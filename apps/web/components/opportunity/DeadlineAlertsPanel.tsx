'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useApp } from '@/app/providers';
import { isLikelyDbId } from '@/lib/utils';
import { Calendar, ChevronRight, Circle, Clock, X } from 'lucide-react';

type Deadline = {
  fundId: string;
  name: string;
  institution: string;
  deadline: string;
  daysLeft: number;
};

type RollingFund = {
  fundId: string;
  name: string;
  institution: string;
  type: string;
};

type Props = {
  /** `button` — chip compacto; `inline` — botão na barra de acções */
  variant?: 'button' | 'inline';
  className?: string;
};

export function DeadlineAlertsPanel({ variant = 'button', className }: Props) {
  const { locale, activeCompanyId } = useApp();
  const companyId = useMemo(() => {
    const s = String(activeCompanyId ?? '').trim();
    return isLikelyDbId(s) ? s : '';
  }, [activeCompanyId]);

  const t = (pt: string, es: string, en: string) =>
    locale === 'pt' ? pt : locale === 'es' ? es : en;

  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [rolling, setRolling] = useState<RollingFund[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const q = (path: string) =>
    `${path}${path.includes('?') ? '&' : '?'}companyId=${encodeURIComponent(companyId)}`;

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      await fetch(q('/api/opportunity/alerts'), { method: 'POST' });
      const r = await fetch(q('/api/opportunity/alerts?days=30'), { cache: 'no-store' });
      const d = (await r.json()) as { deadlines?: Deadline[]; rolling?: RollingFund[] };
      if (r.ok) {
        setDeadlines(d.deadlines ?? []);
        setRolling(d.rolling ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const total = deadlines.length + rolling.length;
  if (!companyId || loading || total === 0) return null;

  const urgent = deadlines.filter((i) => i.daysLeft <= 7);
  const upcoming = deadlines.filter((i) => i.daysLeft > 7);

  const btnClass =
    variant === 'inline'
      ? 'inline-flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-medium text-orange-900 hover:bg-orange-100'
      : 'inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-900 hover:bg-orange-100';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${btnClass} ${className ?? ''}`}
        title={t('Prazos e oportunidades abertas', 'Plazos y oportunidades abiertas', 'Deadlines and open calls')}
      >
        <Calendar className="h-3.5 w-3.5" />
        {t('Prazos', 'Plazos', 'Deadlines')}
        <span className="rounded-full bg-orange-200 px-1.5 py-0.5 text-[10px] font-bold leading-none">
          {total}
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/30 p-0 sm:p-4">
          <div
            className="flex h-full w-full max-w-md flex-col bg-white shadow-xl sm:h-auto sm:max-h-[85vh] sm:rounded-2xl"
            role="dialog"
            aria-label={t('Prazos próximos', 'Plazos próximos', 'Upcoming deadlines')}
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  {t('A acompanhar', 'A seguir', 'To follow up')}
                </h2>
                <p className="text-xs text-gray-500">
                  {t(
                    'Prazos a vencer e oportunidades rolling.',
                    'Plazos por vencer y oportunidades rolling.',
                    'Due dates and rolling opportunities.',
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-3">
              {urgent.length > 0 && (
                <TaskSection
                  title={t('Urgente (< 7 dias)', 'Urgente (< 7 días)', 'Urgent (< 7 days)')}
                  accent="text-red-700"
                >
                  {urgent.map((item) => (
                    <TaskRow
                      key={item.fundId}
                      href={`/hub/fundhub/discover/${item.fundId}`}
                      name={item.name}
                      institution={item.institution}
                      badge={`${item.daysLeft}d`}
                      badgeClass="bg-red-100 text-red-800"
                      onNavigate={() => setOpen(false)}
                    />
                  ))}
                </TaskSection>
              )}

              {upcoming.length > 0 && (
                <TaskSection
                  title={t('Próximos 30 dias', 'Próximos 30 días', 'Next 30 days')}
                  accent="text-orange-800"
                >
                  {upcoming.map((item) => (
                    <TaskRow
                      key={item.fundId}
                      href={`/hub/fundhub/discover/${item.fundId}`}
                      name={item.name}
                      institution={item.institution}
                      badge={`${item.daysLeft}d`}
                      badgeClass="bg-orange-100 text-orange-800"
                      onNavigate={() => setOpen(false)}
                    />
                  ))}
                </TaskSection>
              )}

              {rolling.length > 0 && (
                <TaskSection
                  title={t('Rolling / sem prazo fixo', 'Rolling / sin plazo fijo', 'Rolling / no fixed deadline')}
                  accent="text-gray-600"
                >
                  {rolling.map((item) => (
                    <TaskRow
                      key={item.fundId}
                      href={`/hub/fundhub/discover/${item.fundId}`}
                      name={item.name}
                      institution={item.institution}
                      badge={t('Aberto', 'Abierto', 'Open')}
                      badgeClass="bg-gray-100 text-gray-700"
                      onNavigate={() => setOpen(false)}
                    />
                  ))}
                </TaskSection>
              )}
            </div>

            <div className="border-t border-gray-100 px-5 py-3">
              <Link
                href="/hub/fundhub/my-funds"
                onClick={() => setOpen(false)}
                className="text-xs font-medium text-amber-700 hover:underline"
              >
                {t('Ver todas as oportunidades →', 'Ver todas →', 'View all opportunities →')}
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function TaskSection({
  title,
  accent,
  children,
}: {
  title: string;
  accent: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-4">
      <p className={`mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wide ${accent}`}>
        {title}
      </p>
      <ul className="space-y-1">{children}</ul>
    </div>
  );
}

function TaskRow({
  href,
  name,
  institution,
  badge,
  badgeClass,
  onNavigate,
}: {
  href: string;
  name: string;
  institution: string;
  badge: string;
  badgeClass: string;
  onNavigate: () => void;
}) {
  return (
    <li>
      <Link
        href={href}
        onClick={onNavigate}
        className="group flex items-start gap-2.5 rounded-lg px-2 py-2.5 transition hover:bg-gray-50"
      >
        <Circle className="mt-0.5 h-4 w-4 shrink-0 text-gray-300 group-hover:text-amber-500" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900 line-clamp-2">{name}</p>
          <p className="text-xs text-gray-500">{institution}</p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${badgeClass}`}>
            <Clock className="mr-0.5 inline h-3 w-3" />
            {badge}
          </span>
          <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-gray-500" />
        </div>
      </Link>
    </li>
  );
}
