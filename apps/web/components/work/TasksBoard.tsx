'use client';

import { useEffect, useState } from 'react';
import { useApp } from '@/app/providers';
import { cn, formatDate, getInitials, getPriorityColor, getStatusColor } from '@/lib/utils';
import { LayoutGrid, List, Plus, Search, X } from 'lucide-react';
import { WorkTableBoard } from './WorkTableBoard';
import { WorkTaskPanel } from './WorkTaskPanel';
import { WORK_KANBAN, STARTER_GROUPS, parseTags } from './work-ui';

type ML = { es: string; pt: string; en: string };
const ml = (en: string, es: string, pt: string): ML => ({ en, es, pt });

export type TasksBoardProps = {
  variant?: 'atlas' | 'hub';
};

const emptyForm = {
  title: '',
  description: '',
  projectId: '',
  departmentId: '',
  groupId: '',
  assigneeId: '',
  priority: 'MEDIUM',
  status: 'TODO',
  dueDate: '',
  tags: '',
  isRecurring: false,
  recurrenceMonths: '1',
  recurrenceCount: '1',
};

export default function TasksBoard({ variant = 'atlas' }: TasksBoardProps) {
  const { tr, activeCompanyId, locale } = useApp();
  const L = (m: ML) => m[locale] || m.en;
  const t3 = (en: string, es: string, pt: string) => L(ml(en, es, pt));

  const [tasks, setTasks] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'table' | 'kanban'>('table');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [seedingStarter, setSeedingStarter] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [kanbanDragId, setKanbanDragId] = useState<string | null>(null);
  const [kanbanDropCol, setKanbanDropCol] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [showAdvFilters, setShowAdvFilters] = useState(false);
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [taskScopeFilter, setTaskScopeFilter] = useState('');

  const fetchTasks = (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    const params = new URLSearchParams();
    if (activeCompanyId) params.set('companyId', activeCompanyId);
    if (projectFilter) params.set('projectId', projectFilter);
    if (departmentFilter) params.set('departmentId', departmentFilter);
    if (taskScopeFilter === 'company') params.set('noProject', '1');
    fetch(`/api/tasks?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setTasks(d?.tasks ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  const fetchGroups = () => {
    if (!activeCompanyId) {
      setGroups([]);
      return;
    }
    fetch(`/api/task-groups?companyId=${encodeURIComponent(activeCompanyId)}`)
      .then((r) => r.json())
      .then((d) => setGroups(d?.groups ?? []))
      .catch(() => setGroups([]));
  };

  useEffect(() => {
    fetchTasks();
  }, [activeCompanyId, projectFilter, departmentFilter, taskScopeFilter]);

  useEffect(() => {
    fetchGroups();
  }, [activeCompanyId]);

  useEffect(() => {
    fetch('/api/projects')
      .then((r) => r.json())
      .then((d) => setProjects(d?.projects ?? []))
      .catch(() => {});
    fetch('/api/users')
      .then((r) => r.json())
      .then((d) => setUsers(d?.users ?? []))
      .catch(() => {});
    fetch('/api/departments')
      .then((r) => r.json())
      .then((d) => setDepartments(d?.departments ?? []))
      .catch(() => {});
  }, []);

  const patchTask = async (taskId: string, body: Record<string, unknown>) => {
    setTasks((prev) =>
      prev.map((task) => {
        if (task.id !== taskId) return task;
        const next = { ...task, ...body };
        if (body.assigneeId !== undefined) {
          next.assignee =
            body.assigneeId == null
              ? null
              : users.find((u: any) => u.id === body.assigneeId) || task.assignee;
        }
        return next;
      }),
    );
    await fetch(`/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const body: any = {
      ...form,
      dueDate: form.dueDate ? new Date(form.dueDate) : null,
      tags: form.tags || null,
      isRecurring: form.isRecurring || false,
      recurrenceMonths: form.isRecurring ? parseInt(form.recurrenceMonths) || 1 : null,
      recurrenceCount: form.isRecurring ? parseInt(form.recurrenceCount) || 1 : null,
    };
    if (!body.assigneeId) delete body.assigneeId;
    if (!body.departmentId) delete body.departmentId;
    if (!body.groupId) delete body.groupId;
    if (!body.projectId) {
      delete body.projectId;
      if (activeCompanyId) body.companyId = activeCompanyId;
    }
    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setShowForm(false);
    setForm({ ...emptyForm });
    fetchTasks();
    fetchGroups();
  };

  const quickAdd = async (groupId: string | null, title: string) => {
    const body: Record<string, unknown> = {
      title,
      status: 'TODO',
      priority: 'MEDIUM',
      groupId: groupId || undefined,
    };
    if (projectFilter) body.projectId = projectFilter;
    else if (activeCompanyId) body.companyId = activeCompanyId;
    if (departmentFilter) body.departmentId = departmentFilter;
    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    fetchTasks({ silent: true });
  };

  const createGroup = async (name: string, color?: string) => {
    if (!activeCompanyId) return;
    setCreatingGroup(true);
    try {
      await fetch('/api/task-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: activeCompanyId, name, color: color || null }),
      });
      fetchGroups();
    } finally {
      setCreatingGroup(false);
    }
  };

  const renameGroup = async (id: string, name: string) => {
    setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, name } : g)));
    await fetch(`/api/task-groups/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
  };

  const seedStarterGroups = async () => {
    if (!activeCompanyId || seedingStarter) return;
    setSeedingStarter(true);
    try {
      for (const g of STARTER_GROUPS) {
        await fetch('/api/task-groups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyId: activeCompanyId, name: g.name, color: g.color }),
        });
      }
      fetchGroups();
    } finally {
      setSeedingStarter(false);
    }
  };

  const moveTask = async (taskId: string, targetGroupId: string | null, beforeTaskId: string | null) => {
    const moving = tasks.find((t) => t.id === taskId);
    if (!moving) return;

    const sameGroup = (t: any) => (t.groupId || null) === (targetGroupId || null);
    const dest = tasks
      .filter((t) => t.id !== taskId && !t.parentId && sameGroup(t))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    let ordered: any[];
    if (beforeTaskId) {
      const idx = dest.findIndex((t) => t.id === beforeTaskId);
      if (idx < 0) ordered = [...dest, { ...moving, groupId: targetGroupId }];
      else {
        ordered = [
          ...dest.slice(0, idx),
          { ...moving, groupId: targetGroupId },
          ...dest.slice(idx),
        ];
      }
    } else {
      ordered = [...dest, { ...moving, groupId: targetGroupId }];
    }

    const orderMap = new Map(ordered.map((t, i) => [t.id, i]));
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) return { ...t, groupId: targetGroupId, order: orderMap.get(taskId) ?? 0 };
        if (orderMap.has(t.id)) return { ...t, order: orderMap.get(t.id) };
        return t;
      }),
    );

    await Promise.all(
      ordered.map((t, i) =>
        fetch(`/api/tasks/${t.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            t.id === taskId ? { groupId: targetGroupId, order: i } : { order: i },
          ),
        }),
      ),
    );
  };

  const deleteGroup = async (groupId: string, name: string) => {
    if (!confirm(`${t3('Delete section', '¿Eliminar sección', 'Excluir secção')} "${name}"?`)) return;
    await fetch(`/api/task-groups/${groupId}`, { method: 'DELETE' });
    fetchGroups();
    fetchTasks();
  };

  const filtered = (tasks ?? []).filter((task: any) => {
    if (task?.parentId) return false;
    if (
      search &&
      !(task?.title ?? '').toLowerCase().includes(search.toLowerCase()) &&
      !(task?.description ?? '').toLowerCase().includes(search.toLowerCase()) &&
      !parseTags(task?.tags).some((tag) => tag.toLowerCase().includes(search.toLowerCase()))
    ) {
      return false;
    }
    if (priorityFilter && task?.priority !== priorityFilter) return false;
    if (statusFilter && task?.status !== statusFilter) return false;
    if (assigneeFilter && task?.assigneeId !== assigneeFilter) return false;
    if (dateFromFilter && task?.dueDate && new Date(task.dueDate) < new Date(dateFromFilter)) return false;
    if (dateToFilter && task?.dueDate && new Date(task.dueDate) > new Date(`${dateToFilter}T23:59:59`)) {
      return false;
    }
    return true;
  });

  const hasAdvFilters = !!(priorityFilter || statusFilter || assigneeFilter || dateFromFilter || dateToFilter);
  const ungroupedTasks = filtered.filter((task: any) => !task?.groupId);
  const tasksByGroupId = (groupId: string) => filtered.filter((task: any) => task?.groupId === groupId);

  const pageTitle = variant === 'hub' ? t3('Team tasks', 'Tareas del equipo', 'Tarefas da equipa') : tr('nav.tasks');

  return (
    <div className={cn('flex min-h-[70vh] flex-col', variant === 'hub' && 'min-h-[calc(100vh-7.5rem)]')}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {variant === 'hub' ? (
          <p className="text-sm tabular-nums text-slate-500">
            {filtered.length} {tr('nav.tasks').toLowerCase()}
          </p>
        ) : (
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{pageTitle}</h1>
            <p className="text-sm text-gray-500">
              {filtered.length} {tr('nav.tasks').toLowerCase()}
            </p>
          </div>
        )}
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-slate-100 p-0.5">
            <button
              type="button"
              onClick={() => setView('table')}
              title={t3('Table', 'Tabla', 'Tabela')}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition',
                view === 'table' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500',
              )}
            >
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">{t3('Board', 'Tablero', 'Quadro')}</span>
            </button>
            <button
              type="button"
              onClick={() => setView('kanban')}
              title="Kanban"
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition',
                view === 'kanban' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500',
              )}
            >
              <LayoutGrid className="h-4 w-4" />
              <span className="hidden sm:inline">Kanban</span>
            </button>
          </div>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-cyan-500"
          >
            <Plus className="h-4 w-4" />
            {tr('task.new')}
          </button>
        </div>
      </div>

      <div className="mb-4 space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tr('general.search')}
              className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
            />
          </div>
          <select
            value={taskScopeFilter}
            onChange={(e) => {
              setTaskScopeFilter(e.target.value);
              if (e.target.value === 'company') setProjectFilter('');
            }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"
          >
            <option value="">{t3('All tasks', 'Todas las tareas', 'Todas as tarefas')}</option>
            <option value="project">{t3('Project tasks', 'De proyecto', 'De projeto')}</option>
            <option value="company">
              {t3('Company tasks', 'De empresa', 'Da empresa')}
            </option>
          </select>
          {taskScopeFilter !== 'company' && (
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"
            >
              <option value="">
                {tr('general.all')} {tr('nav.projects')}
              </option>
              {(projects ?? []).map((p: any) => (
                <option key={p?.id} value={p?.id}>
                  {p?.name}
                </option>
              ))}
            </select>
          )}
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"
          >
            <option value="">{t3('All departments', 'Todos los sectores', 'Todos os setores')}</option>
            {(departments ?? []).map((d: any) => (
              <option key={d?.id} value={d?.id}>
                {d?.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setShowAdvFilters(!showAdvFilters)}
            className={cn(
              'rounded-lg border px-3 py-2.5 text-sm transition',
              hasAdvFilters
                ? 'border-cyan-300 bg-cyan-50 text-cyan-800'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50',
            )}
          >
            {t3('Filters', 'Filtros', 'Filtros')}
          </button>
        </div>
        {showAdvFilters && (
          <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-3">
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm"
            >
              <option value="">{t3('All priorities', 'Todas las prioridades', 'Todas as prioridades')}</option>
              <option value="LOW">{tr('priority.low')}</option>
              <option value="MEDIUM">{tr('priority.medium')}</option>
              <option value="HIGH">{tr('priority.high')}</option>
              <option value="CRITICAL">{tr('priority.critical')}</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm"
            >
              <option value="">{t3('All statuses', 'Todos los estados', 'Todos os status')}</option>
              {WORK_KANBAN.map((s) => (
                <option key={s} value={s}>
                  {tr(`status.${s.toLowerCase()}`)}
                </option>
              ))}
            </select>
            <select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm"
            >
              <option value="">{t3('All members', 'Todos los miembros', 'Todos os membros')}</option>
              {(users ?? []).map((u: any) => (
                <option key={u?.id} value={u?.id}>
                  {u?.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={dateFromFilter}
              onChange={(e) => setDateFromFilter(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm"
            />
            <input
              type="date"
              value={dateToFilter}
              onChange={(e) => setDateToFilter(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm"
            />
            {hasAdvFilters && (
              <button
                type="button"
                onClick={() => {
                  setPriorityFilter('');
                  setStatusFilter('');
                  setAssigneeFilter('');
                  setDateFromFilter('');
                  setDateToFilter('');
                }}
                className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-rose-600 hover:bg-rose-50"
              >
                <X className="h-3.5 w-3.5" />
                {t3('Clear', 'Limpiar', 'Limpar')}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex min-h-0 flex-1 gap-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-50/50">
        <div className="min-w-0 flex-1 overflow-y-auto p-3 sm:p-4">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-600/30 border-t-cyan-600" />
            </div>
          ) : view === 'table' ? (
            <WorkTableBoard
              groups={groups}
              ungroupedTasks={ungroupedTasks}
              tasksByGroupId={tasksByGroupId}
              users={users}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onPatch={patchTask}
              onMoveTask={moveTask}
              onQuickAdd={quickAdd}
              onCreateGroup={createGroup}
              onRenameGroup={renameGroup}
              onDeleteGroup={deleteGroup}
              onSeedStarter={seedStarterGroups}
              creatingGroup={creatingGroup}
              seedingStarter={seedingStarter}
              t={t3}
              statusLabel={(s) => tr(`status.${s.toLowerCase()}`)}
              priorityLabel={(p) => tr(`priority.${p.toLowerCase()}`)}
            />
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {WORK_KANBAN.map((col) => {
                const colTasks = filtered.filter((task: any) => task?.status === col);
                const isDrop = kanbanDropCol === col && Boolean(kanbanDragId);
                return (
                  <div
                    key={col}
                    className="min-w-[260px] flex-1"
                    onDragOver={(e) => {
                      if (!kanbanDragId) return;
                      e.preventDefault();
                      setKanbanDropCol(col);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (kanbanDragId) void patchTask(kanbanDragId, { status: col });
                      setKanbanDragId(null);
                      setKanbanDropCol(null);
                    }}
                  >
                    <div className="mb-2 flex items-center gap-2 px-1">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: getStatusColor(col) }} />
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                        {tr(`status.${col.toLowerCase()}`)}
                      </span>
                      <span className="rounded-md bg-white px-1.5 py-0.5 text-[10px] tabular-nums text-slate-400 shadow-sm">
                        {colTasks.length}
                      </span>
                    </div>
                    <div
                      className={cn(
                        'min-h-[120px] space-y-2 rounded-xl p-2 transition',
                        isDrop ? 'bg-cyan-100/70 ring-2 ring-cyan-300' : 'bg-slate-100/80',
                      )}
                    >
                      {colTasks.map((task: any) => (
                        <button
                          key={task.id}
                          type="button"
                          draggable
                          onDragStart={(e) => {
                            setKanbanDragId(task.id);
                            e.dataTransfer.effectAllowed = 'move';
                            e.dataTransfer.setData('text/plain', task.id);
                          }}
                          onDragEnd={() => {
                            setKanbanDragId(null);
                            setKanbanDropCol(null);
                          }}
                          onClick={() => setSelectedId(task.id)}
                          className={cn(
                            'w-full cursor-grab rounded-xl border bg-white p-3 text-left shadow-sm transition hover:shadow-md active:cursor-grabbing',
                            selectedId === task.id ? 'border-cyan-300 ring-2 ring-cyan-100' : 'border-slate-100',
                            kanbanDragId === task.id && 'opacity-40',
                          )}
                        >
                          <div className="mb-1.5 flex items-center justify-between">
                            <span className="truncate text-[10px] text-slate-400">
                              {task.project?.name || task.department?.name || '—'}
                            </span>
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: getPriorityColor(task.priority || '') }}
                            />
                          </div>
                          <p className="mb-2 line-clamp-2 text-sm font-medium text-slate-900">{task.title}</p>
                          <div className="flex items-center justify-between">
                            {task.assignee ? (
                              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-100 text-[10px] font-bold text-cyan-800">
                                {getInitials(task.assignee.name)}
                              </span>
                            ) : (
                              <span />
                            )}
                            {task.dueDate ? (
                              <span className="text-[10px] text-slate-400">{formatDate(task.dueDate)}</span>
                            ) : null}
                          </div>
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          setForm({ ...emptyForm, status: col });
                          setShowForm(true);
                        }}
                        className="w-full rounded-lg border border-dashed border-slate-200 py-2 text-xs text-slate-400 hover:border-cyan-300 hover:text-cyan-700"
                      >
                        + {tr('task.new')}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {selectedId ? (
          <WorkTaskPanel
            taskId={selectedId}
            users={users}
            groups={groups}
            activeCompanyId={activeCompanyId}
            onClose={() => setSelectedId(null)}
            onChanged={() => fetchTasks({ silent: true })}
            t={t3}
          />
        ) : null}
      </div>

      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => setShowForm(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="text-lg font-semibold">{tr('task.new')}</h2>
              <button type="button" onClick={() => setShowForm(false)}>
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4 p-5">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{tr('task.title')} *</label>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-cyan-400"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{tr('project.description')}</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-cyan-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">{tr('nav.projects')}</label>
                  <select
                    value={form.projectId}
                    onChange={(e) => setForm({ ...form, projectId: e.target.value })}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  >
                    <option value="">{t3('No project', 'Sin proyecto', 'Sem projeto')}</option>
                    {(projects ?? []).map((p: any) => (
                      <option key={p?.id} value={p?.id}>
                        {p?.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    {t3('Section', 'Sección', 'Secção')}
                  </label>
                  <select
                    value={form.groupId}
                    onChange={(e) => setForm({ ...form, groupId: e.target.value })}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  >
                    <option value="">—</option>
                    {(groups ?? []).map((g: any) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">{tr('task.assignee')}</label>
                  <select
                    value={form.assigneeId}
                    onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  >
                    <option value="">—</option>
                    {(users ?? []).map((u: any) => (
                      <option key={u?.id} value={u?.id}>
                        {u?.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">{tr('general.priority')}</label>
                  <select
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value })}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  >
                    <option value="LOW">{tr('priority.low')}</option>
                    <option value="MEDIUM">{tr('priority.medium')}</option>
                    <option value="HIGH">{tr('priority.high')}</option>
                    <option value="CRITICAL">{tr('priority.critical')}</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">{tr('general.status')}</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  >
                    {WORK_KANBAN.map((s) => (
                      <option key={s} value={s}>
                        {tr(`status.${s.toLowerCase()}`)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">{tr('task.dueDate')}</label>
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Tags</label>
                <input
                  value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                  placeholder="design, sprint"
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
                >
                  {tr('general.cancel')}
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500"
                >
                  {tr('general.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
