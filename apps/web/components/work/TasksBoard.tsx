'use client';

import { useEffect, useState } from 'react';
import { useApp } from '@/app/providers';
import { cn, formatDate, getInitials, getPriorityColor, getStatusColor } from '@/lib/utils';
import { LayoutGrid, List, Plus, Search, X } from 'lucide-react';
import { WorkTableBoard } from './WorkTableBoard';
import { WorkTaskPanel } from './WorkTaskPanel';
import { WorkBulkBar } from './WorkBulkBar';
import {
  WORK_KANBAN,
  STARTER_GROUPS,
  parseTags,
  DEFAULT_WORK_COLUMNS,
  DEFAULT_WORK_NOTIFY,
  WORK_BOARD_TEMPLATES,
  type WorkColumn,
  type WorkNotifyPrefs,
} from './work-ui';

type ML = { es: string; pt: string; en: string };
const ml = (en: string, es: string, pt: string): ML => ({ en, es, pt });

export type TasksBoardProps = {
  variant?: 'atlas' | 'hub';
  embedded?: boolean;
  forcedView?: 'table' | 'kanban';
  hideViewToggle?: boolean;
  hideScopeFilters?: boolean;
  initialProjectId?: string;
  initialDepartmentId?: string;
  initialTaskScope?: string;
  initialFolderId?: string;
  initialAssigneeId?: string;
  /** When true, new groups stay private to the current user (Mi trabajo). */
  personalGroups?: boolean;
  /** Layout key for this area — each board keeps its own columns. */
  boardScopeKey?: string;
  queue?: '' | 'overdue' | 'unassigned' | 'week';
  externalSearch?: string;
  externalStatus?: string;
  externalPriority?: string;
  onTasksChanged?: () => void;
  externalSelectedId?: string | null;
  onExternalSelect?: (id: string | null) => void;
  /** Tasks already loaded by the shell. When set, the board does not wait on a second fetch. */
  presetTasks?: any[] | null;
};

const emptyForm = {
  title: '',
  description: '',
  projectId: '',
  departmentId: '',
  groupId: '',
  folderId: '',
  assigneeId: '',
  priority: 'MEDIUM',
  status: 'TODO',
  dueDate: '',
  tags: '',
  isRecurring: false,
  recurrenceMonths: '1',
  recurrenceCount: '1',
};

export default function TasksBoard({
  variant = 'atlas',
  embedded = false,
  forcedView,
  hideViewToggle = false,
  hideScopeFilters = false,
  initialProjectId = '',
  initialDepartmentId = '',
  initialTaskScope = '',
  initialFolderId = '',
  initialAssigneeId = '',
  personalGroups = false,
  boardScopeKey = '',
  queue = '',
  externalSearch = '',
  externalStatus = '',
  externalPriority = '',
  onTasksChanged,
  externalSelectedId,
  onExternalSelect,
  presetTasks = null,
}: TasksBoardProps) {
  const { tr, activeCompanyId, locale } = useApp();
  const resolvedScopeKey = boardScopeKey || (activeCompanyId ? 'all' : '');
  const L = (m: ML) => m[locale] || m.en;
  const t3 = (en: string, es: string, pt: string) => L(ml(en, es, pt));

  const [tasks, setTasks] = useState<any[]>(presetTasks ?? []);
  const [projects, setProjects] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [folders, setFolders] = useState<any[]>([]);
  const [loading, setLoading] = useState(presetTasks == null);
  const [view, setView] = useState<'table' | 'kanban'>(forcedView || 'table');
  const [selectedIdInternal, setSelectedIdInternal] = useState<string | null>(null);
  const selectedId = onExternalSelect ? (externalSelectedId ?? null) : selectedIdInternal;
  const setSelectedId = (id: string | null) => {
    if (onExternalSelect) onExternalSelect(id);
    else setSelectedIdInternal(id);
  };
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [seedingStarter, setSeedingStarter] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [kanbanDragId, setKanbanDragId] = useState<string | null>(null);
  const [kanbanDropCol, setKanbanDropCol] = useState<string | null>(null);
  const [boardColumns, setBoardColumns] = useState<WorkColumn[]>(DEFAULT_WORK_COLUMNS);
  const [boardNotify, setBoardNotify] = useState<WorkNotifyPrefs>(DEFAULT_WORK_NOTIFY);
  const [bulkIds, setBulkIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState(initialProjectId);
  const [priorityFilter, setPriorityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState(initialAssigneeId);
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [showAdvFilters, setShowAdvFilters] = useState(false);
  const [departmentFilter, setDepartmentFilter] = useState(initialDepartmentId);
  const [folderFilter, setFolderFilter] = useState(initialFolderId);
  const [taskScopeFilter, setTaskScopeFilter] = useState(initialTaskScope);

  useEffect(() => {
    if (forcedView) setView(forcedView);
  }, [forcedView]);

  const saveBoard = async (next: { columns?: WorkColumn[]; notify?: WorkNotifyPrefs }) => {
    if (!activeCompanyId || !resolvedScopeKey) return;
    const columns = next.columns || boardColumns;
    const notify = next.notify || boardNotify;
    setBoardColumns(columns);
    setBoardNotify(notify);
    await fetch('/api/work-board', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId: activeCompanyId,
        scopeKey: resolvedScopeKey,
        columns,
        notify,
      }),
    });
  };

  useEffect(() => {
    if (!activeCompanyId || !resolvedScopeKey) {
      setBoardColumns(DEFAULT_WORK_COLUMNS);
      return;
    }
    setBoardColumns(DEFAULT_WORK_COLUMNS);
    fetch(
      `/api/work-board?companyId=${encodeURIComponent(activeCompanyId)}&scopeKey=${encodeURIComponent(resolvedScopeKey)}`,
    )
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d?.columns) && d.columns.length) setBoardColumns(d.columns);
        if (d?.notify) setBoardNotify({ ...DEFAULT_WORK_NOTIFY, ...d.notify });
      })
      .catch(() => {});
  }, [activeCompanyId, resolvedScopeKey]);

  useEffect(() => {
    setProjectFilter(initialProjectId);
    setDepartmentFilter(initialDepartmentId);
    setTaskScopeFilter(initialTaskScope);
    setFolderFilter(initialFolderId);
    setAssigneeFilter(initialAssigneeId);
  }, [initialProjectId, initialDepartmentId, initialTaskScope, initialFolderId, initialAssigneeId]);

  useEffect(() => {
    if (presetTasks == null) return;
    setTasks(presetTasks);
    setLoading(false);
  }, [presetTasks]);

  const fetchTasks = (opts?: { silent?: boolean }) => {
    if (!opts?.silent && presetTasks == null) setLoading(true);
    const params = new URLSearchParams();
    if (activeCompanyId) params.set('companyId', activeCompanyId);
    if (projectFilter) params.set('projectId', projectFilter);
    if (departmentFilter) params.set('departmentId', departmentFilter);
    if (folderFilter) params.set('folderId', folderFilter);
    if (assigneeFilter) params.set('assigneeId', assigneeFilter);
    if (taskScopeFilter === 'company') params.set('noProject', '1');
    fetch(`/api/tasks?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d?.tasks)) setTasks(d.tasks);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  const fetchGroups = () => {
    if (!activeCompanyId) {
      setGroups([]);
      return;
    }
    const params = new URLSearchParams({ companyId: activeCompanyId });
    if (personalGroups) params.set('personal', '1');
    else if (folderFilter) params.set('folderId', folderFilter);
    fetch(`/api/task-groups?${params}`)
      .then((r) => r.json())
      .then((d) => setGroups(d?.groups ?? []))
      .catch(() => setGroups([]));
  };

  const fetchFolders = () => {
    if (!activeCompanyId) {
      setFolders([]);
      return;
    }
    fetch(`/api/work-folders?companyId=${encodeURIComponent(activeCompanyId)}`)
      .then((r) => r.json())
      .then((d) => setFolders(d?.folders ?? []))
      .catch(() => setFolders([]));
  };

  useEffect(() => {
    fetchTasks();
  }, [activeCompanyId, projectFilter, departmentFilter, taskScopeFilter, folderFilter, assigneeFilter]);

  useEffect(() => {
    fetchGroups();
    fetchFolders();
  }, [activeCompanyId, personalGroups, folderFilter]);

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

  const notifyChanged = () => onTasksChanged?.();

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
        if (body.customFields && typeof body.customFields === 'object') {
          next.customFields = { ...(task.customFields || {}), ...(body.customFields as object) };
        }
        return next;
      }),
    );
    await fetch(`/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    notifyChanged();
  };

  const toggleBulk = (id: string) => {
    setBulkIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleBulkSection = (ids: string[]) => {
    setBulkIds((prev) => {
      const next = new Set(prev);
      const allOn = ids.length > 0 && ids.every((id) => next.has(id));
      if (allOn) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  };

  const deleteTask = async (id: string, title: string) => {
    if (!confirm(`${t3('Delete this task?', '¿Eliminar esta tarea?', 'Excluir esta tarefa?')} ${title}`)) return;
    const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    if (!res.ok) return;
    setTasks((prev) => prev.filter((task) => task.id !== id));
    setBulkIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    if (selectedId === id) setSelectedId(null);
    notifyChanged();
  };

  const deleteSelected = async () => {
    if (bulkIds.size === 0) return;
    if (!confirm(t3(`Delete ${bulkIds.size} tasks?`, `¿Eliminar ${bulkIds.size} tareas?`, `Excluir ${bulkIds.size} tarefas?`))) return;
    setBulkBusy(true);
    try {
      const res = await fetch('/api/tasks/bulk', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [...bulkIds], delete: true }),
      });
      if (res.ok) {
        setBulkIds(new Set());
        fetchTasks({ silent: true });
        notifyChanged();
      }
    } finally {
      setBulkBusy(false);
    }
  };

  const runBulk = async (patch: Record<string, unknown>) => {
    if (bulkIds.size === 0) return;
    setBulkBusy(true);
    try {
      const res = await fetch('/api/tasks/bulk', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [...bulkIds], patch }),
      });
      if (res.ok) {
        setBulkIds(new Set());
        fetchTasks({ silent: true });
        notifyChanged();
      }
    } finally {
      setBulkBusy(false);
    }
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
    if (!body.folderId) {
      if (folderFilter) body.folderId = folderFilter;
      else delete body.folderId;
    }
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

  const addSubtask = async (parentId: string, title: string) => {
    const parent = (tasks ?? []).find((task: any) => task.id === parentId);
    const body: Record<string, unknown> = {
      title,
      parentId,
      status: 'TODO',
      priority: parent?.priority || 'MEDIUM',
      groupId: parent?.groupId || undefined,
      folderId: parent?.folderId || folderFilter || undefined,
      assigneeId: parent?.assigneeId || undefined,
      departmentId: parent?.departmentId || departmentFilter || undefined,
    };
    if (parent?.projectId || projectFilter) body.projectId = parent?.projectId || projectFilter;
    else if (activeCompanyId) body.companyId = activeCompanyId;
    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    fetchTasks({ silent: true });
    notifyChanged();
  };

  const duplicateTask = async (task: any) => {
    const body: Record<string, unknown> = {
      title: `${task.title} (copy)`,
      status: task.status || 'TODO',
      priority: task.priority || 'MEDIUM',
      groupId: task.groupId || undefined,
      folderId: task.folderId || undefined,
      assigneeId: task.assigneeId || undefined,
      departmentId: task.departmentId || undefined,
      dueDate: task.dueDate || undefined,
      startDate: task.startDate || undefined,
      estimatedHours: task.estimatedHours || undefined,
      customFields: task.customFields || undefined,
    };
    if (task.projectId) body.projectId = task.projectId;
    else if (activeCompanyId) body.companyId = activeCompanyId;
    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    fetchTasks({ silent: true });
    notifyChanged();
  };

  const quickAdd = async (groupId: string | null, title: string) => {
    const body: Record<string, unknown> = {
      title,
      status: 'TODO',
      priority: 'MEDIUM',
      groupId: groupId || undefined,
      folderId: folderFilter || undefined,
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
        body: JSON.stringify({
          companyId: activeCompanyId,
          name,
          color: color || null,
          personal: personalGroups,
          folderId: !personalGroups && folderFilter ? folderFilter : undefined,
        }),
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

  const applyPack = async (
    groupsToCreate: Array<{ name: string; color: string; tasks: string[] }>,
  ) => {
    if (!activeCompanyId || seedingStarter) return;
    setSeedingStarter(true);
    try {
      for (const group of groupsToCreate) {
        const res = await fetch('/api/task-groups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyId: activeCompanyId, name: group.name, color: group.color }),
        });
        const data = await res.json().catch(() => ({}));
        const groupId = data?.group?.id as string | undefined;
        for (const title of group.tasks) {
          const body: Record<string, unknown> = {
            title,
            status: 'TODO',
            priority: 'MEDIUM',
            companyId: activeCompanyId,
            groupId,
          };
          if (projectFilter) body.projectId = projectFilter;
          if (departmentFilter) body.departmentId = departmentFilter;
          if (folderFilter) body.folderId = folderFilter;
          if (assigneeFilter) body.assigneeId = assigneeFilter;
          await fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
        }
      }
      fetchGroups();
      fetchTasks();
      notifyChanged();
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

  const persistSortOrders = async (
    ordered: Array<{ groupId: string | null; taskIds: string[] }>,
  ) => {
    const orderMap = new Map<string, number>();
    for (const group of ordered) {
      group.taskIds.forEach((id, i) => orderMap.set(id, i));
    }
    if (orderMap.size === 0) return;
    setTasks((prev) =>
      prev.map((task) => (orderMap.has(task.id) ? { ...task, order: orderMap.get(task.id) } : task)),
    );
    await Promise.all(
      [...orderMap.entries()].map(([id, order]) =>
        fetch(`/api/tasks/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order }),
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
    const q = (embedded ? externalSearch : search).trim().toLowerCase();
    if (
      q &&
      !(task?.title ?? '').toLowerCase().includes(q) &&
      !(task?.description ?? '').toLowerCase().includes(q) &&
      !parseTags(task?.tags).some((tag) => tag.toLowerCase().includes(q))
    ) {
      return false;
    }
    const status = embedded ? externalStatus : statusFilter;
    const priority = embedded ? externalPriority : priorityFilter;
    if (priority && task?.priority !== priority) return false;
    if (status && task?.status !== status) return false;
    if (queue === 'unassigned' && task?.assigneeId) return false;
    if (queue === 'overdue' || queue === 'week') {
      const open = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW'].includes(task?.status);
      if (!open || !task?.dueDate) return false;
      const due = new Date(task.dueDate);
      if (queue === 'overdue' && due.getTime() >= Date.now()) return false;
      if (queue === 'week') {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
        const end = new Date(start);
        end.setDate(end.getDate() + 7);
        if (due < start || due >= end) return false;
      }
    }
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
    <div
      className={cn(
        'flex min-w-0 flex-col',
        embedded ? 'min-h-0' : 'min-h-[70vh]',
        variant === 'hub' && !embedded && 'min-h-[calc(100vh-7.5rem)]',
      )}
    >
      {!embedded && <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {variant === 'hub' || embedded ? (
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
          {!hideViewToggle && (
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
          )}
          <button
            type="button"
            onClick={() => {
              setForm({
                ...emptyForm,
                projectId: projectFilter || '',
                departmentId: departmentFilter || '',
                folderId: folderFilter || '',
              });
              setShowForm(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-cyan-500"
          >
            <Plus className="h-4 w-4" />
            {tr('task.new')}
          </button>
        </div>
      </div>}

      {!embedded && <div className="mb-4 space-y-2">
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
          {!hideScopeFilters && (
            <>
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
                <option value="company">{t3('Company tasks', 'De empresa', 'Da empresa')}</option>
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
            </>
          )}
          <button
            type="button"
            onClick={() => setShowAdvFilters(!showAdvFilters)}
            className={cn(
              'rounded-lg border px-3 py-2.5 text-sm transition',
              hasAdvFilters
                ? 'border-cyan-300 bg-cyan-50 text-cyan-800'
                : 'border-[color:var(--sys-line)] text-[color:var(--sys-muted)] hover:bg-[color:var(--sys-nav-hover)]',
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
      </div>}

      <div className={cn('flex min-h-0 flex-1 gap-0 overflow-hidden', embedded ? '' : 'rounded-2xl border border-slate-200/80 bg-slate-50/50')}>
        <div className="min-w-0 flex-1 overflow-y-auto p-3 sm:p-4">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-600/30 border-t-cyan-600" />
            </div>
          ) : !loading && (tasks ?? []).filter((task: any) => !task?.parentId).length === 0 && embedded ? (
            <div className="px-6 py-12">
              <p className="text-sm font-medium text-slate-700">
                {t3('This board is empty', 'Este tablero está vacío', 'Este quadro está vazio')}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {t3(
                  'Create a task above, or start from a pack.',
                  'Crea una tarea arriba, o empieza con un paquete.',
                  'Cria uma tarefa acima, ou começa com um pack.',
                )}
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                {[
                  {
                    title: t3('Weekly operations', 'Operación semanal', 'Operação semanal'),
                    groups: [
                      { name: t3('This week', 'Esta semana', 'Esta semana'), color: '#0d9488', tasks: [t3('Team check-in', 'Revisión del equipo', 'Ponto da equipa')] },
                      { name: t3('Waiting', 'En espera', 'À espera'), color: '#ea580c', tasks: [t3('Unblock a request', 'Desbloquear un pedido', 'Desbloquear um pedido')] },
                    ],
                  },
                  {
                    title: t3('Onboarding', 'Incorporación', 'Integração'),
                    groups: [
                      { name: t3('Welcome', 'Bienvenida', 'Boas-vindas'), color: '#2563eb', tasks: [t3('Access and tools', 'Accesos y herramientas', 'Acessos e ferramentas')] },
                      { name: t3('First week', 'Primera semana', 'Primeira semana'), color: '#7c3aed', tasks: [t3('First delivery', 'Primera entrega', 'Primeira entrega')] },
                    ],
                  },
                  {
                    title: t3('Project phases', 'Fases de proyecto', 'Fases de projeto'),
                    groups: [
                      { name: t3('Plan', 'Plan', 'Plano'), color: '#0891b2', tasks: [t3('Agree the scope', 'Acordar el alcance', 'Acordar o âmbito')] },
                      { name: t3('Deliver', 'Entrega', 'Entrega'), color: '#ea580c', tasks: [t3('Build the work', 'Construir el trabajo', 'Construir o trabalho')] },
                      { name: t3('Close', 'Cierre', 'Fecho'), color: '#16a34a', tasks: [t3('Hand over', 'Entregar', 'Entregar')] },
                    ],
                  },
                ].map((pack) => (
                  <button
                    key={pack.title}
                    type="button"
                    disabled={seedingStarter}
                    onClick={() => void applyPack(pack.groups)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-left text-sm font-medium text-slate-800 hover:border-teal-300 hover:bg-teal-50 disabled:opacity-50"
                  >
                    {pack.title}
                  </button>
                ))}
              </div>
            </div>
          ) : view === 'table' ? (
            <>
              <WorkBulkBar
                count={bulkIds.size}
                users={users}
                busy={bulkBusy}
                onClear={() => setBulkIds(new Set())}
                onSelectAll={() => setBulkIds(new Set(filtered.map((t: any) => t.id)))}
                onBulk={runBulk}
                onDelete={() => void deleteSelected()}
                t={t3}
              />
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
              selectedIds={bulkIds}
              onToggleSelect={toggleBulk}
              onToggleSelectAll={toggleBulkSection}
              t={t3}
              statusLabel={(s) => tr(`status.${s.toLowerCase()}`)}
              priorityLabel={(p) => tr(`priority.${p.toLowerCase()}`)}
              columns={boardColumns}
              projects={projects}
              departments={departments}
              folders={folders}
              notify={boardNotify}
              onColumnsChange={(columns) => void saveBoard({ columns })}
              onNotifyChange={(notifyPrefs) => void saveBoard({ notify: notifyPrefs })}
              onApplyTemplate={(columns) => void saveBoard({ columns })}
              onCommentPosted={() => fetchTasks({ silent: true })}
              onDeleteTask={(id, title) => void deleteTask(id, title)}
              subtasksOf={(id) => (tasks ?? []).filter((task: any) => task?.parentId === id)}
              onAddSubtask={addSubtask}
              onDuplicate={(task) => void duplicateTask(task)}
              onPersistSortOrders={(ordered) => void persistSortOrders(ordered)}
            />
            </>
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
                        isDrop ? 'bg-cyan-500/15 ring-2 ring-cyan-400/40' : 'bg-[color:var(--sys-panel-soft)]',
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
                              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-500/20 text-[10px] font-bold text-cyan-200">
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
                        className="w-full rounded-lg border border-dashed border-[color:var(--sys-line)] py-2 text-xs text-[color:var(--sys-faint)] hover:border-teal-400/50 hover:text-teal-300"
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
            folders={folders}
            activeCompanyId={activeCompanyId}
            onClose={() => setSelectedId(null)}
            onChanged={() => {
              fetchTasks({ silent: true });
              notifyChanged();
            }}
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
