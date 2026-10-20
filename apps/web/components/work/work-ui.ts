export const WORK_STATUSES = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED'] as const;
export const WORK_KANBAN = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'] as const;
export const WORK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

/** Soft chips that stay readable on Hub dark and light (no pastel islands). */
export const STATUS_STYLE: Record<string, { bg: string; text: string; dot: string }> = {
  BACKLOG: { bg: 'bg-slate-500/15', text: 'text-[color:var(--sys-ink)]', dot: 'bg-slate-400' },
  TODO: { bg: 'bg-sky-500/15', text: 'text-sky-200', dot: 'bg-sky-500' },
  IN_PROGRESS: { bg: 'bg-amber-500/15', text: 'text-amber-200', dot: 'bg-amber-500' },
  IN_REVIEW: { bg: 'bg-violet-500/15', text: 'text-violet-200', dot: 'bg-violet-500' },
  DONE: { bg: 'bg-emerald-500/15', text: 'text-emerald-200', dot: 'bg-emerald-500' },
  CANCELLED: { bg: 'bg-rose-500/15', text: 'text-rose-200', dot: 'bg-rose-400' },
};

export const PRIORITY_STYLE: Record<string, { bg: string; text: string }> = {
  LOW: { bg: 'bg-slate-500/15', text: 'text-[color:var(--sys-muted)]' },
  MEDIUM: { bg: 'bg-cyan-500/15', text: 'text-cyan-200' },
  HIGH: { bg: 'bg-orange-500/15', text: 'text-orange-200' },
  CRITICAL: { bg: 'bg-rose-500/15', text: 'text-rose-200' },
};

export type WorkColumnKind =
  | 'status'
  | 'person'
  | 'priority'
  | 'due'
  | 'start'
  | 'estimate'
  | 'origin'
  | 'updates'
  | 'files'
  | 'tags'
  | 'group'
  | 'text'
  | 'number'
  | 'checkbox'
  | 'date';

export type WorkColumn = { id: string; kind: WorkColumnKind; label: string };

export type WorkNotifyPrefs = { comment: boolean; assign: boolean; status: boolean };

export const DEFAULT_WORK_COLUMNS: WorkColumn[] = [
  { id: 'status', kind: 'status', label: 'Status' },
  { id: 'person', kind: 'person', label: 'Person' },
  { id: 'priority', kind: 'priority', label: 'Priority' },
  { id: 'due', kind: 'due', label: 'Due' },
  { id: 'updates', kind: 'updates', label: 'Updates' },
];

export const DEFAULT_WORK_NOTIFY: WorkNotifyPrefs = { comment: true, assign: true, status: true };

const SINGLETON_KINDS = new Set<WorkColumnKind>([
  'status',
  'person',
  'priority',
  'due',
  'start',
  'estimate',
  'origin',
  'updates',
  'files',
  'tags',
  'group',
]);

export function columnKindLabel(kind: WorkColumnKind, t: (en: string, es: string, pt: string) => string) {
  switch (kind) {
    case 'status':
      return t('Status', 'Estado', 'Estado');
    case 'person':
      return t('Person', 'Persona', 'Pessoa');
    case 'priority':
      return t('Priority', 'Prioridad', 'Prioridade');
    case 'due':
      return t('Due', 'Fecha', 'Prazo');
    case 'start':
      return t('Start', 'Inicio', 'Início');
    case 'estimate':
      return t('Estimate', 'Estimación', 'Estimativa');
    case 'origin':
      return t('Origin', 'Origen', 'Origem');
    case 'updates':
      return t('Updates', 'Actualizaciones', 'Atualizações');
    case 'files':
      return t('Files', 'Archivos', 'Ficheiros');
    case 'tags':
      return t('Tags', 'Etiquetas', 'Etiquetas');
    case 'group':
      return t('Group', 'Grupo', 'Grupo');
    case 'text':
      return t('Text', 'Texto', 'Texto');
    case 'number':
      return t('Number', 'Número', 'Número');
    case 'checkbox':
      return t('Checkbox', 'Casilla', 'Caixa');
    case 'date':
      return t('Date', 'Fecha', 'Data');
    default:
      return kind;
  }
}

export function canAddColumnKind(columns: WorkColumn[], kind: WorkColumnKind) {
  if (!SINGLETON_KINDS.has(kind)) return true;
  return !columns.some((c) => c.kind === kind);
}

export const GROUP_COLORS = ['#0891b2', '#0d9488', '#2563eb', '#7c3aed', '#db2777', '#ea580c', '#65a30d'];

export const STARTER_GROUPS = [
  { name: 'To do', color: '#0891b2' },
  { name: 'Doing', color: '#ea580c' },
  { name: 'Done', color: '#16a34a' },
] as const;

type LabelFn = (en: string, es: string, pt: string) => string;

export function workStatusLabel(code: string, t: LabelFn): string {
  switch (code) {
    case 'BACKLOG':
      return t('Backlog', 'Backlog', 'Backlog');
    case 'TODO':
      return t('To do', 'Por hacer', 'Por fazer');
    case 'IN_PROGRESS':
      return t('In progress', 'En curso', 'Em curso');
    case 'IN_REVIEW':
      return t('In review', 'En revisión', 'Em revisão');
    case 'DONE':
      return t('Done', 'Hecho', 'Feito');
    case 'CANCELLED':
      return t('Cancelled', 'Cancelada', 'Cancelada');
    default:
      return code.replace(/_/g, ' ');
  }
}

export function workPriorityLabel(code: string, t: LabelFn): string {
  switch (code) {
    case 'LOW':
      return t('Low', 'Baja', 'Baixa');
    case 'MEDIUM':
      return t('Medium', 'Media', 'Média');
    case 'HIGH':
      return t('High', 'Alta', 'Alta');
    case 'CRITICAL':
      return t('Critical', 'Crítica', 'Crítica');
    default:
      return code;
  }
}

export function parseTags(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String).map((t) => t.trim()).filter(Boolean);
  return String(raw)
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}
