import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { sendAuthHtmlEmail } from '@/lib/send-auth-email';
import { parseWorkFolderRole, type WorkFolderRole } from '@/lib/work/folder-access';

function generateToken() {
  return randomBytes(24).toString('hex');
}

function expiresInDays(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

async function emailsForUser(userId: string): Promise<string[]> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  return u?.email ? [u.email.toLowerCase()] : [];
}

export function buildWorkFolderShareUrl(token: string, baseUrl?: string): string {
  const root = (baseUrl || process.env.NEXTAUTH_URL || 'https://app.etholys.com').replace(/\/$/, '');
  return `${root}/work/shared/${encodeURIComponent(token)}`;
}

export async function getWorkFolderShareCompanyIds(userId: string): Promise<string[]> {
  const emails = await emailsForUser(userId);
  const rows = await prisma.workFolderShare.findMany({
    where: {
      status: 'active',
      OR: [{ userId }, ...(emails.length ? [{ email: { in: emails } }] : [])],
    },
    select: { companyId: true, expiresAt: true },
  });
  const now = Date.now();
  return [
    ...new Set(
      rows.filter((r) => !r.expiresAt || r.expiresAt.getTime() > now).map((r) => r.companyId),
    ),
  ];
}

export async function listActiveWorkFolderShareIds(userId: string): Promise<string[]> {
  const emails = await emailsForUser(userId);
  const rows = await prisma.workFolderShare.findMany({
    where: {
      status: 'active',
      OR: [{ userId }, ...(emails.length ? [{ email: { in: emails } }] : [])],
    },
    select: { folderId: true, expiresAt: true },
  });
  const now = Date.now();
  return rows.filter((r) => !r.expiresAt || r.expiresAt.getTime() > now).map((r) => r.folderId);
}

export async function resolveWorkJwtScope(userId: string): Promise<{
  mode: 'member' | 'share_only' | 'none';
  folderIds: string[];
  homePath: string;
}> {
  const membership = await prisma.companyUser.findFirst({
    where: { userId },
    select: { id: true },
  });
  if (membership) {
    return { mode: 'member', folderIds: [], homePath: '/hub/work' };
  }

  const emails = await emailsForUser(userId);
  const shares = await prisma.workFolderShare.findMany({
    where: {
      status: 'active',
      accessMode: 'external_guest',
      OR: [{ userId }, ...(emails.length ? [{ email: { in: emails } }] : [])],
    },
    select: { folderId: true, expiresAt: true },
  });
  const now = Date.now();
  const folderIds = shares
    .filter((s) => !s.expiresAt || s.expiresAt.getTime() > now)
    .map((s) => s.folderId);
  if (folderIds.length === 0) return { mode: 'none', folderIds: [], homePath: '/login' };
  const first = folderIds[0];
  return {
    mode: 'share_only',
    folderIds,
    homePath: `/hub/work?nav=folder&id=${encodeURIComponent(first)}&view=table`,
  };
}

export async function findWorkShareByMagicToken(magic: string) {
  const share = await prisma.workFolderShare.findFirst({
    where: {
      magicLoginToken: magic,
      status: 'active',
      magicLoginExpiresAt: { gt: new Date() },
    },
    include: {
      user: {
        select: { id: true, email: true, name: true, role: true, locale: true, avatar: true, image: true, isActive: true },
      },
      folder: { select: { id: true, name: true } },
    },
  });
  return share;
}

/** Login via o token do convite (URL /work/shared/[token]) — sobrevive após accept limpar/expirar magic. */
export async function findWorkShareByInviteToken(inviteToken: string) {
  const share = await prisma.workFolderShare.findFirst({
    where: { token: inviteToken, status: 'active' },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          locale: true,
          avatar: true,
          image: true,
          isActive: true,
        },
      },
      folder: { select: { id: true, name: true, isActive: true } },
    },
  });
  if (!share?.folder?.isActive) return null;
  if (share.expiresAt && share.expiresAt.getTime() < Date.now()) return null;
  return share;
}

/** Garante magic de login para convidados externos (reabrir o mesmo link do email). */
async function ensureWorkShareMagic(shareId: string, current?: {
  magicLoginToken: string | null;
  magicLoginExpiresAt: Date | null;
}): Promise<{ magicLoginToken: string; magicLoginExpiresAt: Date }> {
  const now = Date.now();
  if (
    current?.magicLoginToken &&
    current.magicLoginExpiresAt &&
    current.magicLoginExpiresAt.getTime() > now
  ) {
    return {
      magicLoginToken: current.magicLoginToken,
      magicLoginExpiresAt: current.magicLoginExpiresAt,
    };
  }
  const magicLoginToken = generateToken();
  const magicLoginExpiresAt = expiresInDays(14);
  await prisma.workFolderShare.update({
    where: { id: shareId },
    data: { magicLoginToken, magicLoginExpiresAt },
  });
  return { magicLoginToken, magicLoginExpiresAt };
}

export async function createWorkFolderShare(opts: {
  companyId: string;
  folderId: string;
  invitedById: string;
  email: string;
  role?: WorkFolderRole;
  sendEmail?: boolean;
}): Promise<{ share: { id: string; token: string; accessMode: string }; inviteUrl: string; emailSent: boolean }> {
  const email = opts.email.trim().toLowerCase();
  if (!email.includes('@')) throw new Error('Email inválido');

  const folder = await prisma.workFolder.findFirst({
    where: { id: opts.folderId, companyId: opts.companyId, isActive: true },
    select: { id: true, name: true, ownerId: true },
  });
  if (!folder) throw new Error('Tablero no encontrado');

  const member = await prisma.companyUser.findFirst({
    where: { companyId: opts.companyId, user: { email } },
    select: { user: { select: { id: true, name: true, email: true } } },
  });

  const accessMode = member ? 'company_member' : 'external_guest';
  let userId = member?.user.id ?? null;
  if (!userId) {
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      const tempPassword = await bcrypt.hash(`work-${Date.now()}-${randomBytes(8).toString('hex')}`, 10);
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

  if (userId === folder.ownerId) throw new Error('El dueño ya tiene acceso');

  const role = parseWorkFolderRole(opts.role, 'viewer');
  const token = generateToken();
  const magicLoginToken = generateToken();

  await prisma.workFolderShare.updateMany({
    where: { folderId: opts.folderId, email, status: 'active' },
    data: { status: 'revoked' },
  });

  const share = await prisma.workFolderShare.create({
    data: {
      companyId: opts.companyId,
      folderId: opts.folderId,
      role: role === 'owner' ? 'editor' : role,
      email,
      userId,
      accessMode,
      token,
      magicLoginToken,
      magicLoginExpiresAt: expiresInDays(14),
      status: 'active',
      invitedById: opts.invitedById,
      expiresAt: expiresInDays(90),
      acceptedAt: accessMode === 'company_member' ? new Date() : null,
    },
  });

  // Company members get folder membership immediately (classic ACL)
  if (accessMode === 'company_member' && userId) {
    await prisma.workFolderMember.upsert({
      where: { folderId_userId: { folderId: opts.folderId, userId } },
      create: { folderId: opts.folderId, userId, role: role === 'editor' ? 'editor' : 'viewer' },
      update: { role: role === 'editor' ? 'editor' : 'viewer' },
    });
  }

  // Any invite (company or external pending) marks the board as shared
  await prisma.workFolder.update({
    where: { id: opts.folderId },
    data: { visibility: 'SHARED' },
  });

  const inviteUrl = buildWorkFolderShareUrl(token);
  const inviter = await prisma.user.findUnique({
    where: { id: opts.invitedById },
    select: { name: true },
  });

  const mail =
    opts.sendEmail === false
      ? { sent: false }
      : await sendAuthHtmlEmail({
          to: email,
          subject: `Etholys eTask — tablero: ${folder.name}`,
          html: `<p>${inviter?.name || 'Alguém'} partilhou consigo o tablero «${folder.name}» no Etholys eTask.</p>
<p><a href="${inviteUrl}">Abrir tablero</a></p>
<p style="color:#64748b;font-size:12px">${
            accessMode === 'external_guest'
              ? 'O seu acesso é limitado apenas a este tablero partilhado.'
              : 'Pode abrir este tablero na sua conta Etholys da empresa.'
          }</p>`,
        });

  return {
    share: { id: share.id, token: share.token, accessMode: share.accessMode },
    inviteUrl,
    emailSent: Boolean(mail.sent),
  };
}

export async function getWorkSharePreview(token: string) {
  const share = await prisma.workFolderShare.findFirst({
    where: { token, status: 'active' },
    select: {
      id: true,
      email: true,
      accessMode: true,
      role: true,
      expiresAt: true,
      magicLoginToken: true,
      magicLoginExpiresAt: true,
      folder: { select: { id: true, name: true } },
      company: { select: { id: true, name: true, shortName: true } },
    },
  });
  if (!share) return null;
  if (share.expiresAt && share.expiresAt.getTime() < Date.now()) return null;

  // Convidados externos precisam de magic válido em cada abertura do link
  // (accept antigo limpava o token → «No autorizado» ao reabrir o convite).
  let magicLoginToken = share.magicLoginToken;
  if (share.accessMode === 'external_guest') {
    const ensured = await ensureWorkShareMagic(share.id, {
      magicLoginToken: share.magicLoginToken,
      magicLoginExpiresAt: share.magicLoginExpiresAt,
    });
    magicLoginToken = ensured.magicLoginToken;
  } else {
    const magicOk =
      share.magicLoginToken &&
      share.magicLoginExpiresAt &&
      share.magicLoginExpiresAt.getTime() > Date.now();
    magicLoginToken = magicOk ? share.magicLoginToken : null;
  }

  return {
    ...share,
    magicLoginToken,
    companyName: share.company.shortName || share.company.name,
  };
}

export async function acceptWorkFolderShare(token: string, userId: string) {
  const share = await prisma.workFolderShare.findFirst({
    where: { token, status: 'active' },
    include: { folder: { select: { id: true, name: true, isActive: true } } },
  });
  if (!share || !share.folder?.isActive) throw new Error('Convite inválido ou expirado');
  if (share.expiresAt && share.expiresAt.getTime() < Date.now()) throw new Error('Convite expirado');

  const emails = await emailsForUser(userId);
  if (share.userId && share.userId !== userId && !emails.includes(share.email.toLowerCase())) {
    throw new Error('Este convite não é para a sua conta');
  }

  // Manter magic activo (como Studio) para o convidado reabrir o mesmo link sem password.
  if (share.accessMode === 'external_guest') {
    await ensureWorkShareMagic(share.id, {
      magicLoginToken: share.magicLoginToken,
      magicLoginExpiresAt: share.magicLoginExpiresAt,
    });
  }

  await prisma.workFolderShare.update({
    where: { id: share.id },
    data: {
      userId,
      acceptedAt: new Date(),
    },
  });

  await prisma.workFolderMember.upsert({
    where: { folderId_userId: { folderId: share.folderId, userId } },
    create: {
      folderId: share.folderId,
      userId,
      role: share.role === 'editor' ? 'editor' : 'viewer',
    },
    update: { role: share.role === 'editor' ? 'editor' : 'viewer' },
  });

  await prisma.workFolder.update({
    where: { id: share.folderId },
    data: { visibility: 'SHARED' },
  });

  return {
    href: `/hub/work?nav=folder&id=${encodeURIComponent(share.folderId)}&view=table`,
    folderId: share.folderId,
    folderName: share.folder.name,
  };
}
