export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getForgeDb } from '@/lib/forge/db';
import { parseGameSpecV1 } from '@/lib/forge/schemas/game-spec-v1';
import { getForgeEngine, validateAndPrepareSpec } from '@/lib/forge/engines';
import { completeForgeActivity } from '@/lib/forge/progress';
import { loadActivityForForgeAccess, requireForgeTenant } from '@/lib/forge/tenant';
import { syncJourneyAfterGameAction } from '@/lib/forge/learner-journey';

export async function POST(req: NextRequest) {
  try {
    const tenant = await requireForgeTenant();
    if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const body = (await req.json()) as { activityId?: string };
    const activityId = typeof body.activityId === 'string' ? body.activityId : '';
    if (!activityId) return NextResponse.json({ error: 'activityId é obrigatório' }, { status: 400 });

    const activity = await loadActivityForForgeAccess(activityId, tenant);
    if (!activity || activity.type !== 'game' || !activity.gameSpec) {
      return NextResponse.json({ error: 'Atividade de jogo inválida' }, { status: 400 });
    }

    const spec = validateAndPrepareSpec(parseGameSpecV1(activity.gameSpec.definition));
    const engine = getForgeEngine(spec.engine);
    const state = engine.createInitialState(spec);

    const existing = await getForgeDb().forgeGameSession.findFirst({
      where: { activityId, userId: tenant.userId, status: 'in_progress' },
      orderBy: { updatedAt: 'desc' },
    });

    const session =
      existing ??
      (await getForgeDb().forgeGameSession.create({
        data: {
          activityId,
          userId: tenant.userId,
          state: state as Prisma.InputJsonValue,
          status: 'in_progress',
        },
      }));

    return NextResponse.json({ session, spec, resumed: Boolean(existing) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const tenant = await requireForgeTenant();
    if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const body = (await req.json()) as {
      sessionId?: string;
      action?: { type: string; payload?: Record<string, unknown> };
    };

    const sessionId = typeof body.sessionId === 'string' ? body.sessionId : '';
    if (!sessionId || !body.action?.type) {
      return NextResponse.json({ error: 'sessionId e action.type são obrigatórios' }, { status: 400 });
    }

    const session = await getForgeDb().forgeGameSession.findFirst({
      where: {
        id: sessionId,
        userId: tenant.userId,
        activity: {
          module: {
            course: {
              OR: [
                { companyId: { in: tenant.companyIds } },
                { enrollments: { some: { userId: tenant.userId, status: 'active' } } },
              ],
            },
          },
        },
      },
      include: { activity: { include: { gameSpec: true, module: { include: { course: true } } } } },
    });
    if (!session?.activity.gameSpec) {
      return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 });
    }

    const spec = validateAndPrepareSpec(parseGameSpecV1(session.activity.gameSpec.definition));
    const engine = getForgeEngine(spec.engine);
    const prevState = (session.state ?? {}) as Record<string, unknown>;
    const { state, events } = engine.applyAction(prevState, body.action, spec);
    const score = engine.computeScore(state, spec);
    const done = engine.isComplete(state, spec);

    const updated = await getForgeDb().forgeGameSession.update({
      where: { id: sessionId },
      data: {
        state: state as Prisma.InputJsonValue,
        score,
        status: done ? 'completed' : 'in_progress',
        insights: body.action.type === 'record_insight' && body.action.payload?.text
          ? {
              ...(typeof session.insights === 'object' && session.insights ? session.insights : {}),
              last: String(body.action.payload.text).slice(0, 2000),
            }
          : undefined,
      },
    });

    const courseId = session.activity.module.courseId;
    await syncJourneyAfterGameAction({
      courseId,
      userId: tenant.userId,
      activityId: session.activityId,
      activityTitle: session.activity.title,
      actionType: body.action.type,
      state: state as Record<string, unknown>,
      events,
    }).catch(() => {});

    let completion: Awaited<ReturnType<typeof completeForgeActivity>> | null = null;
    if (done) {
      completion = await completeForgeActivity({
        userId: tenant.userId,
        activityId: session.activityId,
        score,
        payload: { sessionId, events },
      });
    }

    return NextResponse.json({ session: updated, events, completion });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
