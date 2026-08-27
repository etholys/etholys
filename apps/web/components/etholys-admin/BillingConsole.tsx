'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  CreditCard,
  Layers,
  Package,
  Percent,
  RefreshCw,
  Scale,
  Sparkles,
  FileText,
} from 'lucide-react';
import { useApp } from '@/app/providers';
import { formatCents } from '@/lib/billing/catalog';
import type { WorkspaceSystemKey } from '@/lib/integrated-workspace-shared';

type CatalogItem = {
  code: string;
  kind: 'plan' | 'system' | 'addon' | 'license' | 'commission';
  name: string;
  blurb: string;
  systems: WorkspaceSystemKey[];
  requiresSystems: WorkspaceSystemKey[];
  interval: string;
  selfServe: boolean;
  commissionBps: number | null;
  contracted: boolean;
  priceMonthlyCents: number | null;
  priceYearlyCents: number | null;
  currency: string;
};

type Invoice = {
  id: string;
  number: string;
  kind: string;
  status: string;
  totalCents: number;
  currency: string;
  dueDate: string | null;
  paidAt: string | null;
  createdAt: string;
  lines: { skuCode: string; description: string; amountCents: number }[];
};

type CommissionEvent = {
  id: string;
  skuCode: string;
  sourceType: string;
  sourceId: string;
  baseAmountCents: number;
  rateBps: number;
  amountCents: number;
  status: string;
  createdAt: string;
};

type Snapshot = {
  billingEnforced: boolean;
  subscriptionStatus: string | null;
  planCode: string | null;
  maxSeats: number | null;
  seatsUsed: number;
  interval: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  licensedSystems: WorkspaceSystemKey[];
  addOnCodes: string[];
  commissionCodes: string[];
  licenseCodes: string[];
  invoices: Invoice[];
  commissions: CommissionEvent[];
  stripeConnected: boolean;
};

type Tab = 'plans' | 'addons' | 'licenses' | 'commissions' | 'invoices';

export function BillingConsole({ companyId }: { companyId: string }) {
  const { locale } = useApp();
  const search = useSearchParams();
  const highlight = search.get('sku')?.trim() || '';
  const t = (pt: string, es: string, en: string) => (locale === 'pt' ? pt : locale === 'es' ? es : en);
  const loc = locale === 'pt' ? 'pt' : locale === 'es' ? 'es' : 'en';

  const [tab, setTab] = useState<Tab>('plans');
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [interval, setIntervalChoice] = useState<'MONTH' | 'YEAR'>('MONTH');
  const [manualAmount, setManualAmount] = useState('10000');
  const [manualSku, setManualSku] = useState('commission.fundhub.success_fee');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cRes, sRes] = await Promise.all([
        fetch(`/api/billing/catalog?companyId=${encodeURIComponent(companyId)}&locale=${encodeURIComponent(locale)}`, {
          cache: 'no-store',
        }),
        fetch(`/api/billing/subscription?companyId=${encodeURIComponent(companyId)}`, { cache: 'no-store' }),
      ]);
      const cJson = (await cRes.json()) as { items?: CatalogItem[]; error?: string };
      const sJson = (await sRes.json()) as Snapshot & { error?: string };
      if (!cRes.ok) throw new Error(cJson.error || 'Catálogo');
      if (!sRes.ok) throw new Error(sJson.error || 'Subscrição');
      setCatalog(cJson.items ?? []);
      setSnap(sJson);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      setLoading(false);
    }
  }, [companyId, locale]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!highlight) return;
    const item = catalog.find((i) => i.code === highlight);
    if (!item) return;
    if (item.kind === 'addon') setTab('addons');
    else if (item.kind === 'license') setTab('licenses');
    else if (item.kind === 'commission') setTab('commissions');
    else setTab('plans');
  }, [highlight, catalog]);

  async function contract(skuCode: string) {
    setBusy(skuCode);
    setError(null);
    try {
      const r = await fetch('/api/billing/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, skuCode, interval, action: 'contract' }),
      });
      const d = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(d.error || 'Falha');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(null);
    }
  }

  async function cancel(skuCode: string) {
    setBusy(skuCode);
    setError(null);
    try {
      const r = await fetch('/api/billing/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, skuCode, action: 'cancel' }),
      });
      const d = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(d.error || 'Falha');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(null);
    }
  }

  async function payInvoice(invoiceId: string) {
    setBusy(invoiceId);
    setError(null);
    try {
      const r = await fetch('/api/billing/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, invoiceId }),
      });
      const d = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(d.error || 'Falha');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(null);
    }
  }

  async function commissionAction(action: 'scan' | 'invoice') {
    setBusy(action);
    setError(null);
    try {
      const r = await fetch('/api/billing/commissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, action }),
      });
      const d = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(d.error || 'Falha');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(null);
    }
  }

  async function accrueManual() {
    setBusy('accrue');
    setError(null);
    try {
      const base = Math.round(Number(manualAmount) * 100);
      const r = await fetch('/api/billing/commissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          action: 'accrue',
          skuCode: manualSku,
          sourceType: 'MANUAL',
          sourceId: `manual-${Date.now()}`,
          baseAmountCents: base,
        }),
      });
      const d = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(d.error || 'Falha');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(null);
    }
  }

  const byKind = useMemo(() => {
    const g = (k: CatalogItem['kind']) => catalog.filter((i) => i.kind === k);
    return { plan: g('plan'), system: g('system'), addon: g('addon'), license: g('license'), commission: g('commission') };
  }, [catalog]);

  const tabs: { id: Tab; label: string; icon: typeof Layers }[] = [
    { id: 'plans', label: t('Planos e sistemas', 'Planes y sistemas', 'Plans & systems'), icon: Layers },
    { id: 'addons', label: t('Add-ons', 'Add-ons', 'Add-ons'), icon: Sparkles },
    { id: 'licenses', label: t('Licenciamento', 'Licenciamiento', 'Licensing'), icon: Scale },
    { id: 'commissions', label: t('Comissões', 'Comisiones', 'Commissions'), icon: Percent },
    { id: 'invoices', label: t('Faturas', 'Facturas', 'Invoices'), icon: FileText },
  ];

  function priceLabel(item: CatalogItem) {
    if (item.kind === 'commission') {
      return item.commissionBps != null ? `${item.commissionBps / 100}%` : '—';
    }
    const cents = interval === 'YEAR' ? item.priceYearlyCents : item.priceMonthlyCents;
    if (cents == null) return '—';
    const money = formatCents(cents, item.currency, loc);
    return interval === 'YEAR' ? `${money}/${t('ano', 'año', 'yr')}` : `${money}/${t('mês', 'mes', 'mo')}`;
  }

  function SkuCard({ item }: { item: CatalogItem }) {
    const missing = item.requiresSystems.filter((s) => !(snap?.licensedSystems ?? []).includes(s));
    const blocked = missing.length > 0;
    const highlighted = highlight === item.code;
    return (
      <div
        className={`flex flex-col rounded-xl border bg-white p-4 ${
          highlighted ? 'border-teal-500 ring-2 ring-teal-200' : 'border-slate-200'
        }`}
      >
        <div className="mb-2 flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">{item.name}</h3>
          {item.contracted ? (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">
              {t('Activo', 'Activo', 'Active')}
            </span>
          ) : !item.selfServe ? (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-800">
              {t('Sob consulta', 'Bajo consulta', 'On request')}
            </span>
          ) : null}
        </div>
        <p className="mb-3 flex-1 text-sm text-slate-600">{item.blurb}</p>
        {item.systems.length > 0 && (
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">{item.systems.join(' · ')}</p>
        )}
        <p className="mb-3 text-base font-semibold text-slate-900">{priceLabel(item)}</p>
        {blocked && (
          <p className="mb-2 text-xs text-amber-700">
            {t('Requer', 'Requiere', 'Requires')}: {missing.join(', ')}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {item.contracted ? (
            item.kind !== 'system' && item.kind !== 'plan' ? (
              <button
                type="button"
                disabled={busy === item.code}
                onClick={() => void cancel(item.code)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                {t('Cancelar no fim do período', 'Cancelar al fin del período', 'Cancel at period end')}
              </button>
            ) : (
              <span className="text-xs text-slate-500">{t('Incluído na licença', 'Incluido en la licencia', 'Included in license')}</span>
            )
          ) : (
            <button
              type="button"
              disabled={busy === item.code || blocked || !item.selfServe}
              onClick={() => void contract(item.code)}
              className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
            >
              {busy === item.code
                ? t('A contratar…', 'Contratando…', 'Hiring…')
                : t('Contratar', 'Contratar', 'Subscribe')}
            </button>
          )}
        </div>
      </div>
    );
  }

  if (loading && !snap) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <RefreshCw className="h-4 w-4 animate-spin" />
        {t('A carregar faturação…', 'Cargando facturación…', 'Loading billing…')}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
            <CreditCard className="h-3.5 w-3.5" />
            {t('Plano', 'Plan', 'Plan')}
          </p>
          <p className="text-lg font-semibold text-slate-900">{snap?.planCode || t('À la carte / legado', 'A la carta / legado', 'À la carte / legacy')}</p>
          <p className="mt-1 text-xs text-slate-500">
            {snap?.billingEnforced
              ? `${snap.subscriptionStatus || '—'} · ${snap.interval || 'MONTH'}`
              : t('Ainda sem contrato — todos os sistemas abertos', 'Aún sin contrato — todos los sistemas abiertos', 'No contract yet — all systems open')}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
            <Package className="h-3.5 w-3.5" />
            {t('Sistemas', 'Sistemas', 'Systems')}
          </p>
          <p className="text-sm font-medium text-slate-800">{snap?.licensedSystems.join(' · ') || '—'}</p>
          {snap?.currentPeriodEnd && (
            <p className="mt-1 text-xs text-slate-500">
              {t('Próxima renovação', 'Próxima renovación', 'Next renewal')}:{' '}
              {new Date(snap.currentPeriodEnd).toLocaleDateString(locale === 'pt' ? 'pt-PT' : locale === 'es' ? 'es-ES' : 'en-US')}
            </p>
          )}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">{t('Lugares', 'Plazas', 'Seats')}</p>
          <p className="text-lg font-semibold text-slate-900">
            {snap?.seatsUsed ?? 0}
            {snap?.maxSeats ? ` / ${snap.maxSeats}` : ` · ${t('ilimitado', 'ilimitado', 'unlimited')}`}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
          {tabs.map((tb) => {
            const Icon = tb.icon;
            return (
              <button
                key={tb.id}
                type="button"
                onClick={() => setTab(tb.id)}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium ${
                  tab === tb.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tb.label}
              </button>
            );
          })}
        </div>
        {tab !== 'invoices' && tab !== 'commissions' && (
          <label className="flex items-center gap-2 text-xs text-slate-600">
            {t('Ciclo', 'Ciclo', 'Cycle')}
            <select
              value={interval}
              onChange={(e) => setIntervalChoice(e.target.value as 'MONTH' | 'YEAR')}
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
            >
              <option value="MONTH">{t('Mensal', 'Mensual', 'Monthly')}</option>
              <option value="YEAR">{t('Anual (−2 meses)', 'Anual (−2 meses)', 'Yearly (−2 months)')}</option>
            </select>
          </label>
        )}
      </div>

      {tab === 'plans' && (
        <div className="space-y-6">
          <section>
            <h2 className="mb-3 text-sm font-semibold text-slate-800">{t('Pacotes', 'Paquetes', 'Packs')}</h2>
            <div className="grid gap-3 md:grid-cols-2">{byKind.plan.map((item) => <SkuCard key={item.code} item={item} />)}</div>
          </section>
          <section>
            <h2 className="mb-3 text-sm font-semibold text-slate-800">{t('Sistemas à la carte', 'Sistemas a la carta', 'À-la-carte systems')}</h2>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {byKind.system.map((item) => (
                <SkuCard key={item.code} item={item} />
              ))}
            </div>
          </section>
        </div>
      )}

      {tab === 'addons' && (
        <div className="grid gap-3 md:grid-cols-2">
          {byKind.addon.map((item) => (
            <SkuCard key={item.code} item={item} />
          ))}
        </div>
      )}

      {tab === 'licenses' && (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            {t(
              'Licença anual gera uma fatura do período e renova sozinha até cancelar. White label é cotação Etholys.',
              'La licencia anual genera una factura del período y se renueva sola hasta cancelar. White label es cotización Etholys.',
              'An annual license invoices the term and auto-renews until cancelled. White-label is quoted by Etholys.',
            )}
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {byKind.license.map((item) => (
              <SkuCard key={item.code} item={item} />
            ))}
          </div>
        </div>
      )}

      {tab === 'commissions' && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            {t(
              'Active a regra nos produtos que cobram comissão. Depois acumule eventos (FUNDHUB: propostas ganhas) e gere a fatura.',
              'Active la regla en los productos que cobran comisión. Luego acumule eventos (FUNDHUB: propuestas ganadas) y genere la factura.',
              'Enable the rule on products that charge commission. Then accrue events (FUNDHUB: won proposals) and issue the invoice.',
            )}
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {byKind.commission.map((item) => (
              <SkuCard key={item.code} item={item} />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy === 'scan'}
              onClick={() => void commissionAction('scan')}
              className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-900 disabled:opacity-50"
            >
              {t('Varrer propostas FUNDHUB', 'Escanear propuestas FUNDHUB', 'Scan FUNDHUB proposals')}
            </button>
            <button
              type="button"
              disabled={busy === 'invoice'}
              onClick={() => void commissionAction('invoice')}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
            >
              {t('Faturar comissões acumuladas', 'Facturar comisiones acumuladas', 'Invoice accrued commissions')}
            </button>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              {t('Lançamento manual', 'Lanzamiento manual', 'Manual accrual')}
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-xs text-slate-600">
                SKU
                <select
                  value={manualSku}
                  onChange={(e) => setManualSku(e.target.value)}
                  className="mt-1 block rounded-md border border-slate-200 px-2 py-1"
                >
                  {byKind.commission.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-slate-600">
                {t('Base (USD)', 'Base (USD)', 'Base (USD)')}
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={manualAmount}
                  onChange={(e) => setManualAmount(e.target.value)}
                  className="mt-1 block w-32 rounded-md border border-slate-200 px-2 py-1"
                />
              </label>
              <button
                type="button"
                disabled={busy === 'accrue'}
                onClick={() => void accrueManual()}
                className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
              >
                {t('Acumular', 'Acumular', 'Accrue')}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">SKU</th>
                  <th className="px-3 py-2">{t('Origem', 'Origen', 'Source')}</th>
                  <th className="px-3 py-2">{t('Base', 'Base', 'Base')}</th>
                  <th className="px-3 py-2">%</th>
                  <th className="px-3 py-2">{t('Comissão', 'Comisión', 'Fee')}</th>
                  <th className="px-3 py-2">{t('Estado', 'Estado', 'Status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(snap?.commissions ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-4 text-slate-500">
                      {t('Nenhuma comissão acumulada.', 'Ninguna comisión acumulada.', 'No accrued commissions.')}
                    </td>
                  </tr>
                ) : (
                  (snap?.commissions ?? []).map((c) => (
                    <tr key={c.id}>
                      <td className="px-3 py-2 font-mono text-xs">{c.skuCode}</td>
                      <td className="px-3 py-2 text-xs">
                        {c.sourceType} · {c.sourceId.slice(0, 10)}
                      </td>
                      <td className="px-3 py-2">{formatCents(c.baseAmountCents, 'USD', loc)}</td>
                      <td className="px-3 py-2">{c.rateBps / 100}%</td>
                      <td className="px-3 py-2 font-medium">{formatCents(c.amountCents, 'USD', loc)}</td>
                      <td className="px-3 py-2 text-xs">{c.status}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'invoices' && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">{t('Tipo', 'Tipo', 'Kind')}</th>
                <th className="px-3 py-2">{t('Total', 'Total', 'Total')}</th>
                <th className="px-3 py-2">{t('Vencimento', 'Vencimiento', 'Due')}</th>
                <th className="px-3 py-2">{t('Estado', 'Estado', 'Status')}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(snap?.invoices ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-slate-500">
                    {t('Ainda sem faturas Etholys.', 'Aún sin facturas Etholys.', 'No Etholys invoices yet.')}
                  </td>
                </tr>
              ) : (
                (snap?.invoices ?? []).map((inv) => (
                  <tr key={inv.id}>
                    <td className="px-3 py-2 font-medium">{inv.number}</td>
                    <td className="px-3 py-2 text-xs">{inv.kind}</td>
                    <td className="px-3 py-2">{formatCents(inv.totalCents, inv.currency || 'USD', loc)}</td>
                    <td className="px-3 py-2 text-xs">
                      {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          inv.status === 'PAID'
                            ? 'bg-emerald-50 text-emerald-700'
                            : inv.status === 'VOID'
                              ? 'bg-slate-100 text-slate-500'
                              : 'bg-amber-50 text-amber-800'
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {inv.status === 'ISSUED' && (
                        <button
                          type="button"
                          disabled={busy === inv.id}
                          onClick={() => void payInvoice(inv.id)}
                          className="text-xs font-medium text-teal-700 hover:underline disabled:opacity-50"
                        >
                          {t('Marcar paga', 'Marcar pagada', 'Mark paid')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-slate-500">
        {t(
          'Checkout Stripe entra a seguir: as faturas já nascem no contrato e a renovação corre em /api/billing/renew. Preços de lista — cotações institucionais podem ser ajustadas.',
          'Checkout Stripe entra después: las facturas ya nacen al contratar y la renovación corre en /api/billing/renew. Precios de lista — cotizaciones institucionales se pueden ajustar.',
          'Stripe checkout comes next: invoices are created on contract and renewal runs at /api/billing/renew. List prices — institutional quotes can be adjusted.',
        )}
      </p>
    </div>
  );
}
