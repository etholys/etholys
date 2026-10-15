'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { useApp } from '@/app/providers';
import { isLikelyDbId } from '@/lib/utils';
import type { RevenueYear } from '@/lib/opportunity/scan-types';

export function CompanyRevenueForm() {
  const { locale, activeCompanyId } = useApp();
  const companyId = useMemo(() => {
    const s = String(activeCompanyId ?? '').trim();
    return isLikelyDbId(s) ? s : '';
  }, [activeCompanyId]);
  const t = (pt: string, es: string, en: string) =>
    locale === 'pt' ? pt : locale === 'es' ? es : en;

  const [rows, setRows] = useState<RevenueYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setDenied(false);
    try {
      const r = await fetch(`/api/company/revenue?companyId=${encodeURIComponent(companyId)}`);
      if (r.status === 403) {
        setDenied(true);
        return;
      }
      if (!r.ok) return;
      const data = (await r.json()) as { revenueByYear?: RevenueYear[] };
      const year = new Date().getFullYear();
      setRows(
        data.revenueByYear?.length
          ? data.revenueByYear
          : [
              { year: year - 1, amountUsd: 0 },
              { year: year - 2, amountUsd: 0 },
              { year: year - 3, amountUsd: 0 },
            ],
      );
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!companyId) return;
    setSaving(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/company/revenue?companyId=${encodeURIComponent(companyId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revenueByYear: rows }),
      });
      if (r.status === 403) {
        setDenied(true);
        return;
      }
      if (!r.ok) throw new Error('save');
      const data = (await r.json()) as { revenueByYear?: RevenueYear[] };
      if (data.revenueByYear) setRows(data.revenueByYear);
      setMsg(t('Faturamento guardado.', 'Facturación guardada.', 'Revenue saved.'));
    } catch {
      setMsg(t('Erro ao guardar.', 'Error al guardar.', 'Save error.'));
    } finally {
      setSaving(false);
    }
  };

  if (!companyId || denied) return null;
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        …
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-amber-500/30 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-gray-900">
        {t('Faturamento anual (USD)', 'Facturación anual (USD)', 'Annual revenue (USD)')}
      </h2>
      <p className="mt-1 text-sm text-gray-600">
        {t(
          'Dado sensível da empresa. Só a administração o vê. O FundHub usa-o no encaixe, sem o mostrar à equipa.',
          'Dato sensible de la empresa. Solo la administración lo ve. FundHub lo usa en el encaje, sin mostrarlo al equipo.',
          'Sensitive company data. Only administration can see it. FundHub uses it for fit, without showing it to the team.',
        )}
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {rows.map((row, idx) => (
          <label key={row.year} className="block text-sm">
            <span className="font-medium text-gray-700">{row.year}</span>
            <input
              type="number"
              min={0}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none"
              value={row.amountUsd || ''}
              onChange={(e) => {
                const next = [...rows];
                next[idx] = { ...row, amountUsd: Number(e.target.value) || 0 };
                setRows(next);
              }}
            />
          </label>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {t('Guardar faturamento', 'Guardar facturación', 'Save revenue')}
        </button>
        {msg && <span className="text-sm text-gray-600">{msg}</span>}
      </div>
    </section>
  );
}
