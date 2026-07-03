/** Helpers: actividades no marco lógico vs. arrays flat do Smart Import */

export type ImportActivityRow = {
  code: string;
  title: string;
  description?: string | null;
  startDate: string | null;
  endDate: string | null;
  source?: 'objectives' | 'timeline' | 'milestone';
};

type ObjNode = {
  type?: string;
  code?: string;
  title?: string;
  description?: string;
  startDate?: string | null;
  endDate?: string | null;
  children?: ObjNode[];
};

function rowKey(a: ImportActivityRow) {
  return `${(a.code || '').trim()}|${(a.title || '').trim()}`.toLowerCase();
}

function normalizeActivityRow(raw: Record<string, unknown>): ImportActivityRow | null {
  const title = String(
    raw.title ?? raw.name ?? raw.activity ?? raw.description ?? raw.task ?? '',
  ).trim();
  if (!title) return null;
  return {
    code: String(raw.code ?? raw.id ?? raw.number ?? '').trim(),
    title,
    description: raw.description ? String(raw.description) : null,
    startDate: (raw.startDate ?? raw.start ?? raw.from ?? raw.dateStart ?? null) as string | null,
    endDate: (raw.endDate ?? raw.end ?? raw.to ?? raw.dateEnd ?? raw.dueDate ?? null) as string | null,
    source: 'timeline',
  };
}

function normalizeMilestoneRow(raw: Record<string, unknown>) {
  const name = String(raw.name ?? raw.title ?? raw.milestone ?? '').trim();
  if (!name) return null;
  return {
    name,
    description: raw.description ? String(raw.description) : null,
    dueDate: (raw.dueDate ?? raw.endDate ?? raw.date ?? null) as string | null,
  };
}

/** Percorre árvore objectives e recolhe nós type=activity (e deliverable opcional como actividade). */
export function collectActivitiesFromObjectives(objectives: ObjNode[] | undefined | null): ImportActivityRow[] {
  const out: ImportActivityRow[] = [];
  const walk = (nodes: ObjNode[]) => {
    for (const n of nodes ?? []) {
      if (n.type === 'activity' || n.type === 'deliverable') {
        out.push({
          code: n.code || '',
          title: n.title || '',
          description: n.description || null,
          startDate: n.startDate ?? null,
          endDate: n.endDate ?? null,
          source: 'objectives',
        });
      }
      if (n.children?.length) walk(n.children);
    }
  };
  walk(objectives ?? []);
  return out;
}

/** Normaliza resposta parcial da IA (timeline Excel usa chaves variadas). */
export function normalizeMilestonesPartial(partial: Record<string, unknown>): {
  milestones: Array<{ name: string; description: string | null; dueDate: string | null }>;
  activities: ImportActivityRow[];
} {
  const milestoneSources = [
    partial.milestones,
    partial.hitos,
    partial.milestone,
  ].find(Array.isArray) as unknown[] | undefined;

  const activitySources = [
    partial.activities,
    partial.timeline,
    partial.activityTimeline,
    partial.timelineRows,
    partial.rows,
    partial.workPlan,
    partial.cronograma,
  ].find(Array.isArray) as unknown[] | undefined;

  let activities: ImportActivityRow[] = [];
  if (Array.isArray(activitySources)) {
    activities = activitySources
      .map((r) => normalizeActivityRow(r as Record<string, unknown>))
      .filter(Boolean) as ImportActivityRow[];
  }

  if (activities.length === 0 && Array.isArray(partial.objectives)) {
    activities = collectActivitiesFromObjectives(partial.objectives as ObjNode[]);
  }

  let milestones: Array<{ name: string; description: string | null; dueDate: string | null }> = [];
  if (Array.isArray(milestoneSources)) {
    milestones = milestoneSources
      .map((r) => normalizeMilestoneRow(r as Record<string, unknown>))
      .filter(Boolean) as Array<{ name: string; description: string | null; dueDate: string | null }>;
  }

  return { milestones, activities };
}

/** União para a aba Actividades: timeline + marco lógico. */
export function mergeActivityViews(
  flatActivities: ImportActivityRow[] | undefined | null,
  objectives: ObjNode[] | undefined | null,
): ImportActivityRow[] {
  const map = new Map<string, ImportActivityRow>();
  for (const a of [...(flatActivities ?? []), ...collectActivitiesFromObjectives(objectives)]) {
    const key = rowKey(a);
    if (!map.has(key)) map.set(key, a);
  }
  return Array.from(map.values());
}

export function countActivityViews(
  flatActivities: ImportActivityRow[] | undefined | null,
  objectives: ObjNode[] | undefined | null,
  milestonesCount: number,
): number {
  return mergeActivityViews(flatActivities, objectives).length + milestonesCount;
}
