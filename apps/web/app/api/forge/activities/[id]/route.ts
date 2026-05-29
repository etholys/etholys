export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getForgeDb } from '@/lib/forge/db';
import { isForgeActivityType } from '@/lib/forge/types';
import { getForgeCourseAccess } from '@/lib/forge/facilitator-access';
import { loadActivityForTenant, requireForgeTenant } from '@/lib/forge/tenant';

type Ctx = { params: Promise<{ id: string }> };

async function requireFacilitatorForActivity(
  activity: { module: { course: { id: string; companyId: string; createdById: string | null } } },
  tenant: { userId: string }
) {
  const course = activity.module.course;
  const access = await getForgeCourseAccess(
    tenant.userId,
    course.companyId,
    course.id,
    course.createdById
  );
  return access.canFacilitate;
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const tenant = await requireForgeTenant();
    if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { id } = await ctx.params;
    const activity = await loadActivityForTenant(id, tenant);
    if (!activity) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 });

    const progress = await getForgeDb().forgeActivityProgress.findUnique({
      where: { activityId_userId: { activityId: id, userId: tenant.userId } },
    });

    return NextResponse.json({
      activity: {
        id: activity.id,
        type: activity.type,
        title: activity.title,
        config: activity.config,
        gameSpecId: activity.gameSpecId,
        gameSpec: activity.gameSpec
          ? {
              id: activity.gameSpec.id,
              engine: activity.gameSpec.engine,
              title: activity.gameSpec.title,
              definition: activity.gameSpec.definition,
            }
          : null,
      },
      course: {
        id: activity.module.course.id,
        title: activity.module.course.title,
      },
      progress: progress
        ? { status: progress.status, score: progress.score, completedAt: progress.completedAt }
        : null,
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
    const activity = await loadActivityForTenant(id, tenant);
    if (!activity) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 });

    if (!(await requireFacilitatorForActivity(activity, tenant))) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }

    const body = (await req.json()) as {
      title?: string;
      config?: Record<string, unknown>;
      sortOrder?: number;
      type?: string;
      gameSpecId?: string | null;
    };

    const data: {
      title?: string;
      config?: Record<string, unknown>;
      sortOrder?: number;
      type?: string;
      gameSpecId?: string | null;
    } = {};

    if (typeof body.title === 'string') {
      const t = body.title.trim();
      if (!t) return NextResponse.json({ error: 'title é obrigatório' }, { status: 400 });
      data.title = t.slice(0, 300);
    }
    if (body.config && typeof body.config === 'object') data.config = body.config;
    if (typeof body.sortOrder === 'number') data.sortOrder = body.sortOrder;
    if (typeof body.type === 'string') {
      if (!isForgeActivityType(body.type)) {
        return NextResponse.json({ error: 'type inválido' }, { status: 400 });
      }
      data.type = body.type;
    }
    if (body.gameSpecId !== undefined) data.gameSpecId = body.gameSpecId;

    const updated = await getForgeDb().forgeLearningActivity.update({
      where: { id },
      data,
      include: { gameSpec: true },
    });

    return NextResponse.json({ activity: updated });
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
    const activity = await loadActivityForTenant(id, tenant);
    if (!activity) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 });

    if (!(await requireFacilitatorForActivity(activity, tenant))) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }

    await getForgeDb().forgeActivityProgress.deleteMany({ where: { activityId: id } });
    await getForgeDb().forgeLearningActivity.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
