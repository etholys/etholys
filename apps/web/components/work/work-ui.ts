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
  | 'responsible'
  | 'reviewer'
  | 'text'
  | 'number'
  | 'checkbox'
  | 'date';

export type WorkColumn = { id: string; kind: WorkColumnKind; label: string };

export type WorkNotifyPrefs = { comment: boolean; assign: boolean; status: boolean; email: boolean };

/** Slim daily-scan defaults: Task · Status · Executor · Priority · Due. Roles/updates via + Column or panel. */
export const DEFAULT_WORK_COLUMNS: WorkColumn[] = [
  { id: 'status', kind: 'status', label: 'Status' },
  { id: 'person', kind: 'person', label: 'Executor' },
  { id: 'priority', kind: 'priority', label: 'Priority' },
  { id: 'due', kind: 'due', label: 'Due' },
];

/** Templates opcionais — só se aplicam quando o utilizador escolhe. */
export const WORK_BOARD_TEMPLATES: Array<{
  id: string;
  label: { en: string; es: string; pt: string };
  columns: WorkColumn[];
}> = [
  {
    id: 'simple',
    label: { en: 'Simple', es: 'Simple', pt: 'Simples' },
    columns: [
      { id: 'status', kind: 'status', label: 'Status' },
      { id: 'person', kind: 'person', label: 'Person' },
      { id: 'due', kind: 'due', label: 'Due' },
    ],
  },
  {
    id: 'default',
    label: { en: 'Standard', es: 'Estándar', pt: 'Padrão' },
    columns: DEFAULT_WORK_COLUMNS,
  },
  {
    id: 'roles',
    label: { en: 'With roles', es: 'Con roles', pt: 'Com papéis' },
    columns: [
      { id: 'status', kind: 'status', label: 'Status' },
      { id: 'person', kind: 'person', label: 'Person' },
      { id: 'responsible', kind: 'responsible', label: 'Owner' },
      { id: 'reviewer', kind: 'reviewer', label: 'Supervisor' },
      { id: 'priority', kind: 'priority', label: 'Priority' },
      { id: 'due', kind: 'due', label: 'Due' },
      { id: 'updates', kind: 'updates', label: 'Updates' },
    ],
  },
];

export function buildWorkBoardScopeKey(opts: {
  kind: string;
  userId?: string | null;
  folderId?: string | null;
  projectId?: string | null;
  departmentId?: string | null;
}): string {
  switch (opts.kind) {
    case 'mine':
      return `mine:${opts.userId || 'unknown'}`;
    case 'folder':
      return `folder:${opts.folderId || 'unknown'}`;
    case 'project':
      return `project:${opts.projectId || 'unknown'}`;
    case 'department':
      return `department:${opts.departmentId || 'unknown'}`;
    case 'company':
      return 'company';
    case 'all':
      return 'all';
    case 'overdue':
      return 'overdue';
    case 'unassigned':
      return 'unassigned';
    case 'week':
      return 'week';
    default:
      return `nav:${opts.kind}`;
  }
}

export const DEFAULT_WORK_NOTIFY: WorkNotifyPrefs = {
  comment: true,
  assign: true,
  status: true,
  email: true,
};

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
  'responsible',
  'reviewer',
]);

export function columnKindLabel(kind: WorkColumnKind, t: (en: string, es: string, pt: string) => string) {
  switch (kind) {
    case 'status':
      return t('Status', 'Estado', 'Estado');
    case 'person':
      return t('Executor', 'Ejecutor', 'Executor');
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
    case 'responsible':
      return t('Owner', 'Responsable', 'Responsável');
    case 'reviewer':
      return t('Supervisor', 'Supervisor', 'Supervisor');
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

const STATUS_RANK: Record<string, number> = {
  BACKLOG: 0,
  TODO: 1,
  IN_PROGRESS: 2,
  IN_REVIEW: 3,
  DONE: 4,
  CANCELLED: 5,
};

const PRIORITY_RANK: Record<string, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  CRITICAL: 3,
};

export type WorkSortKey = 'title' | string;
export type WorkSortDir = 'asc' | 'desc';
export type WorkBoardSort = { key: WorkSortKey; dir: WorkSortDir };

export function isSortableColumnKind(kind: WorkColumnKind | 'title'): boolean {
  return (
    kind === 'title' ||
    kind === 'status' ||
    kind === 'priority' ||
    kind === 'due' ||
    kind === 'start' ||
    kind === 'person' ||
    kind === 'responsible' ||
    kind === 'reviewer' ||
    kind === 'estimate' ||
    kind === 'tags' ||
    kind === 'group' ||
    kind === 'text' ||
    kind === 'number' ||
    kind === 'date' ||
    kind === 'checkbox' ||
    kind === 'files' ||
    kind === 'updates'
  );
}

type SortableTask = {
  title: string;
  status: string;
  priority: string;
  order?: number;
  dueDate?: string | null;
  startDate?: string | null;
  estimatedHours?: number | null;
  assigneeId?: string | null;
  responsibleId?: string | null;
  reviewerId?: string | null;
  groupId?: string | null;
  customFields?: Record<string, unknown> | null;
  tags?: unknown;
  assignee?: { name?: string | null; email?: string } | null;
  responsible?: { name?: string | null; email?: string } | null;
  reviewer?: { name?: string | null; email?: string } | null;
  _count?: { comments?: number; attachments?: number };
};

function personSortName(
  id: string | null | undefined,
  user: { name?: string | null; email?: string } | null | undefined,
  users: Array<{ id: string; name: string | null; email?: string }>,
) {
  if (!id) return '';
  if (user?.name || user?.email) return String(user.name || user.email || '');
  const found = users.find((u) => u.id === id);
  return found?.name || found?.email || id;
}

function dateMs(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = new Date(String(value)).getTime();
  return Number.isFinite(n) ? n : null;
}

/** Compare two tasks for board column sort. Empty dates/people sink to the end on asc. */
export function compareWorkTasks(
  a: SortableTask,
  b: SortableTask,
  sort: WorkBoardSort,
  columns: WorkColumn[],
  users: Array<{ id: string; name: string | null; email?: string }> = [],
  groups: Array<{ id: string; name: string }> = [],
): number {
  const mul = sort.dir === 'asc' ? 1 : -1;
  let cmp = 0;

  if (sort.key === 'title') {
    cmp = a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
  } else {
    const col = columns.find((c) => c.id === sort.key);
    if (!col) {
      return (a.order ?? 0) - (b.order ?? 0);
    }
    switch (col.kind) {
      case 'due':
      case 'start':
      case 'date': {
        const rawA =
          col.kind === 'due' ? a.dueDate : col.kind === 'start' ? a.startDate : a.customFields?.[col.id];
        const rawB =
          col.kind === 'due' ? b.dueDate : col.kind === 'start' ? b.startDate : b.customFields?.[col.id];
        const at = dateMs(rawA);
        const bt = dateMs(rawB);
        if (at == null && bt == null) cmp = 0;
        else if (at == null) cmp = 1;
        else if (bt == null) cmp = -1;
        else cmp = at - bt;
        break;
      }
      case 'priority':
        cmp = (PRIORITY_RANK[a.priority] ?? 0) - (PRIORITY_RANK[b.priority] ?? 0);
        break;
      case 'status':
        cmp = (STATUS_RANK[a.status] ?? 0) - (STATUS_RANK[b.status] ?? 0);
        break;
      case 'person': {
        if (!a.assigneeId && !b.assigneeId) cmp = 0;
        else if (!a.assigneeId) cmp = 1;
        else if (!b.assigneeId) cmp = -1;
        else {
          cmp = personSortName(a.assigneeId, a.assignee, users).localeCompare(
            personSortName(b.assigneeId, b.assignee, users),
            undefined,
            { sensitivity: 'base' },
          );
        }
        break;
      }
      case 'responsible': {
        if (!a.responsibleId && !b.responsibleId) cmp = 0;
        else if (!a.responsibleId) cmp = 1;
        else if (!b.responsibleId) cmp = -1;
        else {
          cmp = personSortName(a.responsibleId, a.responsible, users).localeCompare(
            personSortName(b.responsibleId, b.responsible, users),
            undefined,
            { sensitivity: 'base' },
          );
        }
        break;
      }
      case 'reviewer': {
        if (!a.reviewerId && !b.reviewerId) cmp = 0;
        else if (!a.reviewerId) cmp = 1;
        else if (!b.reviewerId) cmp = -1;
        else {
          cmp = personSortName(a.reviewerId, a.reviewer, users).localeCompare(
            personSortName(b.reviewerId, b.reviewer, users),
            undefined,
            { sensitivity: 'base' },
          );
        }
        break;
      }
      case 'estimate':
      case 'number': {
        const an =
          col.kind === 'estimate'
            ? a.estimatedHours
            : typeof a.customFields?.[col.id] === 'number'
              ? (a.customFields[col.id] as number)
              : Number(a.customFields?.[col.id]);
        const bn =
          col.kind === 'estimate'
            ? b.estimatedHours
            : typeof b.customFields?.[col.id] === 'number'
              ? (b.customFields[col.id] as number)
              : Number(b.customFields?.[col.id]);
        const av = Number.isFinite(an as number) ? (an as number) : null;
        const bv = Number.isFinite(bn as number) ? (bn as number) : null;
        if (av == null && bv == null) cmp = 0;
        else if (av == null) cmp = 1;
        else if (bv == null) cmp = -1;
        else cmp = av - bv;
        break;
      }
      case 'text': {
        const av = String(a.customFields?.[col.id] ?? '');
        const bv = String(b.customFields?.[col.id] ?? '');
        cmp = av.localeCompare(bv, undefined, { sensitivity: 'base' });
        break;
      }
      case 'tags':
        cmp = parseTags(a.tags).join(',').localeCompare(parseTags(b.tags).join(','), undefined, {
          sensitivity: 'base',
        });
        break;
      case 'group': {
        const an = groups.find((g) => g.id === a.groupId)?.name || '';
        const bn = groups.find((g) => g.id === b.groupId)?.name || '';
        cmp = an.localeCompare(bn, undefined, { sensitivity: 'base' });
        break;
      }
      case 'checkbox': {
        const av = Boolean(a.customFields?.[col.id]) ? 1 : 0;
        const bv = Boolean(b.customFields?.[col.id]) ? 1 : 0;
        cmp = av - bv;
        break;
      }
      case 'files':
        cmp = (a._count?.attachments || 0) - (b._count?.attachments || 0);
        break;
      case 'updates':
        cmp = (a._count?.comments || 0) - (b._count?.comments || 0);
        break;
      default:
        cmp = 0;
    }
  }

  if (cmp === 0) {
    const byOrder = (a.order ?? 0) - (b.order ?? 0);
    if (byOrder !== 0) return byOrder;
    return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
  }
  return cmp * mul;
}

export function workSortOptionLabels(
  kind: WorkColumnKind | 'title',
  t: (en: string, es: string, pt: string) => string,
): { asc: string; desc: string } {
  switch (kind) {
    case 'title':
      return {
        asc: t('A → Z', 'A → Z', 'A → Z'),
        desc: t('Z → A', 'Z → A', 'Z → A'),
      };
    case 'due':
    case 'start':
    case 'date':
      return {
        asc: t('Nearest first', 'Más próxima primero', 'Mais próxima primeiro'),
        desc: t('Furthest first', 'Más lejana primero', 'Mais longe primeiro'),
      };
    case 'priority':
      return {
        asc: t('Low → Critical', 'Baja → Crítica', 'Baixa → Crítica'),
        desc: t('Critical → Low', 'Crítica → Baja', 'Crítica → Baixa'),
      };
    case 'status':
      return {
        asc: t('Backlog → Done', 'Backlog → Hecho', 'Backlog → Feito'),
        desc: t('Done → Backlog', 'Hecho → Backlog', 'Feito → Backlog'),
      };
    case 'person':
    case 'responsible':
    case 'reviewer':
    case 'group':
    case 'tags':
    case 'text':
      return {
        asc: t('A → Z', 'A → Z', 'A → Z'),
        desc: t('Z → A', 'Z → A', 'Z → A'),
      };
    case 'estimate':
    case 'number':
    case 'files':
    case 'updates':
      return {
        asc: t('Low → High', 'Menor → Mayor', 'Menor → Maior'),
        desc: t('High → Low', 'Mayor → Menor', 'Maior → Menor'),
      };
    case 'checkbox':
      return {
        asc: t('Unchecked first', 'Sin marcar primero', 'Desmarcadas primeiro'),
        desc: t('Checked first', 'Marcadas primero', 'Marcadas primeiro'),
      };
    default:
      return {
        asc: t('Ascending', 'Ascendente', 'Ascendente'),
        desc: t('Descending', 'Descendente', 'Descendente'),
      };
  }
}
