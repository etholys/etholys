'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Loader2, MapPinned } from 'lucide-react';
import { useRadarClientScopeOptional } from '@/components/radar/RadarClientScopeContext';
import { RADAR_SCOPE_OWN } from '@/lib/radar/client-scope';

type Loc = 'pt' | 'es' | 'en';

type AlertRow = {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  message: { es: string; pt: string; en: string };
  propertyId: string | null;
  propertyName: string | null;
  href: string;
};

const PRIORITY: Record<AlertRow['severity'], { pt: string; es: string; en: string }> = {
  critical: { pt: 'Muito alta', es: 'Muy alta', en: 'Very high' },
  warning: { pt: 'Alta', es: 'Alta', en: 'High' },
  info: { pt: 'Normal', es: 'Normal', en: 'Normal' },
};

export function RadarTasksBoard({
  companyId,
  engagementId,
  locale,
}: {
  companyId: string;
  engagementId?: string | null;
  locale: string;
}) {
  const loc: Loc = locale === 'es' || locale === 'en' ? locale : 'pt';
  const scope = useRadarClientScopeOptional()?.scope || RADAR_SCOPE_OWN;
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);

  const companyQ = engagementId
    ? `company=${companyId}&engagement=${engagementId}`
    : `company=${companyId}`;

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const q = new URLSearchParams({ companyId, clientId: scope });
      if (engagementId) q.set('engagementId', engagementId);
      const r = await fetch(`/api/radar/alerts?${q}`, { cache: 'no-store' });
      const d = await r.json();
      if (r.ok) setAlerts(d.alerts || []);
      else setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, engagementId, scope]);

  useEffect(() => {
    void load();
  }, [load]);

  const groups = useMemo(() => {
    const rank = { critical: 0, warning: 1, info: 2 };
    const sorted = [...alerts].sort((a, b) => rank[a.severity] - rank[b.severity]);
    const map = new Map<string, { name: string; propertyId: string | null; tasks: AlertRow[] }>();
    for (const t of sorted) {
      const key = t.propertyId || '_none';
      const row = map.get(key) || {
        name: t.propertyName || (loc === 'en' ? 'General' : 'Geral'),
        propertyId: t.propertyId,
        tasks: [],
      };
      row.tasks.push(t);
      map.set(key, row);
    }
    return [...map.values()];
  }, [alerts, loc]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/40">RADAR</p>
          <h1 className="mt-2 font-serif text-4xl text-white">
            {loc === 'es' ? 'Hoy en el campo' : loc === 'en' ? 'Today in the field' : 'Hoje no campo'}
          </h1>
          <p className="mt-2 max-w-lg text-sm text-white/50">
            {loc === 'es'
              ? 'Qué hacer ahora, agrupado por lugar.'
              : loc === 'en'
                ? 'What to do now, grouped by place.'
                : 'O que fazer agora, agrupado por local.'}
          </p>
        </div>
        <Link
          href={`/hub/radar?${companyQ}`}
          className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm text-white/80"
        >
          <MapPinned className="h-4 w-4" />
          {loc === 'en' ? 'Open map' : 'Abrir mapa'}
        </Link>
      </div>

      {loading ? (
        <Loader2 className="h-6 w-6 animate-spin text-emerald-300" />
      ) : groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 px-5 py-10 text-center">
          <CheckCircle2 className="mx-auto h-7 w-7 text-emerald-300/70" />
          <p className="mt-3 text-sm text-white/55">
            {loc === 'es' ? 'Nada urgente en este ámbito.' : loc === 'en' ? 'Nothing urgent in this scope.' : 'Nada urgente neste âmbito.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.propertyId || g.name} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-medium text-white/80">
                  <MapPinned className="mr-1.5 inline h-3.5 w-3.5 text-emerald-300/70" />
                  {g.name}
                </h2>
                {g.propertyId && (
                  <Link
                    href={`/hub/radar/properties/${g.propertyId}?${companyQ}&client=${RADAR_SCOPE_OWN}`}
                    className="text-xs text-emerald-300/80 hover:text-emerald-200"
                  >
                    {loc === 'en' ? 'Go to place →' : 'Ir ao local →'}
                  </Link>
                )}
              </div>
              <ul className="space-y-2">
                {g.tasks.map((t) => (
                  <li key={t.id}>
                    <Link
                      href={t.href}
                      className="block rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5 transition hover:border-emerald-400/30"
                    >
                      <p className="text-[15px] font-medium text-white">{t.message[loc]}</p>
                      <p className="mt-1.5 text-xs text-white/45">
                        {loc === 'en' ? 'Priority' : 'Prioridade'}: {PRIORITY[t.severity][loc]}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
