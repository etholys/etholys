import type { GameSpecV1 } from '@/lib/forge/schemas/game-spec-v1';
import type { ForgeEngine, GameAction, GameEvent, GameState } from '@/lib/forge/engines/types';

type Branch = { id: string; prompt: string; choices: { id: string; label: string; nextId: string; feedback?: string }[] };

type BranchState = {
  nodeId: string;
  path: string[];
  finished: boolean;
};

function getBranches(spec: GameSpecV1): Branch[] {
  const raw = (spec as GameSpecV1 & { branches?: Branch[] }).branches;
  if (Array.isArray(raw) && raw.length) return raw;
  return (spec.cards ?? []).map((c) => ({
    id: c.id,
    prompt: c.prompt,
    choices: [
      { id: `${c.id}-a`, label: 'Avançar', nextId: 'end', feedback: c.reflection ?? 'Boa escolha.' },
    ],
  }));
}

function asState(state: GameState): BranchState {
  const s = state as Partial<BranchState>;
  return {
    nodeId: typeof s.nodeId === 'string' ? s.nodeId : 'start',
    path: Array.isArray(s.path) ? (s.path as string[]) : [],
    finished: Boolean(s.finished),
  };
}

export const branchingEngine: ForgeEngine = {
  engine: 'branching',

  validateSpec(spec: GameSpecV1): GameSpecV1 {
    const branches = getBranches(spec);
    if (!branches.length) throw new Error('Motor branching requer branches[] ou cards[]');
    return spec;
  },

  createInitialState(spec: GameSpecV1): GameState {
    const branches = getBranches(spec);
    return { nodeId: branches[0]?.id ?? 'start', path: [], finished: false } satisfies BranchState;
  },

  applyAction(state: GameState, action: GameAction, spec: GameSpecV1): { state: GameState; events: GameEvent[] } {
    const s = asState(state);
    const branches = getBranches(spec);
    const events: GameEvent[] = [];

    if (s.finished) return { state: s, events: [{ type: 'already_finished' }] };

    if (action.type === 'choose') {
      const choiceId = typeof action.payload?.choiceId === 'string' ? action.payload.choiceId : '';
      const node = branches.find((b) => b.id === s.nodeId);
      const choice = node?.choices.find((c) => c.id === choiceId);
      if (!choice) return { state: s, events: [{ type: 'error', message: 'Escolha inválida.' }] };

      s.path.push(choice.id);
      events.push({ type: 'choice', message: choice.feedback ?? choice.label, xp: 15 });

      if (choice.nextId === 'end' || s.path.length >= (spec.rules?.minInsights ?? 3)) {
        s.finished = true;
        events.push({ type: 'win', message: 'Simulação concluída.' });
      } else {
        const next = branches.find((b) => b.id === choice.nextId);
        if (next) s.nodeId = next.id;
        else {
          s.finished = true;
          events.push({ type: 'win' });
        }
      }
      return { state: s, events };
    }

    return { state: s, events: [{ type: 'error' }] };
  },

  isComplete(state: GameState, spec: GameSpecV1): boolean {
    return asState(state).finished;
  },

  computeScore(state: GameState, spec: GameSpecV1): number {
    const s = asState(state);
    const target = spec.rules?.minInsights ?? 3;
    return Math.min(1, s.path.length / target);
  },
};
