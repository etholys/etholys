'use client';

import { Fragment, useState } from 'react';
import { ChevronDown, ChevronRight, Copy, GripVertical, Paperclip, Plus, Trash2 } from 'lucide-react';
import { getInitials } from '@/lib/utils';
import { WorkUpdates } from './WorkUpdates';
import {
  WORK_KANBAN,
  WORK_PRIORITIES,
  STATUS_STYLE,
  canAddColumnKind,
  columnKindLabel,
  DEFAULT_WORK_COLUMNS,
  parseTags,
  type WorkColumn,
  type WorkColumnKind,
  type WorkNotifyPrefs,
} from './work-ui';

type UserOpt = { id: string; name: string | null; email?: string };
type GroupOpt = { id: string; name: string; color: string | null };
type TaskRow = {
  id: string;
  title: string;
  status: string;
  priority: string;
  order?: number;
  dueDate?: string | null;
  startDate?: string | null;
  estimatedHours?: number | null;
  customFields?: Record<string, unknown> | null;
  tags?: unknown;
  assigneeId?: string | null;
  responsibleId?: string | null;
  reviewerId?: string | null;
  collaboratorIds?: unknown;
  responsible?: UserOpt | null;
  reviewer?: UserOpt | null;
  projectId?: string | null;
  departmentId?: string | null;
  folderId?: string | null;
  groupId?: string | null;
  assignee?: UserOpt | null;
  project?: { id?: string; name?: string } | null;
  department?: { id?: string; name?: string } | null;
  folder?: { id?: string; name?: string } | null;
  checklist?: Array<{ id: string; completed: boolean }>;
  _count?: { comments?: number; subtasks?: number; attachments?: number };
};

type DropTarget =
  | { kind: 'row'; groupId: string | null; beforeTaskId: string }
  | { kind: 'end'; groupId: string | null };

function cellStop(e: React.MouseEvent | React.KeyboardEvent) {
  e.stopPropagation();
}

function sortByOrder(tasks: TaskRow[]) {
  return [...tasks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.title.localeCompare(b.title));
}

function personIds(task: TaskRow) {
  const extra = Array.isArray(task.collaboratorIds) ? task.collaboratorIds.map((id) => String(id)) : [];
  return [task.assigneeId, ...extra].filter((id): id is string => Boolean(id));
}

function PeopleCell({
  task,
  users,
  onPatch,
  t,
}: {
  task: TaskRow;
  users: UserOpt[];
  onPatch: (id: string, body: Record<string, unknown>) => void;
  t: (en: string, es: string, pt: string) => string;
}) {
  const ids = personIds(task);
  const extra = ids.filter((id) => id !== task.assigneeId);
  const nameOf = (id: string) => users.find((u) => u.id === id)?.name || users.find((u) => u.id === id)?.email || id;
  return (
    <div className="flex min-w-[140px] flex-wrap items-center gap-1">
      {ids.map((id) => (
        <button
          key={id}
          type="button"
          title={nameOf(id)}
          onClick={() => {
            if (id === task.assigneeId) {
              const [next, ...rest] = extra;
              onPatch(task.id, { assigneeId: next || null, collaboratorIds: rest });
            } else {
              onPatch(task.id, { collaboratorIds: extra.filter((row) => row !== id) });
            }
          }}
          className="inline-flex h-6 items-center gap-1 rounded-full bg-teal-500/15 px-1.5 text-[10px] font-semibold text-teal-200"
        >
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-teal-500/35 text-[8px] text-[color:var(--sys-ink)]">
            {getInitials(nameOf(id))}
          </span>
          <span className="max-w-[72px] truncate">{nameOf(id)}</span>
        </button>
      ))}
      <select
        value=""
        onChange={(e) => {
          const id = e.target.value;
          if (!id || ids.includes(id)) return;
          if (!task.assigneeId) onPatch(task.id, { assigneeId: id });
          else onPatch(task.id, { collaboratorIds: [...extra, id] });
        }}
        className="max-w-[88px] cursor-pointer bg-transparent text-[11px] text-[color:var(--sys-faint)] outline-none"
      >
        <option value="">{t('+ Person', '+ Persona', '+ Pessoa')}</option>
        {users.filter((u) => !ids.includes(u.id)).map((u) => (
          <option key={u.id} value={u.id}>{u.name || u.email}</option>
        ))}
      </select>
    </div>
  );
}

function RoleSelect({
  value,
  users,
  onChange,
  t,
}: {
  value: string;
  users: UserOpt[];
  onChange: (id: string) => void;
  t: (en: string, es: string, pt: string) => string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full cursor-pointer bg-transparent text-[11px] text-[color:var(--sys-ink)] outline-none"
    >
      <option value="">{t('—', '—', '—')}</option>
      {users.map((u) => (
        <option key={u.id} value={u.id}>
          {u.name || u.email}
        </option>
      ))}
    </select>
  );
}

function TagsCell({
  task,
  onPatch,
  t,
}: {
  task: TaskRow;
  onPatch: (id: string, body: Record<string, unknown>) => void;
  t: (en: string, es: string, pt: string) => string;
}) {
  const tags = parseTags(task.tags);
  return (
    <div className="flex min-w-[120px] flex-wrap items-center gap-1">
      {tags.map((tag) => (
        <button
          key={tag}
          type="button"
          onClick={() => onPatch(task.id, { tags: tags.filter((row) => row !== tag).join(',') })}
          className="rounded-full bg-cyan-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-200"
          title={t('Remove tag', 'Quitar etiqueta', 'Remover etiqueta')}
        >
          {tag}
        </button>
      ))}
      <input
        type="text"
        placeholder={t('+ Tag', '+ Etiqueta', '+ Etiqueta')}
        className="w-16 bg-transparent text-[11px] text-[color:var(--sys-faint)] outline-none"
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return;
          const value = (e.target as HTMLInputElement).value.trim();
          if (!value) return;
          e.preventDefault();
          if (!tags.includes(value)) onPatch(task.id, { tags: [...tags, value].join(',') });
          (e.target as HTMLInputElement).value = '';
        }}
      />
    </div>
  );
}

function FileCell({
  taskId,
  count,
  t,
}: {
  taskId: string;
  count: number;
  t: (en: string, es: string, pt: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<Array<{ id: string; fileName: string }>>([]);
  const [n, setN] = useState(count);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const res = await fetch(`/api/tasks/${taskId}/files`);
    const data = await res.json().catch(() => ({}));
    const list = Array.isArray(data?.files) ? data.files : [];
    setFiles(list);
    setN(list.length);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          void load();
        }}
        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[color:var(--sys-ink)]"
      >
        <Paperclip className="h-3.5 w-3.5" />
        {n > 0 ? n : t('Add', 'Añadir', 'Adicionar')}
      </button>
      {open && (
        <div className="absolute left-0 z-30 mt-1 w-56 rounded-xl border border-[color:var(--sys-line)] bg-[color:var(--sys-panel,#0f172a)] p-2 shadow-lg">
          {files.map((file) => (
            <a
              key={file.id}
              href={`/api/tasks/${taskId}/files/${file.id}`}
              className="block truncate rounded px-1 py-1 text-[11px] text-[color:var(--sys-ink)] hover:bg-[color:var(--sys-nav-hover)]"
            >
              {file.fileName}
            </a>
          ))}
          <label className="mt-1 block cursor-pointer rounded px-1 py-1 text-[11px] font-semibold text-teal-300 hover:bg-teal-500/10">
            {busy ? t('Uploading…', 'Subiendo…', 'A enviar…') : t('+ Upload file', '+ Subir archivo', '+ Enviar ficheiro')}
            <input
              type="file"
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                setBusy(true);
                const body = new FormData();
                body.set('file', file);
                void fetch(`/api/tasks/${taskId}/files`, { method: 'POST', body })
                  .then(() => load())
                  .finally(() => setBusy(false));
              }}
            />
          </label>
        </div>
      )}
    </div>
  );
}

export function WorkTableBoard({
  groups,
  ungroupedTasks,
  tasksByGroupId,
  users,
  selectedId,
  onSelect,
  onPatch,
  onMoveTask,
  onQuickAdd,
  onCreateGroup,
  onRenameGroup,
  onDeleteGroup,
  onSeedStarter,
  creatingGroup,
  seedingStarter,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  t,
  statusLabel,
  priorityLabel,
  columns = DEFAULT_WORK_COLUMNS,
  projects = [],
  departments = [],
  folders = [],
  notify,
  onColumnsChange,
  onNotifyChange,
  onCommentPosted,
  onDeleteTask,
  subtasksOf,
  onAddSubtask,
  onDuplicate,
}: {
  groups: GroupOpt[];
  ungroupedTasks: TaskRow[];
  tasksByGroupId: (groupId: string) => TaskRow[];
  users: UserOpt[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onPatch: (id: string, body: Record<string, unknown>) => void;
  onMoveTask: (taskId: string, groupId: string | null, beforeTaskId: string | null) => void;
  onQuickAdd: (groupId: string | null, title: string) => Promise<void>;
  onCreateGroup: (name: string) => Promise<void>;
  onRenameGroup: (id: string, name: string) => Promise<void>;
  onDeleteGroup: (id: string, name: string) => void;
  onSeedStarter: () => void;
  creatingGroup: boolean;
  seedingStarter: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: (ids: string[]) => void;
  t: (en: string, es: string, pt: string) => string;
  statusLabel: (s: string) => string;
  priorityLabel: (p: string) => string;
  columns?: WorkColumn[];
  projects?: Array<{ id: string; name: string }>;
  departments?: Array<{ id: string; name: string }>;
  folders?: Array<{ id: string; name: string }>;
  notify?: WorkNotifyPrefs;
  onColumnsChange?: (columns: WorkColumn[]) => void;
  onNotifyChange?: (notify: WorkNotifyPrefs) => void;
  onCommentPosted?: () => void;
  onDeleteTask?: (id: string, title: string) => void;
  subtasksOf?: (parentId: string) => TaskRow[];
  onAddSubtask?: (parentId: string, title: string) => Promise<void>;
  onDuplicate?: (task: TaskRow) => void;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [newGroup, setNewGroup] = useState('');
  const [adding, setAdding] = useState<string | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [titleDraft, setTitleDraft] = useState<{ id: string; value: string } | null>(null);
  const [openSubs, setOpenSubs] = useState<Record<string, boolean>>({});
  const [subDrafts, setSubDrafts] = useState<Record<string, string>>({});
  const [updatesFor, setUpdatesFor] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [hideDone, setHideDone] = useState(false);
  const colSpan = columns.length + (onToggleSelect ? 4 : 3);

  const toggle = (key: string) => setCollapsed((c) => ({ ...c, [key]: !c[key] }));

  const submitQuick = async (key: string, groupId: string | null) => {
    const title = (drafts[key] || '').trim();
    if (!title) return;
    setAdding(key);
    try {
      await onQuickAdd(groupId, title);
      setDrafts((d) => ({ ...d, [key]: '' }));
    } finally {
      setAdding(null);
    }
  };

  const visible = (list: TaskRow[]) =>
    hideDone ? list.filter((task) => task.status !== 'DONE' && task.status !== 'CANCELLED') : list;

  const sections: Array<{ key: string; id: string | null; name: string; color: string; tasks: TaskRow[] }> = [
    ...groups.map((g) => ({
      key: g.id,
      id: g.id,
      name: g.name,
      color: g.color || '#0891b2',
      tasks: sortByOrder(visible(tasksByGroupId(g.id))),
    })),
    {
      key: '__ungrouped',
      id: null,
      name: t('Ungrouped', 'Sin sección', 'Sem secção'),
      color: '#94a3b8',
      tasks: sortByOrder(visible(ungroupedTasks)),
    },
  ];

  const setDrop = (next: DropTarget | null) => {
    setDropTarget((prev) => {
      if (!next && !prev) return prev;
      if (
        prev &&
        next &&
        prev.kind === next.kind &&
        prev.groupId === next.groupId &&
        (prev.kind !== 'row' || next.kind !== 'row' || prev.beforeTaskId === next.beforeTaskId)
      ) {
        return prev;
      }
      return next;
    });
  };

  const handleDrop = () => {
    if (!draggingId || !dropTarget) {
      setDraggingId(null);
      setDropTarget(null);
      return;
    }
    const before = dropTarget.kind === 'row' ? dropTarget.beforeTaskId : null;
    if (before === draggingId) {
      setDraggingId(null);
      setDropTarget(null);
      return;
    }
    onMoveTask(draggingId, dropTarget.groupId, before);
    setDraggingId(null);
    setDropTarget(null);
  };

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <input
          value={newGroup}
          onChange={(e) => setNewGroup(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              const name = newGroup.trim();
              if (!name) return;
              void onCreateGroup(name).then(() => setNewGroup(''));
            }
          }}
          placeholder={t('New group…', 'Nuevo grupo…', 'Novo grupo…')}
          className="w-44 max-w-full rounded-lg border border-[color:var(--sys-line)] bg-[color:var(--sys-panel-soft)] px-3 py-1.5 text-sm text-[color:var(--sys-ink)] outline-none focus:border-teal-500"
        />
        <button
          type="button"
          disabled={creatingGroup || !newGroup.trim()}
          onClick={() => {
            const name = newGroup.trim();
            if (!name) return;
            void onCreateGroup(name).then(() => setNewGroup(''));
          }}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[color:var(--sys-line)] px-2.5 py-1.5 text-xs font-semibold text-[color:var(--sys-ink)] hover:bg-[color:var(--sys-nav-hover)] disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" />
          {t('Add group', 'Añadir grupo', 'Adicionar grupo')}
        </button>
        {groups.length === 0 && (
          <button
            type="button"
            disabled={seedingStarter}
            onClick={onSeedStarter}
            className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-teal-300 hover:bg-teal-500/10 disabled:opacity-40"
          >
            {t('Starter groups', 'Grupos iniciales', 'Grupos iniciais')}
          </button>
        )}
        <label className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 text-[11px] font-medium text-[color:var(--sys-muted)]">
          <input
            type="checkbox"
            checked={hideDone}
            onChange={(e) => setHideDone(e.target.checked)}
            className="rounded border-slate-300 text-teal-600"
          />
          {t('Hide done', 'Ocultar hechas', 'Ocultar concluídas')}
        </label>
        {onColumnsChange && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setAddOpen((v) => !v)}
              className="inline-flex items-center gap-1 rounded-lg border border-[color:var(--sys-line)] px-2.5 py-1.5 text-xs font-semibold text-[color:var(--sys-muted)] hover:bg-[color:var(--sys-nav-hover)]"
            >
              <Plus className="h-3.5 w-3.5" />
              {t('Column', 'Columna', 'Coluna')}
            </button>
            {addOpen && (
              <div className="absolute left-0 z-20 mt-1 w-48 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                {(['status', 'person', 'responsible', 'reviewer', 'priority', 'due', 'start', 'estimate', 'origin', 'updates', 'files', 'tags', 'group', 'text', 'number', 'checkbox', 'date'] as WorkColumnKind[])
                  .filter((kind) => canAddColumnKind(columns, kind))
                  .map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => {
                        const label =
                          kind === 'text' || kind === 'number' || kind === 'checkbox' || kind === 'date'
                            ? window.prompt(t('Column name', 'Nombre de la columna', 'Nome da coluna'), columnKindLabel(kind, t)) || ''
                            : columnKindLabel(kind, t);
                        if (!label.trim()) return;
                        onColumnsChange([
                          ...columns,
                          { id: kind === 'text' || kind === 'number' || kind === 'checkbox' || kind === 'date' ? `${kind}-${Date.now()}` : kind, kind, label: label.trim() },
                        ]);
                        setAddOpen(false);
                      }}
                      className="block w-full rounded-lg px-2 py-1.5 text-left text-sm text-[color:var(--sys-ink)] hover:bg-[color:var(--sys-nav-hover)]"
                    >
                      {columnKindLabel(kind, t)}
                    </button>
                  ))}
              </div>
            )}
          </div>
          {onNotifyChange && notify && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifyOpen((v) => !v)}
                className="rounded-lg border border-[color:var(--sys-line)] px-2.5 py-1.5 text-xs font-semibold text-[color:var(--sys-muted)] hover:bg-[color:var(--sys-nav-hover)]"
              >
                {t('Notifications', 'Notificaciones', 'Notificações')}
              </button>
              {notifyOpen && (
                <div className="absolute left-0 z-20 mt-1 w-64 rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-lg">
                  {(
                    [
                      ['comment', t('Updates on my tasks', 'Actualizaciones en mis tareas', 'Atualizações nas minhas tarefas')],
                      ['assign', t('When a task is assigned to me', 'Cuando me asignan una tarea', 'Quando me atribuem uma tarefa')],
                      ['status', t('When status changes', 'Cuando cambia el estado', 'Quando o estado muda')],
                      ['email', t('Also send email', 'También enviar email', 'Também enviar email')],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="mb-2 flex items-center gap-2 text-[color:var(--sys-ink)]">
                      <input
                        type="checkbox"
                        checked={Boolean(notify[key])}
                        onChange={(e) => onNotifyChange({ ...notify, [key]: e.target.checked })}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        )}
      </div>

      {sections.map((section) => {
        if (section.key === '__ungrouped' && section.tasks.length === 0 && groups.length > 0) return null;
        const isCollapsed = collapsed[section.key];
        const doneCount = section.tasks.filter((task) => task.status === 'DONE').length;
        const progress = section.tasks.length ? Math.round((doneCount / section.tasks.length) * 100) : 0;
        const endActive =
          dropTarget?.kind === 'end' && dropTarget.groupId === section.id && Boolean(draggingId);

        return (
          <section
            key={section.key}
            className={`overflow-hidden rounded-xl border bg-[color:var(--sys-panel)] transition ${
              endActive ? 'border-teal-400' : 'border-[color:var(--sys-line)]'
            }`}
            onDragOver={(e) => {
              if (!draggingId) return;
              e.preventDefault();
              setDrop({ kind: 'end', groupId: section.id });
            }}
            onDrop={(e) => {
              e.preventDefault();
              handleDrop();
            }}
          >
            <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2.5">
              <button
                type="button"
                onClick={() => toggle(section.key)}
                className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: section.color }} />
              {section.id && editingGroupId === section.id ? (
                <input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={() => {
                    const name = editName.trim();
                    setEditingGroupId(null);
                    if (name && name !== section.name) void onRenameGroup(section.id!, name);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    if (e.key === 'Escape') setEditingGroupId(null);
                  }}
                  className="rounded border border-cyan-300 px-1.5 py-0.5 text-sm font-bold text-slate-800 outline-none"
                />
              ) : (
                <button
                  type="button"
                  className="text-left text-sm font-bold tracking-tight text-slate-800 hover:text-cyan-800"
                  onDoubleClick={() => {
                    if (!section.id) return;
                    setEditingGroupId(section.id);
                    setEditName(section.name);
                  }}
                  title={section.id ? t('Double-click to rename', 'Doble clic para renombrar', 'Duplo clique para renomear') : undefined}
                >
                  {section.name}
                </button>
              )}
              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-slate-500">
                {section.tasks.length}
              </span>
              {section.tasks.length > 0 && (
                <div className="ml-1 hidden h-1.5 w-16 overflow-hidden rounded-full bg-slate-100 sm:block">
                  <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
                </div>
              )}
              <div className="flex-1" />
              {section.id ? (
                <button
                  type="button"
                  onClick={() => onDeleteGroup(section.id!, section.name)}
                  className="rounded p-1 text-slate-300 hover:bg-rose-50 hover:text-rose-600"
                  title={t('Delete group', 'Eliminar grupo', 'Excluir grupo')}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>

            {!isCollapsed && (
              <div className="min-w-0 overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                      {onToggleSelect && (
                        <th className="w-8 px-2 py-2">
                          <input
                            type="checkbox"
                            checked={
                              section.tasks.length > 0 &&
                              section.tasks.every((task) => selectedIds?.has(task.id))
                            }
                            onChange={() =>
                              onToggleSelectAll?.(section.tasks.map((task) => task.id))
                            }
                            className="h-3.5 w-3.5 rounded border-slate-300 text-cyan-600"
                            onClick={cellStop}
                          />
                        </th>
                      )}
                      <th className="w-8 px-1 py-2" />
                      <th className="w-8 px-1 py-2" title={t('Done', 'Hecho', 'Feito')} />
                      <th className="min-w-[220px] px-3 py-2 font-semibold">{t('Task', 'Tarea', 'Tarefa')}</th>
                      {columns.map((col) => (
                        <th key={col.id} className="min-w-[120px] px-2 py-2">
                          <span className="inline-flex items-center gap-1">
                            {col.kind === 'text' || col.kind === 'number' || col.kind === 'checkbox' || col.kind === 'date'
                              ? col.label
                              : columnKindLabel(col.kind, t)}
                            {onColumnsChange && columns.length > 1 && (
                              <button
                                type="button"
                                className="text-slate-300 hover:text-rose-600"
                                onClick={() => onColumnsChange(columns.filter((c) => c.id !== col.id))}
                                aria-label={t('Remove column', 'Quitar columna', 'Remover coluna')}
                              >
                                ×
                              </button>
                            )}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {section.tasks.map((task) => {
                      const selected = selectedId === task.id;
                      const multiSelected = selectedIds?.has(task.id);
                      const rowDrop =
                        dropTarget?.kind === 'row' &&
                        dropTarget.beforeTaskId === task.id &&
                        Boolean(draggingId) &&
                        draggingId !== task.id;
                      return (
                        <Fragment key={task.id}>
                        <tr
                          draggable={false}
                          onDragOver={(e) => {
                            if (!draggingId || draggingId === task.id) return;
                            e.preventDefault();
                            e.stopPropagation();
                            setDrop({ kind: 'row', groupId: section.id, beforeTaskId: task.id });
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDrop();
                          }}
                          className={`group cursor-pointer border-b border-[color:var(--sys-line)] transition ${
                            draggingId === task.id ? 'opacity-40' : ''
                          } ${rowDrop ? 'border-t-2 border-t-teal-400' : ''} ${
                            selected || multiSelected ? 'bg-teal-500/15' : 'hover:bg-[color:var(--sys-nav-hover)]'
                          }`}
                        >
                          {onToggleSelect && (
                            <td className="px-2 py-2" onClick={cellStop}>
                              <input
                                type="checkbox"
                                checked={Boolean(multiSelected)}
                                onChange={() => onToggleSelect(task.id)}
                                className="h-3.5 w-3.5 rounded border-slate-300 text-cyan-600"
                              />
                            </td>
                          )}
                          <td className="px-1 py-2" onClick={cellStop}>
                            <button
                              type="button"
                              draggable
                              onDragStart={(e) => {
                                e.stopPropagation();
                                setDraggingId(task.id);
                                e.dataTransfer.effectAllowed = 'move';
                                e.dataTransfer.setData('text/plain', task.id);
                              }}
                              onDragEnd={() => {
                                setDraggingId(null);
                                setDropTarget(null);
                              }}
                              className="cursor-grab rounded p-1 text-slate-300 hover:bg-slate-100 hover:text-slate-500 active:cursor-grabbing"
                              aria-label="Drag"
                            >
                              <GripVertical className="h-4 w-4" />
                            </button>
                          </td>
                          <td className="px-1 py-2" onClick={cellStop}>
                            <button
                              type="button"
                              onClick={() =>
                                onPatch(task.id, { status: task.status === 'DONE' ? 'TODO' : 'DONE' })
                              }
                              className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition ${
                                task.status === 'DONE'
                                  ? 'border-emerald-500 bg-emerald-500 text-white'
                                  : 'border-slate-300 hover:border-teal-500'
                              }`}
                              title={t('Mark done', 'Marcar hecha', 'Marcar concluída')}
                              aria-label={t('Mark done', 'Marcar hecha', 'Marcar concluída')}
                            >
                              {task.status === 'DONE' ? (
                                <span className="text-[10px] font-bold leading-none">✓</span>
                              ) : null}
                            </button>
                          </td>
                          <td className="px-3 py-1.5" onClick={cellStop}>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setOpenSubs((s) => ({ ...s, [task.id]: !s[task.id] }))}
                                className="rounded p-0.5 text-[color:var(--sys-faint)] hover:bg-[color:var(--sys-nav-hover)]"
                                title={t('Subitems', 'Subelementos', 'Subitens')}
                              >
                                <ChevronRight className={`h-3.5 w-3.5 transition ${openSubs[task.id] ? 'rotate-90' : ''}`} />
                              </button>
                              <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_STYLE[task.status]?.dot || 'bg-slate-300'}`} />
                              {titleDraft?.id === task.id ? (
                                <input
                                  autoFocus
                                  value={titleDraft.value}
                                  onChange={(e) => setTitleDraft({ id: task.id, value: e.target.value })}
                                  onBlur={() => {
                                    const next = titleDraft.value.trim();
                                    if (next && next !== task.title) onPatch(task.id, { title: next });
                                    setTitleDraft(null);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                    if (e.key === 'Escape') setTitleDraft(null);
                                  }}
                                  className="min-w-0 flex-1 rounded border border-teal-400 px-1.5 py-1 text-sm font-medium outline-none"
                                />
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setTitleDraft({ id: task.id, value: task.title })}
                                  className={`min-w-0 flex-1 truncate text-left text-sm font-medium ${
                                    task.status === 'DONE'
                                      ? 'text-[color:var(--sys-faint)] line-through'
                                      : 'text-[color:var(--sys-ink)]'
                                  }`}
                                >
                                  {task.title}
                                </button>
                              )}
                              {(subtasksOf?.(task.id).length || 0) > 0 && (
                                <span className="shrink-0 text-[10px] tabular-nums text-[color:var(--sys-faint)]">
                                  {subtasksOf!(task.id).filter((s) => s.status === 'DONE').length}/{subtasksOf!(task.id).length}
                                </span>
                              )}
                              {(task.checklist?.length || 0) > 0 && (
                                <span className="shrink-0 rounded bg-slate-500/15 px-1 py-0.5 text-[10px] tabular-nums text-[color:var(--sys-faint)]">
                                  {task.checklist!.filter((c) => c.completed).length}/{task.checklist!.length}
                                </span>
                              )}
                              {onDuplicate && (
                                <button
                                  type="button"
                                  onClick={() => onDuplicate(task)}
                                  className="shrink-0 rounded p-1 text-[color:var(--sys-faint)] opacity-0 hover:text-teal-300 group-hover:opacity-100"
                                  title={t('Duplicate', 'Duplicar', 'Duplicar')}
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => onSelect(task.id)}
                                className="shrink-0 text-[10px] font-semibold text-[color:var(--sys-faint)] opacity-0 hover:text-teal-300 group-hover:opacity-100"
                              >
                                {t('Open', 'Abrir', 'Abrir')}
                              </button>
                              {onDeleteTask && (
                                <button
                                  type="button"
                                  onClick={() => onDeleteTask(task.id, task.title)}
                                  className="shrink-0 rounded p-1 text-[color:var(--sys-faint)] opacity-0 hover:text-rose-400 group-hover:opacity-100"
                                  title={t('Delete', 'Eliminar', 'Excluir')}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                          {columns.map((col) => (
                            <td key={col.id} className="px-2 py-1.5" onClick={cellStop}>
                              {col.kind === 'status' && (
                                <select
                                  value={task.status}
                                  onChange={(e) => onPatch(task.id, { status: e.target.value })}
                                  className={`w-full cursor-pointer rounded-md border-0 px-2 py-1 text-[11px] font-semibold outline-none ${STATUS_STYLE[task.status]?.bg || 'bg-slate-100'} ${STATUS_STYLE[task.status]?.text || 'text-slate-700'}`}
                                >
                                  {WORK_KANBAN.map((s) => (
                                    <option key={s} value={s}>{statusLabel(s)}</option>
                                  ))}
                                </select>
                              )}
                              {col.kind === 'person' && (
                                <PeopleCell task={task} users={users} onPatch={onPatch} t={t} />
                              )}
                              {col.kind === 'responsible' && (
                                <RoleSelect
                                  value={task.responsibleId || ''}
                                  users={users}
                                  onChange={(id) => onPatch(task.id, { responsibleId: id || null })}
                                  t={t}
                                />
                              )}
                              {col.kind === 'reviewer' && (
                                <RoleSelect
                                  value={task.reviewerId || ''}
                                  users={users}
                                  onChange={(id) => onPatch(task.id, { reviewerId: id || null })}
                                  t={t}
                                />
                              )}
                              {col.kind === 'priority' && (
                                <select
                                  value={task.priority}
                                  onChange={(e) => onPatch(task.id, { priority: e.target.value })}
                                  className="w-full cursor-pointer rounded-md border border-[color:var(--sys-line)] bg-[color:var(--sys-panel-soft)] px-2 py-1 text-[11px] font-semibold text-[color:var(--sys-ink)] outline-none"
                                >
                                  {WORK_PRIORITIES.map((p) => (
                                    <option key={p} value={p}>{priorityLabel(p)}</option>
                                  ))}
                                </select>
                              )}
                              {col.kind === 'due' && (
                                <input
                                  type="date"
                                  value={task.dueDate ? String(task.dueDate).slice(0, 10) : ''}
                                  onChange={(e) => onPatch(task.id, { dueDate: e.target.value || null })}
                                  className={`w-full bg-transparent text-[11px] text-[color:var(--sys-ink)] outline-none [color-scheme:inherit] ${
                                    task.dueDate && !['DONE', 'CANCELLED'].includes(task.status) && new Date(task.dueDate).getTime() < Date.now()
                                      ? 'font-semibold text-rose-400'
                                      : ''
                                  }`}
                                />
                              )}
                              {col.kind === 'start' && (
                                <input
                                  type="date"
                                  value={task.startDate ? String(task.startDate).slice(0, 10) : ''}
                                  onChange={(e) => onPatch(task.id, { startDate: e.target.value || null })}
                                  className="w-full bg-transparent text-[11px] text-slate-600 outline-none"
                                />
                              )}
                              {col.kind === 'estimate' && (
                                <input
                                  type="number"
                                  min="0"
                                  step="0.5"
                                  value={task.estimatedHours ?? ''}
                                  onChange={(e) => onPatch(task.id, { estimatedHours: e.target.value === '' ? null : Number(e.target.value) })}
                                  className="w-16 bg-transparent text-[11px] text-slate-700 outline-none"
                                  placeholder="h"
                                />
                              )}
                              {col.kind === 'origin' && (
                                <div className="flex flex-col gap-1">
                                  <select
                                    value={task.projectId || task.project?.id || ''}
                                    onChange={(e) => onPatch(task.id, { projectId: e.target.value || null })}
                                    className="w-full bg-transparent text-[11px] text-slate-600 outline-none"
                                  >
                                    <option value="">{t('No project', 'Sin proyecto', 'Sem projeto')}</option>
                                    {projects.map((p) => (
                                      <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                  </select>
                                  <select
                                    value={task.departmentId || task.department?.id || ''}
                                    onChange={(e) => onPatch(task.id, { departmentId: e.target.value || null })}
                                    className="w-full bg-transparent text-[11px] text-slate-600 outline-none"
                                  >
                                    <option value="">{t('No department', 'Sin sector', 'Sem setor')}</option>
                                    {departments.map((d) => (
                                      <option key={d.id} value={d.id}>{d.name}</option>
                                    ))}
                                  </select>
                                  <select
                                    value={task.folderId || task.folder?.id || ''}
                                    onChange={(e) => onPatch(task.id, { folderId: e.target.value || null })}
                                    className="w-full bg-transparent text-[11px] text-slate-600 outline-none"
                                  >
                                    <option value="">{t('No board', 'Sin tablero', 'Sem quadro')}</option>
                                    {folders.map((f) => (
                                      <option key={f.id} value={f.id}>{f.name}</option>
                                    ))}
                                  </select>
                                </div>
                              )}
                              {col.kind === 'files' && <FileCell taskId={task.id} count={task._count?.attachments || 0} t={t} />}
                              {col.kind === 'tags' && <TagsCell task={task} onPatch={onPatch} t={t} />}
                              {col.kind === 'group' && (
                                <select
                                  value={task.groupId || ''}
                                  onChange={(e) => onPatch(task.id, { groupId: e.target.value || null })}
                                  className="w-full cursor-pointer bg-transparent text-[11px] text-[color:var(--sys-ink)] outline-none"
                                >
                                  <option value="">{t('Ungrouped', 'Sin sección', 'Sem secção')}</option>
                                  {groups.map((g) => (
                                    <option key={g.id} value={g.id}>{g.name}</option>
                                  ))}
                                </select>
                              )}
                              {col.kind === 'updates' && (
                                <button
                                  type="button"
                                  onClick={() => setUpdatesFor((id) => (id === task.id ? null : task.id))}
                                  className="text-[11px] font-semibold text-teal-800 hover:underline"
                                >
                                  {(task._count?.comments || 0) > 0
                                    ? `${task._count?.comments} ${t('updates', 'act.', 'atu.')}`
                                    : t('Write', 'Escribir', 'Escrever')}
                                </button>
                              )}
                              {(col.kind === 'text' || col.kind === 'number' || col.kind === 'date') && (
                                <input
                                  type={col.kind === 'number' ? 'number' : col.kind === 'date' ? 'date' : 'text'}
                                  value={task.customFields?.[col.id] == null ? '' : String(task.customFields[col.id])}
                                  onChange={(e) =>
                                    onPatch(task.id, {
                                      customFields: { [col.id]: col.kind === 'number' ? Number(e.target.value) : e.target.value },
                                    })
                                  }
                                  className="w-full min-w-[88px] bg-transparent text-[11px] text-slate-700 outline-none"
                                />
                              )}
                              {col.kind === 'checkbox' && (
                                <input
                                  type="checkbox"
                                  checked={Boolean(task.customFields?.[col.id])}
                                  onChange={(e) => onPatch(task.id, { customFields: { [col.id]: e.target.checked } })}
                                />
                              )}
                            </td>
                          ))}
                        </tr>
                        {updatesFor === task.id && (
                          <tr>
                            <td colSpan={colSpan}>
                              <WorkUpdates taskId={task.id} users={users} onPosted={onCommentPosted} t={t} />
                            </td>
                          </tr>
                        )}
                        {openSubs[task.id] && (subtasksOf?.(task.id) || []).map((sub) => (
                          <tr key={sub.id} className="border-b border-[color:var(--sys-line)] bg-[color:var(--sys-panel-soft)]/40">
                            {onToggleSelect && <td />}
                            <td />
                            <td className="px-1 py-2" onClick={cellStop}>
                              <button
                                type="button"
                                onClick={() =>
                                  onPatch(sub.id, { status: sub.status === 'DONE' ? 'TODO' : 'DONE' })
                                }
                                className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                                  sub.status === 'DONE'
                                    ? 'border-emerald-500 bg-emerald-500 text-white'
                                    : 'border-slate-300'
                                }`}
                              >
                                {sub.status === 'DONE' ? <span className="text-[9px] font-bold">✓</span> : null}
                              </button>
                            </td>
                            <td className="px-3 py-1.5" onClick={cellStop}>
                              <div className="flex items-center gap-2 pl-6">
                                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_STYLE[sub.status]?.dot || 'bg-slate-300'}`} />
                                {titleDraft?.id === sub.id ? (
                                  <input
                                    autoFocus
                                    value={titleDraft.value}
                                    onChange={(e) => setTitleDraft({ id: sub.id, value: e.target.value })}
                                    onBlur={() => {
                                      const next = titleDraft.value.trim();
                                      if (next && next !== sub.title) onPatch(sub.id, { title: next });
                                      setTitleDraft(null);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                      if (e.key === 'Escape') setTitleDraft(null);
                                    }}
                                    className="min-w-0 flex-1 rounded border border-teal-400 px-1.5 py-1 text-[13px] outline-none"
                                  />
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setTitleDraft({ id: sub.id, value: sub.title })}
                                    className="min-w-0 flex-1 truncate text-left text-[13px] text-[color:var(--sys-ink)]"
                                  >
                                    {sub.title}
                                  </button>
                                )}
                                {onDeleteTask && (
                                  <button
                                    type="button"
                                    onClick={() => onDeleteTask(sub.id, sub.title)}
                                    className="rounded p-1 text-[color:var(--sys-faint)] hover:text-rose-400"
                                    title={t('Delete', 'Eliminar', 'Excluir')}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="px-2 py-1" onClick={cellStop}>
                              <select
                                value={sub.status}
                                onChange={(e) => onPatch(sub.id, { status: e.target.value })}
                                className={`w-full cursor-pointer rounded-md border-0 px-2 py-1 text-[11px] font-semibold outline-none ${STATUS_STYLE[sub.status]?.bg || ''} ${STATUS_STYLE[sub.status]?.text || ''}`}
                              >
                                {WORK_KANBAN.map((s) => (
                                  <option key={s} value={s}>{statusLabel(s)}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-2 py-1" onClick={cellStop}>
                              <select
                                value={sub.assigneeId || ''}
                                onChange={(e) => onPatch(sub.id, { assigneeId: e.target.value || null })}
                                className="w-full bg-transparent text-[11px] text-[color:var(--sys-ink)] outline-none"
                              >
                                <option value="">{t('—', '—', '—')}</option>
                                {users.map((u) => (
                                  <option key={u.id} value={u.id}>{u.name || u.email}</option>
                                ))}
                              </select>
                            </td>
                            <td colSpan={Math.max(1, columns.length - 2)} />
                          </tr>
                        ))}
                        {openSubs[task.id] && onAddSubtask && (
                          <tr className="border-b border-[color:var(--sys-line)]">
                            <td colSpan={colSpan} className="px-3 py-1.5">
                              <input
                                value={subDrafts[task.id] || ''}
                                onChange={(e) => setSubDrafts((d) => ({ ...d, [task.id]: e.target.value }))}
                                onKeyDown={(e) => {
                                  if (e.key !== 'Enter') return;
                                  const title = (subDrafts[task.id] || '').trim();
                                  if (!title) return;
                                  e.preventDefault();
                                  setSubDrafts((d) => ({ ...d, [task.id]: '' }));
                                  void onAddSubtask(task.id, title);
                                }}
                                placeholder={t('+ Add subitem', '+ Subelemento', '+ Subitem')}
                                className="w-full bg-transparent py-1 pl-8 text-sm text-[color:var(--sys-ink)] outline-none placeholder:text-[color:var(--sys-faint)]"
                              />
                            </td>
                          </tr>
                        )}
                        </Fragment>
                      );
                    })}
                    <tr
                      className={`border-t border-dashed ${endActive ? 'border-cyan-400 bg-cyan-50/40' : 'border-slate-100'}`}
                      onDragOver={(e) => {
                        if (!draggingId) return;
                        e.preventDefault();
                        e.stopPropagation();
                        setDrop({ kind: 'end', groupId: section.id });
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDrop();
                      }}
                    >
                      <td colSpan={colSpan} className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Plus className="h-3.5 w-3.5 text-slate-300" />
                          <input
                            value={drafts[section.key] || ''}
                            onChange={(e) => setDrafts((d) => ({ ...d, [section.key]: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                void submitQuick(section.key, section.id);
                              }
                            }}
                            disabled={adding === section.key}
                            placeholder={t('+ Add task', '+ Añadir tarea', '+ Adicionar tarefa')}
                            className="w-full bg-transparent py-1 text-sm text-slate-700 outline-none placeholder:text-slate-400"
                          />
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}

      {groups.length === 0 && ungroupedTasks.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-6 py-16 text-center">
          <p className="text-base font-semibold text-slate-800">
            {t('Start with a group', 'Empieza con un grupo', 'Começa com um grupo')}
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            {t(
              'Groups work like Monday sections — To do, This week, Waiting… then add tasks inside each.',
              'Los grupos son como secciones de Monday — Por hacer, Esta semana… luego añade tareas.',
              'Grupos são como secções do Monday — A fazer, Esta semana… depois adiciona tarefas.',
            )}
          </p>
          <button
            type="button"
            disabled={seedingStarter}
            onClick={onSeedStarter}
            className="mt-5 inline-flex rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-40"
          >
            {t('Create To do / Doing / Done', 'Crear To do / Doing / Done', 'Criar To do / Doing / Done')}
          </button>
        </div>
      )}
    </div>
  );
}
