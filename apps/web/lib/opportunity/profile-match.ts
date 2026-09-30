/**
 * R2 — matching / yield a partir do perfil de elegibilidade.
 * Não inventa fundos: só pontua e ordena candidatos já descobertos.
 */

import { evaluateFit } from '@/lib/opportunity/fit';
import type {
  CandidateFit,
  FitItemStatus,
  OpportunityBriefing,
  ScanCandidate,
} from '@/lib/opportunity/scan-types';

export type ProfileMatchScore = {
  score: number;
  verdict: CandidateFit['verdict'] | 'unknown';
  reasons: string[];
  fit?: CandidateFit;
};

const STATUS_POINTS: Record<FitItemStatus, number> = {
  go: 10,
  caution: 2,
  unknown: 0,
  no_go: -28,
};

/** Critérios centrais do perfil — pesam mais no score. */
const CORE_IDS = new Set(['country', 'org_type', 'legal_registration', 'kind', 'deadline', 'ceiling']);

/**
 * Pontua 0–100 a partir de evaluateFit (perfil → elegibilidade do edital).
 * Sem perfil preenchido → score neutro 50 com reasons vazias.
 * Verdict no_go / caution limitam o tecto para o ranking da inbox ser útil.
 */
export function scoreCandidateAgainstProfile(
  candidate: ScanCandidate,
  briefing: OpportunityBriefing,
  opts?: { now?: number; locale?: string },
): ProfileMatchScore {
  const hasProfile =
    Boolean(briefing.countries?.length) ||
    Boolean(briefing.orgKind) ||
    Boolean(briefing.entityType) ||
    Boolean(briefing.legalCountries?.length) ||
    briefing.amountMax != null ||
    Boolean(briefing.kinds?.length);

  if (!hasProfile) {
    return {
      score: typeof candidate.matchScore === 'number' ? clamp(candidate.matchScore) : 50,
      verdict: 'unknown',
      reasons: [],
    };
  }

  const fit = evaluateFit(candidate, briefing, opts);
  let raw = 45;
  const reasons: string[] = [];

  for (const item of fit.items) {
    const weight = CORE_IDS.has(item.id) ? 1.5 : 0.8;
    raw += STATUS_POINTS[item.status] * weight;
    if (item.status === 'go' && CORE_IDS.has(item.id) && item.note) {
      reasons.push(item.note);
    } else if (item.status === 'no_go' && item.note) {
      reasons.push(item.note);
    } else if (item.status === 'caution' && CORE_IDS.has(item.id) && item.note) {
      reasons.push(item.note);
    }
  }

  // LLM matchScore como ligeiro boost (não substitui fit).
  if (typeof candidate.matchScore === 'number') {
    raw += (candidate.matchScore - 50) * 0.12;
  }

  // Tecto por verdict — no_go nunca compete com go na ordenação.
  if (fit.verdict === 'no_go') raw = Math.min(raw, 32);
  else if (fit.verdict === 'caution') raw = Math.min(raw, 68);

  return {
    score: clamp(Math.round(raw)),
    verdict: fit.verdict,
    reasons: reasons.slice(0, 4),
    fit,
  };
}

export function attachProfileMatchScores<T extends ScanCandidate>(
  candidates: T[],
  briefing: OpportunityBriefing,
  opts?: { now?: number; locale?: string },
): Array<T & { profileMatch?: ProfileMatchScore }> {
  return candidates.map((c) => {
    const profileMatch = scoreCandidateAgainstProfile(c, briefing, opts);
    return {
      ...c,
      matchScore: profileMatch.score,
      profileMatch,
      fit: c.fit ?? profileMatch.fit,
    };
  });
}

/** Ordena por score desc; empate → prazo mais próximo (já no matchScore agregado). */
export function sortByProfileMatch<T extends { matchScore?: number; profileMatch?: ProfileMatchScore }>(
  candidates: T[],
): T[] {
  return [...candidates].sort((a, b) => {
    const as = a.profileMatch?.score ?? a.matchScore ?? 0;
    const bs = b.profileMatch?.score ?? b.matchScore ?? 0;
    return bs - as;
  });
}

/**
 * Filtra inbox: remove no_go duros (país / tipo / prazo fechado) se o perfil estiver completo.
 * Não inventa nem descarta por score baixo — só no_go claros.
 */
export function filterInboxByProfileFit<T extends ScanCandidate>(
  candidates: T[],
  briefing: OpportunityBriefing,
  opts?: { dropNoGo?: boolean; now?: number; locale?: string },
): T[] {
  if (!opts?.dropNoGo) return candidates;
  return candidates.filter((c) => {
    const m = scoreCandidateAgainstProfile(c, briefing, opts);
    if (m.verdict !== 'no_go') return true;
    const hard = m.fit?.items.some(
      (i) =>
        i.status === 'no_go' &&
        (i.id === 'country' || i.id === 'org_type' || i.id === 'deadline' || i.id === 'kind'),
    );
    return !hard;
  });
}

export type ProfileYieldSummary = {
  total: number;
  go: number;
  caution: number;
  no_go: number;
  unknown: number;
  avgScore: number;
  topReasons: string[];
};

export function summarizeProfileYield(
  candidates: ScanCandidate[],
  briefing: OpportunityBriefing,
  opts?: { now?: number; locale?: string },
): ProfileYieldSummary {
  if (!candidates.length) {
    return { total: 0, go: 0, caution: 0, no_go: 0, unknown: 0, avgScore: 0, topReasons: [] };
  }
  let go = 0;
  let caution = 0;
  let no_go = 0;
  let unknown = 0;
  let scoreSum = 0;
  const reasonCounts = new Map<string, number>();

  for (const c of candidates) {
    const m = scoreCandidateAgainstProfile(c, briefing, opts);
    scoreSum += m.score;
    if (m.verdict === 'go') go += 1;
    else if (m.verdict === 'caution') caution += 1;
    else if (m.verdict === 'no_go') no_go += 1;
    else unknown += 1;
    for (const r of m.reasons) {
      reasonCounts.set(r, (reasonCounts.get(r) ?? 0) + 1);
    }
  }

  const topReasons = [...reasonCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([r]) => r);

  return {
    total: candidates.length,
    go,
    caution,
    no_go,
    unknown,
    avgScore: Math.round(scoreSum / candidates.length),
    topReasons,
  };
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}
