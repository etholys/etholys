import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { resolveStudioCompanyId } from '@/lib/studio/access';
import { getStudioBrandKit } from '@/lib/studio/brand';
import {
  htmlToPdfViaAbacus,
  studioCanvasToDocxBuffer,
  studioCanvasToHtml,
} from '@/lib/studio/export';
import {
  normalizeStudioCanvas,
  normalizeStudioMargins,
  type StudioCanvasState,
} from '@/lib/studio/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 180;

/** POST /api/studio/documents/[id]/export — { format: 'pdf' | 'docx' } */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const companyId = await resolveStudioCompanyId(
    user.id,
    typeof body.companyId === 'string' ? body.companyId : null,
  );
  if (!companyId) return NextResponse.json({ error: 'No company' }, { status: 400 });

  const format = body.format === 'docx' ? 'docx' : 'pdf';
  const doc = await prisma.studioDocument.findFirst({
    where: { id: params.id, companyId },
  });
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let canvas = doc.canvasState as StudioCanvasState;
  if (body.canvasState && typeof body.canvasState === 'object') {
    canvas = body.canvasState as StudioCanvasState;
  }
  const title =
    typeof body.title === 'string' && body.title.trim() ? body.title.trim() : doc.title;

  const brand = await getStudioBrandKit(companyId);
  const safeName = title.replace(/[^\w\-]+/g, '_').slice(0, 60) || 'studio-doc';

  try {
    if (format === 'docx') {
      const buf = await studioCanvasToDocxBuffer(title, canvas, brand);
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="${safeName}.docx"`,
        },
      });
    }

    const normalized = normalizeStudioCanvas(canvas);
    const html = studioCanvasToHtml(title, normalized, brand);
    const margins = normalizeStudioMargins(normalized.marginsMm);
    const size = normalized.pageSize || 'A4';
    const pdfFormat =
      size === 'Letter' || size === 'Legal' || size === 'A3' || size === 'A5' ? size : 'A4';
    const pdf = await htmlToPdfViaAbacus(html, {
      format: pdfFormat,
      landscape: normalized.orientation === 'landscape' || size === 'Slide',
      margin: {
        top: `${margins.top}mm`,
        right: `${margins.right}mm`,
        bottom: `${margins.bottom}mm`,
        left: `${margins.left}mm`,
      },
    });
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safeName}.pdf"`,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[studio export]', e);
    return NextResponse.json({ error: 'Export failed', detail: msg }, { status: 502 });
  }
}
