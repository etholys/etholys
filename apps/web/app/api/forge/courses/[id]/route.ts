export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getForgeDb } from '@/lib/forge/db';
import { forgeCourseInclude } from '@/lib/forge/queries';
import { serializeForgeCourse } from '@/lib/forge/serialize';
import { getCourseProgressPercent } from '@/lib/forge/progress';
import { loadCourseForTenant, requireForgeTenant } from '@/lib/forge/tenant';
import { parseDeliveryMode, parseLiveConfig } from '@/lib/forge/delivery';
import { parseGamePlayMode } from '@/lib/forge/game-play-mode';
import { getForgeCourseAccess } from '@/lib/forge/facilitator-access';
import { checkProgramOrderAccess } from '@/lib/forge/program-order';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const tenant = await requireForgeTenant();
    if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { id } = await ctx.params;
    const course = await getForgeDb().forgeCourse.findFirst({
      where: {
        id,
        OR: [
          { companyId: { in: tenant.companyIds } },
          { enrollments: { some: { userId: tenant.userId, status: 'active' } } },
        ],
      },
      include: forgeCourseInclude,
    });
    if (!course) return NextResponse.json({ error: 'Curso não encontrado' }, { status: 404 });

    const access = await getForgeCourseAccess(
      tenant.userId,
      course.companyId,
      course.id,
      course.createdById
    );
    const canFacilitate = access.canFacilitate;

    const progressPercent = await getCourseProgressPercent(course.id, tenant.userId);
    const profile = await getForgeDb().forgeLearnerProfile.findUnique({
      where: { courseId_userId: { courseId: course.id, userId: tenant.userId } },
    });

    const progressRows = await getForgeDb().forgeActivityProgress.findMany({
      where: {
        userId: tenant.userId,
        activity: { module: { courseId: course.id } },
      },
      select: { activityId: true, status: true, score: true },
    });

    let programOrderBlocked: Awaited<ReturnType<typeof checkProgramOrderAccess>> = { ok: true };
    if (!canFacilitate) {
      programOrderBlocked = await checkProgramOrderAccess(tenant.userId, course.id);
    }

    return NextResponse.json({
      course: {
        ...serializeForgeCourse(course, {
          progressPercent,
          xp: profile?.xp,
          level: profile?.level,
        }),
        canFacilitate,
        isOrgAdmin: access.isOrgAdmin,
        orgRole: access.role,
        companyId: course.companyId,
        programOrderBlocked,
      },
      activityProgress: progressRows,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const tenant = await requireForgeTenant();
    if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { id } = await ctx.params;
    const existing = await loadCourseForTenant(id, tenant);
    if (!existing) return NextResponse.json({ error: 'Curso não encontrado' }, { status: 404 });

    const body = (await req.json()) as Record<string, unknown>;
    const data: Record<string, unknown> = {};
    if (typeof body.title === 'string') data.title = body.title.trim().slice(0, 300);
    if (typeof body.description === 'string') data.description = body.description.slice(0, 5000);
    if (body.status === 'draft' || body.status === 'published' || body.status === 'archived') {
      data.status = body.status;
    }
    if (typeof body.coverEmoji === 'string') data.coverEmoji = body.coverEmoji.slice(0, 8);
    if (body.deliveryMode !== undefined) {
      data.deliveryMode = parseDeliveryMode(body.deliveryMode);
    }
    if (body.liveConfig !== undefined) {
      data.liveConfig = parseLiveConfig(body.liveConfig);
    }
    if (body.gamePlayMode !== undefined) {
      data.gamePlayMode = parseGamePlayMode(body.gamePlayMode);
    }
    if (body.cohortMode === 'open' || body.cohortMode === 'invite_only') {
      data.cohortMode = body.cohortMode;
    }
    if (body.programId === null) {
      data.programId = null;
    } else if (typeof body.programId === 'string' && body.programId.trim()) {
      const prog = await getForgeDb().forgeProgram.findFirst({
        where: { id: body.programId.trim(), companyId: existing.companyId },
      });
      if (prog) data.programId = prog.id;
    }

    const course = await getForgeDb().forgeCourse.update({
      where: { id },
      data,
      include: forgeCourseInclude,
    });

    return NextResponse.json({ course: serializeForgeCourse(course) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const tenant = await requireForgeTenant();
    if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { id } = await ctx.params;
    const existing = await loadCourseForTenant(id, tenant);
    if (!existing) return NextResponse.json({ error: 'Curso não encontrado' }, { status: 404 });

    await getForgeDb().forgeCourse.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
