'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Bell, BrainCircuit, CheckCheck, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OverviewPayload } from '@/components/workspace/WorkspaceStagePanel';

type Props = {
  overview: OverviewPayload;
  locale: string;
  notifBusy: string | null;
  advisorBusy: string | null;
  onMarkNotif: (id: string) => void;
  onMarkAllNotifs: () => void;
  onMarkAlert: (id: string) => void;
  t: (pt: string, es: string, en: string) => string;
};

export function WorkspaceDigest({
  overview,
  locale,
  notifBusy,
  advisorBusy,
  onMarkNotif,
  onMarkAllNotifs,
  onMarkAlert,
  t,
}: Props) {
  const unreadNotifs = overview.notifications.filter((n) => !n.read);
  const alerts = overview.advisor?.alerts ?? [];
  const hasSignal = unreadNotifs.length > 0 || alerts.length > 0;
  const [open, setOpen] = useState(hasSignal);

  const deadlines = overview.blocks.SIEP?.siepDeadlines?.slice(0, 2) ?? [];

  return (
    <aside className="rounded-xl border border-[color:var(--sys-line,rgba(255,255,255,0.1))] bg-[color:var(--sys-panel,rgba(255,255,255,0.03))]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
      >
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/50">
          <Bell className="h-3.5 w-3.5" />
          {t('Hoje', 'Hoy', 'Today')}
          {hasSignal ? (
            <span className="rounded-full bg-teal-500/20 px-1.5 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-teal-200">
              {alerts.length + unreadNotifs.length}
            </span>
          ) : null}
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-white/40" /> : <ChevronDown className="h-4 w-4 text-white/40" />}
      </button>
      {open ? (
        <div className="space-y-3 border-t border-white/5 px-3 pb-3 pt-2">
          {alerts.length > 0 ? (
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <p className="flex items-center gap-1 text-[11px] font-medium text-white/45">
                  <BrainCircuit className="h-3 w-3" /> Advisor
                </p>
                <Link href="/hub/advisor" className="text-[11px] text-teal-300/80 hover:underline">
                  {t('Abrir', 'Abrir', 'Open')}
                </Link>
              </div>
              <ul className="space-y-1">
                {alerts.slice(0, 3).map((a) => (
                  <li key={a.id} className="rounded-lg border border-white/8 bg-white/[0.03] px-2 py-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        {a.link ? (
                          <Link href={a.link} className="truncate text-xs font-medium text-white/85 hover:text-teal-200">
                            {a.title}
                          </Link>
                        ) : (
                          <p className="truncate text-xs font-medium text-white/85">{a.title}</p>
                        )}
                        <p className="line-clamp-2 text-[11px] text-white/40">{a.message}</p>
                      </div>
                      <button
                        type="button"
                        disabled={advisorBusy === a.id}
                        onClick={() => onMarkAlert(a.id)}
                        className="shrink-0 text-[10px] text-white/40 hover:text-white disabled:opacity-50"
                      >
                        {t('Lida', 'Leída', 'Read')}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {unreadNotifs.length > 0 ? (
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-[11px] font-medium text-white/45">
                  {t('Por ler', 'Por leer', 'Unread')}
                </p>
                <button
                  type="button"
                  disabled={notifBusy === 'all'}
                  onClick={onMarkAllNotifs}
                  className="inline-flex items-center gap-1 text-[11px] text-white/40 hover:text-white disabled:opacity-50"
                >
                  <CheckCheck className="h-3 w-3" />
                  {t('Todas', 'Todas', 'All')}
                </button>
              </div>
              <ul className="space-y-1">
                {unreadNotifs.slice(0, 3).map((n) => (
                  <li key={n.id} className="flex items-start justify-between gap-2 rounded-lg border border-white/8 px-2 py-1.5">
                    <div className="min-w-0">
                      {n.link ? (
                        <Link href={n.link} className="truncate text-xs text-white/85 hover:text-teal-200">
                          {n.title}
                        </Link>
                      ) : (
                        <p className="truncate text-xs text-white/85">{n.title}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={notifBusy === n.id}
                      onClick={() => onMarkNotif(n.id)}
                      className="shrink-0 text-[10px] text-white/40 hover:text-white"
                    >
                      ✓
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {deadlines.length > 0 ? (
            <div>
              <p className="mb-1.5 text-[11px] font-medium text-white/45">
                {t('Prazos SIEP', 'Plazos SIEP', 'SIEP deadlines')}
              </p>
              <ul className="space-y-1">
                {deadlines.map((d) => (
                  <li key={d.id}>
                    <Link
                      href={d.href}
                      className={cn('text-xs', d.overdue ? 'text-amber-300' : 'text-white/70')}
                    >
                      {d.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {!hasSignal && deadlines.length === 0 ? (
            <p className="text-xs text-white/40">
              {locale === 'pt'
                ? 'Nada urgente por agora.'
                : locale === 'es'
                  ? 'Nada urgente por ahora.'
                  : 'Nothing urgent right now.'}
            </p>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}
