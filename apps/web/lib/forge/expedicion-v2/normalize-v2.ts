import type { ExpedicionV2PlayerState } from '@/lib/forge/expedicion-v2/types';

/** Normaliza estados legados (pre_quiz inicial) e devolve se houve alteração. */
export function normalizeV2State(v2: ExpedicionV2PlayerState): {
  v2: ExpedicionV2PlayerState;
  changed: boolean;
} {
  let next = { ...v2 };
  let changed = false;

  // Legado: fase inicial era pre_quiz — voltar ao hall sem quiz aberto
  if (next.phase === 'pre_quiz' && !next.preQuizCompletedAt && !next.quizGate) {
    next = { ...next, phase: 'lobby', quizGate: null };
    changed = true;
  }

  // Legado: post_quiz sem quiz final aberto pelo facilitador
  if (next.phase === 'post_quiz' && !next.postQuizCompletedAt && !next.quizGate) {
    next = { ...next, phase: next.cyclesCompleted >= next.maxCycles ? 'playing' : 'playing', quizGate: null };
    changed = true;
  }

  if (next.quizGate === undefined) {
    next = { ...next, quizGate: null };
    changed = true;
  }

  return { v2: next, changed };
}
