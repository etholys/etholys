export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getForgeDb } from '@/lib/forge/db';
import { getForgeCourseAccess } from '@/lib/forge/facilitator-access';
import { loadCourseForTenant, requireForgeTenant } from '@/lib/forge/tenant';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const tenant = await requireForgeTenant();
  if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { id: courseId } = await ctx.params;
  const course = await loadCourseForTenant(courseId, tenant);
  if (!course) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  const access = await getForgeCourseAccess(
    tenant.userId,
    course.companyId,
    course.id,
    course.createdById
  );
  if (!access.isOrgAdmin && !access.canFacilitate) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
  }

  const rows = await getForgeDb().forgeCourseFacilitator.findMany({
    where: { courseId },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  return NextResponse.json({
    facilitators: rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      role: r.role,
      name: r.user.name,
      email: r.user.email,
    })),
  });
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const tenant = await requireForgeTenant();
  if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { id: courseId } = await ctx.params;
  const course = await loadCourseForTenant(courseId, tenant);
  if (!course) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  const access = await getForgeCourseAccess(
    tenant.userId,
    course.companyId,
    course.id,
    course.createdById
  );
  if (!access.isOrgAdmin) {
    return NextResponse.json({ error: 'Solo admin de la org' }, { status: 403 });
  }

  const body = (await req.json()) as { email?: string; role?: string };
  const email = body.email?.trim().toLowerCase();
  if (!email) return NextResponse.json({ error: 'email requerido' }, { status: 400 });

  const user = await getForgeDb().user.findUnique({ where: { email } });
  if (!user) return NextResponse.json({ error: 'Usuario no existe' }, { status: 404 });

  const row = await getForgeDb().forgeCourseFacilitator.upsert({
    where: { courseId_userId: { courseId, userId: user.id } },
    create: { courseId, userId: user.id, role: body.role === 'assistant' ? 'assistant' : 'facilitator' },
    update: { role: body.role === 'assistant' ? 'assistant' : 'facilitator' },
  });

  return NextResponse.json({ ok: true, id: row.id });
}
