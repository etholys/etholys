/** Tarefas / milestones do expediente FundHub (por fundo). */

export type FundTask = {
  id: string;
  title: string;
  dueAt?: string;
  done: boolean;
  createdAt: string;
};

export const DEFAULT_MILESTONE_KEYS = [
  'loi',
  'draft',
  'budget',
  'review',
  'submit',
] as const;

export function defaultMilestones(locale: string, deadlineIso?: string | null): FundTask[] {
  const pt = locale === 'pt';
  const es = locale === 'es';
  const titles: Record<(typeof DEFAULT_MILESTONE_KEYS)[number], string> = {
    loi: pt ? 'LOI / carta de intenção' : es ? 'LOI / carta de intención' : 'LOI / intent letter',
    draft: pt ? 'Rascunho da proposta' : es ? 'Borrador de la propuesta' : 'Proposal draft',
    budget: pt ? 'Orçamento' : es ? 'Presupuesto' : 'Budget',
    review: pt ? 'Revisão interna' : es ? 'Revisión interna' : 'Internal review',
    submit: pt ? 'Submissão' : es ? 'Envío' : 'Submit',
  };
  const now = new Date().toISOString();
  return DEFAULT_MILESTONE_KEYS.map((key) => ({
    id: `ms_${key}`,
    title: titles[key],
    dueAt: key === 'submit' && deadlineIso ? deadlineIso.slice(0, 10) : undefined,
    done: false,
    createdAt: now,
  }));
}

export function parseFundTasks(raw: unknown): FundTask[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((t): t is Record<string, unknown> => Boolean(t) && typeof t === 'object')
    .map((t, i) => ({
      id: typeof t.id === 'string' ? t.id.slice(0, 80) : `task_${i}`,
      title: String(t.title ?? '').slice(0, 200),
      dueAt: typeof t.dueAt === 'string' ? t.dueAt.slice(0, 40) : undefined,
      done: Boolean(t.done),
      createdAt: typeof t.createdAt === 'string' ? t.createdAt : new Date().toISOString(),
    }))
    .filter((t) => t.title)
    .slice(0, 40);
}

export function newFundTask(title: string, dueAt?: string): FundTask {
  return {
    id: `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    title: title.trim().slice(0, 200),
    dueAt: dueAt?.slice(0, 40),
    done: false,
    createdAt: new Date().toISOString(),
  };
}
