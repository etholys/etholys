import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { sendAuthHtmlEmail } from '@/lib/send-auth-email';
import type { StudioShareTargetRef } from '@/lib/studio/share-guard';

export type StudioShareRole = 'viewer' | 'editor' | 'admin';
export type StudioVisibility = 'company' | 'private';
export type AccessLevel = 'none' | 'viewer' | 'editor' | 'admin' | 'owner';

export const STUDIO_SHARE_ROLES: StudioShareRole[] = ['viewer', 'editor', 'admin'];

export function parseStudioShareRole(raw: unknown, fallback: StudioShareRole = 'editor'): StudioShareRole {
  if (raw === 'viewer' || raw === 'editor' || raw === 'admin') return raw;
  return fallback;
}

export function shareRoleToAccess(role: string): AccessLevel {
  if (role === 'admin') return 'admin';
  if (role === 'editor') return 'editor';
  if (role === 'viewer') return 'viewer';
  return 'viewer';
}

function better(a: AccessLevel, b: AccessLevel): AccessLevel {
  const rank: Record<AccessLevel, number> = {
    none: 0,
    viewer: 1,
    editor: 2,
    admin: 3,
    owner: 4,
  };
  return rank[a] >= rank[b] ? a : b;
}

export function canReadStudio(access: AccessLevel): boolean {
  return access !== 'none';
}

export function canCreateStudioContent(access: AccessLevel): boolean {
  return access === 'editor' || access === 'admin' || access === 'owner';
}

export function canEditStudioContent(access: AccessLevel): boolean {
  return access === 'editor' || access === 'admin' || access === 'owner';
}

export function canManageStudioShares(access: AccessLevel): boolean {
  return access === 'admin' || access === 'owner';
}

export function canRenameStudio(access: AccessLevel): boolean {
  return access === 'admin' || access === 'owner';
}

export function canChangeStudioVisibility(access: AccessLevel): boolean {
  return access === 'owner';
}

/** Pastas: só o dono. */
export function canDeleteStudioItem(access: AccessLevel): boolean {
  return access === 'owner';
}

/** Documentos: dono do doc ou admin (ex. admin/dono da pasta). */
export function canDeleteStudioDocument(access: AccessLevel): boolean {
  return access === 'owner' || access === 'admin';
}

export function generateStudioShareToken(): string {
  return randomBytes(24).toString('base64url');
}

export function studioShareExpiresAt(days = 60): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

export function buildStudioShareUrl(token: string, baseUrl?: string): string {
  const root = (baseUrl || process.env.NEXTAUTH_URL || 'https://app.etholys.com').replace(/\/$/, '');
  return `${root}/studio/shared/${encodeURIComponent(token)}`;
}

export async function resolveStudioJwtScope(userId: string): Promise<{
  mode: 'member' | 'share_only' | 'none';
  targets: StudioShareTargetRef[];
  homePath: string;
}> {
  const membership = await prisma.companyUser.findFirst({
    where: { userId },
    select: { id: true },
  });
  if (membership) {
    return { mode: 'member', targets: [], homePath: '/hub/studio' };
  }

  const shares = await prisma.studioShare.findMany({
    where: {
      status: 'active',
      accessMode: 'external_guest',
      OR: [{ userId }, { email: { in: await emailsForUser(userId) } }],
    },
    select: { targetType: true, folderId: true, documentId: true, expiresAt: true },
  });

  const now = Date.now();
  const targets: StudioShareTargetRef[] = [];
  for (const s of shares) {
    if (s.expiresAt && s.expiresAt.getTime() < now) continue;
    if (s.targetType === 'folder' && s.folderId) {
      targets.push({ type: 'folder', id: s.folderId });
    } else if (s.targetType === 'document' && s.documentId) {
      targets.push({ type: 'document', id: s.documentId });
    }
  }

  if (targets.length === 0) return { mode: 'none', targets: [], homePath: '/login' };

  const { defaultStudioShareOnlyHome } = await import('@/lib/studio/share-guard');
  return {
    mode: 'share_only',
    targets,
    homePath: defaultStudioShareOnlyHome(targets),
  };
}

async function emailsForUser(userId: string): Promise<string[]> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  return u?.email ? [u.email.toLowerCase()] : [];
}

/** Partilhas activas (internas ou externas) do utilizador — pastas e documentos. */
export async function listActiveStudioShareTargets(userId: string): Promise<{
  folders: Array<{ id: string; name: string; companyId: string; parentId: string | null; role: string }>;
  documents: Array<{
    id: string;
    title: string;
    format: string;
    folderId: string | null;
    companyId: string;
    role: string;
  }>;
}> {
  const emails = await emailsForUser(userId);
  const shares = await prisma.studioShare.findMany({
    where: {
      status: 'active',
      OR: [{ userId }, ...(emails.length ? [{ email: { in: emails } }] : [])],
    },
    select: {
      role: true,
      expiresAt: true,
      targetType: true,
      folder: { select: { id: true, name: true, companyId: true, parentId: true } },
      document: {
        select: { id: true, title: true, format: true, folderId: true, companyId: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const now = Date.now();
  const folders: Array<{
    id: string;
    name: string;
    companyId: string;
    parentId: string | null;
    role: string;
  }> = [];
  const documents: Array<{
    id: string;
    title: string;
    format: string;
    folderId: string | null;
    companyId: string;
    role: string;
  }> = [];
  const seenF = new Set<string>();
  const seenD = new Set<string>();

  for (const s of shares) {
    if (s.expiresAt && s.expiresAt.getTime() < now) continue;
    if (s.targetType === 'folder' && s.folder && !seenF.has(s.folder.id)) {
      seenF.add(s.folder.id);
      folders.push({ ...s.folder, role: s.role });
    }
    if (s.targetType === 'document' && s.document && !seenD.has(s.document.id)) {
      seenD.add(s.document.id);
      documents.push({ ...s.document, role: s.role });
    }
  }

  return { folders, documents };
}

export async function isCompanyMember(userId: string, companyId: string): Promise<boolean> {
  const row = await prisma.companyUser.findUnique({
    where: { userId_companyId: { userId, companyId } },
    select: { id: true },
  });
  return Boolean(row);
}

export async function listCompanyMembersForShare(companyId: string) {
  // Select explícito: `include` traria todas as colunas de CompanyUser e quebra
  // se a BD estiver atrasada em relação ao schema.
  const rows = await prisma.companyUser.findMany({
    where: { companyId },
    select: {
      role: true,
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
  return rows
    .filter((r) => r.user?.email)
    .map((r) => ({
      userId: r.user.id,
      name: r.user.name,
      email: r.user.email,
      role: r.role,
    }));
}

/** Sem dono (conta apagada): admins da empresa recuperam o conteúdo — evita ficheiros órfãos. */
async function isCompanyAdmin(userId: string, companyId: string): Promise<boolean> {
  const row = await prisma.companyUser.findUnique({
    where: { userId_companyId: { userId, companyId } },
    select: { role: true },
  });
  return row?.role === 'ADMIN';
}

export async function getFolderAccess(
  userId: string,
  folder: { id: string; companyId: string; createdById: string | null; visibility: string },
): Promise<AccessLevel> {
  if (folder.createdById === userId) return 'owner';
  if (!folder.createdById && (await isCompanyAdmin(userId, folder.companyId))) return 'owner';

  const member = await isCompanyMember(userId, folder.companyId);
  if (member && folder.visibility === 'company') return 'editor';

  const share = await prisma.studioShare.findFirst({
    where: {
      status: 'active',
      targetType: 'folder',
      folderId: folder.id,
      OR: [{ userId }, { email: { in: await emailsForUser(userId) } }],
    },
    select: { role: true, expiresAt: true },
  });
  if (share && (!share.expiresAt || share.expiresAt.getTime() > Date.now())) {
    return shareRoleToAccess(share.role);
  }

  // Partilha de pasta ancestral?
  const ancestors = await getFolderAncestorIds(folder.id);
  if (ancestors.length) {
    const parentShare = await prisma.studioShare.findFirst({
      where: {
        status: 'active',
        targetType: 'folder',
        folderId: { in: ancestors },
        OR: [{ userId }, { email: { in: await emailsForUser(userId) } }],
      },
      select: { role: true, expiresAt: true },
    });
    if (parentShare && (!parentShare.expiresAt || parentShare.expiresAt.getTime() > Date.now())) {
      return shareRoleToAccess(parentShare.role);
    }
  }

  return 'none';
}

async function getFolderAncestorIds(folderId: string): Promise<string[]> {
  const ids: string[] = [];
  let cur: string | null = folderId;
  for (let i = 0; i < 20 && cur; i++) {
    const f: { parentId: string | null } | null = await prisma.studioFolder.findUnique({
      where: { id: cur },
      select: { parentId: true },
    });
    if (!f?.parentId) break;
    ids.push(f.parentId);
    cur = f.parentId;
  }
  return ids;
}

export async function getDocumentAccess(
  userId: string,
  doc: {
    id: string;
    companyId: string;
    folderId: string | null;
    createdById: string | null;
    visibility: string;
  },
): Promise<AccessLevel> {
  if (doc.createdById === userId) return 'owner';
  if (!doc.createdById && (await isCompanyAdmin(userId, doc.companyId))) return 'owner';

  const member = await isCompanyMember(userId, doc.companyId);
  if (member && doc.visibility === 'company') return 'editor';

  let level: AccessLevel = 'none';

  const share = await prisma.studioShare.findFirst({
    where: {
      status: 'active',
      targetType: 'document',
      documentId: doc.id,
      OR: [{ userId }, { email: { in: await emailsForUser(userId) } }],
    },
    select: { role: true, expiresAt: true },
  });
  if (share && (!share.expiresAt || share.expiresAt.getTime() > Date.now())) {
    level = better(level, shareRoleToAccess(share.role));
  }

  if (doc.folderId) {
    const folder = await prisma.studioFolder.findUnique({
      where: { id: doc.folderId },
      select: { id: true, companyId: true, createdById: true, visibility: true },
    });
    if (folder) {
      const fa = await getFolderAccess(userId, folder);
      // Pasta: owner no folder → admin no doc (pode gerir partilhas do doc via pasta)
      if (fa === 'owner') level = better(level, 'admin');
      else if (fa !== 'none') level = better(level, fa);
    }
  }

  return level;
}

export async function createStudioShare(opts: {
  companyId: string;
  invitedById: string;
  targetType: 'folder' | 'document';
  folderId?: string | null;
  documentId?: string | null;
  email: string;
  role?: StudioShareRole;
  /** Se true, força guest externo mesmo que seja membro */
  forceExternal?: boolean;
  /** Se false, cria a partilha sem enviar email — o convite é entregue como link copiado */
  sendEmail?: boolean;
}): Promise<{ share: { id: string; token: string; accessMode: string }; inviteUrl: string; emailSent: boolean }> {
  const email = opts.email.trim().toLowerCase();
  if (!email.includes('@')) throw new Error('Email inválido');

  const member = await prisma.companyUser.findFirst({
    where: { companyId: opts.companyId, user: { email } },
    select: { user: { select: { id: true, name: true, email: true } } },
  });

  const accessMode =
    opts.forceExternal || !member ? 'external_guest' : 'company_member';

  let userId = member?.user.id ?? null;
  if (!userId) {
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      const tempPassword = await bcrypt.hash(`studio-${Date.now()}-${randomBytes(8).toString('hex')}`, 10);
      user = await prisma.user.create({
        data: {
          email,
          name: email.split('@')[0],
          password: tempPassword,
        },
      });
    }
    userId = user.id;
  }

  const token = generateStudioShareToken();
  const magicLoginToken = generateStudioShareToken();
  const magicLoginExpiresAt = studioShareExpiresAt(14);

  // Revogar partilha anterior ativa do mesmo alvo+email
  await prisma.studioShare.updateMany({
    where: {
      companyId: opts.companyId,
      targetType: opts.targetType,
      email,
      status: 'active',
      ...(opts.targetType === 'folder'
        ? { folderId: opts.folderId || undefined }
        : { documentId: opts.documentId || undefined }),
    },
    data: { status: 'revoked' },
  });

  const share = await prisma.studioShare.create({
    data: {
      companyId: opts.companyId,
      targetType: opts.targetType,
      folderId: opts.targetType === 'folder' ? opts.folderId || null : null,
      documentId: opts.targetType === 'document' ? opts.documentId || null : null,
      role: parseStudioShareRole(opts.role, 'editor'),
      email,
      userId,
      accessMode,
      token,
      magicLoginToken,
      magicLoginExpiresAt,
      status: 'active',
      invitedById: opts.invitedById,
      expiresAt: studioShareExpiresAt(90),
      acceptedAt: accessMode === 'company_member' ? new Date() : null,
    },
  });

  const inviteUrl = buildStudioShareUrl(token);
  let targetLabel = 'documento Studio';
  if (opts.targetType === 'folder' && opts.folderId) {
    const f = await prisma.studioFolder.findUnique({ where: { id: opts.folderId }, select: { name: true } });
    targetLabel = f?.name ? `pasta «${f.name}»` : 'pasta Studio';
  } else if (opts.documentId) {
    const d = await prisma.studioDocument.findUnique({ where: { id: opts.documentId }, select: { title: true } });
    targetLabel = d?.title ? `documento «${d.title}»` : 'documento Studio';
  }

  const inviter = await prisma.user.findUnique({
    where: { id: opts.invitedById },
    select: { name: true },
  });

  const mail =
    opts.sendEmail === false
      ? { sent: false }
      : await sendAuthHtmlEmail({
          to: email,
          subject: `Etholys Studio — partilha: ${targetLabel}`,
          html: `<p>${inviter?.name || 'Alguém'} partilhou consigo ${targetLabel} no Etholys Studio.</p>
<p><a href="${inviteUrl}">Abrir partilha</a></p>
<p style="color:#64748b;font-size:12px">${
            accessMode === 'external_guest'
              ? 'O seu acesso é limitado apenas a este conteúdo partilhado.'
              : 'Pode abrir este conteúdo na sua conta Etholys da empresa.'
          }</p>`,
        });

  return {
    share: { id: share.id, token: share.token, accessMode: share.accessMode },
    inviteUrl,
    emailSent: mail.sent,
  };
}

export async function updateStudioShareRole(shareId: string, role: StudioShareRole) {
  return prisma.studioShare.update({
    where: { id: shareId },
    data: { role: parseStudioShareRole(role) },
    select: {
      id: true,
      email: true,
      role: true,
      accessMode: true,
      status: true,
      token: true,
      user: { select: { id: true, name: true } },
    },
  });
}

export async function findShareByMagicToken(magic: string) {
  const share = await prisma.studioShare.findFirst({
    where: {
      magicLoginToken: magic,
      status: 'active',
    },
    include: {
      user: true,
    },
  });
  if (!share?.user) return null;
  if (share.magicLoginExpiresAt && share.magicLoginExpiresAt.getTime() < Date.now()) return null;
  if (share.expiresAt && share.expiresAt.getTime() < Date.now()) return null;
  return share;
}

export async function acceptShareByToken(token: string, userId?: string | null) {
  const share = await prisma.studioShare.findFirst({
    where: { token, status: 'active' },
    include: {
      document: { select: { id: true, title: true } },
      folder: { select: { id: true, name: true } },
      user: { select: { id: true, email: true } },
    },
  });
  if (!share) return null;
  if (share.expiresAt && share.expiresAt.getTime() < Date.now()) return null;

  if (userId && share.userId && share.userId !== userId) {
    // Ligar ao utilizador autenticado se o email coincidir
  }

  await prisma.studioShare.update({
    where: { id: share.id },
    data: {
      acceptedAt: share.acceptedAt || new Date(),
      ...(userId && !share.userId ? { userId } : {}),
    },
  });

  return share;
}
