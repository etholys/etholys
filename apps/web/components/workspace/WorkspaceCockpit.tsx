'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  Columns2,
  Compass,
  GraduationCap,
  HandCoins,
  LayoutGrid,
  ListTodo,
  PanelLeftClose,
  PanelLeftOpen,
  PenLine,
  Radar,
  Sprout,
  Sunrise,
  Target,
  Video,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { sysTheme } from '@/lib/system-shell';
import {
  buildWorkspaceRails,
  FOCUS_STORAGE_PREFIX,
  SPLIT_STORAGE_PREFIX,
  type WorkspaceRailDef,
  type WorkspaceRailId,
} from '@/lib/workspace-rails';
import type { WorkspaceSystemKey } from '@/lib/integrated-workspace-shared';
import { WorkspaceStagePanel, type OverviewPayload } from '@/components/workspace/WorkspaceStagePanel';
import { WorkspaceDigest } from '@/components/workspace/WorkspaceDigest';
import { adminHref } from '@/lib/admin-control';

const ICONS: Record<WorkspaceRailId, typeof BarChart3> = {
  ATLAS: BarChart3,
  SIEP: Sprout,
  FUNDHUB: HandCoins,
  NEXUS: LayoutGrid,
  FORGE: GraduationCap,
  PRISM: Target,
  AURORA: Sunrise,
  POLARIS: Compass,
  RADAR: Radar,
  WORK: ListTodo,
  MEET: Video,
  STUDIO: PenLine,
};

type Props = {
  companyId: string;
  overview: OverviewPayload;
  locale: string;
  canManage: boolean;
  saving: string | null;
  notifBusy: string | null;
  advisorBusy: string | null;
  onMarkTaskDone: (id: string) => void;
  onMarkNotif: (id: string) => void;
  onMarkAllNotifs: () => void;
  onMarkAlert: (id: string) => void;
  onFocusRailChange?: (rail: WorkspaceRailDef | null) => void;
  t: (pt: string, es: string, en: string) => string;
};

function readStored(prefix: string, companyId: string): string | null {
  try {
    return localStorage.getItem(`${prefix}${companyId}`);
  } catch {
    return null;
  }
}

function writeStored(prefix: string, companyId: string, value: string | null) {
  try {
    const key = `${prefix}${companyId}`;
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function WorkspaceCockpit({
  companyId,
  overview,
  locale,
  canManage,
  saving,
  notifBusy,
  advisorBusy,
  onMarkTaskDone,
  onMarkNotif,
  onMarkAllNotifs,
  onMarkAlert,
  onFocusRailChange,
  t,
}: Props) {
  const rails = useMemo(
    () =>
      buildWorkspaceRails({
        systems: overview.access.systems as WorkspaceSystemKey[],
        tools: {
          work: overview.tools?.work === true || Boolean(overview.blocks.WORK),
          meet: overview.tools?.meet === true,
          studio: overview.tools?.studio === true || Boolean(overview.blocks.STUDIO),
        },
      }),
    [overview]
  );

  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [focusId, setFocusId] = useState<WorkspaceRailId | null>(null);
  const [splitId, setSplitId] = useState<WorkspaceRailId | null>(null);
  const [splitEnabled, setSplitEnabled] = useState(false);

  useEffect(() => {
    const f = readStored(FOCUS_STORAGE_PREFIX, companyId) as WorkspaceRailId | null;
    const s = readStored(SPLIT_STORAGE_PREFIX, companyId) as WorkspaceRailId | null;
    const valid = (id: string | null) => rails.some((r) => r.id === id);
    setFocusId(f && valid(f) ? f : rails[0]?.id ?? null);
    if (s && valid(s) && s !== f) {
      setSplitId(s);
      setSplitEnabled(true);
    }
  }, [companyId, rails]);

  const focusRail = rails.find((r) => r.id === focusId) ?? rails[0] ?? null;
  const splitRail =
    splitEnabled && splitId && splitId !== focusRail?.id
      ? rails.find((r) => r.id === splitId) ?? null
      : null;

  useEffect(() => {
    onFocusRailChange?.(focusRail);
  }, [focusRail, onFocusRailChange]);

  const selectRail = useCallback(
    (id: WorkspaceRailId, opts?: { split?: boolean }) => {
      if (opts?.split && focusId && id !== focusId) {
        setSplitId(id);
        setSplitEnabled(true);
        writeStored(SPLIT_STORAGE_PREFIX, companyId, id);
        return;
      }
      setFocusId(id);
      writeStored(FOCUS_STORAGE_PREFIX, companyId, id);
      if (splitId === id) {
        setSplitEnabled(false);
        setSplitId(null);
        writeStored(SPLIT_STORAGE_PREFIX, companyId, null);
      }
    },
    [companyId, focusId, splitId]
  );

  const toggleSplit = () => {
    if (splitEnabled) {
      setSplitEnabled(false);
      writeStored(SPLIT_STORAGE_PREFIX, companyId, null);
      return;
    }
    const other = rails.find((r) => r.id !== focusRail?.id);
    if (!other) return;
    setSplitId(other.id);
    setSplitEnabled(true);
    writeStored(SPLIT_STORAGE_PREFIX, companyId, other.id);
  };

  if (rails.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-sm text-white/55">
          {t(
            'Nenhum sistema no seu grant. Peça ao administrador ou configure o acesso.',
            'Ningún sistema en su grant. Pida al administrador o configure el acceso.',
            'No systems in your grant. Ask an admin or configure access.',
          )}
        </p>
        {canManage ? (
          <Link
            href={adminHref('access')}
            className="mt-4 inline-flex rounded-lg bg-teal-500/20 px-4 py-2 text-sm font-medium text-teal-200 hover:bg-teal-500/30"
          >
            {t('Gerir acessos', 'Gestionar accesos', 'Manage access')}
          </Link>
        ) : null}
      </div>
    );
  }

  const RailButton = ({ rail, compact }: { rail: WorkspaceRailDef; compact?: boolean }) => {
    const Icon = ICONS[rail.id] ?? LayoutGrid;
    const focused = focusRail?.id === rail.id;
    const inSplit = splitRail?.id === rail.id;
    return (
      <button
        type="button"
        title={`${rail.label}${compact ? '' : ' — Shift+click split'}`}
        onClick={(e) => selectRail(rail.id, { split: e.shiftKey })}
        className={cn(
          'flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-sm transition',
          focused
            ? cn('border-teal-400/35', sysTheme.active.teal)
            : inSplit
              ? 'border-white/20 bg-white/10 text-white'
              : 'border-transparent text-white/55 hover:bg-white/5 hover:text-white',
          compact && 'justify-center px-2'
        )}
      >
        <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-md border', sysTheme.icon[rail.accent])}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        {!compact ? <span className="truncate font-medium">{rail.label}</span> : null}
      </button>
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row lg:gap-0">
      {/* Desktop dock */}
      <nav
        className={cn(
          'hidden shrink-0 flex-col border-r border-[color:var(--sys-line,rgba(255,255,255,0.1))] bg-[color:var(--sys-aside-bg,rgba(7,17,26,0.55))] lg:flex',
          dockCollapsed ? 'w-14' : 'w-52'
        )}
        aria-label={t('Sistemas', 'Sistemas', 'Systems')}
      >
        <div className="flex items-center justify-between gap-1 border-b border-white/10 px-2 py-2">
          {!dockCollapsed ? (
            <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
              {t('Sistemas', 'Sistemas', 'Systems')}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => setDockCollapsed((v) => !v)}
            className="rounded-md p-1.5 text-white/40 hover:bg-white/5 hover:text-white"
            title={dockCollapsed ? t('Expandir', 'Expandir', 'Expand') : t('Recolher', 'Contraer', 'Collapse')}
          >
            {dockCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>
        <div className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {rails.map((rail) => (
            <RailButton key={rail.id} rail={rail} compact={dockCollapsed} />
          ))}
        </div>
        <div className="border-t border-white/10 p-2">
          <button
            type="button"
            onClick={toggleSplit}
            disabled={rails.length < 2}
            className={cn(
              'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-xs transition disabled:opacity-40',
              splitEnabled ? 'bg-teal-500/15 text-teal-200' : 'text-white/45 hover:bg-white/5 hover:text-white',
              dockCollapsed && 'justify-center'
            )}
            title={t('Dois painéis (desktop)', 'Dos paneles (escritorio)', 'Two panels (desktop)')}
          >
            <Columns2 className="h-4 w-4 shrink-0" />
            {!dockCollapsed ? t('Split', 'Split', 'Split') : null}
          </button>
        </div>
      </nav>

      {/* Mobile rails */}
      <div className="flex gap-1.5 overflow-x-auto px-4 pt-3 lg:hidden">
        {rails.map((rail) => {
          const Icon = ICONS[rail.id] ?? LayoutGrid;
          const focused = focusRail?.id === rail.id;
          return (
            <button
              key={rail.id}
              type="button"
              onClick={() => selectRail(rail.id)}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium',
                focused
                  ? 'border-teal-400/40 bg-teal-500/15 text-teal-100'
                  : 'border-white/10 bg-white/5 text-white/60'
              )}
            >
              <Icon className="h-3 w-3" />
              {rail.label}
            </button>
          );
        })}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-3 px-4 pb-6 pt-3 sm:px-6 lg:flex-row">
        <div
          className={cn(
            'grid min-w-0 flex-1 gap-3',
            splitRail ? 'xl:grid-cols-2' : 'grid-cols-1'
          )}
        >
          {focusRail ? (
            <WorkspaceStagePanel
              railId={focusRail.id}
              overview={overview}
              locale={locale}
              saving={saving}
              onMarkTaskDone={onMarkTaskDone}
              t={t}
            />
          ) : null}
          {splitRail ? (
            <div className="hidden xl:block">
              <WorkspaceStagePanel
                railId={splitRail.id}
                overview={overview}
                locale={locale}
                saving={saving}
                onMarkTaskDone={onMarkTaskDone}
                t={t}
              />
            </div>
          ) : null}
        </div>

        <div className="w-full shrink-0 lg:w-64 xl:w-72">
          <WorkspaceDigest
            overview={overview}
            locale={locale}
            notifBusy={notifBusy}
            advisorBusy={advisorBusy}
            onMarkNotif={onMarkNotif}
            onMarkAllNotifs={onMarkAllNotifs}
            onMarkAlert={onMarkAlert}
            t={t}
          />
          <p className="mt-2 hidden text-[10px] text-white/30 xl:block">
            {t(
              'Shift+clique num rail para o segundo painel.',
              'Shift+clic en un rail para el segundo panel.',
              'Shift+click a rail for the second panel.',
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
