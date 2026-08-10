'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  Building2,
  CalendarRange,
  Folder,
  FolderKanban,
  LayoutDashboard,
  ListTodo,
  PanelLeftClose,
  PanelLeft,
  Plus,
  Settings,
  Users,
} from 'lucide-react';

export type WorkNav =
  | { kind: 'dashboard' }
  | { kind: 'all' }
  | { kind: 'company' }
  | { kind: 'department'; id: string; name: string }
  | { kind: 'project'; id: string; name: string }
  | { kind: 'folder'; id: string; name: string };

export type WorkFolderRow = {
  id: string;
  name: string;
  color?: string | null;
  visibility: string;
  ownerId: string;
  _count?: { tasks?: number };
};

type Dept = { id: string; name: string };
type Proj = { id: string; name: string; _count?: { tasks?: number } };

export function WorkSidebar({
  nav,
  onNav,
  departments,
  projects,
  folders,
  currentUserId,
  collapsed,
  onToggle,
  counts,
  onCreateFolder,
  t,
}: {
  nav: WorkNav;
  onNav: (n: WorkNav) => void;
  departments: Dept[];
  projects: Proj[];
  folders: WorkFolderRow[];
  currentUserId?: string | null;
  collapsed: boolean;
  onToggle: () => void;
  counts: { open: number; overdue: number; mine: number };
  onCreateFolder: (input: { name: string; visibility: 'PERSONAL' | 'SHARED' }) => Promise<void>;
  t: (en: string, es: string, pt: string) => string;
}) {
  const [draft, setDraft] = useState('');
  const [visibility, setVisibility] = useState<'PERSONAL' | 'SHARED'>('PERSONAL');
  const [creating, setCreating] = useState(false);

  const mine = folders.filter((f) => f.ownerId === currentUserId && f.visibility === 'PERSONAL');
  const shared = folders.filter((f) => f.visibility === 'SHARED');

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

  const submitFolder = async () => {
    const name = draft.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      await onCreateFolder({ name, visibility });
      setDraft('');
    } finally {
      setCreating(false);
    }
  };

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
          {item(nav.kind === 'dashboard', () => onNav({ kind: 'dashboard' }), <LayoutDashboard className="h-4 w-4" />, t('Dashboard', 'Panel', 'Painel'))}
          {item(nav.kind === 'all', () => onNav({ kind: 'all' }), <ListTodo className="h-4 w-4" />, t('All tasks', 'Todas las tareas', 'Todas as tarefas'), counts.open)}
          {item(nav.kind === 'company', () => onNav({ kind: 'company' }), <Building2 className="h-4 w-4" />, t('Company ops', 'Ops empresa', 'Ops empresa'))}
        </div>

        <div>
          {!collapsed && (
            <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              {t('My folders', 'Mis carpetas', 'As minhas pastas')}
            </p>
          )}
          <div className="space-y-0.5">
            {mine.map((f) =>
              item(
                nav.kind === 'folder' && nav.id === f.id,
                () => onNav({ kind: 'folder', id: f.id, name: f.name }),
                <Folder className="h-4 w-4" />,
                f.name,
                f._count?.tasks,
              ),
            )}
            {!collapsed && mine.length === 0 && (
              <p className="px-2 py-1 text-[11px] text-slate-400">
                {t('Private lists you own', 'Listas privadas tuyas', 'Listas privadas tuas')}
              </p>
            )}
          </div>
        </div>

        <div>
          {!collapsed && (
            <p className="mb-1 flex items-center gap-1 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              <Users className="h-3 w-3" />
              {t('Team folders', 'Carpetas de equipo', 'Pastas de equipa')}
            </p>
          )}
          <div className="space-y-0.5">
            {shared.map((f) =>
              item(
                nav.kind === 'folder' && nav.id === f.id,
                () => onNav({ kind: 'folder', id: f.id, name: f.name }),
                <Folder className="h-4 w-4" />,
                f.name,
                f._count?.tasks,
              ),
            )}
            {!collapsed && shared.length === 0 && (
              <p className="px-2 py-1 text-[11px] text-slate-400">
                {t('Shared with the company', 'Compartidas con la empresa', 'Partilhadas com a empresa')}
              </p>
            )}
          </div>
        </div>

        {!collapsed && (
          <div className="rounded-xl border border-dashed border-slate-200 p-2">
            <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              {t('New folder', 'Nueva carpeta', 'Nova pasta')}
            </p>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), void submitFolder())}
              placeholder={t('Name…', 'Nombre…', 'Nome…')}
              className="mb-1.5 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-cyan-400"
            />
            <div className="mb-1.5 flex gap-1">
              <button
                type="button"
                onClick={() => setVisibility('PERSONAL')}
                className={cn(
                  'flex-1 rounded-md px-1.5 py-1 text-[10px] font-semibold',
                  visibility === 'PERSONAL' ? 'bg-cyan-100 text-cyan-800' : 'bg-slate-100 text-slate-500',
                )}
              >
                {t('Personal', 'Personal', 'Pessoal')}
              </button>
              <button
                type="button"
                onClick={() => setVisibility('SHARED')}
                className={cn(
                  'flex-1 rounded-md px-1.5 py-1 text-[10px] font-semibold',
                  visibility === 'SHARED' ? 'bg-cyan-100 text-cyan-800' : 'bg-slate-100 text-slate-500',
                )}
              >
                {t('Team', 'Equipo', 'Equipa')}
              </button>
            </div>
            <button
              type="button"
              disabled={creating || !draft.trim()}
              onClick={() => void submitFolder()}
              className="inline-flex w-full items-center justify-center gap-1 rounded-lg bg-slate-900 px-2 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-40"
            >
              <Plus className="h-3 w-3" />
              {t('Create', 'Crear', 'Criar')}
            </button>
          </div>
        )}

        <div>
          {!collapsed && (
            <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              {t('Departments', 'Sectores', 'Setores')}
            </p>
          )}
          <div className="space-y-0.5">
            {departments.length === 0 && !collapsed && (
              <div className="px-2 py-1">
                <p className="text-[11px] text-slate-400">
                  {t('Company structure (admin)', 'Estructura (admin)', 'Estrutura (admin)')}
                </p>
                <Link href="/hub/work/settings" className="mt-1 inline-block text-[11px] font-semibold text-cyan-700 hover:underline">
                  {t('Manage in settings', 'Gestionar en ajustes', 'Gerir nas definições')}
                </Link>
              </div>
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
            {projects.slice(0, 30).map((p) =>
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
              <span className="font-semibold text-rose-600">{counts.overdue}</span> {t('overdue', 'atrasadas', 'atrasadas')}
            </p>
            <p className="mt-0.5">
              <span className="font-semibold text-cyan-700">{counts.mine}</span>{' '}
              {t('assigned to me', 'asignadas a mí', 'atribuídas a mim')}
            </p>
          </div>
        )}
      </nav>

      <div className="border-t border-slate-100 p-2">
        <Link
          href="/hub/work/settings"
          className={cn(
            'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-slate-600 transition hover:bg-slate-100',
            collapsed && 'justify-center px-2',
          )}
          title={t('Settings', 'Ajustes', 'Definições')}
        >
          <Settings className="h-4 w-4 shrink-0 text-slate-500" />
          {!collapsed && <span>{t('Settings', 'Ajustes', 'Definições')}</span>}
        </Link>
      </div>
    </aside>
  );
}
