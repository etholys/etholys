'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
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
  Share2,
  UserRound,
  Users,
} from 'lucide-react';

export type WorkNav =
  | { kind: 'dashboard' }
  | { kind: 'all' }
  | { kind: 'mine' }
  | { kind: 'overdue' }
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
  members?: { userId: string }[];
  _count?: { tasks?: number; members?: number };
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
  onShareFolder,
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
  onShareFolder?: (folder: { id: string; name: string }) => void;
  t: (en: string, es: string, pt: string) => string;
}) {
  const [draft, setDraft] = useState('');
  const [visibility, setVisibility] = useState<'PERSONAL' | 'SHARED'>('PERSONAL');
  const [creating, setCreating] = useState(false);

  const personalFolders = folders.filter((f) => f.ownerId === currentUserId && f.visibility === 'PERSONAL');
  const otherFolders = folders.filter((f) => !personalFolders.some((p) => p.id === f.id));

  const item = (
    active: boolean,
    onClick: () => void,
    icon: ReactNode,
    label: string,
    badge?: number,
    trailing?: ReactNode,
    badgeTone?: 'default' | 'danger',
  ) => (
    <div
      className={cn(
        'group flex w-full items-center gap-0.5 rounded-lg transition',
        active ? 'bg-cyan-50 ring-1 ring-cyan-100' : 'hover:bg-slate-100/90',
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition',
          active ? 'font-semibold text-cyan-900' : 'text-slate-600',
          collapsed && 'justify-center px-2',
        )}
        title={label}
      >
        <span className={cn('shrink-0', active ? 'text-cyan-700' : 'text-slate-500')}>{icon}</span>
        {!collapsed && <span className="min-w-0 flex-1 truncate">{label}</span>}
        {!collapsed && badge != null && badge > 0 && (
          <span
            className={cn(
              'rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
              badgeTone === 'danger' ? 'bg-rose-100 text-rose-700' : 'bg-slate-200/80 text-slate-600',
            )}
          >
            {badge}
          </span>
        )}
      </button>
      {!collapsed && trailing}
    </div>
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

  const folderRow = (f: WorkFolderRow) => {
    const isOwner = f.ownerId === currentUserId;
    const memberCount = f.members?.length ?? f._count?.members ?? 0;
    const shareBtn =
      isOwner && onShareFolder ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onShareFolder({ id: f.id, name: f.name });
          }}
          className="mr-1 rounded-md p-1.5 text-slate-400 opacity-0 transition hover:bg-white hover:text-cyan-700 group-hover:opacity-100"
          title={t('Share', 'Compartir', 'Partilhar')}
        >
          <Share2 className="h-3.5 w-3.5" />
        </button>
      ) : memberCount > 0 ? (
        <span className="mr-2 text-[10px] font-medium text-slate-400">{memberCount}</span>
      ) : null;
    const icon = (
      <span className="relative inline-flex">
        <Folder className="h-4 w-4" style={f.color ? { color: f.color } : undefined} />
        {f.visibility === 'PERSONAL' && memberCount === 0 && (
          <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-slate-400" title="Private" />
        )}
      </span>
    );
    return item(
      nav.kind === 'folder' && nav.id === f.id,
      () => onNav({ kind: 'folder', id: f.id, name: f.name }),
      icon,
      f.name,
      f._count?.tasks,
      shareBtn,
    );
  };

  return (
    <aside
      className={cn(
        'flex shrink-0 flex-col border-r border-slate-200/80 bg-gradient-to-b from-white via-white to-slate-50/80 transition-all',
        collapsed ? 'w-[52px]' : 'w-[248px]',
      )}
    >
      <div className={cn('flex items-center border-b border-slate-100 px-2 py-2.5', collapsed ? 'justify-center' : 'justify-between')}>
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
          {item(nav.kind === 'mine', () => onNav({ kind: 'mine' }), <UserRound className="h-4 w-4" />, t('My tasks', 'Mis tareas', 'As minhas'), counts.mine)}
          {item(
            nav.kind === 'overdue',
            () => onNav({ kind: 'overdue' }),
            <AlertTriangle className="h-4 w-4" />,
            t('Overdue', 'Atrasadas', 'Atrasadas'),
            counts.overdue,
            undefined,
            'danger',
          )}
          {item(nav.kind === 'company', () => onNav({ kind: 'company' }), <Building2 className="h-4 w-4" />, t('Company ops', 'Ops empresa', 'Ops empresa'))}
        </div>

        <div>
          {!collapsed && (
            <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              {t('My folders', 'Mis carpetas', 'As minhas pastas')}
            </p>
          )}
          <div className="space-y-0.5">
            {personalFolders.map((f) => folderRow(f))}
            {!collapsed && personalFolders.length === 0 && (
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
              {t('Shared folders', 'Carpetas compartidas', 'Pastas partilhadas')}
            </p>
          )}
          <div className="space-y-0.5">
            {otherFolders.map((f) => folderRow(f))}
            {!collapsed && otherFolders.length === 0 && (
              <p className="px-2 py-1 text-[11px] text-slate-400">
                {t('Invite people — Drive-style', 'Invita personas — estilo Drive', 'Convida pessoas — estilo Drive')}
              </p>
            )}
          </div>
        </div>

        {!collapsed && (
          <div className="rounded-xl border border-dashed border-cyan-200/70 bg-cyan-50/30 p-2">
            <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wide text-cyan-800/70">
              {t('New folder', 'Nueva carpeta', 'Nova pasta')}
            </p>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), void submitFolder())}
              placeholder={t('Name…', 'Nombre…', 'Nome…')}
              className="mb-1.5 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-cyan-400"
            />
            <div className="mb-1.5 flex gap-1">
              <button
                type="button"
                onClick={() => setVisibility('PERSONAL')}
                className={cn(
                  'flex-1 rounded-md px-1.5 py-1 text-[10px] font-semibold',
                  visibility === 'PERSONAL' ? 'bg-cyan-100 text-cyan-800' : 'bg-white text-slate-500',
                )}
              >
                {t('Personal', 'Personal', 'Pessoal')}
              </button>
              <button
                type="button"
                onClick={() => setVisibility('SHARED')}
                className={cn(
                  'flex-1 rounded-md px-1.5 py-1 text-[10px] font-semibold',
                  visibility === 'SHARED' ? 'bg-cyan-100 text-cyan-800' : 'bg-white text-slate-500',
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
