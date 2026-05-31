export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getForgeDb } from '@/lib/forge/db';
import { getCourseProgressPercent } from '@/lib/forge/progress';
import { rebuildJourneyMapState } from '@/lib/forge/learner-journey';
import { getForgeCourseAccess } from '@/lib/forge/facilitator-access';
import { loadCourseForTenant, requireForgeTenant } from '@/lib/forge/tenant';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const withMaps = req.nextUrl.searchParams.get('maps') === '1';
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
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
      orderBy: { enrolledAt: 'desc' },
    });

    const facilitatorIds = new Set(
      (
        await getForgeDb().forgeCourseFacilitator.findMany({
          where: { courseId },
          select: { userId: true },
        })
      ).map((f) => f.userId)
    );
    if (course.createdById) facilitatorIds.add(course.createdById);

    const rows = await Promise.all(
      enrollments.map(async (e) => {
        const progressPercent = await getCourseProgressPercent(courseId, e.userId);
        const mapState = await rebuildJourneyMapState(courseId, e.userId);
        const profile = await getForgeDb().forgeLearnerProfile.findUnique({
          where: { courseId_userId: { courseId, userId: e.userId } },
        });
        return {
          userId: e.userId,
          name: e.user.name,
          email: e.user.email,
          image: e.user.image,
          isSelf: e.userId === tenant.userId,
          isFacilitator: facilitatorIds.has(e.userId),
          status: e.status,
          enrolledAt: e.enrolledAt.toISOString(),
          completedAt: e.completedAt?.toISOString() ?? null,
          progressPercent,
          xp: profile?.xp ?? 0,
          level: profile?.level ?? 1,
          board: mapState.board,
          stationsCompleted: mapState.stations.filter((s) => s.completed).length,
          stationTotal: mapState.stations.length,
          ...(withMaps
            ? {
                mapState: {
                  stations: mapState.stations.map((s) => ({
                    title: s.title,
                    completed: s.completed,
                    activityDone: s.activityDone,
                    activityTotal: s.activityTotal,
                  })),
                },
              }
            : {}),
        };
      })
    );

    return NextResponse.json({ learners: rows });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
