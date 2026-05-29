export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getForgeDb } from '@/lib/forge/db';
import { loadCourseForTenant, requireForgeTenant } from '@/lib/forge/tenant';
import { ensureLearnerJourney } from '@/lib/forge/learner-journey';
import { getForgeCourseAccess } from '@/lib/forge/facilitator-access';
import { checkProgramOrderAccess } from '@/lib/forge/program-order';

export async function POST(req: NextRequest) {
  try {
    const tenant = await requireForgeTenant();
    if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const body = (await req.json()) as { courseId?: string };
    const courseId = typeof body.courseId === 'string' ? body.courseId : '';
    if (!courseId) return NextResponse.json({ error: 'courseId é obrigatório' }, { status: 400 });

    const course = await loadCourseForTenant(courseId, tenant);
    if (!course) return NextResponse.json({ error: 'Curso não encontrado' }, { status: 404 });

    const fac = await getForgeCourseAccess(
      tenant.userId,
      course.companyId,
      course.id,
      course.createdById
    );
    if (!fac.canFacilitate) {
      const order = await checkProgramOrderAccess(tenant.userId, courseId);
      if (!order.ok) {
        return NextResponse.json(
          {
            error: 'Debes completar el curso anterior de la trilha',
            requiredCourseId: order.requiredCourseId,
            requiredCourseTitle: order.requiredCourseTitle,
          },
          { status: 403 }
        );
      }
    }
    const accessScope = fac.canFacilitate ? 'organization' : 'course_only';

    const enrollment = await getForgeDb().forgeEnrollment.upsert({
      where: { courseId_userId: { courseId, userId: tenant.userId } },
      create: { courseId, userId: tenant.userId, status: 'active', accessScope },
      update: { status: 'active' },
    });

    await getForgeDb().forgeLearnerProfile.upsert({
      where: { courseId_userId: { courseId, userId: tenant.userId } },
      create: { courseId, userId: tenant.userId },
      update: {},
    });

    await ensureLearnerJourney(courseId, tenant.userId);

    return NextResponse.json({ enrollment });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
