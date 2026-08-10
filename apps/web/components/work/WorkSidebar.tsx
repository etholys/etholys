'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import {
  Building2,
  CalendarRange,
  FolderKanban,
  LayoutDashboard,
  ListTodo,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';

export type WorkNav =
  | { kind: 'dashboard' }
  | { kind: 'all' }
  | { kind: 'company' }
  | { kind: 'department'; id: string; name: string }
  | { kind: 'project'; id: string; name: string };

type Dept = { id: string; name: string };
type Proj = { id: string; name: string; _count?: { tasks?: number } };

export function WorkSidebar({
  nav,
  onNav,
  departments,
  projects,
  collapsed,
  onToggle,
  counts,
  t,
}: {
  nav: WorkNav;
  onNav: (n: WorkNav) => void;
  departments: Dept[];
  projects: Proj[];
  collapsed: boolean;
  onToggle: () => void;
  counts: { open: number; overdue: number; mine: number };
  t: (en: string, es: string, pt: string) => string;
}) {
  const item = (
    active: boolean,
    onClick: () => void,
    icon: ReactNode,
    label: string,
    badge?: number,
  ) => (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition',
        active ? 'bg-cyan-50 font-semibold text-cyan-900' : 'text-slate-600 hover:bg-slate-100',
        collapsed && 'justify-center px-2',
      )}
      title={label}
    >
      <span className="shrink-0 text-slate-500">{icon}</span>
      {!collapsed && <span className="min-w-0 flex-1 truncate">{label}</span>}
      {!collapsed && badge != null && badge > 0 && (
        <span className="rounded-md bg-slate-200/80 px-1.5 py-0.5 text-[10px] tabular-nums text-slate-600">
          {badge}
        </span>
      )}
    </button>
  );

  return (
    <aside
      className={cn(
        'flex shrink-0 flex-col border-r border-slate-200/80 bg-white/90 transition-all',
        collapsed ? 'w-[52px]' : 'w-[240px]',
      )}
    >
      <div className={cn('flex items-center border-b border-slate-100 px-2 py-2', collapsed ? 'justify-center' : 'justify-between')}>
        {!collapsed && (
          <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            {t('Workspace', 'Espacio', 'Espaço')}
          </p>
        )}
        <button
          type="button"
          onClick={onToggle}
          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Toggle sidebar"
        >
          {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto p-2">
        <div className="space-y-0.5">
          {item(
            nav.kind === 'dashboard',
            () => onNav({ kind: 'dashboard' }),
            <LayoutDashboard className="h-4 w-4" />,
            t('Dashboard', 'Panel', 'Painel'),
          )}
          {item(
            nav.kind === 'all',
            () => onNav({ kind: 'all' }),
            <ListTodo className="h-4 w-4" />,
            t('All tasks', 'Todas las tareas', 'Todas as tarefas'),
            counts.open,
          )}
          {item(
            nav.kind === 'company',
            () => onNav({ kind: 'company' }),
            <Building2 className="h-4 w-4" />,
            t('Company ops', 'Ops empresa', 'Ops empresa'),
          )}
        </div>

        <div>
          {!collapsed && (
            <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              {t('Departments', 'Sectores', 'Setores')}
            </p>
          )}
          <div className="space-y-0.5">
            {departments.length === 0 && !collapsed && (
              <p className="px-2 py-1 text-[11px] text-slate-400">
                {t('No departments yet', 'Sin sectores', 'Sem setores')}
              </p>
            )}
            {departments.map((d) =>
              item(
                nav.kind === 'department' && nav.id === d.id,
                () => onNav({ kind: 'department', id: d.id, name: d.name }),
                <FolderKanban className="h-4 w-4" />,
                d.name,
              ),
            )}
          </div>
        </div>

        <div>
          {!collapsed && (
            <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              {t('Projects', 'Proyectos', 'Projetos')}
            </p>
          )}
          <div className="space-y-0.5">
            {projects.length === 0 && !collapsed && (
              <p className="px-2 py-1 text-[11px] text-slate-400">
                {t('No projects yet', 'Sin proyectos', 'Sem projetos')}
              </p>
            )}
            {projects.slice(0, 40).map((p) =>
              item(
                nav.kind === 'project' && nav.id === p.id,
                () => onNav({ kind: 'project', id: p.id, name: p.name }),
                <CalendarRange className="h-4 w-4" />,
                p.name,
                p._count?.tasks,
              ),
            )}
          </div>
        </div>

        {!collapsed && (counts.overdue > 0 || counts.mine > 0) && (
          <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-2.5 text-[11px] text-slate-600">
            <p>
              <span className="font-semibold text-rose-600">{counts.overdue}</span>{' '}
              {t('overdue', 'atrasadas', 'atrasadas')}
            </p>
            <p className="mt-0.5">
              <span className="font-semibold text-cyan-700">{counts.mine}</span>{' '}
              {t('assigned to me', 'asignadas a mí', 'atribuídas a mim')}
            </p>
          </div>
        )}
      </nav>
    </aside>
  );
}
