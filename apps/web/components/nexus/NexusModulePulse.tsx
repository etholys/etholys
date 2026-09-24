'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { L, moduleActionHref, type L3 } from '@/lib/nexus-sector-modules';

type Pulse = {
  module: {
    moduleId: string;
    unitLabel: L3;
    bookLabel: L3;
    monitorLabel: L3;
    intro: L3;
  };
  units: unknown[];
  recentEntries: unknown[];
  sensors: unknown[];
  latestDiagnosis: { overall: number; createdAt: string } | null;
  alerts: Array<{ severity: string }>;
};

export function NexusModulePulse({
  companyId,
  engagementId,
  locale,
}: {
  companyId: string;
  engagementId?: string | null;
  locale: 'es' | 'pt' | 'en';
}) {
  const [pulse, setPulse] = useState<Pulse | null>(null);

  useEffect(() => {
    if (!companyId) return;
    const q = new URLSearchParams({ companyId });
    if (engagementId) q.set('engagementId', engagementId);
    let cancelled = false;
    fetch(`/api/nexus/ops/summary?${q}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.module) setPulse(d as Pulse);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [companyId, engagementId]);

  if (!pulse) return null;

  const es = locale === 'es';
  const en = locale === 'en';
  const alerts = pulse.alerts?.length || 0;
  const campo = moduleActionHref('campo', { companyId, engagementId });
  const monitor = moduleActionHref('monitor', { companyId, engagementId });

  return (
    <section className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {es ? 'Módulo vivo' : en ? 'Live module' : 'Módulo vivo'}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{L(pulse.module.bookLabel, locale)}</p>
      <p className="mt-0.5 text-xs text-slate-500">{L(pulse.module.intro, locale)}</p>
      <p className="mt-2 text-xs text-slate-600">
        {pulse.units.length} {L(pulse.module.unitLabel, locale).toLowerCase()}
        {' · '}
        {pulse.recentEntries.length} {es ? 'líneas' : en ? 'lines' : 'linhas'}
        {' · '}
        {pulse.sensors.length} {es ? 'sensores' : en ? 'sensors' : 'sensores'}
        {pulse.latestDiagnosis ? ` · dx ${pulse.latestDiagnosis.overall}/100` : ''}
        {alerts ? ` · ${alerts} ${es ? 'alertas' : en ? 'alerts' : 'alertas'}` : ''}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={campo} className="rounded-md bg-[#0c1222] px-2.5 py-1 text-[11px] font-medium text-white">
          {L(pulse.module.bookLabel, locale)}
        </Link>
        <Link
          href={monitor}
          className="rounded-md border border-slate-300 px-2.5 py-1 text-[11px] font-medium text-slate-800"
        >
          {L(pulse.module.monitorLabel, locale)}
        </Link>
      </div>
    </section>
  );
}
