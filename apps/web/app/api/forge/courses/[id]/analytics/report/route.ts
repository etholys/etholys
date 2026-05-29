export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getForgeCourseAccess } from '@/lib/forge/facilitator-access';
import { getCourseAnalytics } from '@/lib/forge/course-analytics';
import { parseForgeEmailLocale } from '@/lib/forge/email-templates';
import { courseAnalyticsReportHtml } from '@/lib/forge/analytics-report-html';
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

    const locale = parseForgeEmailLocale(req.nextUrl.searchParams.get('lang'));
    const analytics = await getCourseAnalytics(courseId);
    const html = courseAnalyticsReportHtml(course.title, analytics, locale);
    const filename = `forge-analytics-${courseId.slice(0, 8)}.html`;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro' }, { status: 500 });
  }
}
