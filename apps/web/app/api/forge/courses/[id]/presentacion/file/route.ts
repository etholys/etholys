export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { loadCourseForTenant, requireForgeTenant } from '@/lib/forge/tenant';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const tenant = await requireForgeTenant();
  if (!tenant) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id: courseId } = await ctx.params;
  const course = await loadCourseForTenant(courseId, tenant);
  if (!course?.presentationPdfPath) {
    return NextResponse.json({ error: 'Sin PDF' }, { status: 404 });
  }

  if (course.presentationPdfPath.startsWith('uploads/forge-presentaciones/')) {
    const abs = path.join(process.cwd(), 'public', course.presentationPdfPath);
    try {
      const buffer = await fs.readFile(abs);
      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'inline',
          'Cache-Control': 'private, max-age=3600',
          'X-Frame-Options': 'SAMEORIGIN',
        },
      });
    } catch {
      return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 });
    }
  }

  return NextResponse.json({ error: 'PDF no disponible' }, { status: 404 });
}
