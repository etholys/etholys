import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { resolveStudioCompanyId } from '@/lib/studio/access';
import { resolveTemplatePreviewCanvas } from '@/lib/studio/template-library/resolve-preview';
import { normalizeStudioCanvas } from '@/lib/studio/types';

export const dynamic = 'force-dynamic';

/** GET /api/studio/templates/[key]/preview?companyId= */
export async function GET(
  req: NextRequest,
  { params }: { params: { key: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const key = decodeURIComponent(params.key || '').trim();
  if (!key) return NextResponse.json({ error: 'key required' }, { status: 400 });

  let canvas = resolveTemplatePreviewCanvas(key);
  if (!canvas) {
    const companyId = await resolveStudioCompanyId(user.id, req.nextUrl.searchParams.get('companyId'));
    if (companyId) {
      try {
        const row = await prisma.studioTemplate.findFirst({
          where: { companyId, key },
        });
        if (row?.canvasSeed) canvas = normalizeStudioCanvas(row.canvasSeed);
      } catch {
        /* table may not exist */
      }
    }
  }

  if (!canvas) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

  return NextResponse.json({
    key,
    canvas,
    pageCount: canvas.pages.length,
    studioMode: canvas.studioMode || 'design',
  });
}
