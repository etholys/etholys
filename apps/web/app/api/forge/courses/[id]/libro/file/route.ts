export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { loadLibroPdfBuffer } from '@/lib/forge/libro-ocr';
import { loadCourseForTenant, requireForgeTenant } from '@/lib/forge/tenant';

type Ctx = { params: Promise<{ id: string }> };

/** PDF inline — JSON 401 se não autorizado (nunca redirect para /login). */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const tenant = await requireForgeTenant();
  if (!tenant) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id: courseId } = await ctx.params;
  const course = await loadCourseForTenant(courseId, tenant);
  if (!course?.libroPdfPath) {
    return NextResponse.json({ error: 'Sin PDF' }, { status: 404 });
  }

  if (course.libroPdfPath.startsWith('uploads/forge-libros/')) {
    const buffer = await loadLibroPdfBuffer(courseId);
    if (!buffer?.length) {
      return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 });
    }
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline',
        'Cache-Control': 'private, max-age=3600',
        'X-Frame-Options': 'SAMEORIGIN',
      },
    });
  }

  const buffer = await loadLibroPdfBuffer(courseId);
  if (buffer?.length) {
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline',
        'Cache-Control': 'private, max-age=300',
        'X-Frame-Options': 'SAMEORIGIN',
      },
    });
  }

  return NextResponse.json({ error: 'PDF no disponible' }, { status: 404 });
}
