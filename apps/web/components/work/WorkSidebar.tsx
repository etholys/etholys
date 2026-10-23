'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { GROUP_COLORS } from './work-ui';
import {
  AlertTriangle,
  Building2,
  CalendarRange,
  ChevronDown,
  Folder,
  FolderKanban,
  LayoutDashboard,
  ListTodo,
  Lock,
  PanelLeftClose,
  PanelLeft,
  Plus,
  Share2,
  UserRound,
  Users,
} from 'lucide-react';

export type WorkNav =
  | { kind: 'dashboard' }
  | { kind: 'all' }
  | { kind: 'mine' }
  | { kind: 'overdue' }
  | { kind: 'unassigned' }
  | { kind: 'week' }
  | { kind: 'company' }
  | { kind: 'department'; id: string; name: string }
  | { kind: 'project'; id: string; name: string }
  | { kind: 'folder'; id: string; name: string }
  | { kind: 'person'; id: string; name: string };

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
  canSeeEverything = false,
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
  counts: { open: number; overdue: number; mine: number; unassigned: number; week: number; sharedOpen?: number };
  onCreateFolder: (input: { name: string; visibility: 'PERSONAL' | 'SHARED'; color?: string }) => Promise<void>;
  onShareFolder?: (folder: { id: string; name: string }) => void;
  /** Company ADMIN only — overview of SHARED team boards */
  canSeeEverything?: boolean;
  t: (en: string, es: string, pt: string) => string;
}) {
  const [composerOpen, setComposerOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [color, setColor] = useState<string>(GROUP_COLORS[0]);
  const [visibility, setVisibility] = useState<'PERSONAL' | 'SHARED'>('PERSONAL');
  const [creating, setCreating] = useState(false);
  const [companyOpen, setCompanyOpen] = useState(true);
  const composerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!composerOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!composerRef.current?.contains(e.target as Node)) setComposerOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [composerOpen]);

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
        active ? 'bg-teal-500/15' : 'hover:bg-[color:var(--sys-nav-hover)]',
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition',
          active ? 'font-semibold text-[color:var(--sys-ink)]' : 'text-[color:var(--sys-nav-idle)]',
          collapsed && 'justify-center px-2',
        )}
        title={label}
      >
        <span className={cn('shrink-0', active ? 'text-teal-300' : 'text-[color:var(--sys-icon,#94a3b8)]')}>{icon}</span>
        {!collapsed && <span className="min-w-0 flex-1 truncate">{label}</span>}
        {!collapsed && badge != null && badge > 0 && (
          <span
            className={cn(
              'rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
              badgeTone === 'danger' ? 'bg-rose-500/20 text-rose-200' : 'bg-white/10 text-[color:var(--sys-muted)]',
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
      await onCreateFolder({ name, visibility, color });
      setDraft('');
      setComposerOpen(false);
      setVisibility('PERSONAL');
    } finally {
      setCreating(false);
    }
  };

  const openComposer = () => {
    if (collapsed) onToggle();
    setComposerOpen(true);
  };

  const folderRow = (f: WorkFolderRow) => {
    const isOwner = f.ownerId === currentUserId;
    const memberCount = f.members?.length ?? f._count?.members ?? 0;
    const shared = f.visibility === 'SHARED' || memberCount > 0;
    const shareBtn =
      isOwner && onShareFolder ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onShareFolder({ id: f.id, name: f.name });
          }}
          className="mr-1 rounded-md p-1 text-[color:var(--sys-faint)] opacity-0 transition hover:bg-teal-500/15 hover:text-teal-300 group-hover:opacity-100"
          title={t('Share', 'Compartir', 'Partilhar')}
        >
          <Share2 className="h-3.5 w-3.5" />
        </button>
      ) : null;
    const icon = (
      <span className="relative inline-flex">
        <Folder className="h-4 w-4" style={{ color: f.color || '#0d9488' }} />
        {shared ? (
          <Users className="absolute -bottom-1 -right-1.5 h-2.5 w-2.5 rounded-full bg-white text-slate-500" />
        ) : (
          <Lock className="absolute -bottom-1 -right-1.5 h-2.5 w-2.5 rounded-full bg-white text-slate-400" />
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
        'flex shrink-0 flex-col border-r border-[color:var(--sys-line)] bg-[color:var(--sys-aside-bg)] transition-all',
        collapsed ? 'w-[52px]' : 'w-[232px]',
      )}
    >
      <div className={cn('flex items-center px-2 py-2', collapsed ? 'justify-center' : 'justify-end')}>
        <button
          type="button"
          onClick={onToggle}
          className="rounded-md p-1.5 text-[color:var(--sys-faint)] hover:bg-[color:var(--sys-nav-hover)] hover:text-[color:var(--sys-ink)]"
          aria-label="Toggle sidebar"
        >
          {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-2 pb-3">
        <div className="space-y-0.5">
          {!collapsed && (
            <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--sys-faint)]">
              {t('Me', 'Yo', 'Eu')}
            </p>
          )}
          {item(nav.kind === 'mine', () => onNav({ kind: 'mine' }), <UserRound className="h-4 w-4" />, t('My work', 'Mi trabajo', 'O meu trabalho'), counts.mine)}
          {item(
            nav.kind === 'overdue',
            () => onNav({ kind: 'overdue' }),
            <AlertTriangle className="h-4 w-4" />,
            t('Overdue', 'Atrasadas', 'Atrasadas'),
            counts.overdue,
            undefined,
            'danger',
          )}
          {folders.filter((f) => f.visibility !== 'SHARED' && (f.members?.length ?? f._count?.members ?? 0) === 0).map((f) => folderRow(f))}
        </div>

        <div className="space-y-0.5">
          {!collapsed && (
            <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--sys-faint)]">
              {t('Overview', 'Visión', 'Visão')}
            </p>
          )}
          {item(nav.kind === 'dashboard', () => onNav({ kind: 'dashboard' }), <LayoutDashboard className="h-4 w-4" />, t('Home', 'Inicio', 'Início'))}
          {canSeeEverything &&
            item(
              nav.kind === 'all',
              () => onNav({ kind: 'all' }),
              <ListTodo className="h-4 w-4" />,
              t('Company work', 'Trabajo de la empresa', 'Trabalho da empresa'),
              counts.sharedOpen ?? 0,
            )}
        </div>

        <div>
          <div className={cn('mb-1 flex items-center', collapsed ? 'justify-center' : 'justify-between px-2')}>
            {!collapsed && (
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--sys-faint)]">
                {t('Team boards', 'Tableros de equipo', 'Quadros da equipa')}
              </p>
            )}
            <div className="relative" ref={composerRef}>
              <button
                type="button"
                onClick={() => (composerOpen ? setComposerOpen(false) : openComposer())}
                className="rounded-md p-1 text-[color:var(--sys-faint)] hover:bg-teal-500/15 hover:text-teal-200"
                title={t('New board', 'Nuevo tablero', 'Novo quadro')}
                aria-label={t('New board', 'Nuevo tablero', 'Novo quadro')}
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
              {composerOpen && !collapsed && (
                <div className="absolute right-0 top-8 z-40 w-56 rounded-xl border border-[color:var(--sys-line)] bg-[color:var(--sys-panel)] p-3 shadow-lg">
                  <p className="mb-2 text-xs font-semibold text-[color:var(--sys-ink)]">
                    {t('New board', 'Nuevo tablero', 'Novo quadro')}
                  </p>
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void submitFolder();
                      }
                      if (e.key === 'Escape') setComposerOpen(false);
                    }}
                    placeholder={t('Name', 'Nombre', 'Nome')}
                    className="mb-2 w-full rounded-lg border border-[color:var(--sys-line)] bg-[color:var(--sys-panel-soft)] px-2.5 py-1.5 text-sm text-[color:var(--sys-ink)] outline-none focus:border-teal-500"
                  />
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {GROUP_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(c)}
                        className={cn(
                          'h-5 w-5 rounded-full ring-offset-2',
                          color === c ? 'ring-2 ring-slate-800' : 'ring-0',
                        )}
                        style={{ backgroundColor: c }}
                        aria-label={c}
                      />
                    ))}
                  </div>
                  <div className="mb-2 grid grid-cols-2 gap-1">
                    <button
                      type="button"
                      onClick={() => setVisibility('PERSONAL')}
                      className={cn(
                        'rounded-md px-2 py-1 text-[11px] font-semibold',
                        visibility === 'PERSONAL' ? 'bg-teal-600 text-white' : 'bg-white/10 text-[color:var(--sys-muted)]',
                      )}
                    >
                      {t('Only me', 'Solo yo', 'Só eu')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setVisibility('SHARED')}
                      className={cn(
                        'rounded-md px-2 py-1 text-[11px] font-semibold',
                        visibility === 'SHARED' ? 'bg-teal-600 text-white' : 'bg-white/10 text-[color:var(--sys-muted)]',
                      )}
                    >
                      {t('Share', 'Compartir', 'Partilhar')}
                    </button>
                  </div>
                  <button
                    type="button"
                    disabled={creating || !draft.trim()}
                    onClick={() => void submitFolder()}
                    className="w-full rounded-lg bg-teal-700 px-2 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-40"
                  >
                    {t('Create', 'Crear', 'Criar')}
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="space-y-0.5">
            {folders
              .filter((f) => f.visibility === 'SHARED' || (f.members?.length ?? f._count?.members ?? 0) > 0)
              .map((f) => folderRow(f))}
          </div>
        </div>

        <div>
          {!collapsed ? (
            <button
              type="button"
              onClick={() => setCompanyOpen((v) => !v)}
              className="mb-1 flex w-full items-center justify-between px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--sys-faint)] hover:text-[color:var(--sys-ink)]"
            >
              {t('Team', 'Equipo', 'Equipa')}
              <ChevronDown className={cn('h-3 w-3 transition', companyOpen && 'rotate-180')} />
            </button>
          ) : null}
          {(collapsed || companyOpen) && (
            <div className="space-y-0.5">
              {item(
                nav.kind === 'company',
                () => onNav({ kind: 'company' }),
                <Building2 className="h-4 w-4" />,
                t('Operations', 'Operaciones', 'Operações'),
              )}
              {item(
                nav.kind === 'unassigned',
                () => onNav({ kind: 'unassigned' }),
                <UserRound className="h-4 w-4" />,
                t('Unassigned', 'Sin asignar', 'Sem responsável'),
                counts.unassigned,
              )}
              {item(
                nav.kind === 'week',
                () => onNav({ kind: 'week' }),
                <CalendarRange className="h-4 w-4" />,
                t('This week', 'Esta semana', 'Esta semana'),
                counts.week,
              )}
              {departments.map((d) =>
                item(
                  nav.kind === 'department' && nav.id === d.id,
                  () => onNav({ kind: 'department', id: d.id, name: d.name }),
                  <FolderKanban className="h-4 w-4" />,
                  d.name,
                ),
              )}
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
          )}
        </div>
      </nav>

    </aside>
  );
}
