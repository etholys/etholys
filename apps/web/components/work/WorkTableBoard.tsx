'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, GripVertical, Plus, Trash2 } from 'lucide-react';
import { getInitials } from '@/lib/utils';
import { WORK_KANBAN, WORK_PRIORITIES, PRIORITY_STYLE, STATUS_STYLE, parseTags } from './work-ui';

type UserOpt = { id: string; name: string | null; email?: string };
type GroupOpt = { id: string; name: string; color: string | null };
type TaskRow = {
  id: string;
  title: string;
  status: string;
  priority: string;
  order?: number;
  dueDate?: string | null;
  tags?: unknown;
  assigneeId?: string | null;
  groupId?: string | null;
  assignee?: UserOpt | null;
  project?: { name?: string } | null;
  department?: { name?: string } | null;
  _count?: { comments?: number; subtasks?: number };
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
  t,
  statusLabel,
  priorityLabel,
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
  t: (en: string, es: string, pt: string) => string;
  statusLabel: (s: string) => string;
  priorityLabel: (p: string) => string;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [newGroup, setNewGroup] = useState('');
  const [adding, setAdding] = useState<string | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

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

  const sections: Array<{ key: string; id: string | null; name: string; color: string; tasks: TaskRow[] }> = [
    ...groups.map((g) => ({
      key: g.id,
      id: g.id,
      name: g.name,
      color: g.color || '#0891b2',
      tasks: sortByOrder(tasksByGroupId(g.id)),
    })),
    {
      key: '__ungrouped',
      id: null,
      name: t('Ungrouped', 'Sin sección', 'Sem secção'),
      color: '#94a3b8',
      tasks: sortByOrder(ungroupedTasks),
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
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
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
          className="min-w-[200px] flex-1 rounded-lg border border-dashed border-slate-300 bg-white/80 px-3 py-2 text-sm outline-none focus:border-cyan-400"
        />
        <button
          type="button"
          disabled={creatingGroup || !newGroup.trim()}
          onClick={() => {
            const name = newGroup.trim();
            if (!name) return;
            void onCreateGroup(name).then(() => setNewGroup(''));
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
          {t('Add group', 'Añadir grupo', 'Adicionar grupo')}
        </button>
        {groups.length === 0 && (
          <button
            type="button"
            disabled={seedingStarter}
            onClick={onSeedStarter}
            className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm font-medium text-cyan-800 hover:bg-cyan-100 disabled:opacity-40"
          >
            {t('Starter groups', 'Grupos iniciales', 'Grupos iniciais')}
          </button>
        )}
      </div>

      <p className="text-[11px] text-slate-400">
        {t(
          'Drag the handle to move tasks between groups or reorder.',
          'Arrastra el asa para mover tareas entre grupos o reordenar.',
          'Arrasta a pega para mover tarefas entre grupos ou reordenar.',
        )}
      </p>

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
            className={`overflow-hidden rounded-xl border bg-white shadow-sm transition ${
              endActive ? 'border-cyan-400 ring-2 ring-cyan-100' : 'border-slate-200/90'
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
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                      <th className="w-8 px-1 py-2" />
                      <th className="w-[34%] px-3 py-2 font-semibold">{t('Task', 'Tarea', 'Tarefa')}</th>
                      <th className="w-[14%] px-2 py-2">{t('Status', 'Estado', 'Status')}</th>
                      <th className="w-[14%] px-2 py-2">{t('Person', 'Persona', 'Pessoa')}</th>
                      <th className="w-[12%] px-2 py-2">{t('Priority', 'Prioridad', 'Prioridade')}</th>
                      <th className="w-[12%] px-2 py-2">{t('Due', 'Fecha', 'Prazo')}</th>
                      <th className="w-[12%] px-2 py-2">{t('Tags', 'Etiquetas', 'Tags')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.tasks.map((task) => {
                      const selected = selectedId === task.id;
                      const rowDrop =
                        dropTarget?.kind === 'row' &&
                        dropTarget.beforeTaskId === task.id &&
                        Boolean(draggingId) &&
                        draggingId !== task.id;
                      return (
                        <tr
                          key={task.id}
                          draggable={false}
                          onClick={() => onSelect(task.id)}
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
                          className={`group cursor-pointer border-b border-slate-50 transition ${
                            draggingId === task.id ? 'opacity-40' : ''
                          } ${rowDrop ? 'border-t-2 border-t-cyan-500' : ''} ${
                            selected ? 'bg-cyan-50/70' : 'hover:bg-slate-50/80'
                          }`}
                        >
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
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <span
                                className={`h-2 w-2 shrink-0 rounded-full ${STATUS_STYLE[task.status]?.dot || 'bg-slate-300'}`}
                              />
                              <span className="truncate font-medium text-slate-900">{task.title}</span>
                              {(task._count?.subtasks || 0) > 0 && (
                                <span className="shrink-0 text-[10px] text-slate-400">{task._count?.subtasks}</span>
                              )}
                            </div>
                            {(task.project?.name || task.department?.name) && (
                              <p className="mt-0.5 truncate pl-4 text-[11px] text-slate-400">
                                {task.project?.name || task.department?.name}
                              </p>
                            )}
                          </td>
                          <td className="px-2 py-1.5" onClick={cellStop}>
                            <select
                              value={task.status}
                              onChange={(e) => onPatch(task.id, { status: e.target.value })}
                              className={`w-full max-w-[130px] cursor-pointer rounded-md border-0 px-2 py-1 text-[11px] font-semibold outline-none ${STATUS_STYLE[task.status]?.bg || 'bg-slate-100'} ${STATUS_STYLE[task.status]?.text || ''}`}
                            >
                              {WORK_KANBAN.map((s) => (
                                <option key={s} value={s}>
                                  {statusLabel(s)}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-1.5" onClick={cellStop}>
                            <div className="flex items-center gap-1.5">
                              {task.assignee?.name ? (
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-100 text-[9px] font-bold text-cyan-800">
                                  {getInitials(task.assignee.name)}
                                </span>
                              ) : (
                                <span className="h-5 w-5 shrink-0 rounded-full border border-dashed border-slate-200" />
                              )}
                              <select
                                value={task.assigneeId || ''}
                                onChange={(e) => onPatch(task.id, { assigneeId: e.target.value || null })}
                                className="min-w-0 flex-1 cursor-pointer rounded-md border border-transparent bg-transparent px-1 py-1 text-[11px] text-slate-700 outline-none hover:border-slate-200 hover:bg-white"
                              >
                                <option value="">{t('—', '—', '—')}</option>
                                {users.map((u) => (
                                  <option key={u.id} value={u.id}>
                                    {u.name || u.email}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </td>
                          <td className="px-2 py-1.5" onClick={cellStop}>
                            <select
                              value={task.priority}
                              onChange={(e) => onPatch(task.id, { priority: e.target.value })}
                              className={`w-full max-w-[110px] cursor-pointer rounded-md border-0 px-2 py-1 text-[11px] font-semibold outline-none ${PRIORITY_STYLE[task.priority]?.bg || ''} ${PRIORITY_STYLE[task.priority]?.text || ''}`}
                            >
                              {WORK_PRIORITIES.map((p) => (
                                <option key={p} value={p}>
                                  {priorityLabel(p)}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-1.5" onClick={cellStop}>
                            <input
                              type="date"
                              value={task.dueDate ? String(task.dueDate).slice(0, 10) : ''}
                              onChange={(e) => onPatch(task.id, { dueDate: e.target.value || null })}
                              className="w-full max-w-[130px] cursor-pointer rounded-md border border-transparent bg-transparent px-1 py-1 text-[11px] text-slate-600 outline-none hover:border-slate-200 hover:bg-white"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <div className="flex flex-wrap gap-1">
                              {parseTags(task.tags)
                                .slice(0, 3)
                                .map((tag) => (
                                  <span
                                    key={tag}
                                    className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600"
                                  >
                                    {tag}
                                  </span>
                                ))}
                            </div>
                          </td>
                        </tr>
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
                      <td colSpan={7} className="px-3 py-2">
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
