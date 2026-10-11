export const WORK_STATUSES = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED'] as const;
export const WORK_KANBAN = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'] as const;
export const WORK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

export const STATUS_STYLE: Record<string, { bg: string; text: string; dot: string }> = {
  BACKLOG: { bg: 'bg-slate-100', text: 'text-slate-700', dot: 'bg-slate-400' },
  TODO: { bg: 'bg-sky-50', text: 'text-sky-800', dot: 'bg-sky-500' },
  IN_PROGRESS: { bg: 'bg-amber-50', text: 'text-amber-800', dot: 'bg-amber-500' },
  IN_REVIEW: { bg: 'bg-violet-50', text: 'text-violet-800', dot: 'bg-violet-500' },
  DONE: { bg: 'bg-emerald-50', text: 'text-emerald-800', dot: 'bg-emerald-500' },
  CANCELLED: { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-400' },
};

export const PRIORITY_STYLE: Record<string, { bg: string; text: string }> = {
  LOW: { bg: 'bg-slate-100', text: 'text-slate-600' },
  MEDIUM: { bg: 'bg-cyan-50', text: 'text-cyan-800' },
  HIGH: { bg: 'bg-orange-50', text: 'text-orange-800' },
  CRITICAL: { bg: 'bg-red-50', text: 'text-red-800' },
};

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
