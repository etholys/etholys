'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CreditCard, Layers, Users } from 'lucide-react';
import { useApp } from '@/app/providers';
import type { WorkspaceSystemKey } from '@/lib/integrated-workspace-shared';

type BillingState = {
  billingEnforced: boolean;
  subscriptionStatus: string | null;
  planCode: string | null;
  maxSeats: number | null;
  licensedSystems: WorkspaceSystemKey[];
  stripeConnected: boolean;
};

export function BillingOverview({ companyId }: { companyId: string | null }) {
  const { locale } = useApp();
  const t = (pt: string, es: string, en: string) =>
    locale === 'pt' ? pt : locale === 'es' ? es : en;

  const [state, setState] = useState<BillingState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      setState(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetch(`/api/billing/subscription?companyId=${encodeURIComponent(companyId)}`, { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) {
          const d = (await r.json().catch(() => ({}))) as { error?: string };
          throw new Error(d.error || 'Failed');
        }
        return r.json();
      })
      .then((d: BillingState) => setState(d))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [companyId]);

  if (!companyId) {
    return (
      <p className="text-sm text-slate-500">
        {t('Selecione uma empresa.', 'Seleccione una empresa.', 'Select a company.')}
      </p>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
        {t('A carregar licenças…', 'Cargando licencias…', 'Loading licenses…')}
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (!state) return null;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            <CreditCard className="h-3.5 w-3.5" />
            {t('Plano', 'Plan', 'Plan')}
          </div>
          <p className="text-lg font-semibold text-slate-900">
            {state.planCode || t('Legado / manual', 'Legado / manual', 'Legacy / manual')}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {state.billingEnforced
              ? state.subscriptionStatus || '—'
              : t('Sem subscrição registada — todos os sistemas', 'Sin suscripción — todos los sistemas', 'No subscription — all systems')}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            <Layers className="h-3.5 w-3.5" />
            {t('Sistemas', 'Sistemas', 'Systems')}
          </div>
          <p className="text-sm font-medium text-slate-800">
            {state.licensedSystems.length > 0 ? state.licensedSystems.join(' · ') : '—'}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            <Users className="h-3.5 w-3.5" />
            {t('Lugares', 'Plazas', 'Seats')}
          </div>
          <p className="text-lg font-semibold text-slate-900">
            {state.maxSeats ?? t('Ilimitado', 'Ilimitado', 'Unlimited')}
          </p>
        </div>
      </div>
      <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        {state.stripeConnected
          ? t('Pagamentos ligados.', 'Pagos conectados.', 'Payments connected.')
          : t(
              'Contrate pacotes, sistemas, add-ons e regras de comissão. As faturas nascem no contrato; a renovação é automática.',
              'Contrate paquetes, sistemas, add-ons y reglas de comisión. Las facturas nacen al contratar; la renovación es automática.',
              'Hire packs, systems, add-ons, and commission rules. Invoices are created on contract; renewal is automatic.',
            )}
      </p>
      <Link
        href="/hub/billing"
        className="inline-flex items-center gap-1 text-sm font-medium text-teal-700 hover:underline"
      >
        {t('Abrir loja de licenças', 'Abrir tienda de licencias', 'Open license store')}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
