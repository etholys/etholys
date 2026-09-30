'use client';

import { useCallback, useEffect, useState } from 'react';
import { useApp } from '@/app/providers';
import { isLikelyDbId } from '@/lib/utils';
import { HandCoins, Loader2, RefreshCw } from 'lucide-react';

type FeeEvent = {
  id: string;
  amountCents: number;
  baseAmountCents: number;
  currency: string;
  rateBps: number;
  status: string;
  createdAt: string;
  sourceId: string;
};

export function SuccessFeePanel() {
  const { locale, activeCompanyId } = useApp();
  const companyId = String(activeCompanyId ?? '').trim();
  const ok = isLikelyDbId(companyId);
  const t = (pt: string, es: string, en: string) =>
    locale === 'pt' ? pt : locale === 'es' ? es : en;

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [allowed, setAllowed] = useState(true);
  const [blockedReason, setBlockedReason] = useState<string | null>(null);
  const [entitlementActive, setEntitlementActive] = useState(false);
  const [rateBps, setRateBps] = useState<number | null>(null);
  const [events, setEvents] = useState<FeeEvent[]>([]);

  const load = useCallback(async () => {
    if (!ok) return;
    setLoading(true);
    try {
      const r = await fetch(
        `/api/fundhub/success-fees?companyId=${encodeURIComponent(companyId)}`,
        { cache: 'no-store' },
      );
      const d = (await r.json()) as {
        allowed?: boolean;
        blockedReason?: string | null;
        entitlementActive?: boolean;
        rateBps?: number | null;
        events?: FeeEvent[];
      };
      if (r.ok) {
        setAllowed(Boolean(d.allowed));
        setBlockedReason(d.blockedReason ?? null);
        setEntitlementActive(Boolean(d.entitlementActive));
        setRateBps(d.rateBps ?? null);
        setEvents(d.events ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [ok, companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const scan = async () => {
    if (!ok) return;
    setBusy(true);
    try {
      await fetch(`/api/fundhub/success-fees?companyId=${encodeURIComponent(companyId)}`, {
        method: 'POST',
      });
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (!ok) return null;

  return (
    <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <HandCoins className="h-5 w-5 text-amber-400" />
          <h2 className="text-base font-semibold text-white">
            {t('Success fee', 'Success fee', 'Success fee')}
          </h2>
        </div>
        <button
          type="button"
          disabled={busy || !allowed}
          onClick={() => void scan()}
          className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1 text-xs text-gray-200 hover:bg-white/5 disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {t('Sincronizar', 'Sincronizar', 'Sync')}
        </button>
      </div>
      <p className="mt-1 text-sm text-gray-400">
        {t(
          'Só consultoria privada. Contas públicas não acumulam comissão.',
          'Solo consultoría privada. Cuentas públicas no acumulan comisión.',
          'Private consulting only. Public accounts do not accrue commission.',
        )}
      </p>

      {loading ? (
        <p className="mt-3 text-sm text-gray-500">…</p>
      ) : !allowed ? (
        <p className="mt-3 rounded-lg bg-amber-950/40 px-3 py-2 text-sm text-amber-100">
          {blockedReason}
        </p>
      ) : (
        <div className="mt-3 space-y-2 text-sm text-gray-300">
          <p>
            {entitlementActive
              ? t(
                  `SKU activo · ${(rateBps ?? 0) / 100}%`,
                  `SKU activo · ${(rateBps ?? 0) / 100}%`,
                  `SKU active · ${(rateBps ?? 0) / 100}%`,
                )
              : t(
                  'SKU de comissão não activo nesta empresa.',
                  'SKU de comisión no activo en esta empresa.',
                  'Commission SKU not active for this company.',
                )}
          </p>
          <ul className="max-h-40 space-y-1 overflow-y-auto">
            {events.length === 0 ? (
              <li className="text-xs text-gray-500">
                {t('Sem eventos ainda.', 'Sin eventos aún.', 'No events yet.')}
              </li>
            ) : (
              events.map((e) => (
                <li
                  key={e.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/20 px-2.5 py-1.5 text-xs"
                >
                  <span>
                    {(e.amountCents / 100).toLocaleString()} {e.currency} · {e.status}
                  </span>
                  <span className="text-gray-500">
                    {new Date(e.createdAt).toLocaleDateString(
                      locale === 'pt' ? 'pt-PT' : locale === 'es' ? 'es-ES' : 'en-US',
                    )}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </section>
  );
}
