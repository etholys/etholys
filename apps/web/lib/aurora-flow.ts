/**
 * AURORA — fluxo contínuo da incubadora (negócio externo).
 * Diagnóstico → radiografía (documento) → validación → ruta → vivo.
 * Estado de trabalho em interviewJson; documento publicado em portraitText/hypothesis/bets.
 */

import {
  AURORA_DIAG_BLOCKS,
  AURORA_MATURITY,
  diagProgress,
  readAuroraDiagnostic,
  type AuroraDiagnosticState,
} from './aurora-diagnostic';
import type { AuroraBetDraft, AuroraLocale } from './aurora-interview';

export const AURORA_FLOW_KEY = '__auroraFlow';
export const AURORA_RADIOGRAPHY_KEY = '__auroraRadiography';
export const AURORA_VALIDATION_KEY = '__auroraValidation';
export const AURORA_ROUTE_CHAT_KEY = '__auroraRouteChat';

export type AuroraFlowPhase = 'diag' | 'radio' | 'validate' | 'route' | 'live';

export const AURORA_FLOW_PHASES: AuroraFlowPhase[] = ['diag', 'radio', 'validate', 'route', 'live'];

export const AURORA_FLOW_PHASE_ORDER: Record<AuroraFlowPhase, number> = {
  diag: 0,
  radio: 1,
  validate: 2,
  route: 3,
  live: 4,
};

export type AuroraFlowState = {
  phase: AuroraFlowPhase;
  updatedAt: string;
};

export type AuroraRadiographyDoc = {
  title: string;
  body: string;
  hypothesis: string;
  blockSummaries: Array<{
    id: string;
    label: string;
    level: number | null;
    levelLabel: string;
    situation: string;
    gap: string;
    potential: string;
  }>;
  generatedAt: string;
  source: 'diagnostic';
};

export type AuroraValidationState = {
  techAccepted: boolean;
  aiAccepted: boolean;
  techNotes: string;
  aiNotes: string;
  acceptedAt: string | null;
};

export type AuroraRouteChatMessage = { role: 'user' | 'assistant'; text: string };

export function emptyAuroraFlow(): AuroraFlowState {
  return { phase: 'diag', updatedAt: new Date().toISOString() };
}

export function emptyAuroraValidation(): AuroraValidationState {
  return {
    techAccepted: false,
    aiAccepted: false,
    techNotes: '',
    aiNotes: '',
    acceptedAt: null,
  };
}

export function readAuroraFlow(interviewJson: unknown): AuroraFlowState {
  if (!interviewJson || typeof interviewJson !== 'object' || Array.isArray(interviewJson)) {
    return emptyAuroraFlow();
  }
  const raw = (interviewJson as Record<string, unknown>)[AURORA_FLOW_KEY];
  if (!raw || typeof raw !== 'object') return emptyAuroraFlow();
  const phase = String((raw as { phase?: unknown }).phase || '');
  if (!AURORA_FLOW_PHASES.includes(phase as AuroraFlowPhase)) return emptyAuroraFlow();
  return {
    phase: phase as AuroraFlowPhase,
    updatedAt: String((raw as { updatedAt?: unknown }).updatedAt || '') || new Date().toISOString(),
  };
}

export function readAuroraRadiography(interviewJson: unknown): AuroraRadiographyDoc | null {
  if (!interviewJson || typeof interviewJson !== 'object' || Array.isArray(interviewJson)) return null;
  const raw = (interviewJson as Record<string, unknown>)[AURORA_RADIOGRAPHY_KEY];
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const body = String(o.body || '').trim();
  if (!body) return null;
  return {
    title: String(o.title || '').trim() || 'Radiografía',
    body: body.slice(0, 12000),
    hypothesis: String(o.hypothesis || '').trim().slice(0, 2000),
    blockSummaries: Array.isArray(o.blockSummaries)
      ? (o.blockSummaries as AuroraRadiographyDoc['blockSummaries']).slice(0, 8)
      : [],
    generatedAt: String(o.generatedAt || ''),
    source: 'diagnostic',
  };
}

export function readAuroraValidation(interviewJson: unknown): AuroraValidationState {
  if (!interviewJson || typeof interviewJson !== 'object' || Array.isArray(interviewJson)) {
    return emptyAuroraValidation();
  }
  const raw = (interviewJson as Record<string, unknown>)[AURORA_VALIDATION_KEY];
  if (!raw || typeof raw !== 'object') return emptyAuroraValidation();
  const o = raw as Record<string, unknown>;
  return {
    techAccepted: Boolean(o.techAccepted),
    aiAccepted: Boolean(o.aiAccepted),
    techNotes: String(o.techNotes || '').trim().slice(0, 2000),
    aiNotes: String(o.aiNotes || '').trim().slice(0, 2000),
    acceptedAt: o.acceptedAt ? String(o.acceptedAt) : null,
  };
}

export function readAuroraRouteChat(interviewJson: unknown): AuroraRouteChatMessage[] {
  if (!interviewJson || typeof interviewJson !== 'object' || Array.isArray(interviewJson)) return [];
  const raw = (interviewJson as Record<string, unknown>)[AURORA_ROUTE_CHAT_KEY];
  if (!Array.isArray(raw)) return [];
  return raw
    .map((m) => {
      if (!m || typeof m !== 'object') return null;
      const role = (m as { role?: unknown }).role;
      const text = String((m as { text?: unknown }).text || '').trim().slice(0, 4000);
      if ((role !== 'user' && role !== 'assistant') || !text) return null;
      return { role, text } as AuroraRouteChatMessage;
    })
    .filter((m): m is AuroraRouteChatMessage => Boolean(m))
    .slice(-40);
}

export function auroraFlowPatch(input: {
  flow?: AuroraFlowState | null;
  radiography?: AuroraRadiographyDoc | null;
  validation?: AuroraValidationState | null;
  routeChat?: AuroraRouteChatMessage[] | null;
}): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (input.flow !== undefined) patch[AURORA_FLOW_KEY] = input.flow;
  if (input.radiography !== undefined) patch[AURORA_RADIOGRAPHY_KEY] = input.radiography;
  if (input.validation !== undefined) patch[AURORA_VALIDATION_KEY] = input.validation;
  if (input.routeChat !== undefined) patch[AURORA_ROUTE_CHAT_KEY] = input.routeChat;
  return patch;
}

/** Deriva a fase a partir do progresso real (não só do que está gravado). */
export function resolveAuroraFlowPhase(input: {
  diagnostic: AuroraDiagnosticState;
  radiography: AuroraRadiographyDoc | null;
  validation: AuroraValidationState;
  openBetCount: number;
  stored?: AuroraFlowState | null;
}): AuroraFlowPhase {
  const progress = diagProgress(input.diagnostic);
  if (!progress.complete) return 'diag';
  if (!input.radiography?.body) return 'radio';
  if (!input.validation.techAccepted) return 'validate';
  if (input.openBetCount < 2) return 'route';
  const stored = input.stored?.phase;
  if (stored === 'live') return 'live';
  return 'route';
}

export function composeRadiographyFromDiagnostic(
  diagnostic: AuroraDiagnosticState,
  locale: AuroraLocale,
  companyName?: string,
): AuroraRadiographyDoc {
  const progress = diagProgress(diagnostic);
  const name = (companyName || '').trim();
  const title =
    locale === 'es'
      ? `Radiografía${name ? ` · ${name}` : ''}`
      : locale === 'en'
        ? `Radiography${name ? ` · ${name}` : ''}`
        : `Radiografia${name ? ` · ${name}` : ''}`;

  const blockSummaries = AURORA_DIAG_BLOCKS.map((def) => {
    const block = diagnostic.blocks[def.id];
    const level = block?.status === 'done' ? block.level : null;
    return {
      id: def.id,
      label: def.label[locale],
      level,
      levelLabel: level ? AURORA_MATURITY[level].short[locale] : '—',
      situation: block?.situation || '',
      gap: block?.gap || '',
      potential: block?.potential || '',
    };
  });

  const lines: string[] = [];
  if (locale === 'es') {
    lines.push(
      name
        ? `Este documento resume el diagnóstico de ${name} en seis áreas.`
        : 'Este documento resume el diagnóstico del negocio en seis áreas.',
    );
  } else if (locale === 'en') {
    lines.push(
      name
        ? `This document summarizes the diagnostic of ${name} across six areas.`
        : 'This document summarizes the business diagnostic across six areas.',
    );
  } else {
    lines.push(
      name
        ? `Este documento resume o diagnóstico de ${name} em seis áreas.`
        : 'Este documento resume o diagnóstico do negócio em seis áreas.',
    );
  }
  lines.push('');

  for (const row of blockSummaries) {
    lines.push(`## ${row.label} (${row.levelLabel})`);
    if (row.situation) lines.push(row.situation);
    if (row.gap) {
      lines.push(
        locale === 'es' ? `Brecha: ${row.gap}` : locale === 'en' ? `Gap: ${row.gap}` : `Brecha: ${row.gap}`,
      );
    }
    if (row.potential) {
      lines.push(
        locale === 'es'
          ? `Potencial: ${row.potential}`
          : locale === 'en'
            ? `Potential: ${row.potential}`
            : `Potencial: ${row.potential}`,
      );
    }
    lines.push('');
  }

  if (progress.avgLevel != null) {
    lines.push(
      locale === 'es'
        ? `Madurez media observada: ${progress.avgLevel}/5.`
        : locale === 'en'
          ? `Average observed maturity: ${progress.avgLevel}/5.`
          : `Maturidade média observada: ${progress.avgLevel}/5.`,
    );
  }

  const topGap = progress.gaps[0] || '';
  const topPot = progress.potentials[0] || '';
  let hypothesis = '';
  if (locale === 'es') {
    hypothesis = topGap
      ? `El freno principal parece ser: ${topGap}.${topPot ? ` El empuje está en: ${topPot}` : ''}`
      : topPot
        ? `Hay base para empujar: ${topPot}`
        : 'Hipótesis pendiente de validar con el técnico.';
  } else if (locale === 'en') {
    hypothesis = topGap
      ? `The main brake seems to be: ${topGap}.${topPot ? ` The pull is: ${topPot}` : ''}`
      : topPot
        ? `There is a base to pull on: ${topPot}`
        : 'Hypothesis pending technician validation.';
  } else {
    hypothesis = topGap
      ? `O travão principal parece ser: ${topGap}.${topPot ? ` O puxão está em: ${topPot}` : ''}`
      : topPot
        ? `Há base para puxar: ${topPot}`
        : 'Hipótese pendente de validação com o técnico.';
  }

  return {
    title,
    body: lines.join('\n').trim().slice(0, 12000),
    hypothesis: hypothesis.slice(0, 2000),
    blockSummaries,
    generatedAt: new Date().toISOString(),
    source: 'diagnostic',
  };
}

/** Apostas/atividades da rota a partir de brechas e potenciais do diagnóstico. */
export function proposeRouteFromDiagnostic(
  diagnostic: AuroraDiagnosticState,
  locale: AuroraLocale,
): AuroraBetDraft[] {
  const progress = diagProgress(diagnostic);
  const bets: AuroraBetDraft[] = [];

  for (const gap of progress.gaps.slice(0, 3)) {
    bets.push({
      title:
        locale === 'es'
          ? `Destrabar: ${gap.slice(0, 80)}`
          : locale === 'en'
            ? `Unblock: ${gap.slice(0, 80)}`
            : `Destravar: ${gap.slice(0, 80)}`,
      why: gap,
      indicator:
        locale === 'es'
          ? 'Evidencia visible esta semana'
          : locale === 'en'
            ? 'Visible evidence this week'
            : 'Evidência visível esta semana',
    });
  }
  for (const pot of progress.potentials.slice(0, 2)) {
    if (bets.length >= 4) break;
    bets.push({
      title:
        locale === 'es'
          ? `Empujar: ${pot.slice(0, 80)}`
          : locale === 'en'
            ? `Push: ${pot.slice(0, 80)}`
            : `Puxar: ${pot.slice(0, 80)}`,
      why: pot,
      indicator:
        locale === 'es'
          ? 'Un paso concreto esta semana'
          : locale === 'en'
            ? 'One concrete step this week'
            : 'Um passo concreto esta semana',
    });
  }

  while (bets.length < 2) {
    bets.push({
      title:
        locale === 'es'
          ? 'Cerrar una prueba de esta semana'
          : locale === 'en'
            ? 'Close one this-week trial'
            : 'Fechar uma prova desta semana',
      why:
        locale === 'es'
          ? 'Falta una apuesta concreta después del diagnóstico.'
          : locale === 'en'
            ? 'Need a concrete bet after the diagnostic.'
            : 'Falta uma aposta concreta depois do diagnóstico.',
      indicator:
        locale === 'es' ? 'Hecho / no hecho' : locale === 'en' ? 'Done / not done' : 'Feito / não feito',
    });
  }

  return bets.slice(0, 4);
}

export function auroraFlowPhaseLabels(locale: AuroraLocale): Record<AuroraFlowPhase, string> {
  if (locale === 'es') {
    return {
      diag: 'Diagnóstico',
      radio: 'Radiografía',
      validate: 'Validar',
      route: 'Ruta',
      live: 'En curso',
    };
  }
  if (locale === 'en') {
    return {
      diag: 'Diagnostic',
      radio: 'Radiography',
      validate: 'Validate',
      route: 'Route',
      live: 'Live',
    };
  }
  return {
    diag: 'Diagnóstico',
    radio: 'Radiografia',
    validate: 'Validar',
    route: 'Rota',
    live: 'Em curso',
  };
}

/** Payload seguro para o negócio atendido (sem chats internos). */
export function attendedAuroraView(input: {
  companyName: string;
  portraitText: string;
  hypothesis: string;
  hypothesisAccepted: boolean;
  gaps: Array<{ text: string }>;
  potentials: Array<{ text: string }>;
  radiography: AuroraRadiographyDoc | null;
  bets: Array<{ id: string; title: string; status: string; why?: string; indicator?: string | null; dueAt?: string | null }>;
  phase: AuroraFlowPhase;
  lastRhythm?: { happened: string; blocked: string; nextStep: string; createdAt: string } | null;
}) {
  const open = input.bets.filter((b) => b.status !== 'done' && b.status !== 'dropped');
  const done = input.bets.filter((b) => b.status === 'done');
  const total = open.length + done.length;
  return {
    companyName: input.companyName,
    phase: input.phase,
    radiography: {
      title: input.radiography?.title || '',
      body: input.radiography?.body || input.portraitText || '',
      hypothesis: input.radiography?.hypothesis || input.hypothesis || '',
      validated: input.hypothesisAccepted,
    },
    gaps: input.gaps.slice(0, 5),
    potentials: input.potentials.slice(0, 3),
    route: input.bets
      .filter((b) => b.status !== 'dropped')
      .map((b) => ({
        id: b.id,
        title: b.title,
        status: b.status,
        why: b.why || '',
        indicator: b.indicator || '',
        dueAt: b.dueAt || null,
      })),
    progress: {
      activitiesDone: done.length,
      activitiesOpen: open.length,
      activitiesTotal: total,
      pct: total ? Math.round((done.length / total) * 100) : 0,
    },
    lastRhythm: input.lastRhythm || null,
  };
}

export const AURORA_BET_STATUSES = ['proposed', 'accepted', 'active', 'done', 'dropped'] as const;
export type AuroraBetStatus = (typeof AURORA_BET_STATUSES)[number];

export function normalizeAuroraBetStatus(raw: unknown): AuroraBetStatus | null {
  const s = String(raw || '').trim();
  return (AURORA_BET_STATUSES as readonly string[]).includes(s) ? (s as AuroraBetStatus) : null;
}

export function nextAuroraBetStatuses(status: string): AuroraBetStatus[] {
  if (status === 'proposed') return ['accepted', 'dropped'];
  if (status === 'accepted') return ['active', 'dropped'];
  if (status === 'active') return ['done', 'dropped'];
  if (status === 'done') return ['active'];
  return [];
}

export function auroraBetStatusLabel(status: string, locale: AuroraLocale): string {
  if (locale === 'es') {
    const m: Record<string, string> = {
      proposed: 'Propuesta',
      accepted: 'Aceptada',
      active: 'En curso',
      done: 'Hecha',
      dropped: 'Descartada',
    };
    return m[status] || status;
  }
  if (locale === 'en') {
    const m: Record<string, string> = {
      proposed: 'Proposed',
      accepted: 'Accepted',
      active: 'Active',
      done: 'Done',
      dropped: 'Dropped',
    };
    return m[status] || status;
  }
  const m: Record<string, string> = {
    proposed: 'Proposta',
    accepted: 'Aceite',
    active: 'Em curso',
    done: 'Feita',
    dropped: 'Descartada',
  };
  return m[status] || status;
}


export function flowFromInterviewBundle(interviewJson: unknown, diagnostic?: AuroraDiagnosticState) {
  const diag = diagnostic || readAuroraDiagnostic(interviewJson);
  const radiography = readAuroraRadiography(interviewJson);
  const validation = readAuroraValidation(interviewJson);
  const stored = readAuroraFlow(interviewJson);
  return {
    diagnostic: diag,
    radiography,
    validation,
    stored,
    routeChat: readAuroraRouteChat(interviewJson),
    progress: diagProgress(diag),
  };
}
