'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '@/app/providers';
import { isLikelyDbId } from '@/lib/utils';
import { Loader2, Save } from 'lucide-react';
import type { OpportunityBriefing, OrgKindForFunding, RevenueYear } from '@/lib/opportunity/scan-types';

const ORG_OPTIONS: Array<{ id: OrgKindForFunding; pt: string; es: string; en: string }> = [
  { id: 'ngo', pt: 'ONG', es: 'ONG', en: 'NGO' },
  { id: 'osc', pt: 'OSC / sociedade civil', es: 'OSC / sociedad civil', en: 'CSO' },
  { id: 'private', pt: 'Empresa privada', es: 'Empresa privada', en: 'Private company' },
  { id: 'public', pt: 'Público / governo', es: 'Público / gobierno', en: 'Public / government' },
  { id: 'coop', pt: 'Cooperativa', es: 'Cooperativa', en: 'Cooperative' },
  { id: 'foundation', pt: 'Fundação', es: 'Fundación', en: 'Foundation' },
  { id: 'other', pt: 'Outro', es: 'Otro', en: 'Other' },
];

export function EligibilityProfileForm() {
  const { locale, activeCompanyId } = useApp();
  const companyId = useMemo(() => {
    const s = String(activeCompanyId ?? '').trim();
    return isLikelyDbId(s) ? s : '';
  }, [activeCompanyId]);
  const t = (pt: string, es: string, en: string) =>
    locale === 'pt' ? pt : locale === 'es' ? es : en;

  const [briefing, setBriefing] = useState<OpportunityBriefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/opportunity/briefing?companyId=${encodeURIComponent(companyId)}`);
      const d = (await r.json()) as { briefing?: OpportunityBriefing };
      setBriefing(d.briefing ?? null);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!companyId || !briefing) return;
    setSaving(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/opportunity/briefing?companyId=${encodeURIComponent(companyId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ briefing }),
      });
      if (!r.ok) throw new Error('save failed');
      const d = (await r.json()) as { briefing?: OpportunityBriefing };
      if (d.briefing) setBriefing(d.briefing);
      setMsg(t('Guardado.', 'Guardado.', 'Saved.'));
    } catch {
      setMsg(t('Erro ao guardar.', 'Error al guardar.', 'Save error.'));
    } finally {
      setSaving(false);
    }
  };

  if (!companyId) return null;
  if (loading || !briefing) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        …
      </div>
    );
  }

  const year = new Date().getFullYear();
  const revenue: RevenueYear[] = briefing.revenueByYear?.length
    ? briefing.revenueByYear
    : [
        { year: year - 1, amountUsd: 0 },
        { year: year - 2, amountUsd: 0 },
        { year: year - 3, amountUsd: 0 },
      ];

  return (
    <section className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-5 shadow-sm text-gray-100">
      <h2 className="text-base font-semibold text-white">
        {t('Elegibilidade institucional', 'Elegibilidad institucional', 'Institutional eligibility')}
      </h2>
      <p className="mt-1 text-sm text-gray-400">
        {t(
          'Camada essencial para filtros e recomendações — poucos campos, alto impacto.',
          'Capa esencial para filtros y recomendaciones — pocos campos, alto impacto.',
          'Essential layer for filters and recommendations — few fields, high impact.',
        )}
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-gray-300">
            {t('Tipo de organização', 'Tipo de organización', 'Organization type')}
          </span>
          <select
            className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-gray-100"
            value={briefing.orgKind ?? ''}
            onChange={(e) =>
              setBriefing({
                ...briefing,
                orgKind: (e.target.value || undefined) as OrgKindForFunding | undefined,
              })
            }
          >
            <option value="">{t('Seleccionar…', 'Seleccionar…', 'Select…')}</option>
            {ORG_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {locale === 'pt' ? o.pt : locale === 'es' ? o.es : o.en}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="font-medium text-gray-300">
            {t('Países de registo jurídico', 'Países de registro jurídico', 'Legal registration countries')}
          </span>
          <input
            className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-gray-100"
            value={(briefing.legalCountries ?? []).join(', ')}
            onChange={(e) =>
              setBriefing({
                ...briefing,
                legalCountries: e.target.value
                  .split(/[,;]+/)
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            placeholder="Honduras, Guatemala, Perú"
          />
        </label>

        <label className="block text-sm">
          <span className="font-medium text-gray-300">
            {t('Anos de operação', 'Años de operación', 'Years operating')}
          </span>
          <input
            type="number"
            min={0}
            className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-gray-100"
            value={briefing.yearsOperating ?? ''}
            onChange={(e) =>
              setBriefing({
                ...briefing,
                yearsOperating: e.target.value === '' ? undefined : Number(e.target.value),
              })
            }
          />
        </label>

        <label className="block text-sm">
          <span className="font-medium text-gray-300">{t('Maturidade', 'Madurez', 'Maturity')}</span>
          <select
            className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-gray-100"
            value={briefing.maturityLevel ?? ''}
            onChange={(e) =>
              setBriefing({
                ...briefing,
                maturityLevel: (e.target.value || undefined) as OpportunityBriefing['maturityLevel'],
              })
            }
          >
            <option value="">{t('Seleccionar…', 'Seleccionar…', 'Select…')}</option>
            <option value="early">{t('Inicial', 'Temprana', 'Early')}</option>
            <option value="growing">{t('Em crescimento', 'En crecimiento', 'Growing')}</option>
            <option value="established">{t('Estabelecida', 'Establecida', 'Established')}</option>
          </select>
        </label>

        <label className="block text-sm sm:col-span-2">
          <span className="font-medium text-gray-300">
            {t('Auditoria externa (últimos 5 anos)', 'Auditoría externa (últimos 5 años)', 'External audit (last 5 years)')}
          </span>
          <div className="mt-2 flex flex-wrap gap-3 text-sm">
            {[
              { v: true, label: t('Sim', 'Sí', 'Yes') },
              { v: false, label: t('Não', 'No', 'No') },
            ].map((opt) => (
              <button
                key={String(opt.v)}
                type="button"
                onClick={() => setBriefing({ ...briefing, hasAuditLast5Years: opt.v })}
                className={`rounded-full px-3 py-1.5 ring-1 ${
                  briefing.hasAuditLast5Years === opt.v
                    ? 'bg-amber-600 text-white ring-amber-600'
                    : 'bg-slate-900 text-gray-300 ring-white/15'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </label>
      </div>

      <div className="mt-4">
        <p className="text-sm font-medium text-gray-300">
          {t('Faturamento anual (USD)', 'Facturación anual (USD)', 'Annual revenue (USD)')}
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {revenue.map((row, idx) => (
            <div
              key={row.year}
              className="flex items-center gap-2 rounded-lg border border-white/10 bg-slate-900 px-2 py-1.5"
            >
              <span className="w-12 text-xs text-gray-500">{row.year}</span>
              <input
                type="number"
                min={0}
                className="w-full bg-transparent text-sm text-gray-100 outline-none"
                value={row.amountUsd || ''}
                onChange={(e) => {
                  const next = [...revenue];
                  next[idx] = { ...row, amountUsd: Number(e.target.value) || 0 };
                  setBriefing({ ...briefing, revenueByYear: next });
                }}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {t('Guardar elegibilidade', 'Guardar elegibilidad', 'Save eligibility')}
        </button>
        {msg && <span className="text-sm text-gray-400">{msg}</span>}
      </div>
    </section>
  );
}
