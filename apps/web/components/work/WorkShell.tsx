'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useApp } from '@/app/providers';
import { cn } from '@/lib/utils';
import TasksBoard from './TasksBoard';
import { WorkSidebar, type WorkNav } from './WorkSidebar';
import { WorkDashboard } from './WorkDashboard';
import { WorkGantt } from './WorkGantt';
import { WorkTaskPanel } from './WorkTaskPanel';
import { CalendarRange, LayoutGrid, List } from 'lucide-react';

type ML = { es: string; pt: string; en: string };
const ml = (en: string, es: string, pt: string): ML => ({ en, es, pt });

export default function WorkShell() {
  const { locale, activeCompanyId } = useApp();
  const { data: session } = useSession();
  const L = (m: ML) => m[locale] || m.en;
  const t3 = (en: string, es: string, pt: string) => L(ml(en, es, pt));

  const [nav, setNav] = useState<WorkNav>({ kind: 'dashboard' });
  const [collapsed, setCollapsed] = useState(false);
  const [boardView, setBoardView] = useState<'table' | 'kanban' | 'gantt'>('table');
  const [tasks, setTasks] = useState<any[]>([]);
  const [deps, setDeps] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadingDash, setLoadingDash] = useState(true);

  const currentUserId = (session?.user as { id?: string } | undefined)?.id || null;

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

  const scopedTasks = useMemo(() => {
    const top = (tasks ?? []).filter((t: any) => !t.parentId);
    if (nav.kind === 'company') return top.filter((t: any) => !t.projectId);
    if (nav.kind === 'department') return top.filter((t: any) => t.departmentId === nav.id);
    if (nav.kind === 'project') return top.filter((t: any) => t.projectId === nav.id);
    return top;
  }, [tasks, nav]);

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
    if (nav.kind === 'company') return t3('Company operations', 'Operaciones de empresa', 'Operações da empresa');
    if (nav.kind === 'department') return nav.name;
    if (nav.kind === 'project') return nav.name;
    return 'Work';
  })();

  const scopeProps =
    nav.kind === 'company'
      ? { taskScope: 'company' as const, projectId: '', departmentId: '' }
      : nav.kind === 'department'
        ? { taskScope: '' as const, projectId: '', departmentId: nav.id }
        : nav.kind === 'project'
          ? { taskScope: '' as const, projectId: nav.id, departmentId: '' }
          : nav.kind === 'all'
            ? { taskScope: '' as const, projectId: '', departmentId: '' }
            : null;

  return (
    <div className="flex min-h-[calc(100vh-7.5rem)] overflow-hidden rounded-2xl border border-slate-200/80 bg-white/50 shadow-sm">
      <WorkSidebar
        nav={nav}
        onNav={(n) => {
          setNav(n);
          setSelectedId(null);
          if (n.kind !== 'dashboard') setBoardView('table');
        }}
        departments={departments}
        projects={projects}
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        counts={counts}
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
          {nav.kind !== 'dashboard' && (
            <div className="flex rounded-lg bg-slate-100 p-0.5">
              <button
                type="button"
                onClick={() => setBoardView('table')}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium',
                  boardView === 'table' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500',
                )}
              >
                <List className="h-4 w-4" />
                <span className="hidden sm:inline">{t3('Board', 'Tablero', 'Quadro')}</span>
              </button>
              <button
                type="button"
                onClick={() => setBoardView('kanban')}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium',
                  boardView === 'kanban' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500',
                )}
              >
                <LayoutGrid className="h-4 w-4" />
                <span className="hidden sm:inline">Kanban</span>
              </button>
              <button
                type="button"
                onClick={() => setBoardView('gantt')}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium',
                  boardView === 'gantt' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500',
                )}
              >
                <CalendarRange className="h-4 w-4" />
                <span className="hidden sm:inline">{t3('Timeline', 'Cronograma', 'Gantt')}</span>
              </button>
            </div>
          )}
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
                  onNav={setNav}
                  t={t3}
                />
              )
            ) : boardView === 'gantt' ? (
              <WorkGantt
                tasks={scopedTasks}
                deps={deps}
                onSelect={setSelectedId}
                t={t3}
              />
            ) : (
              <TasksBoard
                variant="hub"
                embedded
                forcedView={boardView}
                hideViewToggle
                hideScopeFilters
                initialProjectId={scopeProps?.projectId || ''}
                initialDepartmentId={scopeProps?.departmentId || ''}
                initialTaskScope={scopeProps?.taskScope || ''}
                onTasksChanged={() => fetchAllTasks({ silent: true })}
                externalSelectedId={selectedId}
                onExternalSelect={setSelectedId}
              />
            )}
          </div>

          {selectedId && nav.kind === 'dashboard' && (
            <WorkTaskPanel
              taskId={selectedId}
              users={users}
              groups={groups}
              activeCompanyId={activeCompanyId}
              onClose={() => setSelectedId(null)}
              onChanged={() => fetchAllTasks({ silent: true })}
              t={t3}
            />
          )}
          {selectedId && boardView === 'gantt' && nav.kind !== 'dashboard' && (
            <WorkTaskPanel
              taskId={selectedId}
              users={users}
              groups={groups}
              activeCompanyId={activeCompanyId}
              onClose={() => setSelectedId(null)}
              onChanged={() => fetchAllTasks({ silent: true })}
              t={t3}
            />
          )}
        </div>
      </div>
    </div>
  );
}
