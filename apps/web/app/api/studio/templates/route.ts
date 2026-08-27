import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { resolveStudioCompanyId } from '@/lib/studio/access';
import { normalizeStudioCanvas } from '@/lib/studio/types';
import { galleryKindForFormat, type StudioTemplateDomain } from '@/lib/studio/templates';

export const dynamic = 'force-dynamic';

async function authUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  return prisma.user.findUnique({ where: { email: session.user.email } });
}

/** GET /api/studio/templates?companyId= — plantillas de la empresa */
export async function GET(req: NextRequest) {
  const user = await authUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const companyId = await resolveStudioCompanyId(
    user.id,
    req.nextUrl.searchParams.get('companyId'),
  );
  if (!companyId) return NextResponse.json({ error: 'No company' }, { status: 400 });

  try {
    const rows = await prisma.studioTemplate.findMany({
      where: { companyId, isSystem: false },
      orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
    });
    return NextResponse.json({
      templates: rows.map((r) => ({
        key: r.key,
        format: r.format,
        domain: 'general' as StudioTemplateDomain,
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
      })),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: 'Templates unavailable', detail: msg }, { status: 503 });
  }
}

/** POST /api/studio/templates — guardar documento como plantilla de empresa */
export async function POST(req: NextRequest) {
  const user = await authUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const companyId = await resolveStudioCompanyId(
    user.id,
    typeof body.companyId === 'string' ? body.companyId : null,
  );
  if (!companyId) return NextResponse.json({ error: 'No company' }, { status: 400 });

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
  if (!body.canvasState || typeof body.canvasState !== 'object') {
    return NextResponse.json({ error: 'canvasState required' }, { status: 400 });
  }

  const canvas = normalizeStudioCanvas(body.canvasState);
  const key = `company-${Date.now().toString(36)}`;
  const desc =
    typeof body.description === 'string' && body.description.trim()
      ? body.description.trim()
      : 'Plantilla de la empresa';

  try {
    const row = await prisma.studioTemplate.create({
      data: {
        companyId,
        key,
        nameEs: name,
        namePt: name,
        nameEn: name,
        descriptionEs: desc,
        descriptionPt: desc,
        descriptionEn: desc,
        format: canvas.format,
        canvasSeed: canvas,
        isSystem: false,
        sortOrder: 100,
      },
    });
    return NextResponse.json({ template: { key: row.key, id: row.id } }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: 'Failed to save template', detail: msg }, { status: 503 });
  }
}
