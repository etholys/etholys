'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useApp } from '@/app/providers';
import { cn } from '@/lib/utils';
import TasksBoard from './TasksBoard';
import { WorkSidebar, type WorkNav } from './WorkSidebar';
import { WorkDashboard } from './WorkDashboard';
import { WorkGantt } from './WorkGantt';
import { WorkCalendar } from './WorkCalendar';
import { WorkList } from './WorkList';
import { WorkWorkload } from './WorkWorkload';
import { WorkTaskPanel } from './WorkTaskPanel';
import { WorkFolderShareDialog } from './WorkFolderShareDialog';
import type { ReactNode } from 'react';
import {
  Calendar,
  CalendarRange,
  LayoutGrid,
  List,
  ListTree,
  Settings,
  Users,
} from 'lucide-react';
import Link from 'next/link';

type ML = { es: string; pt: string; en: string };
const ml = (en: string, es: string, pt: string): ML => ({ en, es, pt });

export type BoardView = 'table' | 'kanban' | 'gantt' | 'calendar' | 'list' | 'workload';

const VIEW_SET = new Set<BoardView>(['table', 'kanban', 'gantt', 'calendar', 'list', 'workload']);

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
  return { kind: 'dashboard' };
}

function navToParams(nav: WorkNav): { nav: string; id?: string; name?: string } {
  if (nav.kind === 'department' || nav.kind === 'project' || nav.kind === 'folder') {
    return { nav: nav.kind, id: nav.id, name: nav.name };
  }
  return { nav: nav.kind };
}

export default function WorkShell() {
  const { locale, activeCompanyId } = useApp();
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const L = (m: ML) => m[locale] || m.en;
  const t3 = (en: string, es: string, pt: string) => L(ml(en, es, pt));

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

  // Hydrate from URL once lists are available (or immediately for simple nav)
  useEffect(() => {
    if (urlReady) return;
    const v = parseView(searchParams.get('view'));
    const n = parseNavFromParams(searchParams, folders, departments, projects);
    setBoardView(v);
    setNav(n);
    setUrlReady(true);
  }, [searchParams, folders, departments, projects, urlReady]);

  const changeNav = (n: WorkNav) => {
    setNav(n);
    setSelectedId(null);
    syncUrl(n, boardView);
  };

  const changeView = (v: BoardView) => {
    setBoardView(v);
    if (nav.kind !== 'dashboard') syncUrl(nav, v);
  };

  const scopedTasks = useMemo(() => {
    const top = (tasks ?? []).filter((t: any) => !t.parentId);
    if (nav.kind === 'company') return top.filter((t: any) => !t.projectId);
    if (nav.kind === 'department') return top.filter((t: any) => t.departmentId === nav.id);
    if (nav.kind === 'project') return top.filter((t: any) => t.projectId === nav.id);
    if (nav.kind === 'folder') return top.filter((t: any) => t.folderId === nav.id);
    if (nav.kind === 'mine') {
      return top.filter((t: any) => currentUserId && t.assigneeId === currentUserId);
    }
    return top;
  }, [tasks, nav, currentUserId]);

  const counts = useMemo(() => {
    const top = (tasks ?? []).filter((t: any) => !t.parentId);
    const openStatuses = new Set(['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW']);
    const open = top.filter((t: any) => openStatuses.has(t.status));
    const now = new Date();
    return {
      open: open.length,
      overdue: open.filter((t: any) => t.dueDate && new Date(t.dueDate) < now).length,
      mine: open.filter((t: any) => currentUserId && t.assigneeId === currentUserId).length,
    };
  }, [tasks, currentUserId]);

  const contextTitle = (() => {
    if (nav.kind === 'dashboard') return t3('Dashboard', 'Panel', 'Painel');
    if (nav.kind === 'all') return t3('All tasks', 'Todas las tareas', 'Todas as tarefas');
    if (nav.kind === 'mine') return t3('My tasks', 'Mis tareas', 'As minhas tarefas');
    if (nav.kind === 'company') return t3('Company operations', 'Operaciones de empresa', 'Operações da empresa');
    if (nav.kind === 'department') return nav.name;
    if (nav.kind === 'project') return nav.name;
    if (nav.kind === 'folder') return nav.name;
    return 'Work';
  })();

  const createFolder = async (input: { name: string; visibility: 'PERSONAL' | 'SHARED' }) => {
    if (!activeCompanyId) return;
    const res = await fetch('/api/work-folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId: activeCompanyId,
        name: input.name,
        visibility: input.visibility,
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
              : nav.kind === 'all'
                ? { taskScope: '' as const, projectId: '', departmentId: '', folderId: '', assigneeId: '' }
                : null;

  const shellViews: BoardView[] = ['calendar', 'list', 'gantt', 'workload'];
  const showPanel =
    !!selectedId && (nav.kind === 'dashboard' || shellViews.includes(boardView));

  const viewBtn = (v: BoardView, icon: ReactNode, label: string, short?: string) => (
    <button
      type="button"
      onClick={() => changeView(v)}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium',
        boardView === v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500',
      )}
      title={label}
    >
      {icon}
      <span className="hidden lg:inline">{label}</span>
      {short && <span className="hidden sm:inline lg:hidden">{short}</span>}
    </button>
  );

  return (
    <div className="flex min-h-[calc(100vh-7.5rem)] overflow-hidden rounded-2xl border border-slate-200/80 bg-white/50 shadow-sm">
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
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-white/80 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-700">
              Etholys Work
            </p>
            <h2 className="truncate text-lg font-bold tracking-tight text-slate-900">{contextTitle}</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/hub/work/settings"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              title={t3('Settings', 'Ajustes', 'Definições')}
            >
              <Settings className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t3('Settings', 'Ajustes', 'Definições')}</span>
            </Link>
            {nav.kind !== 'dashboard' && (
              <div className="flex flex-wrap rounded-lg bg-slate-100 p-0.5">
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

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="min-w-0 flex-1 overflow-y-auto p-3 sm:p-4">
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
              <WorkCalendar tasks={scopedTasks} onSelect={setSelectedId} t={t3} />
            ) : boardView === 'list' ? (
              <WorkList tasks={scopedTasks} onSelect={setSelectedId} t={t3} />
            ) : boardView === 'workload' ? (
              <WorkWorkload
                tasks={scopedTasks}
                onOpenTask={setSelectedId}
                onSelectPerson={(assigneeId) => {
                  if (assigneeId && assigneeId === currentUserId) changeNav({ kind: 'mine' });
                  else if (!assigneeId) changeNav({ kind: 'all' });
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
                initialAssigneeId={scopeProps?.assigneeId || ''}
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
