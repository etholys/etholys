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
import {
  applyActionEventCard,
  applyCrisisEventCard,
  consumeInvestmentBenefit,
  investmentCostWithBenefits,
  type CrisisResolveMode,
} from '@/lib/forge/expedicion-v2/event-card-effects';
import { getActionCards, getCrisisCards, getMicroCasoById } from '@/lib/forge/expedicion-v2/content';
import { feriaEligible, FERIA_ECO_PRIZE } from '@/lib/forge/expedicion-v2/feria';
import { addTeamPeerCredit } from '@/lib/forge/expedicion-v2/peer-credits';
import {
  createInitialV2State,
} from '@/lib/forge/expedicion-v2/player-state';
import type { ExpedicionStationSlug } from '@/lib/forge/expedicion-station-decks';
import type { ExpedicionV2PlayerState, PostItType } from '@/lib/forge/expedicion-v2/types';

export class V2ActionError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/** Aplica uma ação PATCH ao estado V2 (jornada individual ou equipa). */
export function applyV2Action(
  v2: ExpedicionV2PlayerState,
  body: Record<string, unknown>
): ExpedicionV2PlayerState {
  const action = body.action as string;

  switch (action) {
    case 'start_playing':
      if (v2.phase === 'finished') return v2;
      return {
        ...v2,
        phase: 'playing',
        quizGate: null,
        preQuizCompletedAt: v2.preQuizCompletedAt ?? new Date().toISOString(),
      };
    case 'open_pre_quiz':
      return { ...v2, phase: v2.phase === 'finished' ? v2.phase : 'lobby', quizGate: 'pre' as const };
    case 'open_post_quiz':
      return { ...v2, quizGate: 'post' as const };
    case 'return_to_lobby':
      return { ...v2, phase: 'lobby' as const, quizGate: null };
    case 'complete_pre_quiz':
      return {
        ...v2,
        phase: 'playing',
        quizGate: null,
        preQuizAnswers: (body.answers as ExpedicionV2PlayerState['preQuizAnswers']) ?? {},
        preQuizCompletedAt: new Date().toISOString(),
      };
    case 'complete_post_quiz': {
      const next = {
        ...v2,
        phase: 'finished' as const,
        quizGate: null,
        postQuizAnswers: (body.answers as ExpedicionV2PlayerState['postQuizAnswers']) ?? {},
        postQuizCompletedAt: new Date().toISOString(),
      };
      next.ledger = settleGreenLoan(next.ledger);
      const breakdown = computeSustainabilityScore(
        next.ledger,
        next.constructionMap,
        next.impactPoints ?? 0
      );
      next.finalScoreBreakdown = breakdown;
      next.finalScore = breakdown.total;
      return next;
    }
    case 'add_postit':
      return {
        ...v2,
        constructionMap: addPostIt(
          v2.constructionMap,
          body.station as ExpedicionStationSlug,
          body.type as PostItType,
          String(body.text ?? ''),
          body.x as number | undefined,
          body.y as number | undefined
        ),
      };
    case 'update_postit':
      return {
        ...v2,
        constructionMap: updatePostIt(v2.constructionMap, String(body.id), {
          text: body.text as string | undefined,
          type: body.type as PostItType | undefined,
          x: body.x as number | undefined,
          y: body.y as number | undefined,
        }),
      };
    case 'remove_postit':
      return { ...v2, constructionMap: removePostIt(v2.constructionMap, String(body.id)) };
    case 'add_connection':
      return {
        ...v2,
        constructionMap: addConnection(
          v2.constructionMap,
          String(body.fromPostItId),
          String(body.toPostItId)
        ),
      };
    case 'ledger_entry':
      return {
        ...v2,
        ledger: appendLedgerEntry(
          v2.ledger,
          String(body.description ?? 'Movimiento'),
          body.entryType === 'S' ? 'S' : 'E',
          Number(body.amount) || 0,
          body.meta as Record<string, unknown> | undefined
        ),
      };
    case 'consultancy': {
      const opt = CONSULTANCY_OPTIONS.find((o) => o.id === body.optionId);
      if (!opt) throw new V2ActionError('Consultoría inválida');
      let next: ExpedicionV2PlayerState = {
        ...v2,
        ledger: appendLedgerEntry(v2.ledger, `Consultoría: ${opt.label}`, 'S', opt.cost, {
          kind: 'consultancy',
          optionId: opt.id,
          peerUserId: body.peerUserId,
        }),
      };
      if (opt.id === 'companero' && typeof body.peerUserId === 'string' && body.peerUserId) {
        next = addTeamPeerCredit(next, body.peerUserId, opt.cost);
      }
      return next;
    }
    case 'green_loan':
      return { ...v2, ledger: takeGreenLoan(v2.ledger) };
    case 'end_cycle': {
      const cycles = v2.cyclesCompleted + 1;
      const done = cycles >= v2.maxCycles;
      return {
        ...v2,
        cyclesCompleted: cycles,
        phase: done ? 'playing' : 'playing',
        quizGate: done ? ('post' as const) : v2.quizGate ?? null,
      };
    }
    case 'apply_action_card': {
      const card = getActionCards().find((c) => c.id === body.cardId);
      if (!card) throw new V2ActionError('Carta de Acción inválida');
      return applyActionEventCard(v2, card).v2;
    }
    case 'apply_crisis_card': {
      const card = getCrisisCards().find((c) => c.id === body.cardId);
      if (!card) throw new V2ActionError('Carta de Desafío inválida');
      const mode = (body.mode === 'rewrite' ? 'rewrite' : 'pay_fine') as CrisisResolveMode;
      return applyCrisisEventCard(v2, card, mode).v2;
    }
    case 'submit_micro_caso': {
      if (v2.pendingMicroCaso) throw new V2ActionError('Ya hay un micro-caso pendiente de validación');
      const microCasoId = String(body.microCasoId ?? '');
      const answer = String(body.answer ?? '').trim();
      if (!microCasoId || !answer) throw new V2ActionError('Respuesta requerida');
      const mc = getMicroCasoById(microCasoId);
      if (!mc) throw new V2ActionError('Micro-caso inválido');
      return {
        ...v2,
        pendingMicroCaso: {
          microCasoId,
          station: (body.station as ExpedicionStationSlug) ?? (mc.station as ExpedicionStationSlug),
          answer,
          submittedAt: new Date().toISOString(),
          submittedBy: typeof body.submittedBy === 'string' ? body.submittedBy : undefined,
        },
      };
    }
    case 'approve_micro_caso': {
      const pending = v2.pendingMicroCaso;
      if (!pending) throw new V2ActionError('No hay micro-caso pendiente');
      const completed = [...(v2.completedMicroCasos ?? []), pending.microCasoId];
      let next: ExpedicionV2PlayerState = {
        ...v2,
        pendingMicroCaso: null,
        completedMicroCasos: completed,
        impactPoints: (v2.impactPoints ?? 0) + 1,
        ledger: appendLedgerEntry(
          v2.ledger,
          'Premio estación (validación facilitador)',
          'E',
          200,
          { kind: 'station_prize', microCasoId: pending.microCasoId }
        ),
      };
      return next;
    }
    case 'reject_micro_caso': {
      if (!v2.pendingMicroCaso) throw new V2ActionError('No hay micro-caso pendiente');
      return { ...v2, pendingMicroCaso: null };
    }
    case 'submit_feria_pitch': {
      if (v2.feriaAwarded) throw new V2ActionError('El premio de la Feria ya fue entregado');
      if (v2.pendingFeriaPitch) throw new V2ActionError('Ya hay un pitch pendiente de validación');
      if (!feriaEligible(v2.constructionMap)) {
        throw new V2ActionError('Completa al menos 3 estaciones en el mapa para participar');
      }
      const pitch = String(body.pitch ?? '').trim();
      if (!pitch) throw new V2ActionError('Pitch requerido');
      return {
        ...v2,
        pendingFeriaPitch: {
          pitch,
          submittedAt: new Date().toISOString(),
          submittedBy: typeof body.submittedBy === 'string' ? body.submittedBy : undefined,
        },
      };
    }
    case 'award_feria_pitch': {
      if (v2.feriaAwarded) throw new V2ActionError('El premio de la Feria ya fue entregado');
      const pending = v2.pendingFeriaPitch;
      if (!pending) throw new V2ActionError('No hay pitch pendiente');
      return {
        ...v2,
        pendingFeriaPitch: null,
        feriaAwarded: true,
        ledger: appendLedgerEntry(
          v2.ledger,
          'Gran Desafío — Feria de Negocios (mejor pitch)',
          'E',
          FERIA_ECO_PRIZE,
          { kind: 'feria_prize', pitch: pending.pitch.slice(0, 500) }
        ),
      };
    }
    case 'reject_feria_pitch': {
      if (!v2.pendingFeriaPitch) throw new V2ActionError('No hay pitch pendiente');
      return { ...v2, pendingFeriaPitch: null };
    }
    case 'add_impact': {
      const delta = Number(body.points) || 1;
      if (delta <= 0) throw new V2ActionError('Puntos inválidos');
      return { ...v2, impactPoints: (v2.impactPoints ?? 0) + delta };
    }
    case 'purchase_investment': {
      const station = body.station as ExpedicionStationSlug;
      const baseCost = Number(body.cost) || 0;
      const tierId = String(body.tierId ?? '');
      const label = String(body.label ?? 'Inversión');
      const { cost, benefitUsed } = investmentCostWithBenefits(v2.benefits, station, baseCost);
      if (cost <= 0) throw new V2ActionError('Coste inválido');
      let next = {
        ...v2,
        ledger: appendLedgerEntry(v2.ledger, `${label} — ${station}`, 'S', cost, {
          kind: 'investment',
          tierId,
          station,
          baseCost,
          discountApplied: baseCost - cost,
        }),
        constructionMap: addPostIt(
          v2.constructionMap,
          station,
          'inversion',
          `${label}: inversión registrada`
        ),
      };
      next = consumeInvestmentBenefit(next, benefitUsed);
      return next;
    }
    case 'reset_v2': {
      const keepPhase = v2.phase !== 'lobby' && v2.phase !== 'pre_quiz';
      const fresh = createInitialV2State();
      return keepPhase ? { ...fresh, phase: v2.phase, cyclesCompleted: v2.cyclesCompleted } : fresh;
    }
    case 'force_post_quiz':
      return { ...v2, quizGate: 'post' as const };
    default:
      throw new V2ActionError('Acción desconocida');
  }
}
