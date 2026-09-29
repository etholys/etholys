'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Bell, Loader2, MapPinned } from 'lucide-react';
import { useRadarClientScopeOptional } from '@/components/radar/RadarClientScopeContext';
import { RADAR_CLIENT_ALL } from '@/lib/radar/client-scope';

type Loc = 'pt' | 'es' | 'en';

type AlertRow = {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  code: string;
  message: { es: string; pt: string; en: string };
  clientId: string | null;
  clientName: string | null;
  propertyId: string | null;
  propertyName: string | null;
  href: string;
};

const severityStyles = {
  critical: 'border-rose-400/35 bg-rose-500/10 text-rose-50',
  warning: 'border-amber-400/35 bg-amber-500/10 text-amber-50',
  info: 'border-sky-400/30 bg-sky-500/10 text-sky-50',
};

export function RadarAlertsDashboard({
  companyId,
  engagementId,
  locale,
  clientId,
}: {
  companyId: string;
  engagementId?: string | null;
  locale: string;
  /** Explicit override; otherwise uses scope context when available. */
  clientId?: string | null;
}) {
  const loc: Loc = locale === 'es' || locale === 'en' ? locale : 'pt';
  const scope = useRadarClientScopeOptional();
  const resolvedClient =
    clientId !== undefined
      ? clientId
      : scope?.role === 'provider'
        ? scope.clientScope === RADAR_CLIENT_ALL
          ? RADAR_CLIENT_ALL
          : scope.clientScope
        : null;

  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setErr(null);
    try {
      const q = new URLSearchParams({ companyId });
      if (engagementId) q.set('engagementId', engagementId);
      if (resolvedClient) q.set('clientId', resolvedClient);
      const r = await fetch(`/api/radar/alerts?${q}`, { cache: 'no-store' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha');
      setAlerts(d.alerts || []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, engagementId, resolvedClient]);

  useEffect(() => {
    void load();
  }, [load]);

  const title =
    loc === 'es' ? 'Alertas principales' : loc === 'en' ? 'Main alerts' : 'Alertas principais';
  const subtitle =
    resolvedClient && resolvedClient !== RADAR_CLIENT_ALL
      ? loc === 'es'
        ? 'Ámbito del cliente seleccionado.'
        : loc === 'en'
          ? 'Scoped to the selected client.'
          : 'Âmbito do cliente selecionado.'
      : loc === 'es'
        ? 'Humedad, carencia, sensores, cadena y WhatsApp en toda la cartera.'
        : loc === 'en'
          ? 'Moisture, PHI, sensors, chain and WhatsApp across the portfolio.'
          : 'Humidade, carência, sensores, cadeia e WhatsApp em toda a carteira.';

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/40">
            RADAR · Dashboard
          </p>
          <h2 className="mt-1 font-serif text-3xl text-white">{title}</h2>
          <p className="mt-1 max-w-xl text-sm text-white/50">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-xl border border-white/10 px-3 py-2 text-xs text-white/55 hover:bg-white/5"
        >
          {loc === 'en' ? 'Refresh' : 'Atualizar'}
        </button>
      </div>

      {err && <p className="text-sm text-rose-200">{err}</p>}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-7 w-7 animate-spin text-emerald-300" />
        </div>
      ) : alerts.length === 0 ? (
        <div className="rounded-[1.35rem] border border-dashed border-white/15 bg-black/20 px-6 py-10 text-center">
          <Bell className="mx-auto h-7 w-7 text-white/30" />
          <p className="mt-3 text-sm text-white/55">
            {loc === 'es'
              ? 'Sin alertas activas en este ámbito.'
              : loc === 'en'
                ? 'No active alerts in this scope.'
                : 'Sem alertas ativas neste âmbito.'}
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {alerts.map((a) => (
            <li key={a.id}>
              <Link
                href={a.href}
                className={`group flex h-full flex-col rounded-[1.25rem] border px-4 py-4 transition hover:brightness-110 ${severityStyles[a.severity]}`}
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 opacity-80" />
                  <p className="text-sm font-medium leading-snug">{a.message[loc]}</p>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] opacity-70">
                  {a.clientName && <span>{a.clientName}</span>}
                  {a.propertyName && (
                    <span className="inline-flex items-center gap-1">
                      <MapPinned className="h-3 w-3" />
                      {a.propertyName}
                    </span>
                  )}
                  <span className="uppercase tracking-wide opacity-60">{a.severity}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
