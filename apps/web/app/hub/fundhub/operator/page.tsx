'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/app/providers';
import { isLikelyDbId } from '@/lib/utils';
import { ArrowLeft, Building2, Loader2, RefreshCw } from 'lucide-react';

type OperatorCompany = {
  companyId: string;
  companyName: string;
  primary?: boolean;
  pending: number;
  later: number;
  inProgress: number;
  won: number;
  items: Array<{
    tempId: string;
    name: string;
    institution?: string;
    closesAt?: string;
    runId?: string;
  }>;
};

export default function FundHubOperatorPage() {
  const { locale, activeCompanyId, setActiveCompanyId } = useApp();
  const companyId = useMemo(() => {
    const s = String(activeCompanyId ?? '').trim();
    return isLikelyDbId(s) ? s : '';
  }, [activeCompanyId]);
  const t = (pt: string, es: string, en: string) =>
    locale === 'pt' ? pt : locale === 'es' ? es : en;

  const [loading, setLoading] = useState(true);
  const [operator, setOperator] = useState(false);
  const [companies, setCompanies] = useState<OperatorCompany[]>([]);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const r = await fetch(
        `/api/fundhub/operator/inbox?companyId=${encodeURIComponent(companyId)}`,
        { cache: 'no-store' },
      );
      const d = (await r.json()) as { operator?: boolean; companies?: OperatorCompany[] };
      setOperator(Boolean(d.operator));
      setCompanies(d.companies ?? []);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!companyId) {
    return (
      <p className="p-6 text-sm text-gray-600">
        {t('Seleccione uma empresa.', 'Seleccione una empresa.', 'Select a company.')}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/hub/fundhub"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
        >
          <ArrowLeft className="h-4 w-4" />
          FundHub
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              {t('Operador multi-org', 'Operador multi-org', 'Multi-org operator')}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-gray-600">
              {t(
                'Inbox e expediente das organizações sob white-label — sem misturar dados entre tenants.',
                'Bandeja y expediente de las organizaciones bajo white-label — sin mezclar datos entre tenants.',
                'Inbox and pipeline across white-label orgs — no cross-tenant data mixing.',
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {t('Actualizar', 'Actualizar', 'Refresh')}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" /> …
        </div>
      ) : !operator ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
          {t(
            'Esta empresa não tem SKU white-label activo. O modo operador fica bloqueado.',
            'Esta empresa no tiene SKU white-label activo. El modo operador queda bloqueado.',
            'This company has no active white-label SKU. Operator mode stays locked.',
          )}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {companies.map((c) => (
            <section
              key={c.companyId}
              className={`rounded-xl border bg-white p-4 shadow-sm ${
                c.primary ? 'border-amber-300' : 'border-gray-200'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-amber-700" />
                  <h2 className="text-sm font-semibold text-gray-900">{c.companyName}</h2>
                  {c.primary && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-900">
                      {t('Actual', 'Actual', 'Current')}
                    </span>
                  )}
                </div>
                {!c.primary && (
                  <button
                    type="button"
                    onClick={() => setActiveCompanyId(c.companyId)}
                    className="text-xs font-medium text-amber-800 underline"
                  >
                    {t('Mudar para esta org', 'Cambiar a esta org', 'Switch to this org')}
                  </button>
                )}
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                {(
                  [
                    [c.pending, t('Inbox', 'Bandeja', 'Inbox')],
                    [c.later, t('Depois', 'Luego', 'Later')],
                    [c.inProgress, t('Em curso', 'En curso', 'In progress')],
                    [c.won, t('Ganhos', 'Ganados', 'Won')],
                  ] as const
                ).map(([n, label]) => (
                  <div key={label} className="rounded-lg bg-gray-50 px-2 py-2">
                    <p className="text-lg font-semibold text-gray-900">{n}</p>
                    <p className="text-[10px] uppercase tracking-wide text-gray-500">{label}</p>
                  </div>
                ))}
              </div>
              <ul className="mt-3 max-h-48 space-y-1.5 overflow-y-auto">
                {c.items.length === 0 ? (
                  <li className="py-3 text-center text-xs text-gray-400">
                    {t('Sem pendentes', 'Sin pendientes', 'No pending')}
                  </li>
                ) : (
                  c.items.map((item) => (
                    <li
                      key={`${c.companyId}-${item.tempId}`}
                      className="rounded-lg border border-gray-100 px-2.5 py-2 text-xs"
                    >
                      <p className="font-medium text-gray-900 line-clamp-1">{item.name}</p>
                      <p className="text-gray-500">{item.institution || '—'}</p>
                    </li>
                  ))
                )}
              </ul>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href="/hub/fundhub/discover"
                  onClick={() => {
                    if (!c.primary) setActiveCompanyId(c.companyId);
                  }}
                  className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white"
                >
                  {t('Abrir Buscar', 'Abrir Buscar', 'Open Search')}
                </Link>
                <Link
                  href="/hub/fundhub/my-funds"
                  onClick={() => {
                    if (!c.primary) setActiveCompanyId(c.companyId);
                  }}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700"
                >
                  {t('Em curso', 'En curso', 'In progress')}
                </Link>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
