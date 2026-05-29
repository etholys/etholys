export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getForgeDb } from '@/lib/forge/db';
import { getForgeCourseAccess } from '@/lib/forge/facilitator-access';
import { getCourseProgressPercent } from '@/lib/forge/progress';
import { loadCourseForTenant, requireForgeTenant } from '@/lib/forge/tenant';

type Ctx = { params: Promise<{ id: string }> };

function csvEscape(v: string | number | null | undefined): string {
  const s = v == null ? '' : String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const tenant = await requireForgeTenant();
    if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { id: courseId } = await ctx.params;
    const course = await loadCourseForTenant(courseId, tenant);
    if (!course) return NextResponse.json({ error: 'Curso não encontrado' }, { status: 404 });

    const access = await getForgeCourseAccess(
      tenant.userId,
      course.companyId,
      course.id,
      course.createdById
    );
    if (!access.canFacilitate) {
      return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
    }

    const enrollments = await getForgeDb().forgeEnrollment.findMany({
      where: { courseId },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { enrolledAt: 'desc' },
    });

    const header = ['nombre', 'email', 'estado', 'progreso_%', 'matriculado', 'completado'];
    const lines = [header.join(',')];

    for (const e of enrollments) {
      const pct = await getCourseProgressPercent(courseId, e.userId);
      lines.push(
        [
          csvEscape(e.user.name),
          csvEscape(e.user.email),
          csvEscape(e.status),
          csvEscape(pct),
          csvEscape(e.enrolledAt.toISOString()),
          csvEscape(e.completedAt?.toISOString() ?? ''),
        ].join(',')
      );
    }

    const csv = lines.join('\n');
    const filename = `forge-alumnos-${courseId.slice(0, 8)}.csv`;

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
