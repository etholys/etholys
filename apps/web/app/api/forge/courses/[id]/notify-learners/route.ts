export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getForgeCourseAccess } from '@/lib/forge/facilitator-access';
import { getCourseAnalytics } from '@/lib/forge/course-analytics';
import { parseForgeEmailLocale } from '@/lib/forge/email-templates';
import { notifyAtRiskLearners, notifyInactiveLearners } from '@/lib/forge/notify-learners';
import { notifyFacilitatorsAtRisk } from '@/lib/forge/notify-facilitators';
import { loadCourseForTenant, requireForgeTenant } from '@/lib/forge/tenant';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
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

    const body = (await req.json()) as { mode?: 'at_risk' | 'inactive' | 'all'; locale?: string };
    const mode = body.mode ?? 'all';
    const locale = parseForgeEmailLocale(body.locale);

    const analytics = await getCourseAnalytics(courseId);
    let atRisk: Awaited<ReturnType<typeof notifyAtRiskLearners>> = [];
    let inactive: Awaited<ReturnType<typeof notifyInactiveLearners>> = [];

    if (mode === 'at_risk' || mode === 'all') {
      atRisk = await notifyAtRiskLearners(courseId, course.title, analytics, locale);
      await notifyFacilitatorsAtRisk(
        course.companyId,
        courseId,
        course.title,
        analytics,
        locale
      );
    }
    if (mode === 'inactive' || mode === 'all') {
      inactive = await notifyInactiveLearners(courseId, course.title, 7, locale);
    }

    return NextResponse.json({
      atRisk,
      inactive,
      summary: {
        atRiskNotified: atRisk.length,
        inactiveNotified: inactive.length,
        emailsSent:
          atRisk.filter((r) => r.emailSent).length + inactive.filter((r) => r.emailSent).length,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro' }, { status: 500 });
  }
}
