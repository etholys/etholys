export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireForgeTenant } from '@/lib/forge/tenant';
import { getForgeDb } from '@/lib/forge/db';
import { ensureLearnerJourney } from '@/lib/forge/learner-journey';
import {
  mergeV2IntoMapState,
  parseV2State,
  v2FromJourneyMapState,
} from '@/lib/forge/expedicion-v2/player-state';
import {
  addConnection,
  addPostIt,
  removePostIt,
  updatePostIt,
} from '@/lib/forge/expedicion-v2/construction-map';
import {
  appendLedgerEntry,
  settleGreenLoan,
  takeGreenLoan,
} from '@/lib/forge/expedicion-v2/ledger';
import { computeSustainabilityScore } from '@/lib/forge/expedicion-v2/score';
import { CONSULTANCY_OPTIONS } from '@/lib/forge/expedicion-v2/consultancy';
import type { ExpedicionStationSlug } from '@/lib/forge/expedicion-station-decks';
import type { PostItType } from '@/lib/forge/expedicion-v2/types';

type Ctx = { params: Promise<{ id: string }> };

async function authorizeCourse(courseId: string, userId: string, companyIds: string[]) {
  return getForgeDb().forgeCourse.findFirst({
    where: {
      id: courseId,
      OR: [{ companyId: { in: companyIds } }, { enrollments: { some: { userId } } }],
    },
  });
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const tenant = await requireForgeTenant();
    if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const { id: courseId } = await ctx.params;
    const course = await authorizeCourse(courseId, tenant.userId, tenant.companyIds);
    if (!course) return NextResponse.json({ error: 'Curso não encontrado' }, { status: 404 });
    const journey = await ensureLearnerJourney(courseId, tenant.userId);
    const mapState = (journey.mapState ?? {}) as Record<string, unknown>;
    const v2 = v2FromJourneyMapState(mapState);
    const liveConfig = (course.liveConfig ?? {}) as Record<string, unknown>;
    return NextResponse.json({
      v2,
      sessionFormat: liveConfig.sessionFormat ?? 'online',
      videoEnabled: liveConfig.videoEnabled !== false,
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
    const { id: courseId } = await ctx.params;
    const course = await authorizeCourse(courseId, tenant.userId, tenant.companyIds);
    if (!course) return NextResponse.json({ error: 'Curso não encontrado' }, { status: 404 });

    const body = await req.json();
    const action = body.action as string;
    const journey = await ensureLearnerJourney(courseId, tenant.userId);
    const mapState = (journey.mapState ?? {}) as Record<string, unknown>;
    let v2 = v2FromJourneyMapState(mapState);

    switch (action) {
      case 'complete_pre_quiz': {
        v2 = {
          ...v2,
          phase: 'playing',
          preQuizAnswers: body.answers ?? {},
          preQuizCompletedAt: new Date().toISOString(),
        };
        break;
      }
      case 'complete_post_quiz': {
        v2 = {
          ...v2,
          phase: 'finished',
          postQuizAnswers: body.answers ?? {},
          postQuizCompletedAt: new Date().toISOString(),
        };
        v2.ledger = settleGreenLoan(v2.ledger);
        const breakdown = computeSustainabilityScore(v2.ledger, v2.constructionMap);
        v2.finalScoreBreakdown = breakdown;
        v2.finalScore = breakdown.total;
        break;
      }
      case 'add_postit': {
        v2 = {
          ...v2,
          constructionMap: addPostIt(
            v2.constructionMap,
            body.station as ExpedicionStationSlug,
            body.type as PostItType,
            String(body.text ?? ''),
            body.x,
            body.y
          ),
        };
        break;
      }
      case 'update_postit': {
        v2 = {
          ...v2,
          constructionMap: updatePostIt(v2.constructionMap, body.id, {
            text: body.text,
            type: body.type,
            x: body.x,
            y: body.y,
          }),
        };
        break;
      }
      case 'remove_postit': {
        v2 = { ...v2, constructionMap: removePostIt(v2.constructionMap, body.id) };
        break;
      }
      case 'add_connection': {
        v2 = {
          ...v2,
          constructionMap: addConnection(v2.constructionMap, body.fromPostItId, body.toPostItId),
        };
        break;
      }
      case 'ledger_entry': {
        v2 = {
          ...v2,
          ledger: appendLedgerEntry(
            v2.ledger,
            String(body.description ?? 'Movimiento'),
            body.entryType === 'S' ? 'S' : 'E',
            Number(body.amount) || 0,
            body.meta
          ),
        };
        break;
      }
      case 'consultancy': {
        const opt = CONSULTANCY_OPTIONS.find((o) => o.id === body.optionId);
        if (!opt) return NextResponse.json({ error: 'Consultoría inválida' }, { status: 400 });
        v2 = {
          ...v2,
          ledger: appendLedgerEntry(v2.ledger, `Consultoría: ${opt.label}`, 'S', opt.cost, {
            kind: 'consultancy',
            optionId: opt.id,
          }),
        };
        break;
      }
      case 'green_loan': {
        v2 = { ...v2, ledger: takeGreenLoan(v2.ledger) };
        break;
      }
      case 'end_cycle': {
        const cycles = v2.cyclesCompleted + 1;
        v2 = {
          ...v2,
          cyclesCompleted: cycles,
          phase: cycles >= v2.maxCycles ? 'post_quiz' : 'playing',
        };
        break;
      }
      default:
        return NextResponse.json({ error: 'Ação desconhecida' }, { status: 400 });
    }

    await getForgeDb().forgeLearnerJourney.update({
      where: { id: journey.id },
      data: { mapState: mergeV2IntoMapState(mapState, v2) as object },
    });

    return NextResponse.json({ v2 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
