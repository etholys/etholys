export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getForgeDb } from '@/lib/forge/db';
import { getForgeCourseAccess } from '@/lib/forge/facilitator-access';
import { loadCourseForTenant, requireForgeTenant } from '@/lib/forge/tenant';
import { parseMulti } from '@/lib/forge/expedicion-board-multi';
import { v2FromJourneyMapState } from '@/lib/forge/expedicion-v2/player-state';
import { v2FromRoomState, v2TeamSummary } from '@/lib/forge/expedicion-v2/room-v2-store';

type Ctx = { params: Promise<{ id: string }> };

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

    const rooms = await getForgeDb().forgeSharedGameRoom.findMany({
      where: { courseId, status: 'open', playGroupId: { not: null } },
      include: { playGroup: { select: { id: true, name: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 24,
    });

    const teams = rooms
      .map((room) => {
        const prev = (room.state ?? {}) as Record<string, unknown>;
        const multi = parseMulti(prev);
        if (!multi?.teamPlay || !room.playGroup) return null;
        const v2 = v2FromRoomState(prev);
        return {
          playGroupId: room.playGroup.id,
          name: room.playGroup.name,
          roomId: room.id,
          ...v2TeamSummary(v2),
        };
      })
      .filter(Boolean);

    const journeys = await getForgeDb().forgeLearnerJourney.findMany({
      where: { courseId },
      include: { user: { select: { id: true, name: true, email: true } } },
      take: 48,
    });

    const learners = journeys.map((j) => {
      const mapState = (j.mapState ?? {}) as Record<string, unknown>;
      const v2 = v2FromJourneyMapState(mapState);
      const s = v2TeamSummary(v2);
      return {
        userId: j.userId,
        name: j.user.name ?? j.user.email,
        phase: s.phase,
        balance: s.balance,
        postItCount: s.postItCount,
        finalScore: s.finalScore,
        impactPoints: s.impactPoints,
      };
    });

    return NextResponse.json({ teams, learners });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
