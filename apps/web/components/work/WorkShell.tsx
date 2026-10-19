'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useApp } from '@/app/providers';
import { cn } from '@/lib/utils';
import TasksBoard from './TasksBoard';
import { WorkSidebar, type WorkNav } from './WorkSidebar';
import { WorkDashboard } from './WorkDashboard';
import { WorkGantt } from './WorkGantt';
import { WorkCalendar } from './WorkCalendar';
import { WorkWorkload } from './WorkWorkload';
import { WorkTaskPanel } from './WorkTaskPanel';
import { WorkFolderShareDialog } from './WorkFolderShareDialog';
import { WorkQuickAdd } from './WorkQuickAdd';
import { WORK_KANBAN, WORK_PRIORITIES, workPriorityLabel, workStatusLabel } from './work-ui';
import {
  Calendar,
  CalendarRange,
  LayoutGrid,
  List,
  ListTree,
  Search,
  Users,
  X,
} from 'lucide-react';

type ML = { es: string; pt: string; en: string };
const ml = (en: string, es: string, pt: string): ML => ({ en, es, pt });

export type BoardView = 'table' | 'kanban' | 'gantt' | 'calendar' | 'list' | 'workload';

const VIEW_SET = new Set<BoardView>(['table', 'kanban', 'gantt', 'calendar', 'list', 'workload']);
const VIEW_STORAGE_KEY = 'etholys.work.boardView';
const OPEN = new Set(['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW']);

function parseView(raw: string | null): BoardView {
  if (raw && VIEW_SET.has(raw as BoardView)) return raw as BoardView;
  return 'table';
}

function parseNavFromParams(
  sp: URLSearchParams,
  folders: { id: string; name: string }[],
  departments: { id: string; name: string }[],
  projects: { id: string; name: string }[],
): WorkNav {
  const kind = sp.get('nav') || 'dashboard';
  const id = sp.get('id') || '';
  if (kind === 'all') return { kind: 'all' };
  if (kind === 'company') return { kind: 'company' };
  if (kind === 'mine') return { kind: 'mine' };
  if (kind === 'overdue') return { kind: 'overdue' };
  if (kind === 'unassigned') return { kind: 'unassigned' };
  if (kind === 'week') return { kind: 'week' };
  if (kind === 'department' && id) {
    const d = departments.find((x) => x.id === id);
    return { kind: 'department', id, name: d?.name || sp.get('name') || id };
  }
  if (kind === 'project' && id) {
    const p = projects.find((x) => x.id === id);
    return { kind: 'project', id, name: p?.name || sp.get('name') || id };
  }
  if (kind === 'folder' && id) {
    const f = folders.find((x) => x.id === id);
    return { kind: 'folder', id, name: f?.name || sp.get('name') || id };
  }
  if (kind === 'person' && id) {
    return { kind: 'person', id, name: sp.get('name') || id };
  }
  return { kind: 'dashboard' };
}

function navToParams(nav: WorkNav): { nav: string; id?: string; name?: string } {
  if (nav.kind === 'department' || nav.kind === 'project' || nav.kind === 'folder' || nav.kind === 'person') {
    return { nav: nav.kind, id: nav.id, name: nav.name };
  }
  return { nav: nav.kind };
}

function toDateInputValue(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function WorkShell() {
  const { locale, activeCompanyId } = useApp();
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const L = (m: ML) => m[locale] || m.en;
  const t3 = (en: string, es: string, pt: string) => L(ml(en, es, pt));
  const searchRef = useRef<HTMLInputElement>(null);

  const [nav, setNav] = useState<WorkNav>({ kind: 'dashboard' });
  const [collapsed, setCollapsed] = useState(false);
  const [boardView, setBoardView] = useState<BoardView>('table');
  const [urlReady, setUrlReady] = useState(false);
  const [tasks, setTasks] = useState<any[]>([]);
  const [deps, setDeps] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [folders, setFolders] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadingDash, setLoadingDash] = useState(true);
  const [shareFolder, setShareFolder] = useState<{ id: string; name: string } | null>(null);
  const [query, setQuery] = useState('');
  const [statusChip, setStatusChip] = useState('');
  const [priorityChip, setPriorityChip] = useState('');
  const [personFocus, setPersonFocus] = useState('');

  const currentUserId = (session?.user as { id?: string } | undefined)?.id || null;

  const syncUrl = useCallback(
    (nextNav: WorkNav, nextView: BoardView) => {
      const params = new URLSearchParams();
      const np = navToParams(nextNav);
      params.set('nav', np.nav);
      if (np.id) params.set('id', np.id);
      if (np.name) params.set('name', np.name);
      if (nextNav.kind !== 'dashboard') params.set('view', nextView);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  const fetchAllTasks = (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoadingDash(true);
    const params = new URLSearchParams();
    if (activeCompanyId) params.set('companyId', activeCompanyId);
    fetch(`/api/tasks?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setTasks(d?.tasks ?? []);
        setLoadingDash(false);
      })
      .catch(() => setLoadingDash(false));
  };

  const fetchFolders = () => {
    if (!activeCompanyId) {
      setFolders([]);
      return;
    }
    fetch(`/api/work-folders?companyId=${encodeURIComponent(activeCompanyId)}`)
      .then((r) => r.json())
      .then((data) => setFolders(data?.folders ?? []))
      .catch(() => setFolders([]));
  };

  useEffect(() => {
    fetchAllTasks();
  }, [activeCompanyId]);

  useEffect(() => {
    const d = new URLSearchParams();
    if (activeCompanyId) d.set('companyId', activeCompanyId);
    fetch(`/api/departments?${d}`)
      .then((r) => r.json())
      .then((data) => setDepartments(data?.departments ?? []))
      .catch(() => {});
    const p = new URLSearchParams();
    if (activeCompanyId) p.set('companyId', activeCompanyId);
    fetch(`/api/projects?${p}`)
      .then((r) => r.json())
      .then((data) => setProjects(data?.projects ?? []))
      .catch(() => {});
    fetch('/api/users')
      .then((r) => r.json())
      .then((data) => setUsers(data?.users ?? []))
      .catch(() => {});
    fetchFolders();
  }, [activeCompanyId]);

  useEffect(() => {
    if (!activeCompanyId) {
      setGroups([]);
      return;
    }
    fetch(`/api/task-groups?companyId=${encodeURIComponent(activeCompanyId)}`)
      .then((r) => r.json())
      .then((d) => setGroups(d?.groups ?? []))
      .catch(() => setGroups([]));
  }, [activeCompanyId]);

  useEffect(() => {
    if (nav.kind !== 'project') {
      setDeps([]);
      return;
    }
    fetch(`/api/task-dependencies?projectId=${encodeURIComponent(nav.id)}`)
      .then((r) => r.json())
      .then((d) => setDeps(d?.dependencies ?? d?.deps ?? []))
      .catch(() => setDeps([]));
  }, [nav]);

  useEffect(() => {
    if (urlReady) return;
    const fromUrl = searchParams.get('view');
    let v = parseView(fromUrl);
    if (!fromUrl && typeof window !== 'undefined') {
      const stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
      if (stored && stored !== 'workload' && VIEW_SET.has(stored as BoardView)) v = stored as BoardView;
    }
    const n = parseNavFromParams(searchParams, folders, departments, projects);
    setBoardView(v);
    setNav(n);
    setUrlReady(true);
  }, [searchParams, folders, departments, projects, urlReady]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable;
      if (e.key === 'Escape') {
        setSelectedId(null);
        return;
      }
      if (!typing && (e.key === 'x' || e.key === 'X') && selectedId) {
        e.preventDefault();
        setSelectedId(null);
        return;
      }
      if (!typing && e.key === '/' && nav.kind !== 'dashboard') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [nav.kind, selectedId]);

  const changeNav = (n: WorkNav) => {
    setNav(n);
    setSelectedId(null);
    setQuery('');
    setPersonFocus('');
    const view: BoardView = n.kind === 'dashboard' ? boardView : 'table';
    if (n.kind !== 'dashboard') {
      setBoardView('table');
      try {
        window.localStorage.setItem(VIEW_STORAGE_KEY, 'table');
      } catch {
        /* ignore */
      }
    }
    syncUrl(n, view);
  };

  const changeView = (v: BoardView) => {
    setBoardView(v);
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, v);
    } catch {
      /* ignore */
    }
    if (nav.kind !== 'dashboard') syncUrl(nav, v);
  };

  const scopedTasks = useMemo(() => {
    const top = (tasks ?? []).filter((t: any) => !t.parentId);
    let list = top;
    if (nav.kind === 'company') list = top.filter((t: any) => !t.projectId);
    else if (nav.kind === 'department') list = top.filter((t: any) => t.departmentId === nav.id);
    else if (nav.kind === 'project') list = top.filter((t: any) => t.projectId === nav.id);
    else if (nav.kind === 'folder') list = top.filter((t: any) => t.folderId === nav.id);
    else if (nav.kind === 'mine') {
      list = top.filter((t: any) => currentUserId && t.assigneeId === currentUserId);
    } else if (nav.kind === 'person') {
      list = top.filter((t: any) => t.assigneeId === nav.id);
    } else if (nav.kind === 'overdue') {
      const now = Date.now();
      list = top.filter(
        (t: any) => OPEN.has(t.status) && t.dueDate && new Date(t.dueDate).getTime() < now,
      );
    } else if (nav.kind === 'unassigned') {
      list = top.filter((t: any) => OPEN.has(t.status) && !t.assigneeId);
    } else if (nav.kind === 'week') {
      const now = new Date();
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      list = top.filter((t: any) => {
        if (!OPEN.has(t.status) || !t.dueDate) return false;
        const d = new Date(t.dueDate);
        return d >= start && d < end;
      });
    }
    if (personFocus) list = list.filter((t: any) => t.assigneeId === personFocus);
    const q = query.trim().toLowerCase();
    if (statusChip) list = list.filter((t: any) => t.status === statusChip);
    if (priorityChip) list = list.filter((t: any) => t.priority === priorityChip);
    if (!q) return list;
    return list.filter((t: any) => {
      const hay = `${t.title || ''} ${t.assignee?.name || ''} ${t.status || ''} ${t.priority || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [tasks, nav, currentUserId, query, statusChip, priorityChip, personFocus]);

  const counts = useMemo(() => {
    const top = (tasks ?? []).filter((t: any) => !t.parentId);
    const open = top.filter((t: any) => OPEN.has(t.status));
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return {
      open: open.length,
      overdue: open.filter((t: any) => t.dueDate && new Date(t.dueDate) < now).length,
      mine: open.filter((t: any) => currentUserId && t.assigneeId === currentUserId).length,
      unassigned: open.filter((t: any) => !t.assigneeId).length,
      week: open.filter((t: any) => {
        if (!t.dueDate) return false;
        const d = new Date(t.dueDate);
        return d >= start && d < end;
      }).length,
    };
  }, [tasks, currentUserId]);

  const contextTitle = (() => {
    if (nav.kind === 'dashboard') return t3('Dashboard', 'Panel', 'Painel');
    if (nav.kind === 'all') return t3('All tasks', 'Todas las tareas', 'Todas as tarefas');
    if (nav.kind === 'mine') return t3('My tasks', 'Mis tareas', 'As minhas tarefas');
    if (nav.kind === 'overdue') return t3('Overdue', 'Atrasadas', 'Atrasadas');
    if (nav.kind === 'unassigned') return t3('Unassigned', 'Sin asignar', 'Sem responsável');
    if (nav.kind === 'week') return t3('This week', 'Esta semana', 'Esta semana');
    if (nav.kind === 'company') return t3('Team operations', 'Operaciones del equipo', 'Operações da equipa');
    if (nav.kind === 'department') return nav.name;
    if (nav.kind === 'project') return nav.name;
    if (nav.kind === 'folder') return nav.name;
    if (nav.kind === 'person') return nav.name;
    return 'eTask';
  })();

  const contextHint = (() => {
    if (nav.kind === 'overdue') {
      return t3('Open tasks past their due date', 'Tareas abiertas vencidas', 'Tarefas abertas fora do prazo');
    }
    if (nav.kind === 'mine') {
      return t3('Assigned to you', 'Asignadas a ti', 'Atribuídas a ti');
    }
    if (nav.kind === 'folder') {
      return t3('A board in your workspace', 'Un tablero de tu espacio', 'Um quadro do teu espaço');
    }
    if (nav.kind === 'company') {
      return t3(
        'Open demands across the company — not tied to one person',
        'Demandas abiertas de la empresa — no atadas a una persona',
        'Demandas abertas da empresa — sem ficar presas a uma pessoa',
      );
    }
    return null;
  })();

  const createFolder = async (input: { name: string; visibility: 'PERSONAL' | 'SHARED'; color?: string }) => {
    if (!activeCompanyId) return;
    const res = await fetch('/api/work-folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId: activeCompanyId,
        name: input.name,
        visibility: input.visibility,
        color: input.color,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return;
    fetchFolders();
    if (data.folder?.id) {
      const next: WorkNav = { kind: 'folder', id: data.folder.id, name: data.folder.name };
      setNav(next);
      setBoardView('table');
      syncUrl(next, 'table');
      if (input.visibility === 'SHARED') {
        setShareFolder({ id: data.folder.id, name: data.folder.name });
      }
    }
  };

  const buildCreateBody = (title: string, dueDate?: string) => {
    const body: Record<string, unknown> = {
      title,
      status: 'TODO',
      priority: 'MEDIUM',
      companyId: activeCompanyId || undefined,
    };
    if (dueDate) body.dueDate = dueDate;
    if (nav.kind === 'project') body.projectId = nav.id;
    if (nav.kind === 'department') body.departmentId = nav.id;
    if (nav.kind === 'folder') body.folderId = nav.id;
    if (nav.kind === 'company') {
      /* company ops = no project */
    }
    if (nav.kind === 'mine' && currentUserId) body.assigneeId = currentUserId;
    if (nav.kind === 'person') body.assigneeId = nav.id;
    return body;
  };

  const quickCreate = async (title: string, dueDate?: string) => {
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildCreateBody(title, dueDate)),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || 'create failed');
    fetchAllTasks({ silent: true });
    if (data?.task?.id) setSelectedId(data.task.id);
  };

  const rescheduleTask = async (taskId: string, day: Date) => {
    await fetch(`/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dueDate: toDateInputValue(day) }),
    });
    fetchAllTasks({ silent: true });
  };

  const scopeProps =
    nav.kind === 'company'
      ? { taskScope: 'company' as const, projectId: '', departmentId: '', folderId: '', assigneeId: '' }
      : nav.kind === 'department'
        ? { taskScope: '' as const, projectId: '', departmentId: nav.id, folderId: '', assigneeId: '' }
        : nav.kind === 'project'
          ? { taskScope: '' as const, projectId: nav.id, departmentId: '', folderId: '', assigneeId: '' }
          : nav.kind === 'folder'
            ? { taskScope: '' as const, projectId: '', departmentId: '', folderId: nav.id, assigneeId: '' }
            : nav.kind === 'mine'
              ? {
                  taskScope: '' as const,
                  projectId: '',
                  departmentId: '',
                  folderId: '',
                  assigneeId: currentUserId || '',
                }
              : nav.kind === 'person'
                ? { taskScope: '' as const, projectId: '', departmentId: '', folderId: '', assigneeId: nav.id }
              : nav.kind === 'overdue' || nav.kind === 'unassigned' || nav.kind === 'week' || nav.kind === 'all'
                ? { taskScope: '' as const, projectId: '', departmentId: '', folderId: '', assigneeId: '' }
                : null;

  const shellViews: BoardView[] = ['calendar', 'list', 'gantt', 'workload'];
  const showPanel =
    !!selectedId &&
    (nav.kind === 'dashboard' ||
      shellViews.includes(boardView) ||
      nav.kind === 'overdue');

  const viewBtn = (v: BoardView, icon: ReactNode, label: string, short?: string) => (
    <button
      type="button"
      onClick={() => changeView(v)}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition',
        boardView === v
          ? 'bg-[color:var(--sys-panel,#fff)] text-[color:var(--sys-ink,#0f172a)] shadow-sm'
          : 'text-[color:var(--sys-faint,#64748b)] hover:text-[color:var(--sys-ink,#0f172a)]',
      )}
      title={label}
    >
      {icon}
      <span className="hidden xl:inline">{label}</span>
      {short && <span className="hidden sm:inline xl:hidden">{short}</span>}
    </button>
  );

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-[color:var(--sys-panel)]">
      <WorkSidebar
        nav={nav}
        onNav={changeNav}
        departments={departments}
        projects={projects}
        folders={folders}
        currentUserId={currentUserId}
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        counts={counts}
        onCreateFolder={createFolder}
        onShareFolder={(f) => setShareFolder(f)}
        t={t3}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="space-y-2.5 border-b border-[color:var(--sys-line)] bg-[color:var(--sys-panel)] px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="truncate font-[family-name:var(--font-etholys-display)] text-lg font-bold tracking-tight text-[color:var(--sys-ink)]">{contextTitle}</h2>
              {contextHint && <p className="mt-0.5 text-[11px] text-[color:var(--sys-faint)]">{contextHint}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {nav.kind !== 'dashboard' && (
                <div className="flex max-w-full flex-wrap rounded-lg bg-[color:var(--sys-panel-soft)] p-0.5">
                  {viewBtn('table', <ListTree className="h-4 w-4" />, t3('Board', 'Tablero', 'Quadro'), 'Board')}
                  {viewBtn('list', <List className="h-4 w-4" />, t3('List', 'Lista', 'Lista'), 'List')}
                  {viewBtn('kanban', <LayoutGrid className="h-4 w-4" />, 'Kanban')}
                  {viewBtn('calendar', <Calendar className="h-4 w-4" />, t3('Calendar', 'Calendario', 'Calendário'), 'Cal')}
                  {viewBtn('gantt', <CalendarRange className="h-4 w-4" />, t3('Timeline', 'Cronograma', 'Gantt'), 'Gantt')}
                  {viewBtn('workload', <Users className="h-4 w-4" />, t3('Workload', 'Carga', 'Carga'), 'Load')}
                </div>
              )}
            </div>
          </div>

          {nav.kind !== 'dashboard' && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <WorkQuickAdd
                className="min-w-0 flex-1"
                disabled={!activeCompanyId}
                addLabel={t3('Add', 'Añadir', 'Criar')}
                placeholder={t3(
                  'Quick add a task… Enter to create',
                  'Añadir tarea rápida… Enter para crear',
                  'Criar tarefa rápida… Enter para criar',
                )}
                onSubmit={(title) => quickCreate(title)}
              />
              <div className="relative w-full sm:w-56">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[color:var(--sys-faint)]" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t3('Filter… /', 'Filtrar… /', 'Filtrar… /')}
                  className="w-full rounded-xl border border-[color:var(--sys-line)] bg-[color:var(--sys-panel-soft)] py-2 pl-8 pr-8 text-sm text-[color:var(--sys-ink)] outline-none focus:border-teal-500"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-700"
                    aria-label="Clear"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <select
                value={statusChip}
                onChange={(e) => setStatusChip(e.target.value)}
                className="rounded-xl border border-[color:var(--sys-line)] bg-[color:var(--sys-panel-soft)] px-2.5 py-2 text-xs text-[color:var(--sys-ink)]"
              >
                <option value="">{t3('Any status', 'Cualquier estado', 'Qualquer estado')}</option>
                {WORK_KANBAN.map((s) => (
                  <option key={s} value={s}>
                    {workStatusLabel(s, t3)}
                  </option>
                ))}
              </select>
              <select
                value={priorityChip}
                onChange={(e) => setPriorityChip(e.target.value)}
                className="rounded-xl border border-[color:var(--sys-line)] bg-[color:var(--sys-panel-soft)] px-2.5 py-2 text-xs text-[color:var(--sys-ink)]"
              >
                <option value="">{t3('Any priority', 'Cualquier prioridad', 'Qualquer prioridade')}</option>
                {WORK_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {workPriorityLabel(p, t3)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
            {nav.kind === 'dashboard' ? (
              loadingDash ? (
                <div className="flex justify-center py-16">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-600/30 border-t-cyan-600" />
                </div>
              ) : (
                <WorkDashboard
                  tasks={tasks}
                  currentUserId={currentUserId}
                  onOpenTask={setSelectedId}
                  onNav={changeNav}
                  t={t3}
                />
              )
            ) : boardView === 'gantt' ? (
              <WorkGantt tasks={scopedTasks} deps={deps} onSelect={setSelectedId} t={t3} />
            ) : boardView === 'calendar' ? (
              <WorkCalendar
                tasks={scopedTasks}
                onSelect={setSelectedId}
                onCreateDay={(day) => {
                  const label = t3('New task', 'Nueva tarea', 'Nova tarefa');
                  void quickCreate(label, toDateInputValue(day));
                }}
                onReschedule={(id, day) => void rescheduleTask(id, day)}
                t={t3}
              />
            ) : boardView === 'workload' ? (
              <WorkWorkload
                tasks={scopedTasks}
                onOpenTask={setSelectedId}
                onReassign={async (taskId, assigneeId) => {
                  await fetch(`/api/tasks/${taskId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ assigneeId }),
                  });
                  fetchAllTasks({ silent: true });
                }}
                onSelectPerson={(assigneeId) => {
                  if (!assigneeId) {
                    changeNav({ kind: 'unassigned' });
                    return;
                  }
                  setPersonFocus(assigneeId);
                  setBoardView('table');
                  try {
                    window.localStorage.setItem(VIEW_STORAGE_KEY, 'table');
                  } catch {
                    /* ignore */
                  }
                  syncUrl(nav, 'table');
                }}
                t={t3}
              />
            ) : (
              <TasksBoard
                variant="hub"
                embedded
                forcedView={boardView === 'kanban' ? 'kanban' : 'table'}
                hideViewToggle
                hideScopeFilters
                initialProjectId={scopeProps?.projectId || ''}
                initialDepartmentId={scopeProps?.departmentId || ''}
                initialTaskScope={scopeProps?.taskScope || ''}
                initialFolderId={scopeProps?.folderId || ''}
                initialAssigneeId={personFocus || scopeProps?.assigneeId || ''}
                queue={
                  nav.kind === 'overdue' ? 'overdue' : nav.kind === 'unassigned' ? 'unassigned' : nav.kind === 'week' ? 'week' : ''
                }
                externalSearch={query}
                externalStatus={statusChip}
                externalPriority={priorityChip}
                presetTasks={loadingDash ? null : scopedTasks}
                onTasksChanged={() => fetchAllTasks({ silent: true })}
                externalSelectedId={selectedId}
                onExternalSelect={setSelectedId}
              />
            )}
          </div>

          {showPanel && selectedId && (
            <WorkTaskPanel
              taskId={selectedId}
              users={users}
              groups={groups}
              folders={folders}
              activeCompanyId={activeCompanyId}
              onClose={() => setSelectedId(null)}
              onChanged={() => fetchAllTasks({ silent: true })}
              t={t3}
            />
          )}
        </div>
      </div>

      {shareFolder && (
        <WorkFolderShareDialog
          folderId={shareFolder.id}
          folderName={shareFolder.name}
          users={users}
          open={!!shareFolder}
          onClose={() => setShareFolder(null)}
          onSaved={fetchFolders}
          t={t3}
        />
      )}
    </div>
  );
}
