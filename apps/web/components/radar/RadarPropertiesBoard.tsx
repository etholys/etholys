'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2, MapPinned, Plus } from 'lucide-react';
import type { PropertyStepState } from '@/lib/radar/property-progress';
import { RadarAlertsDashboard } from '@/components/radar/RadarAlertsDashboard';

type Loc = 'pt' | 'es' | 'en';

type PropRow = {
  id: string;
  name: string;
  moduleId: string | null;
  crop: string | null;
  progressPercent: number;
  steps: PropertyStepState[];
  unitCount: number;
};

const MODULES = [
  { id: 'agriculture', label: { pt: 'Agricultura', es: 'Agricultura', en: 'Agriculture' } },
  { id: 'agroindustry', label: { pt: 'Agroindústria', es: 'Agroindustria', en: 'Agroindustry' } },
  { id: 'livestock', label: { pt: 'Pecuária', es: 'Ganadería', en: 'Livestock' } },
  { id: 'carbon', label: { pt: 'Carbono', es: 'Carbono', en: 'Carbon' } },
] as const;

export function RadarPropertiesBoard({
  companyId,
  engagementId,
  locale,
  clientId,
  title,
  subtitle,
  backHref,
  showDashboard = false,
}: {
  companyId: string;
  engagementId?: string | null;
  locale: string;
  clientId?: string | null;
  title: string;
  subtitle: string;
  backHref?: string;
  showDashboard?: boolean;
}) {
  const loc: Loc = locale === 'es' || locale === 'en' ? locale : 'pt';
  const router = useRouter();
  const [rows, setRows] = useState<PropRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [moduleId, setModuleId] = useState('agriculture');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ companyId });
      if (engagementId) q.set('engagementId', engagementId);
      if (clientId) q.set('clientId', clientId);
      const r = await fetch(`/api/radar/properties?${q}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha');
      setRows(d.properties || []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setLoading(false);
    }
  }, [companyId, engagementId, clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (name.trim().length < 2) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch('/api/radar/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, engagementId, clientId, name, moduleId }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha');
      setName('');
      setCreating(false);
      const companyQ = engagementId
        ? `company=${companyId}&engagement=${engagementId}`
        : `company=${companyId}`;
      router.push(
        `/hub/radar/properties/${d.property.id}?${companyQ}${clientId ? `&client=${clientId}` : ''}`,
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  };

  const companyQ = engagementId
    ? `company=${companyId}&engagement=${engagementId}`
    : `company=${companyId}`;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          {backHref && (
            <Link href={backHref} className="text-xs text-white/45 hover:text-white/70">
              ← {loc === 'en' ? 'Back' : 'Voltar'}
            </Link>
          )}
          <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/40">RADAR</p>
          <h1 className="mt-2 font-serif text-4xl text-white">{title}</h1>
          <p className="mt-2 max-w-lg text-sm text-white/55">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-[#04110c]"
        >
          <Plus className="h-4 w-4" />
          {loc === 'en' ? 'Register farm' : 'Cadastrar fazenda'}
        </button>
      </div>

      {showDashboard && (
        <RadarAlertsDashboard companyId={companyId} engagementId={engagementId} locale={loc} clientId={null} />
      )}

      {err && <p className="text-sm text-rose-200">{err}</p>}

      {creating && (
        <div className="rounded-[1.35rem] border border-emerald-400/30 bg-emerald-500/10 px-5 py-5">
          <p className="mb-3 text-sm font-medium text-emerald-100">
            {loc === 'en' ? 'New farm / property' : 'Nova fazenda / propriedade'}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={loc === 'en' ? 'Farm / property name' : 'Nome da fazenda / propriedade'}
              className="rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-400/40 sm:col-span-2"
              autoFocus
            />
            <select
              value={moduleId}
              onChange={(e) => setModuleId(e.target.value)}
              className="rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-400/40 sm:col-span-2"
            >
              {MODULES.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label[loc]}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void create()}
              className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-[#04110c] disabled:opacity-40"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : loc === 'en' ? (
                'Create & open funnel'
              ) : (
                'Criar e abrir funil'
              )}
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="rounded-xl px-4 py-2 text-sm text-white/60"
            >
              {loc === 'en' ? 'Cancel' : 'Cancelar'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-emerald-300" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-[1.5rem] border border-dashed border-white/15 bg-black/20 px-8 py-14 text-center">
          <MapPinned className="mx-auto h-8 w-8 text-white/30" />
          <p className="mt-4 font-serif text-2xl text-white">
            {loc === 'es' ? 'Sin propiedades' : loc === 'en' ? 'No properties' : 'Sem propriedades'}
          </p>
          <p className="mt-2 text-sm text-white/50">
            {loc === 'es'
              ? 'Creá la primera para caracterizar, dibujar, geolocalizar y conectar sensores.'
              : 'Cria a primeira para caracterizar, desenhar, geolocalizar e conectar sensores.'}
          </p>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="mt-6 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-[#04110c]"
          >
            {loc === 'en' ? 'Register farm' : 'Cadastrar fazenda'}
          </button>
        </div>
      ) : (
        <ul className="grid gap-3">
          {rows.map((p) => (
            <li key={p.id}>
              <Link
                href={`/hub/radar/properties/${p.id}?${companyQ}${clientId ? `&client=${clientId}` : ''}`}
                className="group flex items-center justify-between gap-4 rounded-[1.35rem] border border-white/10 bg-white/[0.03] px-5 py-5 transition hover:border-emerald-400/35 hover:bg-emerald-500/10"
              >
                <div className="min-w-0">
                  <p className="truncate text-lg font-medium text-white">{p.name}</p>
                  <p className="mt-1 text-xs text-white/45">
                    {p.crop || p.moduleId || (loc === 'en' ? 'Not characterized' : 'Por caracterizar')}
                    {' · '}
                    {p.progressPercent}%
                  </p>
                  <div className="mt-3 h-1 w-40 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full bg-emerald-400" style={{ width: `${p.progressPercent}%` }} />
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-white/30 group-hover:text-emerald-200" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
