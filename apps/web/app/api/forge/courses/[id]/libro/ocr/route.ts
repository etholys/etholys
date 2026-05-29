export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getForgeCourseAccess } from '@/lib/forge/facilitator-access';
import { runLibroOcr } from '@/lib/forge/libro-ocr';
import { loadCourseForTenant, requireForgeTenant } from '@/lib/forge/tenant';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, ctx: Ctx) {
  const tenant = await requireForgeTenant();
  if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id: courseId } = await ctx.params;
  const course = await loadCourseForTenant(courseId, tenant);
  if (!course) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  const access = await getForgeCourseAccess(
    tenant.userId,
    course.companyId,
    course.id,
    course.createdById
  );
  if (!access.canFacilitate) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
  }

  const result = await runLibroOcr(courseId);
  return NextResponse.json(result);
}
