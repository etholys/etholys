import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { resolveStudioCompanyId } from '@/lib/studio/access';
import { STUDIO_SYSTEM_TEMPLATES, findSystemTemplate } from '@/lib/studio/templates';
import { emptyStudioCanvas, isStudioFormat } from '@/lib/studio/types';
import { prismaHasEnumValue } from '@/lib/prisma-has-field';

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

  const companyId = await resolveStudioCompanyId(
    user.id,
    req.nextUrl.searchParams.get('companyId'),
  );
  if (!companyId) return NextResponse.json({ error: 'No company' }, { status: 400 });

  const folderId = req.nextUrl.searchParams.get('folderId');

  try {
    const [folders, documents] = await Promise.all([
      prisma.studioFolder.findMany({
        where: { companyId, parentId: folderId || null },
        orderBy: { name: 'asc' },
      }),
      prisma.studioDocument.findMany({
        where: { companyId, folderId: folderId || null },
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          title: true,
          format: true,
          status: true,
          folderId: true,
          templateKey: true,
          updatedAt: true,
          createdAt: true,
        },
      }),
    ]);

    const allFolders = await prisma.studioFolder.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, parentId: true },
    });

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
      companyId,
      folderId: folderId || null,
      folders,
      allFolders,
      documents,
      templates,
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
  if (!companyId) return NextResponse.json({ error: 'No company' }, { status: 400 });

  const templateKey = typeof body.templateKey === 'string' ? body.templateKey.trim() : '';
  const title =
    (typeof body.title === 'string' && body.title.trim()) ||
    (templateKey ? findSystemTemplate(templateKey)?.namePt : null) ||
    'Novo documento';
  const folderId = typeof body.folderId === 'string' && body.folderId ? body.folderId : null;
  const formatRaw = typeof body.format === 'string' ? body.format : null;

  const tpl = templateKey ? findSystemTemplate(templateKey) : null;
  const canvas = tpl ? tpl.buildCanvas() : emptyStudioCanvas(isStudioFormat(formatRaw) ? formatRaw : 'report');
  if (isStudioFormat(formatRaw)) canvas.format = formatRaw;
  else if (tpl) canvas.format = tpl.format;

  if (folderId) {
    const folder = await prisma.studioFolder.findFirst({ where: { id: folderId, companyId } });
    if (!folder) return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
  }

  try {
    let aiSessionId: string | null = null;
    try {
      const kind = prismaHasEnumValue('AiAdvisorSessionKind', 'STUDIO_DOC')
        ? 'STUDIO_DOC'
        : 'WORKSPACE_ADVISOR';
      const sess = await prisma.aiAdvisorSession.create({
        data: {
          companyId,
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
        companyId,
        folderId,
        title,
        format: canvas.format,
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
