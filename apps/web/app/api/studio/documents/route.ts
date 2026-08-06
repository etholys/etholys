import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { resolveStudioCompanyId } from '@/lib/studio/access';
import { STUDIO_SYSTEM_TEMPLATES, findSystemTemplate } from '@/lib/studio/templates';
import { emptyStudioCanvas, isStudioFormat } from '@/lib/studio/types';
import { prismaHasEnumValue } from '@/lib/prisma-has-field';
import { getDocumentAccess, getFolderAccess, listActiveStudioShareTargets } from '@/lib/studio/share';
import { resolveStudioJwtScope } from '@/lib/studio/share';

export const dynamic = 'force-dynamic';

async function authUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  return prisma.user.findUnique({ where: { email: session.user.email } });
}

/** GET /api/studio/documents — list folders + documents (+ templates) */
export async function GET(req: NextRequest) {
  const user = await authUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const scope = await resolveStudioJwtScope(user.id);
  if (scope.mode === 'none') {
    return NextResponse.json({ error: 'Sem acesso ao Studio' }, { status: 403 });
  }

  // Convidado externo: só vê alvos partilhados (+ conteúdo dentro das pastas partilhadas)
  if (scope.mode === 'share_only') {
    const folderIdParam = req.nextUrl.searchParams.get('folderId');
    const shared = await listActiveStudioShareTargets(user.id);
    const folderTargets = shared.folders.map((f) => f.id);
    const docTargets = shared.documents.map((d) => d.id);

    let canEdit = false;
    let guestCompanyId: string | null = null;

    if (folderIdParam) {
      const folder = await prisma.studioFolder.findFirst({
        where: { id: folderIdParam },
        select: { id: true, companyId: true, createdById: true, visibility: true, name: true },
      });
      if (!folder) return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
      const access = await getFolderAccess(user.id, folder);
      if (access === 'none') {
        return NextResponse.json({ error: 'Sem acesso a esta pasta' }, { status: 403 });
      }
      canEdit = access === 'owner' || access === 'editor';
      guestCompanyId = folder.companyId;

      // Filhos e docs DENTRO da pasta partilhada (não só o alvo em si)
      const [rawChildren, rawDocs] = await Promise.all([
        prisma.studioFolder.findMany({
          where: { parentId: folderIdParam },
          orderBy: { name: 'asc' },
        }),
        prisma.studioDocument.findMany({
          where: { folderId: folderIdParam },
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            title: true,
            format: true,
            status: true,
            folderId: true,
            templateKey: true,
            visibility: true,
            updatedAt: true,
            createdAt: true,
            createdById: true,
            companyId: true,
          },
        }),
      ]);

      const folders = [];
      for (const f of rawChildren) {
        const a = await getFolderAccess(user.id, f);
        if (a !== 'none') folders.push({ ...f, access: a });
      }
      const documents = [];
      for (const d of rawDocs) {
        const a = await getDocumentAccess(user.id, d);
        if (a !== 'none') documents.push({ ...d, access: a });
      }

      return NextResponse.json({
        companyId: guestCompanyId,
        folderId: folderIdParam,
        folderName: folder.name,
        folders,
        allFolders: shared.folders.map((f) => ({ id: f.id, name: f.name, parentId: f.parentId })),
        documents,
        templates: STUDIO_SYSTEM_TEMPLATES.map((t) => ({
          key: t.key,
          format: t.format,
          nameEs: t.nameEs,
          namePt: t.namePt,
          nameEn: t.nameEn,
          descriptionEs: t.descriptionEs,
          descriptionPt: t.descriptionPt,
          descriptionEn: t.descriptionEn,
          sortOrder: t.sortOrder,
          isSystem: true,
        })),
        accessMode: 'share_only',
        canEdit,
      });
    }

    // Raiz do convidado: pastas/docs explicitamente partilhados
    guestCompanyId = await resolveStudioCompanyId(user.id, null);
    return NextResponse.json({
      companyId: guestCompanyId,
      folderId: null,
      folders: shared.folders.map((f) => ({
        id: f.id,
        name: f.name,
        parentId: f.parentId,
        access: f.role === 'editor' ? 'editor' : 'viewer',
      })),
      allFolders: shared.folders.map((f) => ({ id: f.id, name: f.name, parentId: f.parentId })),
      documents: shared.documents.map((d) => ({
        id: d.id,
        title: d.title,
        format: d.format,
        folderId: d.folderId,
        access: d.role === 'editor' ? 'editor' : 'viewer',
      })),
      templates: [],
      accessMode: 'share_only',
      canEdit: false,
    });
  }

  const companyId = await resolveStudioCompanyId(
    user.id,
    req.nextUrl.searchParams.get('companyId'),
  );
  const folderId = req.nextUrl.searchParams.get('folderId');

  // Se pediu uma pasta concreta, usar a empresa dessa pasta (evita falhar com multi-empresa)
  let resolvedCompanyId = companyId;
  let folderName: string | null = null;
  let folderAccess: 'none' | 'viewer' | 'editor' | 'owner' = 'none';
  if (folderId) {
    const folder = await prisma.studioFolder.findFirst({
      where: { id: folderId },
      select: { id: true, companyId: true, createdById: true, visibility: true, name: true },
    });
    if (folder) {
      const access = await getFolderAccess(user.id, folder);
      if (access === 'none') {
        return NextResponse.json({ error: 'Sem acesso a esta pasta' }, { status: 403 });
      }
      resolvedCompanyId = folder.companyId;
      folderName = folder.name;
      folderAccess = access;
    }
  }

  if (!resolvedCompanyId) return NextResponse.json({ error: 'No company' }, { status: 400 });

  try {
    const [rawFolders, rawDocuments, allFoldersRaw] = await Promise.all([
      prisma.studioFolder.findMany({
        where: { companyId: resolvedCompanyId, parentId: folderId || null },
        orderBy: { name: 'asc' },
      }),
      prisma.studioDocument.findMany({
        where: { companyId: resolvedCompanyId, folderId: folderId || null },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.studioFolder.findMany({
        where: { companyId: resolvedCompanyId },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, parentId: true, createdById: true, visibility: true, companyId: true },
      }),
    ]);

    const folders = [];
    for (const f of rawFolders) {
      const access = await getFolderAccess(user.id, f);
      if (access !== 'none') folders.push({ ...f, access });
    }

    const documents = [];
    for (const d of rawDocuments) {
      const access = await getDocumentAccess(user.id, d);
      if (access !== 'none') {
        documents.push({
          id: d.id,
          title: d.title,
          format: d.format,
          status: d.status,
          folderId: d.folderId,
          templateKey: d.templateKey,
          visibility: d.visibility,
          updatedAt: d.updatedAt,
          createdAt: d.createdAt,
          access,
        });
      }
    }

    // Na raiz: incluir pastas/docs partilhados mesmo que estejam aninhados (fora da raiz)
    const shared = !folderId ? await listActiveStudioShareTargets(user.id) : { folders: [], documents: [] };
    if (!folderId) {
      const seenF = new Set(folders.map((f) => f.id));
      const seenD = new Set(documents.map((d) => d.id));
      for (const f of shared.folders) {
        if (seenF.has(f.id)) continue;
        folders.push({
          id: f.id,
          name: f.name,
          parentId: f.parentId,
          companyId: f.companyId,
          visibility: 'private',
          createdById: null as string | null,
          createdAt: new Date(),
          updatedAt: new Date(),
          access: f.role === 'editor' ? 'editor' : 'viewer',
        });
        seenF.add(f.id);
      }
      if (shared.documents.length) {
        const sharedDocs = await prisma.studioDocument.findMany({
          where: { id: { in: shared.documents.map((d) => d.id) } },
          select: {
            id: true,
            title: true,
            format: true,
            status: true,
            folderId: true,
            templateKey: true,
            visibility: true,
            updatedAt: true,
            createdAt: true,
          },
        });
        const roleById = new Map(shared.documents.map((d) => [d.id, d.role]));
        for (const d of sharedDocs) {
          if (seenD.has(d.id)) continue;
          documents.push({
            ...d,
            access: roleById.get(d.id) === 'editor' ? 'editor' : 'viewer',
          });
          seenD.add(d.id);
        }
      }
    }

    const allFolders = [];
    for (const f of allFoldersRaw) {
      const access = await getFolderAccess(user.id, f);
      if (access !== 'none') allFolders.push({ id: f.id, name: f.name, parentId: f.parentId });
    }
    if (!folderId) {
      const seen = new Set(allFolders.map((f) => f.id));
      for (const f of shared.folders) {
        if (seen.has(f.id)) continue;
        allFolders.push({ id: f.id, name: f.name, parentId: f.parentId });
      }
    }

    const templates = STUDIO_SYSTEM_TEMPLATES.map((t) => ({
      key: t.key,
      format: t.format,
      nameEs: t.nameEs,
      namePt: t.namePt,
      nameEn: t.nameEn,
      descriptionEs: t.descriptionEs,
      descriptionPt: t.descriptionPt,
      descriptionEn: t.descriptionEn,
      sortOrder: t.sortOrder,
      isSystem: true,
    }));

    return NextResponse.json({
      companyId: resolvedCompanyId,
      folderId: folderId || null,
      folderName,
      folders,
      allFolders,
      documents,
      templates,
      accessMode: 'member',
      canEdit: folderAccess === 'owner' || folderAccess === 'editor',
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[GET /api/studio/documents]', e);
    return NextResponse.json(
      {
        error: 'Studio schema missing or DB error',
        detail: msg,
        hint: 'Apply apps/web/prisma/migrations/manual_etholys_studio.sql then prisma generate',
      },
      { status: 503 },
    );
  }
}

/** POST /api/studio/documents — create document (optional folder) */
export async function POST(req: NextRequest) {
  const user = await authUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const companyId = await resolveStudioCompanyId(
    user.id,
    typeof body.companyId === 'string' ? body.companyId : null,
  );

  const templateKey = typeof body.templateKey === 'string' ? body.templateKey.trim() : '';
  const title =
    (typeof body.title === 'string' && body.title.trim()) ||
    (templateKey ? findSystemTemplate(templateKey)?.namePt : null) ||
    'Novo documento';
  const folderId = typeof body.folderId === 'string' && body.folderId ? body.folderId : null;
  const formatRaw = typeof body.format === 'string' ? body.format : null;

  // Convidado com pasta partilhada: companyId vem da pasta se ainda não resolvido
  let resolvedCompanyId = companyId;
  if (folderId) {
    const folder = await prisma.studioFolder.findFirst({ where: { id: folderId } });
    if (!folder) return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    const access = await getFolderAccess(user.id, folder);
    if (access !== 'owner' && access !== 'editor') {
      return NextResponse.json({ error: 'Sem permissão para criar nesta pasta' }, { status: 403 });
    }
    if (!resolvedCompanyId) resolvedCompanyId = folder.companyId;
    else if (resolvedCompanyId !== folder.companyId) {
      // Preferir a empresa da pasta partilhada
      resolvedCompanyId = folder.companyId;
    }
  }

  if (!resolvedCompanyId) return NextResponse.json({ error: 'No company' }, { status: 400 });

  const tpl = templateKey ? findSystemTemplate(templateKey) : null;
  const canvas = tpl ? tpl.buildCanvas() : emptyStudioCanvas(isStudioFormat(formatRaw) ? formatRaw : 'report');
  if (isStudioFormat(formatRaw)) canvas.format = formatRaw;
  else if (tpl) canvas.format = tpl.format;

  try {
    let aiSessionId: string | null = null;
    try {
      const kind = prismaHasEnumValue('AiAdvisorSessionKind', 'STUDIO_DOC')
        ? 'STUDIO_DOC'
        : 'WORKSPACE_ADVISOR';
      const sess = await prisma.aiAdvisorSession.create({
        data: {
          companyId: resolvedCompanyId,
          userId: user.id,
          title: `Studio: ${title}`.slice(0, 120),
          kind: kind as 'STUDIO_DOC' | 'WORKSPACE_ADVISOR',
        },
      });
      aiSessionId = sess.id;
    } catch (e) {
      console.warn('[studio] ai session create skipped', e);
    }

    const doc = await prisma.studioDocument.create({
      data: {
        companyId: resolvedCompanyId,
        folderId,
        title,
        format: canvas.format,
        visibility: 'private',
        canvasState: canvas,
        templateKey: templateKey || null,
        aiSessionId,
        createdById: user.id,
      },
    });

    return NextResponse.json({ document: doc }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[POST /api/studio/documents]', e);
    return NextResponse.json({ error: 'Failed to create document', detail: msg }, { status: 503 });
  }
}
