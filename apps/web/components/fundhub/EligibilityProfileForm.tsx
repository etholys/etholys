'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '@/app/providers';
import { isLikelyDbId } from '@/lib/utils';
import { Loader2, Plus, Save, X } from 'lucide-react';
import { mergeLegalCountries } from '@/lib/opportunity/legal-countries';
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
  const [countryDraft, setCountryDraft] = useState('');
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
    const toSave: OpportunityBriefing = {
      ...briefing,
      legalCountries: mergeLegalCountries(briefing.legalCountries ?? [], countryDraft),
    };
    setBriefing(toSave);
    setCountryDraft('');
    setSaving(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/opportunity/briefing?companyId=${encodeURIComponent(companyId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ briefing: toSave }),
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
    <section className="rounded-2xl border border-amber-500/30 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-gray-900">
        {t('Elegibilidade institucional', 'Elegibilidad institucional', 'Institutional eligibility')}
      </h2>
      <p className="mt-1 text-sm text-gray-600">
        {t(
          'Camada essencial para filtros e recomendações — poucos campos, alto impacto.',
          'Capa esencial para filtros y recomendaciones — pocos campos, alto impacto.',
          'Essential layer for filters and recommendations — few fields, high impact.',
        )}
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-gray-700">
            {t('Tipo de organização', 'Tipo de organización', 'Organization type')}
          </span>
          <select
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-gray-900"
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

        <div className="block text-sm sm:col-span-2">
          <span className="font-medium text-gray-700">
            {t('Países de registo jurídico', 'Países de registro jurídico', 'Legal registration countries')}
          </span>
          <p className="mt-0.5 text-xs text-gray-500">
            {t(
              'Podes acrescentar vários. Um país de cada vez, ou vários separados por vírgula.',
              'Puedes agregar varios. Un país a la vez, o varios separados por coma.',
              'You can add several. One country at a time, or several separated by commas.',
            )}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(briefing.legalCountries ?? []).map((country) => (
              <span
                key={country}
                className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-800 ring-1 ring-gray-200"
              >
                {country}
                <button
                  type="button"
                  aria-label={t(`Remover ${country}`, `Quitar ${country}`, `Remove ${country}`)}
                  onClick={() =>
                    setBriefing({
                      ...briefing,
                      legalCountries: (briefing.legalCountries ?? []).filter((c) => c !== country),
                    })
                  }
                  className="rounded-full p-0.5 text-gray-500 hover:text-gray-900"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-gray-900"
              value={countryDraft}
              onChange={(e) => setCountryDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' && e.key !== ',') return;
                e.preventDefault();
                const next = mergeLegalCountries(briefing.legalCountries ?? [], countryDraft);
                setBriefing({ ...briefing, legalCountries: next });
                setCountryDraft('');
              }}
              onBlur={() => {
                if (!countryDraft.trim()) return;
                setBriefing({
                  ...briefing,
                  legalCountries: mergeLegalCountries(briefing.legalCountries ?? [], countryDraft),
                });
                setCountryDraft('');
              }}
              placeholder={t('Ex.: Uruguay', 'Ej.: Uruguay', 'e.g. Uruguay')}
            />
            <button
              type="button"
              onClick={() => {
                const next = mergeLegalCountries(briefing.legalCountries ?? [], countryDraft);
                setBriefing({ ...briefing, legalCountries: next });
                setCountryDraft('');
              }}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100"
            >
              <Plus className="h-4 w-4" />
              {t('Adicionar', 'Agregar', 'Add')}
            </button>
          </div>
        </div>

        <label className="block text-sm">
          <span className="font-medium text-gray-700">
            {t('Anos de operação', 'Años de operación', 'Years operating')}
          </span>
          <input
            type="number"
            min={0}
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-gray-900"
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
          <span className="font-medium text-gray-700">{t('Maturidade', 'Madurez', 'Maturity')}</span>
          <select
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-gray-900"
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
          <span className="font-medium text-gray-700">
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
                    : 'bg-gray-100 text-gray-700 ring-gray-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </label>
      </div>

      <div className="mt-4">
        <p className="text-sm font-medium text-gray-700">
          {t('Faturamento anual (USD)', 'Facturación anual (USD)', 'Annual revenue (USD)')}
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {revenue.map((row, idx) => (
            <div
              key={row.year}
              className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5"
            >
              <span className="w-12 text-xs font-medium text-gray-600">{row.year}</span>
              <input
                type="number"
                min={0}
                className="w-full bg-transparent text-sm text-gray-900 outline-none"
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
        {msg && <span className="text-sm text-gray-600">{msg}</span>}
      </div>
    </section>
  );
}
