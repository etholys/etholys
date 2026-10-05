'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useApp } from '@/app/providers';
import { RadarChainBoard, type ChainUnitOption } from '@/components/radar/RadarChainBoard';
import { useRadarClientScopeOptional } from '@/components/radar/RadarClientScopeContext';
import { RADAR_SCOPE_ALL, RADAR_SCOPE_OWN } from '@/lib/radar/client-scope';

function Inner() {
  const { locale, activeCompanyId } = useApp();
  const search = useSearchParams();
  const scopeCtx = useRadarClientScopeOptional();
  const loc = locale === 'es' || locale === 'en' ? locale : 'pt';
  const companyId = search.get('company') || activeCompanyId || '';
  const engagementId = search.get('engagement');
  const scope = scopeCtx?.scope || RADAR_SCOPE_OWN;
  const selectedClientId = scopeCtx?.selectedClientId || null;

  const [units, setUnits] = useState<ChainUnitOption[]>([]);

  const loadUnits = useCallback(async () => {
    if (!companyId) return;
    const q = new URLSearchParams({ companyId });
    if (engagementId) q.set('engagementId', engagementId);
    if (scope === RADAR_SCOPE_ALL) q.set('all', '1');
    else if (scope !== RADAR_SCOPE_OWN && selectedClientId) q.set('clientId', selectedClientId);
    const r = await fetch(`/api/radar/properties?${q}`, { cache: 'no-store' });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return;
    const opts: ChainUnitOption[] = [];
    for (const p of d.properties || []) {
      // properties list may not include units — fetch detail if needed
      const dq = new URLSearchParams({ companyId });
      if (engagementId) dq.set('engagementId', engagementId);
      const dr = await fetch(`/api/radar/properties/${p.id}?${dq}`, { cache: 'no-store' });
      const dd = await dr.json().catch(() => ({}));
      if (!dr.ok) continue;
      for (const u of dd.property?.units || []) {
        opts.push({
          id: u.id,
          name: u.name,
          crop: u.crop || p.crop || null,
          propertyName: p.name,
        });
      }
    }
    setUnits(opts);
  }, [companyId, engagementId, scope, selectedClientId]);

  useEffect(() => {
    void loadUnits();
  }, [loadUnits]);

  if (!companyId) {
    return (
      <p className="text-sm text-white/60">
        {loc === 'es' ? 'Elegí una empresa.' : loc === 'en' ? 'Pick a company.' : 'Escolhe uma empresa.'}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/40">RADAR</p>
        <h1 className="mt-2 font-serif text-4xl text-white">
          {loc === 'es' ? 'Cadena' : loc === 'en' ? 'Chain' : 'Cadeia'}
        </h1>
        <p className="mt-2 max-w-lg text-sm text-white/50">
          {loc === 'es'
            ? 'Del campo al camión — el recorrido del lote.'
            : loc === 'en'
              ? 'From field to truck — the lot journey.'
              : 'Do campo ao camião — o percurso do lote.'}
        </p>
      </div>
      <RadarChainBoard
        companyId={companyId}
        engagementId={engagementId}
        locale={loc}
        unitOptions={units}
        hideTitle
      />
    </div>
  );
}

export default function RadarCadeiaPage() {
  return (
    <Suspense fallback={<Loader2 className="mx-auto mt-20 h-8 w-8 animate-spin text-emerald-300" />}>
      <Inner />
    </Suspense>
  );
}
