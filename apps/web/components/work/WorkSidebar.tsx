'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  Building2,
  CalendarRange,
  CheckSquare,
  ChevronDown,
  Folder,
  FolderKanban,
  LayoutDashboard,
  ListTodo,
  Lock,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings,
  Share2,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { AppearanceToggle } from '@/components/hub/AppearanceToggle';
import { sysTheme } from '@/lib/system-shell';
import { cn } from '@/lib/utils';
import { GROUP_COLORS } from './work-ui';

export type WorkNav =
  | { kind: 'dashboard' }
  | { kind: 'all' }
  | { kind: 'mine' }
  | { kind: 'archive' }
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
  mobileOpen,
  onMobileClose,
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
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  counts: {
    open: number;
    overdue: number;
    mine: number;
    unassigned: number;
    week: number;
    sharedOpen?: number;
    archived?: number;
  };
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

  const go = (n: WorkNav) => {
    onNav(n);
    onMobileClose?.();
  };

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
          className={cn(
            'mr-1 rounded-md p-1 transition hover:bg-teal-500/15 hover:text-teal-300',
            shared || (nav.kind === 'folder' && nav.id === f.id)
              ? 'text-teal-400/90'
              : 'text-[color:var(--sys-faint)]',
          )}
          title={
            shared
              ? t('Manage access', 'Gestionar acceso', 'Gerir acesso')
              : t('Share', 'Compartir', 'Partilhar')
          }
          aria-label={
            shared
              ? t('Manage access', 'Gestionar acceso', 'Gerir acesso')
              : t('Share', 'Compartir', 'Partilhar')
          }
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
      () => go({ kind: 'folder', id: f.id, name: f.name }),
      icon,
      f.name,
      f._count?.tasks,
      shareBtn,
    );
  };

  const personalFolders = folders.filter(
    (f) => f.visibility !== 'SHARED' && (f.members?.length ?? f._count?.members ?? 0) === 0,
  );
  const sharedFolders = folders.filter(
    (f) => f.visibility === 'SHARED' || (f.members?.length ?? f._count?.members ?? 0) > 0,
  );

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          aria-label={t('Close', 'Cerrar', 'Fechar')}
          onClick={onMobileClose}
        />
      ) : null}

      <aside
        className={cn(
          sysTheme.aside,
          'overflow-hidden',
          collapsed ? 'w-16' : 'w-60',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        <div className={cn('shrink-0 border-b border-[color:var(--sys-line)]', collapsed ? 'p-2' : 'px-3 pb-2 pt-3')}>
          <div className="flex items-center justify-between gap-1">
            <Link href="/hub/work" className="flex min-w-0 items-center gap-2" onClick={onMobileClose}>
              <div className={cn('flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border', sysTheme.icon.teal)}>
                <CheckSquare className="h-4 w-4" strokeWidth={1.75} />
              </div>
              {!collapsed && (
                <div className="min-w-0">
                  <p className={sysTheme.brand}>eTask</p>
                  <p className="truncate text-[11px] text-[color:var(--sys-faint)]">Etholys Task</p>
                </div>
              )}
            </Link>
            <div className="flex flex-shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={onToggle}
                className="hidden items-center justify-center rounded-lg p-1.5 text-[color:var(--sys-faint)] transition hover:bg-[color:var(--sys-nav-hover)] hover:text-[color:var(--sys-ink)] lg:flex"
                title={collapsed ? t('Expand', 'Expandir', 'Expandir') : t('Collapse', 'Minimizar', 'Minimizar')}
              >
                {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={onMobileClose}
                className="rounded-lg p-1.5 text-[color:var(--sys-faint)] hover:text-[color:var(--sys-ink)] lg:hidden"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
          {!collapsed && (
            <Link
              href="/hub"
              className="mt-2 flex items-center gap-1.5 rounded-md px-1 py-1 text-xs text-[color:var(--sys-faint)] transition hover:bg-[color:var(--sys-nav-hover)] hover:text-[color:var(--sys-ink)]"
            >
              <ArrowLeft className="h-3 w-3" />
              {t('Back to Hub', 'Volver al Hub', 'Voltar ao Hub')}
            </Link>
          )}
        </div>

        <nav className={cn('min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain pb-3', collapsed ? 'px-1.5' : 'px-2')}>
          <div className="space-y-0.5 pt-2">
            {!collapsed && (
              <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--sys-faint)]">
                {t('Me', 'Yo', 'Eu')}
              </p>
            )}
            {item(nav.kind === 'mine', () => go({ kind: 'mine' }), <UserRound className="h-4 w-4" />, t('My work', 'Mi trabajo', 'O meu trabalho'), counts.mine)}
            {item(
              nav.kind === 'archive',
              () => go({ kind: 'archive' }),
              <Archive className="h-4 w-4" />,
              t('Archive', 'Archivo', 'Arquivo'),
              counts.archived,
            )}
            {item(
              nav.kind === 'overdue',
              () => go({ kind: 'overdue' }),
              <AlertTriangle className="h-4 w-4" />,
              t('Overdue', 'Atrasadas', 'Atrasadas'),
              counts.overdue,
              undefined,
              'danger',
            )}
            {personalFolders.map((f) => folderRow(f))}
          </div>

          <div className="space-y-0.5">
            {!collapsed && (
              <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--sys-faint)]">
                {t('Overview', 'Visión', 'Visão')}
              </p>
            )}
            {item(nav.kind === 'dashboard', () => go({ kind: 'dashboard' }), <LayoutDashboard className="h-4 w-4" />, t('Home', 'Inicio', 'Início'))}
            {canSeeEverything &&
              item(
                nav.kind === 'all',
                () => go({ kind: 'all' }),
                <ListTodo className="h-4 w-4" />,
                t('All shared boards', 'Todos los tableros', 'Todos os quadros'),
                counts.sharedOpen ?? 0,
              )}
          </div>

          {/* Shared collaborative boards — not the same as company/org filters below */}
          <div>
            <div className={cn('mb-1 flex items-center', collapsed ? 'justify-center' : 'justify-between px-2')}>
              {!collapsed && (
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--sys-faint)]">
                  {t('Boards', 'Tableros', 'Quadros')}
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
            <div className="space-y-0.5">{sharedFolders.map((f) => folderRow(f))}</div>
            {!collapsed && sharedFolders.length === 0 && (
              <p className="px-2.5 py-1 text-[11px] text-[color:var(--sys-faint)]">
                {t('Shared boards with your team', 'Tableros compartidos con el equipo', 'Quadros partilhados com a equipa')}
              </p>
            )}
          </div>

          {/* Org filters / SIEP mirrors — deliberately not “Equipo” to avoid colliding with Boards */}
          <div>
            {!collapsed ? (
              <button
                type="button"
                onClick={() => setCompanyOpen((v) => !v)}
                className="mb-1 flex w-full items-center justify-between px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--sys-faint)] hover:text-[color:var(--sys-ink)]"
              >
                {t('Company', 'Empresa', 'Empresa')}
                <ChevronDown className={cn('h-3 w-3 transition', companyOpen && 'rotate-180')} />
              </button>
            ) : null}
            {(collapsed || companyOpen) && (
              <div className="space-y-0.5">
                {item(
                  nav.kind === 'company',
                  () => go({ kind: 'company' }),
                  <Building2 className="h-4 w-4" />,
                  t('Operations', 'Operaciones', 'Operações'),
                )}
                {item(
                  nav.kind === 'unassigned',
                  () => go({ kind: 'unassigned' }),
                  <UserRound className="h-4 w-4" />,
                  t('Unassigned', 'Sin asignar', 'Sem responsável'),
                  counts.unassigned,
                )}
                {item(
                  nav.kind === 'week',
                  () => go({ kind: 'week' }),
                  <CalendarRange className="h-4 w-4" />,
                  t('This week', 'Esta semana', 'Esta semana'),
                  counts.week,
                )}
                {departments.map((d) =>
                  item(
                    nav.kind === 'department' && nav.id === d.id,
                    () => go({ kind: 'department', id: d.id, name: d.name }),
                    <FolderKanban className="h-4 w-4" />,
                    d.name,
                  ),
                )}
                {projects.slice(0, 30).map((p) =>
                  item(
                    nav.kind === 'project' && nav.id === p.id,
                    () => go({ kind: 'project', id: p.id, name: p.name }),
                    <CalendarRange className="h-4 w-4" />,
                    p.name,
                    p._count?.tasks,
                  ),
                )}
              </div>
            )}
          </div>
        </nav>

        <div className={cn('shrink-0 space-y-1 border-t border-[color:var(--sys-line)]', collapsed ? 'p-1.5' : 'p-2')}>
          <Link
            href="/hub/work/settings"
            className={cn(
              'flex items-center rounded-lg text-[13px] text-[color:var(--sys-nav-idle)] transition hover:bg-[color:var(--sys-nav-hover)] hover:text-[color:var(--sys-ink)]',
              collapsed ? 'justify-center px-2 py-2' : 'gap-2 px-2.5 py-1.5',
            )}
            title={t('Settings', 'Ajustes', 'Definições')}
            onClick={onMobileClose}
          >
            <Settings className="h-4 w-4 shrink-0" />
            {!collapsed && <span>{t('Settings', 'Ajustes', 'Definições')}</span>}
          </Link>
          <AppearanceToggle collapsed={collapsed} />
        </div>
      </aside>
    </>
  );
}

/** Mobile top strip — only when the fixed sidebar is off-canvas. */
export function WorkMobileBar({
  onOpen,
  title = 'eTask',
}: {
  onOpen: () => void;
  title?: string;
}) {
  return (
    <div className="sticky top-0 z-30 flex items-center gap-2 border-b border-[color:var(--sys-line)] bg-[color:var(--sys-aside-bg)]/90 px-3 py-2 backdrop-blur-md lg:hidden">
      <button
        type="button"
        onClick={onOpen}
        className="rounded-lg p-1.5 text-[color:var(--sys-ink)]"
        aria-label="Menu"
      >
        <Menu className="h-5 w-5" />
      </button>
      <span className={sysTheme.brand}>{title}</span>
    </div>
  );
}
