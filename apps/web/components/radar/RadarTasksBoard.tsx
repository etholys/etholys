'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Loader2, MapPinned } from 'lucide-react';
import { useRadarClientScopeOptional } from '@/components/radar/RadarClientScopeContext';
import { RADAR_SCOPE_OWN } from '@/lib/radar/client-scope';

type Loc = 'pt' | 'es' | 'en';

type AlertRow = {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  message: { es: string; pt: string; en: string };
  propertyName: string | null;
  href: string;
};

const PRIORITY: Record<AlertRow['severity'], { pt: string; es: string; en: string; dot: string }> = {
  critical: { pt: 'Muito alta', es: 'Muy alta', en: 'Very high', dot: 'bg-rose-400' },
  warning: { pt: 'Alta', es: 'Alta', en: 'High', dot: 'bg-amber-400' },
  info: { pt: 'Normal', es: 'Normal', en: 'Normal', dot: 'bg-sky-400' },
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

  const tasks = [...alerts].sort((a, b) => {
    const rank = { critical: 0, warning: 1, info: 2 };
    return rank[a.severity] - rank[b.severity];
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/40">RADAR</p>
        <h1 className="mt-2 font-serif text-4xl text-white">
          {loc === 'es' ? 'Hoy en el campo' : loc === 'en' ? 'Today in the field' : 'Hoje no campo'}
        </h1>
        <p className="mt-2 max-w-lg text-sm text-white/50">
          {loc === 'es'
            ? 'Qué hacer ahora — una lista corta, no un muro de alertas.'
            : loc === 'en'
              ? 'What to do now — a short list, not an alert wall.'
              : 'O que fazer agora — uma lista curta, não um muro de alertas.'}
        </p>
      </div>

      {loading ? (
        <Loader2 className="h-6 w-6 animate-spin text-emerald-300" />
      ) : tasks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 px-5 py-10 text-center">
          <CheckCircle2 className="mx-auto h-7 w-7 text-emerald-300/70" />
          <p className="mt-3 text-sm text-white/55">
            {loc === 'es' ? 'Nada urgente en este ámbito.' : loc === 'en' ? 'Nothing urgent in this scope.' : 'Nada urgente neste âmbito.'}
          </p>
          <Link
            href={`/hub/radar?company=${companyId}${engagementId ? `&engagement=${engagementId}` : ''}`}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-[#04110c]"
          >
            <MapPinned className="h-4 w-4" />
            {loc === 'es' ? 'Abrir mapa' : loc === 'en' ? 'Open map' : 'Abrir mapa'}
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {tasks.slice(0, 12).map((t) => {
            const p = PRIORITY[t.severity];
            return (
              <li key={t.id}>
                <Link
                  href={t.href}
                  className="block rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 transition hover:border-emerald-400/35 hover:bg-white/[0.06]"
                >
                  <p className="text-base font-semibold text-emerald-100">{t.message[loc]}</p>
                  <dl className="mt-3 grid gap-1.5 text-sm sm:grid-cols-2">
                    <div className="flex gap-2">
                      <dt className="text-white/40">{loc === 'en' ? 'Ready' : 'Pronto'}</dt>
                      <dd className="inline-flex items-center gap-1.5 text-white/80">
                        <span className={`h-1.5 w-1.5 rounded-full ${p.dot}`} />
                        {loc === 'en' ? 'Yes' : 'Sim'}
                      </dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="text-white/40">{loc === 'en' ? 'Priority' : 'Prioridade'}</dt>
                      <dd className="text-white/80">{p[loc]}</dd>
                    </div>
                    {t.propertyName && (
                      <div className="flex gap-2 sm:col-span-2">
                        <dt className="text-white/40">{loc === 'en' ? 'Place' : 'Local'}</dt>
                        <dd className="inline-flex items-center gap-1 text-white/80">
                          <MapPinned className="h-3.5 w-3.5 text-emerald-300/70" />
                          {t.propertyName}
                        </dd>
                      </div>
                    )}
                  </dl>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
