export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getForgeCourseAccess } from '@/lib/forge/facilitator-access';
import { getCourseAnalytics } from '@/lib/forge/course-analytics';
import { parseForgeEmailLocale } from '@/lib/forge/email-templates';
import { notifyFacilitatorsAtRisk } from '@/lib/forge/notify-facilitators';
import { loadCourseForTenant, requireForgeTenant } from '@/lib/forge/tenant';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
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

    const analytics = await getCourseAnalytics(courseId);
    const notify = req.nextUrl.searchParams.get('notify') === '1';
    if (notify && analytics.atRisk.length > 0) {
      const locale = parseForgeEmailLocale(req.nextUrl.searchParams.get('lang'));
      void notifyFacilitatorsAtRisk(
        course.companyId,
        courseId,
        course.title,
        analytics,
        locale
      );
    }
    return NextResponse.json(analytics);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
