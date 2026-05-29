export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { searchLibroOcrText } from '@/lib/forge/libro-search';
import { getForgeDb } from '@/lib/forge/db';
import { loadCourseForTenant, requireForgeTenant } from '@/lib/forge/tenant';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const tenant = await requireForgeTenant();
  if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id: courseId } = await ctx.params;
  const course = await loadCourseForTenant(courseId, tenant);
  if (!course) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (!q) return NextResponse.json({ hits: [], status: course.libroOcrStatus });

  const row = await getForgeDb().forgeCourse.findUnique({
    where: { id: courseId },
    select: { libroOcrText: true, libroOcrStatus: true },
  });

  const hits = searchLibroOcrText(row?.libroOcrText, q);
  return NextResponse.json({
    hits,
    status: row?.libroOcrStatus ?? null,
    ready: row?.libroOcrStatus === 'done',
  });
}
