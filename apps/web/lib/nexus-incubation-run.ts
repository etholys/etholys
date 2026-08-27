/**
 * Estado vivo do processo de incubação / consultoria AT — persistido em NexusVentureState.incubatorNotes.
 */

import type { StrategicPlanOutline, WorkPlanItemKind } from './nexus-incubation-workplan';
import type { DevelopmentLayer } from './nexus-incubation-workplan';
import {
  INCUBATION_PROGRAM_JSON_TAG,
  normalizeProgram,
  parseIncubationProgramFromNotes,
  type IncubationProgram,
} from './nexus-incubation-program';
import type { DiagnosticAnalyzeResult } from './nexus-diagnostic-analyze';

export const INCUBATION_RUN_JSON_TAG = '[[NEXUS_INCUBATION_RUN_V1]]';

export type LayerStatus = 'pending' | 'active' | 'completed';

export type IncubationLayerState = {
  index: number;
  title: string;
  monthStart: number;
  monthEnd: number;
  hoursBudget: number;
  goals: string[];
  status: LayerStatus;
  taskIds: string[];
};

export type IncubationDiagnosisSnapshot = {
  id: string;
  at: string;
  sectorId: string;
  sectorName: string;
  overall: number;
  strengths: string[];
  weaknesses: string[];
  potentials: string[];
  pillarScores: Array<{ slug: string; name: string; score: number }>;
  summary?: string;
};

export type IncubationAdvance = {
  at: string;
  type: 'diagnosis' | 'layer_start' | 'layer_complete' | 'plan_commit' | 'tool' | 'review';
  label: string;
  note?: string;
};

export type ImplementedTool = {
  id: string;
  name: string;
  category: 'finance' | 'operations' | 'commercial' | 'digital' | 'people' | 'strategy' | 'other';
  implementedAt?: string;
  notes?: string;
};

export type IncubationRun = {
  version: 1;
  program: IncubationProgram;
  targetCompanyId?: string;
  networkId?: string | null;
  diagnosis?: IncubationDiagnosisSnapshot | null;
  diagnosisHistory?: IncubationDiagnosisSnapshot[];
  layers: IncubationLayerState[];
  strategicPlan?: StrategicPlanOutline | null;
  currentLayerIndex: number;
  advances: IncubationAdvance[];
  toolsImplemented: ImplementedTool[];
  workItemTaskMap: Record<string, string>;
  committedAt?: string;
  updatedAt: string;
};

export type IncubationProgress = {
  overallPct: number;
  tasksDone: number;
  tasksTotal: number;
  hoursDone: number;
  hoursPlanned: number;
  currentLayerIndex: number;
  layers: Array<{
    index: number;
    title: string;
    status: LayerStatus;
    done: number;
    total: number;
    pct: number;
  }>;
};

const DONE_STATUSES = new Set(['DONE', 'COMPLETED']);

export function diagnosisFromAnalyze(analyze: DiagnosticAnalyzeResult, sectorId: string): IncubationDiagnosisSnapshot {
  return {
    id: `dx-${Date.now()}`,
    at: new Date().toISOString(),
    sectorId,
    sectorName: analyze.computed.sectorName,
    overall: analyze.computed.overall,
    strengths: analyze.strengths.slice(0, 12).map((s) => s.label),
    weaknesses: analyze.weaknesses.slice(0, 16).map((s) => s.label),
    potentials: analyze.potentials.slice(0, 12).map((s) => s.label),
    pillarScores: analyze.pillarScores.map((p) => ({ slug: p.slug, name: p.name, score: p.score })),
    summary: analyze.summary,
  };
}

export function layersFromWorkPlan(layers: DevelopmentLayer[]): IncubationLayerState[] {
  return layers.map((l, i) => ({
    index: l.index,
    title: l.title,
    monthStart: l.monthStart,
    monthEnd: l.monthEnd,
    hoursBudget: l.hoursBudget,
    goals: l.goals,
    status: (i === 0 ? 'active' : 'pending') as LayerStatus,
    taskIds: [],
  }));
}

export function defaultIncubationRun(program: IncubationProgram, scope?: { companyId?: string; networkId?: string | null }): IncubationRun {
  return {
    version: 1,
    program: normalizeProgram(program),
    targetCompanyId: scope?.companyId,
    networkId: scope?.networkId ?? null,
    diagnosis: null,
    diagnosisHistory: [],
    layers: [],
    strategicPlan: null,
    currentLayerIndex: 0,
    advances: [],
    toolsImplemented: [],
    workItemTaskMap: {},
    updatedAt: new Date().toISOString(),
  };
}

export function parseIncubationRunFromNotes(notes: string | null | undefined): IncubationRun | null {
  if (!notes?.includes(INCUBATION_RUN_JSON_TAG)) return null;
  const idx = notes.indexOf(INCUBATION_RUN_JSON_TAG);
  const json = notes.slice(idx + INCUBATION_RUN_JSON_TAG.length).trim();
  try {
    const raw = JSON.parse(json) as Partial<IncubationRun>;
    if (raw.version !== 1) return null;
    return normalizeIncubationRun(raw);
  } catch {
    return null;
  }
}

export function normalizeIncubationRun(raw: Partial<IncubationRun>): IncubationRun {
  const base = defaultIncubationRun(raw.program || {});
  return {
    version: 1,
    program: normalizeProgram(raw.program || base.program),
    targetCompanyId: raw.targetCompanyId || base.targetCompanyId,
    networkId: raw.networkId ?? base.networkId,
    diagnosis: raw.diagnosis || null,
    diagnosisHistory: Array.isArray(raw.diagnosisHistory) ? raw.diagnosisHistory.slice(0, 12) : [],
    layers: Array.isArray(raw.layers) ? raw.layers : [],
    strategicPlan: raw.strategicPlan || null,
    currentLayerIndex: Number.isFinite(raw.currentLayerIndex) ? Math.max(0, Math.trunc(raw.currentLayerIndex!)) : 0,
    advances: Array.isArray(raw.advances) ? raw.advances.slice(0, 80) : [],
    toolsImplemented: Array.isArray(raw.toolsImplemented) ? raw.toolsImplemented.slice(0, 40) : [],
    workItemTaskMap: raw.workItemTaskMap && typeof raw.workItemTaskMap === 'object' ? raw.workItemTaskMap : {},
    committedAt: raw.committedAt,
    updatedAt: raw.updatedAt || new Date().toISOString(),
  };
}

export function parseHumanNotesFromIncubatorNotes(notes: string | null | undefined): string {
  if (!notes) return '';
  let text = notes;
  for (const tag of [INCUBATION_RUN_JSON_TAG, INCUBATION_PROGRAM_JSON_TAG]) {
    const idx = text.indexOf(tag);
    if (idx >= 0) text = text.slice(0, idx);
  }
  return text.trim();
}

export function serializeIncubatorNotes(run: IncubationRun, humanNotes?: string): string {
  const human = parseHumanNotesFromIncubatorNotes(humanNotes ?? '');
  const payload = normalizeIncubationRun(run);
  payload.updatedAt = new Date().toISOString();
  return `${human ? `${human}\n\n` : ''}${INCUBATION_RUN_JSON_TAG}${JSON.stringify(payload)}`;
}

/** Compat: programa legado embutido só no run */
export function programFromIncubatorNotes(notes: string | null | undefined): IncubationProgram | null {
  const run = parseIncubationRunFromNotes(notes);
  if (run) return run.program;
  return parseIncubationProgramFromNotes(notes);
}

export function mergeHumanNotesIntoIncubatorNotes(existing: string | null | undefined, humanNotes: string): string {
  const run = parseIncubationRunFromNotes(existing);
  if (run) return serializeIncubatorNotes(run, humanNotes);
  const program = parseIncubationProgramFromNotes(existing);
  if (program) {
    const stub = defaultIncubationRun(program);
    return serializeIncubatorNotes(stub, humanNotes);
  }
  return humanNotes.trim();
}

export function pushAdvance(run: IncubationRun, advance: Omit<IncubationAdvance, 'at'>): IncubationRun {
  return {
    ...run,
    advances: [{ ...advance, at: new Date().toISOString() }, ...run.advances].slice(0, 80),
    updatedAt: new Date().toISOString(),
  };
}

export function recordDiagnosis(run: IncubationRun, snap: IncubationDiagnosisSnapshot): IncubationRun {
  const history = [snap, ...(run.diagnosisHistory || []).filter((x) => x.id !== snap.id)].slice(0, 12);
  let next = {
    ...run,
    diagnosis: snap,
    diagnosisHistory: history,
    updatedAt: new Date().toISOString(),
  };
  next = pushAdvance(next, {
    type: 'diagnosis',
    label: `Diagnóstico ${snap.sectorName} · ${snap.overall}/100`,
    note: snap.summary?.slice(0, 200),
  });
  return next;
}

type TaskRow = { id: string; status: string; tags: string | null; description: string | null };

export function syncLayerProgressFromTasks(
  run: IncubationRun,
  tasks: TaskRow[],
  itemHours: Record<string, number> = {}
): { run: IncubationRun; progress: IncubationProgress } {
  const incubationTasks = tasks.filter((t) => t.tags?.includes('nexus:incubation'));
  const layers = run.layers.map((layer) => {
    const layerTasks = incubationTasks.filter((t) => t.tags?.includes(`incubation:layer:${layer.index}`));
    const taskIds = [...new Set([...layer.taskIds, ...layerTasks.map((t) => t.id)])];
    const doneIds = layerTasks.filter((t) => DONE_STATUSES.has(t.status)).map((t) => t.id);
    let status = layer.status;
    if (layerTasks.length > 0 && doneIds.length >= layerTasks.length) status = 'completed';
    else if (layerTasks.some((t) => !DONE_STATUSES.has(t.status)) && layer.index <= run.currentLayerIndex) {
      status = 'active';
    }
    return { ...layer, taskIds, status };
  });

  let currentLayerIndex = run.currentLayerIndex;
  for (let i = 0; i < layers.length; i++) {
    if (layers[i]!.status !== 'completed') {
      currentLayerIndex = i;
      if (layers[i]!.status === 'pending') layers[i] = { ...layers[i]!, status: 'active' };
      break;
    }
    if (i === layers.length - 1) currentLayerIndex = i;
  }

  const layerProgress = layers.map((layer) => {
    const layerTasks = incubationTasks.filter((t) => t.tags?.includes(`incubation:layer:${layer.index}`));
    const done = layerTasks.filter((t) => DONE_STATUSES.has(t.status)).length;
    const total = layerTasks.length;
    return {
      index: layer.index,
      title: layer.title,
      status: layer.status,
      done,
      total,
      pct: total > 0 ? Math.round((done / total) * 100) : layer.status === 'completed' ? 100 : 0,
    };
  });

  const tasksDone = incubationTasks.filter((t) => DONE_STATUSES.has(t.status)).length;
  const tasksTotal = incubationTasks.length;
  let hoursDone = 0;
  let hoursPlanned = 0;
  for (const t of incubationTasks) {
    const wi = t.tags?.match(/incubation:wi:([a-zA-Z0-9_]+)/)?.[1];
    const h = wi && itemHours[wi] != null ? itemHours[wi]! : 4;
    hoursPlanned += h;
    if (DONE_STATUSES.has(t.status)) hoursDone += h;
  }

  const overallPct = tasksTotal > 0 ? Math.round((tasksDone / tasksTotal) * 100) : run.committedAt ? 5 : 0;

  return {
    run: { ...run, layers, currentLayerIndex, updatedAt: new Date().toISOString() },
    progress: {
      overallPct,
      tasksDone,
      tasksTotal,
      hoursDone,
      hoursPlanned,
      currentLayerIndex,
      layers: layerProgress,
    },
  };
}

export function kindLabel(kind: WorkPlanItemKind, locale: 'es' | 'pt' | 'en'): string {
  const map: Record<WorkPlanItemKind, { es: string; pt: string; en: string }> = {
    visit: { es: 'Visita técnica', pt: 'Visita técnica', en: 'Field visit' },
    workshop: { es: 'Taller', pt: 'Workshop', en: 'Workshop' },
    deliverable: { es: 'Entregable', pt: 'Entregável', en: 'Deliverable' },
    review: { es: 'Revisión', pt: 'Revisão', en: 'Review' },
    training: { es: 'Formación', pt: 'Formação', en: 'Training' },
  };
  return map[kind][locale] || map[kind].es;
}
