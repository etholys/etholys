'use client';

import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  Building2,
  CalendarRange,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderKanban,
  FolderPlus,
  LayoutDashboard,
  LayoutGrid,
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
  kind?: string | null;
  parentId?: string | null;
  order?: number | null;
  members?: { userId: string }[];
  _count?: { tasks?: number; members?: number };
};

export const WORK_FOLDER_DND_MIME = 'application/x-etholys-work-folder';

export type WorkFolderDragPayload = {
  id: string;
  kind: 'FOLDER' | 'BOARD';
};

function parseWorkFolderDrag(raw: string): WorkFolderDragPayload | null {
  try {
    const o = JSON.parse(raw) as WorkFolderDragPayload;
    if (!o?.id) return null;
    return { id: String(o.id), kind: o.kind === 'FOLDER' ? 'FOLDER' : 'BOARD' };
  } catch {
    return null;
  }
}

export function readWorkFolderDrag(dt: DataTransfer): WorkFolderDragPayload | null {
  const raw = dt.getData(WORK_FOLDER_DND_MIME);
  return raw ? parseWorkFolderDrag(raw) : null;
}

export type WorkCreateFolderInput = {
  name: string;
  visibility: 'PERSONAL' | 'SHARED';
  color?: string;
  kind?: 'FOLDER' | 'BOARD';
  parentId?: string | null;
};

type Dept = { id: string; name: string };
type Proj = { id: string; name: string; _count?: { tasks?: number } };

type TreeNode = WorkFolderRow & { children: TreeNode[] };

type ComposerTarget =
  | { mode: 'folder'; parentId: string | null }
  | { mode: 'board'; parentId: string | null; visibility: 'PERSONAL' | 'SHARED' };

function isBoard(row: WorkFolderRow) {
  return row.kind !== 'FOLDER';
}

function isSharedBoard(f: WorkFolderRow) {
  return f.visibility === 'SHARED' || (f.members?.length ?? f._count?.members ?? 0) > 0;
}

function buildTree(folders: WorkFolderRow[]): TreeNode[] {
  const byId = new Map<string, TreeNode>();
  for (const f of folders) {
    byId.set(f.id, { ...f, children: [] });
  }
  const roots: TreeNode[] = [];
  for (const node of byId.values()) {
    const pid = node.parentId || null;
    if (pid && byId.has(pid)) {
      byId.get(pid)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      const ak = a.kind === 'FOLDER' ? 0 : 1;
      const bk = b.kind === 'FOLDER' ? 0 : 1;
      if (ak !== bk) return ak - bk;
      const ao = a.order ?? 0;
      const bo = b.order ?? 0;
      if (ao !== bo) return ao - bo;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
    for (const n of nodes) sortNodes(n.children);
  };
  sortNodes(roots);
  return roots;
}

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
  onMoveFolder,
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
  onCreateFolder: (input: WorkCreateFolderInput) => Promise<void>;
  onShareFolder?: (folder: { id: string; name: string }) => void;
  /** Persist parent change (and optional order). Owners only in UI. */
  onMoveFolder?: (id: string, parentId: string | null, order?: number) => Promise<void>;
  t: (en: string, es: string, pt: string) => string;
}) {
  const [composer, setComposer] = useState<ComposerTarget | null>(null);
  const [draft, setDraft] = useState('');
  const [color, setColor] = useState<string>(GROUP_COLORS[0]);
  const [creating, setCreating] = useState(false);
  const [orgOpen, setOrgOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null | 'root'>(null);
  const [moving, setMoving] = useState(false);
  const composerRef = useRef<HTMLDivElement>(null);
  const dragPayloadRef = useRef<WorkFolderDragPayload | null>(null);

  const tree = useMemo(() => buildTree(folders), [folders]);

  useEffect(() => {
    // Auto-expand ancestors of the active board/folder.
    if (nav.kind !== 'folder') return;
    const path: string[] = [];
    let cur: WorkFolderRow | undefined = folders.find((f) => f.id === nav.id);
    while (cur?.parentId) {
      path.push(cur.parentId);
      cur = folders.find((f) => f.id === cur!.parentId);
    }
    if (!path.length) return;
    setExpanded((prev) => {
      const next = { ...prev };
      for (const id of path) next[id] = true;
      return next;
    });
  }, [nav, folders]);

  useEffect(() => {
    if (!composer) return;
    const onDoc = (e: MouseEvent) => {
      if (!composerRef.current?.contains(e.target as Node)) setComposer(null);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [composer]);

  const go = (n: WorkNav) => {
    onNav(n);
    onMobileClose?.();
  };

  const byId = useMemo(() => {
    const m = new Map<string, WorkFolderRow>();
    for (const f of folders) m.set(f.id, f);
    return m;
  }, [folders]);

  const isDescendantOf = (ancestorId: string, nodeId: string) => {
    let cur = byId.get(nodeId);
    while (cur?.parentId) {
      if (cur.parentId === ancestorId) return true;
      cur = byId.get(cur.parentId);
    }
    return false;
  };

  const canDropOnFolder = (drag: WorkFolderDragPayload, targetFolderId: string) => {
    if (drag.id === targetFolderId) return false;
    if (isDescendantOf(drag.id, targetFolderId)) return false;
    const target = byId.get(targetFolderId);
    if (!target || isBoard(target)) return false;
    return true;
  };

  const finishDrop = async (parentId: string | null, order?: number) => {
    const payload = dragPayloadRef.current;
    setDropTarget(null);
    setDragId(null);
    dragPayloadRef.current = null;
    if (!payload || !onMoveFolder || moving) return;
    const current = byId.get(payload.id);
    if (!current) return;
    const nextParent = parentId;
    if ((current.parentId || null) === nextParent && order === undefined) return;
    if (nextParent) {
      if (!canDropOnFolder(payload, nextParent)) return;
    }
    setMoving(true);
    try {
      await onMoveFolder(payload.id, nextParent, order);
      if (nextParent) {
        setExpanded((prev) => ({ ...prev, [nextParent]: true }));
      }
    } finally {
      setMoving(false);
    }
  };

  const startDrag = (e: DragEvent, node: WorkFolderRow) => {
    if (!onMoveFolder || node.ownerId !== currentUserId || collapsed) {
      e.preventDefault();
      return;
    }
    const payload: WorkFolderDragPayload = {
      id: node.id,
      kind: isBoard(node) ? 'BOARD' : 'FOLDER',
    };
    dragPayloadRef.current = payload;
    setDragId(node.id);
    e.dataTransfer.setData(WORK_FOLDER_DND_MIME, JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'move';
  };

  const endDrag = () => {
    setDragId(null);
    setDropTarget(null);
    dragPayloadRef.current = null;
  };

  const item = (
    active: boolean,
    onClick: () => void,
    icon: ReactNode,
    label: string,
    badge?: number,
    trailing?: ReactNode,
    badgeTone?: 'default' | 'danger',
    indentPx?: number,
  ) => (
    <div
      className={cn(
        'group flex w-full items-center gap-0.5 rounded-lg transition',
        active ? 'bg-teal-500/15' : 'hover:bg-[color:var(--sys-nav-hover)]',
      )}
      style={indentPx ? { paddingLeft: indentPx } : undefined}
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

  const submitComposer = async () => {
    const name = draft.trim();
    if (!name || creating || !composer) return;
    setCreating(true);
    try {
      if (composer.mode === 'folder') {
        await onCreateFolder({
          name,
          visibility: 'PERSONAL',
          color,
          kind: 'FOLDER',
          parentId: composer.parentId,
        });
      } else {
        await onCreateFolder({
          name,
          visibility: composer.visibility,
          color,
          kind: 'BOARD',
          parentId: composer.parentId,
        });
      }
      setDraft('');
      setComposer(null);
      if (composer.parentId) {
        setExpanded((prev) => ({ ...prev, [composer.parentId!]: true }));
      }
    } finally {
      setCreating(false);
    }
  };

  const openComposer = (target: ComposerTarget) => {
    if (collapsed) onToggle();
    setComposer(target);
    setDraft('');
  };

  const composerPopover = (match: ComposerTarget) => {
    if (!composer) return null;
    const same =
      composer.mode === match.mode &&
      composer.parentId === match.parentId &&
      (composer.mode === 'folder' ||
        match.mode === 'folder' ||
        (composer.mode === 'board' && match.mode === 'board' && composer.visibility === match.visibility));
    if (!same || collapsed) return null;
    const title =
      composer.mode === 'folder'
        ? t('New folder', 'Nueva carpeta', 'Nova pasta')
        : composer.visibility === 'SHARED'
          ? t('New shared board', 'Nuevo tablero compartido', 'Novo quadro partilhado')
          : t('New private board', 'Nuevo tablero solo mío', 'Novo quadro só meu');
    return (
      <div
        ref={composerRef}
        className="absolute right-0 top-8 z-40 w-56 rounded-xl border border-[color:var(--sys-line)] bg-[color:var(--sys-panel)] p-3 shadow-lg"
      >
        <p className="mb-2 text-xs font-semibold text-[color:var(--sys-ink)]">{title}</p>
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void submitComposer();
            }
            if (e.key === 'Escape') setComposer(null);
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
              className={cn('h-5 w-5 rounded-full ring-offset-2', color === c ? 'ring-2 ring-slate-800' : 'ring-0')}
              style={{ backgroundColor: c }}
              aria-label={c}
            />
          ))}
        </div>
        {composer.mode === 'board' && (
          <p className="mb-2 text-[10px] leading-snug text-[color:var(--sys-faint)]">
            {composer.visibility === 'SHARED'
              ? t(
                  'You can invite people after creating it',
                  'Podrás invitar personas después de crearlo',
                  'Podes convidar pessoas depois de o criares',
                )
              : t('Only you can see it', 'Solo tú lo ves', 'Só tu o vês')}
          </p>
        )}
        {composer.mode === 'folder' && (
          <p className="mb-2 text-[10px] leading-snug text-[color:var(--sys-faint)]">
            {t(
              'Folders organize boards — tasks live on boards',
              'Las carpetas organizan tableros — las tareas viven en tableros',
              'As pastas organizam tableros — as tarefas ficam nos tableros',
            )}
          </p>
        )}
        <button
          type="button"
          disabled={creating || !draft.trim()}
          onClick={() => void submitComposer()}
          className="w-full rounded-lg bg-teal-700 px-2 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-40"
        >
          {t('Create', 'Crear', 'Criar')}
        </button>
      </div>
    );
  };

  const renderNode = (node: TreeNode, depth: number): ReactNode => {
    const folder = !isBoard(node);
    const shared = isSharedBoard(node);
    const isOwner = node.ownerId === currentUserId;
    const canDrag = Boolean(onMoveFolder && isOwner && !collapsed);
    const open = expanded[node.id] ?? depth < 1;
    const indent = collapsed ? 0 : Math.min(depth, 6) * 12;
    const isDropHighlight = dropTarget === node.id;
    const isDragging = dragId === node.id;

    if (folder) {
      const chevron = (
        <button
          type="button"
          className="mr-0.5 rounded p-0.5 text-[color:var(--sys-faint)] hover:bg-teal-500/10 hover:text-teal-200"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((prev) => ({ ...prev, [node.id]: !open }));
          }}
          aria-label={open ? t('Collapse', 'Contraer', 'Contrair') : t('Expand', 'Expandir', 'Expandir')}
        >
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
      );
      const addBtns = !collapsed ? (
        <div className="relative mr-0.5 flex items-center opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openComposer({ mode: 'folder', parentId: node.id });
            }}
            className="rounded-md p-1 text-[color:var(--sys-faint)] hover:bg-teal-500/15 hover:text-teal-200"
            title={t('New subfolder', 'Nueva subcarpeta', 'Nova subpasta')}
          >
            <FolderPlus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openComposer({ mode: 'board', parentId: node.id, visibility: 'PERSONAL' });
            }}
            className="rounded-md p-1 text-[color:var(--sys-faint)] hover:bg-teal-500/15 hover:text-teal-200"
            title={t('New board here', 'Nuevo tablero aquí', 'Novo quadro aqui')}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          {composer?.mode === 'folder' && composer.parentId === node.id
            ? composerPopover({ mode: 'folder', parentId: node.id })
            : null}
          {composer?.mode === 'board' && composer.parentId === node.id
            ? composerPopover({ mode: 'board', parentId: node.id, visibility: 'PERSONAL' })
            : null}
        </div>
      ) : null;

      return (
        <div key={node.id}>
          <div
            draggable={canDrag}
            onDragStart={(e) => startDrag(e, node)}
            onDragEnd={endDrag}
            onDragOver={(e) => {
              if (!dragId || dragId === node.id) return;
              const payload = dragPayloadRef.current;
              if (!payload || !canDropOnFolder(payload, node.id)) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              if (dropTarget !== node.id) setDropTarget(node.id);
            }}
            onDragLeave={() => {
              if (dropTarget === node.id) setDropTarget(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void finishDrop(node.id);
            }}
            className={cn(
              'group flex w-full items-center gap-0.5 rounded-lg transition',
              isDragging && 'opacity-40',
              isDropHighlight
                ? 'bg-teal-500/25 ring-1 ring-teal-400/60'
                : nav.kind === 'folder' && nav.id === node.id
                  ? 'bg-teal-500/15'
                  : 'hover:bg-[color:var(--sys-nav-hover)]',
              canDrag && 'cursor-grab active:cursor-grabbing',
            )}
            style={{ paddingLeft: indent }}
            title={
              canDrag
                ? t('Drag to nest or reorder', 'Arrastra para anidar o reordenar', 'Arrasta para aninhar ou reordenar')
                : undefined
            }
          >
            {!collapsed && chevron}
            <button
              type="button"
              onClick={() => {
                setExpanded((prev) => ({ ...prev, [node.id]: !open }));
                go({ kind: 'folder', id: node.id, name: node.name });
              }}
              className={cn(
                'flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px]',
                nav.kind === 'folder' && nav.id === node.id
                  ? 'font-semibold text-[color:var(--sys-ink)]'
                  : 'text-[color:var(--sys-nav-idle)]',
              )}
              title={node.name}
            >
              <Folder className="h-4 w-4 shrink-0" style={{ color: node.color || '#64748b' }} />
              {!collapsed && <span className="min-w-0 flex-1 truncate">{node.name}</span>}
            </button>
            {addBtns}
          </div>
          {open && !collapsed && node.children.map((c) => renderNode(c, depth + 1))}
        </div>
      );
    }

    const shareBtn =
      isOwner && onShareFolder ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onShareFolder({ id: node.id, name: node.name });
          }}
          className={cn(
            'mr-1 rounded-md p-1 transition hover:bg-teal-500/15 hover:text-teal-300',
            shared || (nav.kind === 'folder' && nav.id === node.id)
              ? 'text-teal-400/90'
              : 'text-[color:var(--sys-faint)]',
          )}
          title={
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
        <LayoutGrid className="h-4 w-4" style={{ color: node.color || '#0d9488' }} />
        {shared ? (
          <Users className="absolute -bottom-1 -right-1.5 h-2.5 w-2.5 rounded-full bg-white text-slate-500" />
        ) : (
          <Lock className="absolute -bottom-1 -right-1.5 h-2.5 w-2.5 rounded-full bg-white text-slate-400" />
        )}
      </span>
    );

    // Dropping onto a board moves the dragged item to the board's parent (sibling).
    return (
      <div
        key={node.id}
        draggable={canDrag}
        onDragStart={(e) => startDrag(e, node)}
        onDragEnd={endDrag}
        onDragOver={(e) => {
          if (!dragId || dragId === node.id) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          if (dropTarget !== node.id) setDropTarget(node.id);
        }}
        onDragLeave={() => {
          if (dropTarget === node.id) setDropTarget(null);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const siblingOrder = (node.order ?? 0) + 1;
          void finishDrop(node.parentId || null, siblingOrder);
        }}
        className={cn(
          isDragging && 'opacity-40',
          isDropHighlight && 'rounded-lg bg-teal-500/20 ring-1 ring-teal-400/50',
          canDrag && 'cursor-grab active:cursor-grabbing',
        )}
        title={
          canDrag
            ? t('Drag board into a folder', 'Arrastra el tablero a una carpeta', 'Arrasta o tablero para uma pasta')
            : undefined
        }
      >
        {item(
          nav.kind === 'folder' && nav.id === node.id,
          () => go({ kind: 'folder', id: node.id, name: node.name }),
          icon,
          node.name,
          node._count?.tasks,
          shareBtn,
          undefined,
          indent,
        )}
      </div>
    );
  };

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
          {/* Personal utility views — not boards */}
          <div className="space-y-0.5 pt-2">
            {!collapsed && (
              <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--sys-faint)]">
                {t('Work', 'Trabajo', 'Trabalho')}
              </p>
            )}
            {item(
              nav.kind === 'dashboard',
              () => go({ kind: 'dashboard' }),
              <LayoutDashboard className="h-4 w-4" />,
              t('Home', 'Inicio', 'Início'),
            )}
            {item(
              nav.kind === 'mine',
              () => go({ kind: 'mine' }),
              <UserRound className="h-4 w-4" />,
              t('My tasks', 'Mis tareas', 'As minhas tarefas'),
              counts.mine,
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
            {item(
              nav.kind === 'archive',
              () => go({ kind: 'archive' }),
              <Archive className="h-4 w-4" />,
              t('Archive', 'Archivo', 'Arquivo'),
              counts.archived,
            )}
          </div>

          {/* Folder tree + boards */}
          <div>
            <div className={cn('mb-1 flex items-center', collapsed ? 'justify-center' : 'justify-between px-2')}>
              {!collapsed && (
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--sys-faint)]">
                  {t('Boards', 'Tableros', 'Tableros')}
                </p>
              )}
              {!collapsed && (
                <div className="relative flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() =>
                      composer?.mode === 'folder' && !composer.parentId
                        ? setComposer(null)
                        : openComposer({ mode: 'folder', parentId: null })
                    }
                    className="rounded-md p-1 text-[color:var(--sys-faint)] hover:bg-teal-500/15 hover:text-teal-200"
                    title={t('New folder', 'Nueva carpeta', 'Nova pasta')}
                  >
                    <FolderPlus className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      composer?.mode === 'board' && !composer.parentId
                        ? setComposer(null)
                        : openComposer({ mode: 'board', parentId: null, visibility: 'PERSONAL' })
                    }
                    className="rounded-md p-1 text-[color:var(--sys-faint)] hover:bg-teal-500/15 hover:text-teal-200"
                    title={t('New board', 'Nuevo tablero', 'Novo quadro')}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                  {composer?.mode === 'folder' && composer.parentId === null
                    ? composerPopover({ mode: 'folder', parentId: null })
                    : null}
                  {composer?.mode === 'board' && composer.parentId === null
                    ? composerPopover({
                        mode: 'board',
                        parentId: null,
                        visibility: composer.visibility,
                      })
                    : null}
                </div>
              )}
            </div>
            {!collapsed && (
              <div className="mb-1.5 flex gap-1 px-2">
                <button
                  type="button"
                  onClick={() => openComposer({ mode: 'board', parentId: null, visibility: 'PERSONAL' })}
                  className="rounded-md px-1.5 py-0.5 text-[10px] text-[color:var(--sys-faint)] hover:bg-teal-500/10 hover:text-teal-200"
                >
                  {t('+ Private', '+ Solo yo', '+ Só eu')}
                </button>
                <button
                  type="button"
                  onClick={() => openComposer({ mode: 'board', parentId: null, visibility: 'SHARED' })}
                  className="rounded-md px-1.5 py-0.5 text-[10px] text-[color:var(--sys-faint)] hover:bg-teal-500/10 hover:text-teal-200"
                >
                  {t('+ Shared', '+ Compartido', '+ Partilhado')}
                </button>
              </div>
            )}
            <div className="space-y-0.5">
              {item(
                nav.kind === 'all',
                () => go({ kind: 'all' }),
                <Users className="h-4 w-4" />,
                t('All shared', 'Todo lo compartido', 'Tudo partilhado'),
                counts.sharedOpen ?? 0,
              )}
              {dragId && !collapsed && onMoveFolder ? (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    if (dropTarget !== 'root') setDropTarget('root');
                  }}
                  onDragLeave={() => {
                    if (dropTarget === 'root') setDropTarget(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    void finishDrop(null);
                  }}
                  className={cn(
                    'mx-1 mb-0.5 rounded-lg border border-dashed px-2.5 py-1.5 text-[11px] transition',
                    dropTarget === 'root'
                      ? 'border-teal-400 bg-teal-500/15 text-teal-200'
                      : 'border-[color:var(--sys-line)] text-[color:var(--sys-faint)]',
                  )}
                >
                  {t('Drop at root', 'Soltar en la raíz', 'Largar na raiz')}
                </div>
              ) : null}
              {tree.map((n) => renderNode(n, 0))}
            </div>
            {!collapsed && tree.length === 0 && (
              <p className="px-2.5 py-1 text-[11px] leading-snug text-[color:var(--sys-faint)]">
                {t(
                  'Create folders and boards. Boards are personal or shared.',
                  'Crea carpetas y tableros. Los tableros son personales o compartidos.',
                  'Cria pastas e tableros. Os tableros são pessoais ou partilhados.',
                )}
              </p>
            )}
          </div>

          {/* Org / SIEP filters — not boards */}
          <div>
            {!collapsed ? (
              <button
                type="button"
                onClick={() => setOrgOpen((v) => !v)}
                className="mb-1 flex w-full items-center justify-between px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--sys-faint)] hover:text-[color:var(--sys-ink)]"
              >
                <span>{t('Org filters', 'Filtros org.', 'Filtros org.')}</span>
                <ChevronDown className={cn('h-3 w-3 transition', orgOpen && 'rotate-180')} />
              </button>
            ) : null}
            {(collapsed || orgOpen) && (
              <div className="space-y-0.5">
                {!collapsed && (
                  <p className="px-2.5 pb-1 text-[10px] leading-snug text-[color:var(--sys-faint)]">
                    {t(
                      'Not boards — company, sectors and SIEP projects',
                      'No son tableros — empresa, sectores y proyectos SIEP',
                      'Não são tableros — empresa, setores e projetos SIEP',
                    )}
                  </p>
                )}
                {item(
                  nav.kind === 'company',
                  () => go({ kind: 'company' }),
                  <Building2 className="h-4 w-4" />,
                  t('Operations', 'Operaciones', 'Operações'),
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
      <button type="button" onClick={onOpen} className="rounded-lg p-1.5 text-[color:var(--sys-ink)]" aria-label="Menu">
        <Menu className="h-5 w-5" />
      </button>
      <span className={sysTheme.brand}>{title}</span>
    </div>
  );
}
