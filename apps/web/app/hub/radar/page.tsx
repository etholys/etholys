'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Building2, Loader2, Wrench } from 'lucide-react';
import { useApp } from '@/app/providers';
import { RadarSpaceSetup } from '@/components/radar/RadarSpaceSetup';
import { RadarEmpresaView, RadarTecnicoView } from '@/components/radar/RadarViews';
import type { RadarModuleId } from '@/lib/etholys-products';
import type { RadarView } from '@/lib/radar/space';

function RadarInner() {
  const { locale, activeCompanyId } = useApp();
  const search = useSearchParams();
  const router = useRouter();
  const loc = locale === 'es' || locale === 'en' ? locale : 'pt';
  const companyId = search.get('company') || activeCompanyId || '';
  const engagementId = search.get('engagement');
  const viewParam = search.get('view');
  const view: RadarView = viewParam === 'tecnico' ? 'tecnico' : 'empresa';

  const [ready, setReady] = useState(false);
  const [hasSpaces, setHasSpaces] = useState(false);
  const [moduleId, setModuleId] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  const check = useCallback(async () => {
    if (!companyId) {
      setChecking(false);
      setHasSpaces(false);
      return;
    }
    setChecking(true);
    try {
      const q = new URLSearchParams({ companyId });
      if (engagementId) q.set('engagementId', engagementId);
      const [ag, br] = await Promise.all([
        fetch(`/api/radar/agriculture?${q}`),
        fetch(`/api/radar/bridge?companyId=${encodeURIComponent(companyId)}`),
      ]);
      const ad = ag.ok ? await ag.json() : null;
      const bd = br.ok ? await br.json() : null;
      const spaces = Array.isArray(ad?.spaces) ? ad.spaces.length > 0 : Array.isArray(ad?.parcels) && ad.parcels.length > 0;
      setHasSpaces(Boolean(ad?.hasSpaces) || spaces);
      setModuleId(bd?.radarModule || bd?.pulsoModule || (spaces ? 'agriculture' : null));
      setReady(true);
    } catch {
      setHasSpaces(false);
      setReady(true);
    } finally {
      setChecking(false);
    }
  }, [companyId, engagementId]);

  useEffect(() => {
    void check();
  }, [check]);

  const setView = (next: RadarView) => {
    const q = new URLSearchParams(search.toString());
    q.set('view', next);
    router.replace(`/hub/radar?${q.toString()}`);
  };

  const onSpaceCreated = (id: RadarModuleId) => {
    setModuleId(id);
    setHasSpaces(true);
    void check();
  };

  if (checking && !ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-emerald-300" />
      </div>
    );
  }

  if (!companyId) {
    return (
      <p className="text-sm text-white/60">
        {loc === 'es' ? 'Elegí una empresa.' : loc === 'en' ? 'Pick a company.' : 'Escolhe uma empresa.'}
      </p>
    );
  }

  if (!hasSpaces) {
    return (
      <RadarSpaceSetup
        companyId={companyId}
        engagementId={engagementId}
        locale={loc}
        onCreated={onSpaceCreated}
      />
    );
  }

  // Non-agriculture modules: still show setup message until boards exist
  if (moduleId && moduleId !== 'agriculture') {
    return (
      <div className="mx-auto max-w-xl rounded-[1.5rem] border border-white/10 bg-white/[0.04] px-6 py-10 text-center">
        <p className="font-serif text-2xl text-white">
          {loc === 'es' ? 'Mismo lazo, aún en camino' : loc === 'en' ? 'Same loop, still on the way' : 'Mesmo laço, ainda a caminho'}
        </p>
        <p className="mt-2 text-sm text-white/55">
          {loc === 'es'
            ? 'Agroindustria, pecuaria y carbono usan el mismo ritmo. Agricultura ya está cerrada.'
            : loc === 'en'
              ? 'Agroindustry, livestock and carbon share the same rhythm. Agriculture is already closed.'
              : 'Agroindústria, pecuária e carbono usam o mesmo ritmo. Agricultura já está fechada.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">RADAR · Agricultura</p>
          <p className="mt-1 text-sm text-white/55">
            {view === 'empresa'
              ? loc === 'es'
                ? 'Vista empresa — comando y canales'
                : loc === 'en'
                  ? 'Company view — command and channels'
                  : 'Vista empresa — comando e canais'
              : loc === 'es'
                ? 'Vista técnico — una acción clara en el campo'
                : loc === 'en'
                  ? 'Technician view — one clear field action'
                  : 'Vista técnico — uma ação clara no campo'}
          </p>
        </div>
        <div className="inline-flex rounded-2xl border border-white/15 bg-black/30 p-1">
          <button
            type="button"
            onClick={() => setView('empresa')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm transition ${
              view === 'empresa' ? 'bg-emerald-500 text-[#04110c] font-semibold' : 'text-white/60 hover:text-white'
            }`}
          >
            <Building2 className="h-3.5 w-3.5" />
            {loc === 'es' ? 'Empresa' : loc === 'en' ? 'Company' : 'Empresa'}
          </button>
          <button
            type="button"
            onClick={() => setView('tecnico')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm transition ${
              view === 'tecnico' ? 'bg-emerald-500 text-[#04110c] font-semibold' : 'text-white/60 hover:text-white'
            }`}
          >
            <Wrench className="h-3.5 w-3.5" />
            {loc === 'es' ? 'Técnico' : loc === 'en' ? 'Field' : 'Técnico'}
          </button>
        </div>
      </div>

      {view === 'empresa' ? (
        <RadarEmpresaView companyId={companyId} engagementId={engagementId} locale={loc} />
      ) : (
        <RadarTecnicoView companyId={companyId} engagementId={engagementId} locale={loc} />
      )}
    </div>
  );
}

export default function RadarPage() {
  return (
    <Suspense fallback={<Loader2 className="mx-auto mt-20 h-8 w-8 animate-spin text-emerald-300" />}>
      <RadarInner />
    </Suspense>
  );
}
