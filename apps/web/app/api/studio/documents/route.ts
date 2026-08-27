import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { ALL_STUDIO_TEMPLATES, galleryKindForFormat, serializeStudioTemplate } from '@/lib/studio/templates';
import { createStudioDocument } from '@/lib/studio/create-document';
import { isStudioPageSize, normalizeStudioCanvas } from '@/lib/studio/types';
import { getDocumentAccess, getFolderAccess, listActiveStudioShareTargets } from '@/lib/studio/share';
import {
  canCreateStudioContent,
  canEditStudioContent,
  canManageStudioShares,
  shareRoleToAccess,
  type AccessLevel,
} from '@/lib/studio/share';
import { resolveStudioJwtScope } from '@/lib/studio/share';
import { resolveStudioCompanyId } from '@/lib/studio/access';

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
    let canCreate = false;
    let canManageShares = false;
    let access: AccessLevel = 'none';
    let guestCompanyId: string | null = null;

    if (folderIdParam) {
      const folder = await prisma.studioFolder.findFirst({
        where: { id: folderIdParam },
        select: { id: true, companyId: true, createdById: true, visibility: true, name: true, parentId: true },
      });
      if (!folder) return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
      access = await getFolderAccess(user.id, folder);
      if (access === 'none') {
        return NextResponse.json({ error: 'Sem acesso a esta pasta' }, { status: 403 });
      }
      canEdit = canEditStudioContent(access);
      canCreate = canCreateStudioContent(access);
      canManageShares = canManageStudioShares(access);
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

      // Pais acessíveis (para botão voltar) + alvos partilhados
      const crumbFolders: Array<{ id: string; name: string; parentId: string | null }> = [
        { id: folder.id, name: folder.name, parentId: folder.parentId },
      ];
      if (folder.parentId) {
        const parent = await prisma.studioFolder.findUnique({
          where: { id: folder.parentId },
          select: { id: true, name: true, parentId: true, companyId: true, createdById: true, visibility: true },
        });
        if (parent && (await getFolderAccess(user.id, parent)) !== 'none') {
          crumbFolders.push({ id: parent.id, name: parent.name, parentId: parent.parentId });
        }
      }
      for (const f of shared.folders) {
        if (!crumbFolders.some((c) => c.id === f.id)) {
          crumbFolders.push({ id: f.id, name: f.name, parentId: f.parentId });
        }
      }

      return NextResponse.json({
        companyId: guestCompanyId,
        folderId: folderIdParam,
        folderName: folder.name,
        folderParentId:
          folder.parentId && crumbFolders.some((c) => c.id === folder.parentId) ? folder.parentId : null,
        folders,
        allFolders: crumbFolders,
        documents,
        templates: ALL_STUDIO_TEMPLATES.map(serializeStudioTemplate),
        accessMode: 'share_only',
        access,
        canEdit,
        canCreate,
        canManageShares,
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
        access: shareRoleToAccess(f.role),
      })),
      allFolders: shared.folders.map((f) => ({ id: f.id, name: f.name, parentId: f.parentId })),
      documents: shared.documents.map((d) => ({
        id: d.id,
        title: d.title,
        format: d.format,
        folderId: d.folderId,
        access: shareRoleToAccess(d.role),
      })),
      templates: [],
      accessMode: 'share_only',
      access: 'none',
      canEdit: false,
      canCreate: false,
      canManageShares: false,
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
  let folderParentId: string | null = null;
  let folderAccess: AccessLevel = 'none';
  if (folderId) {
    const folder = await prisma.studioFolder.findFirst({
      where: { id: folderId },
      select: {
        id: true,
        companyId: true,
        createdById: true,
        visibility: true,
        name: true,
        parentId: true,
      },
    });
    if (folder) {
      const access = await getFolderAccess(user.id, folder);
      if (access === 'none') {
        return NextResponse.json({ error: 'Sem acesso a esta pasta' }, { status: 403 });
      }
      resolvedCompanyId = folder.companyId;
      folderName = folder.name;
      folderParentId = folder.parentId;
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
          updatedBy: null as { id: string; name: string | null; email: string } | null,
          access,
        });
      }
    }

    // Enriquecer com updatedBy se a coluna já existir (migração F3.1+)
    try {
      const ids = documents.map((d) => d.id);
      if (ids.length) {
        const withEditors = await prisma.studioDocument.findMany({
          where: { id: { in: ids } },
          select: {
            id: true,
            updatedBy: { select: { id: true, name: true, email: true } },
          },
        });
        const byId = new Map(withEditors.map((x) => [x.id, x.updatedBy]));
        for (const d of documents) {
          const ub = byId.get(d.id);
          if (ub) d.updatedBy = ub;
        }
      }
    } catch {
      /* coluna updatedById ainda não aplicada */
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
          access: shareRoleToAccess(f.role),
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
            access: shareRoleToAccess(roleById.get(d.id) || 'viewer'),
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

    const templates = ALL_STUDIO_TEMPLATES.map(serializeStudioTemplate);
    try {
      const companyTpls = await prisma.studioTemplate.findMany({
        where: { companyId: resolvedCompanyId, isSystem: false },
        orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
      });
      for (const r of companyTpls) {
        templates.push({
          key: r.key,
          format: r.format as never,
          domain: 'general',
          galleryKind: galleryKindForFormat(r.format as never),
          nameEs: r.nameEs,
          namePt: r.namePt,
          nameEn: r.nameEn,
          descriptionEs: r.descriptionEs || '',
          descriptionPt: r.descriptionPt || '',
          descriptionEn: r.descriptionEn || '',
          sortOrder: r.sortOrder,
          isSystem: false,
          isCompany: true,
        } as ReturnType<typeof serializeStudioTemplate> & { isCompany: boolean });
      }
    } catch {
      // tabela pode não existir ainda
    }

    return NextResponse.json({
      companyId: resolvedCompanyId,
      folderId: folderId || null,
      folderName,
      folderParentId,
      folders,
      allFolders,
      documents,
      templates,
      accessMode: 'member',
      access: folderAccess,
      canEdit: canEditStudioContent(folderAccess),
      canCreate: folderId ? canCreateStudioContent(folderAccess) : true,
      canManageShares: canManageStudioShares(folderAccess),
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

/** POST /api/studio/documents — create document (optional folder / canvasState) */
export async function POST(req: NextRequest) {
  const user = await authUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const canvasState =
    body.canvasState && typeof body.canvasState === 'object'
      ? normalizeStudioCanvas(body.canvasState)
      : null;

  const created = await createStudioDocument({
    userId: user.id,
    companyId: typeof body.companyId === 'string' ? body.companyId : null,
    folderId: typeof body.folderId === 'string' && body.folderId ? body.folderId : null,
    title: typeof body.title === 'string' ? body.title : undefined,
    templateKey: typeof body.templateKey === 'string' ? body.templateKey : undefined,
    format: typeof body.format === 'string' ? body.format : null,
    pageSize: typeof body.pageSize === 'string' && isStudioPageSize(body.pageSize) ? body.pageSize : null,
    studioMode:
      body.studioMode === 'write' || body.studioMode === 'design' ? body.studioMode : null,
    canvasState,
  });

  if (!created.ok) {
    return NextResponse.json({ error: created.error }, { status: created.status });
  }
  return NextResponse.json({ document: created.document }, { status: 201 });
}
