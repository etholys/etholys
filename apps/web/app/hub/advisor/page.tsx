'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, BrainCircuit, ExternalLink } from 'lucide-react';
import { useApp } from '@/app/providers';
import { SystemAtmosphere } from '@/components/hub/SystemAtmosphere';
import { AppearanceToggle } from '@/components/hub/AppearanceToggle';
import { sysTheme } from '@/lib/system-shell';
import { isLikelyDbId } from '@/lib/utils';
import { StateLoading } from '@/components/ui/StateBlocks';

type Alert = {
  id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  read: boolean;
  link: string | null;
  createdAt: string;
};

/** Etholys Advisor — ferramenta de inteligência (não o Centro integrado). */
export default function HubAdvisorPage() {
  const { locale, activeCompanyId } = useApp();
  const companyId = useMemo(() => {
    const s = String(activeCompanyId ?? '').trim();
    return isLikelyDbId(s) ? s : '';
  }, [activeCompanyId]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const t = (pt: string, es: string, en: string) =>
    locale === 'pt' ? pt : locale === 'es' ? es : en;

  const load = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      setAlerts([]);
      return;
    }
    setLoading(true);
    try {
      const r = await fetch(
        `/api/workspace/overview?companyId=${encodeURIComponent(companyId)}`,
        { cache: 'no-store' }
      );
      if (!r.ok) {
        setAlerts([]);
        return;
      }
      const d = (await r.json()) as { advisor?: { alerts?: Alert[] } };
      setAlerts(Array.isArray(d.advisor?.alerts) ? d.advisor!.alerts! : []);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const markRead = async (id: string) => {
    if (!companyId) return;
    setBusy(id);
    try {
      const r = await fetch('/api/ai/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'read', companyId }),
      });
      if (r.ok) await load();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={sysTheme.root} data-accent="teal">
      <SystemAtmosphere accent="teal" />
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-8 sm:px-6">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/hub"
            className="inline-flex items-center gap-1 text-sm text-white/55 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Hub
          </Link>
          <AppearanceToggle collapsed className="!w-auto" />
        </div>

        <header className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-400/90">
            Etholys Tools
          </p>
          <h1 className="mt-2 flex items-center gap-3 font-[family-name:var(--font-etholys-display)] text-3xl font-semibold text-white">
            <span className={`flex h-10 w-10 items-center justify-center rounded-xl border ${sysTheme.icon.teal}`}>
              <BrainCircuit className="h-5 w-5" />
            </span>
            Advisor
          </h1>
          <p className="mt-3 max-w-xl text-sm text-white/55">
            {t(
              'Central de inteligência e conselhos institucionais. O trabalho multi-sistema continua no Centro integrado.',
              'Central de inteligencia y consejos institucionales. El trabajo multi-sistema sigue en el Centro integrado.',
              'Institutional intelligence and advice. Multi-system work stays in the Integrated workspace.',
            )}
          </p>
          <Link
            href="/hub/workspace"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-teal-300 hover:underline"
          >
            {t('Abrir Centro integrado', 'Abrir Centro integrado', 'Open Integrated workspace')}
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </header>

        {loading ? (
          <StateLoading />
        ) : !companyId ? (
          <p className="text-sm text-white/50">
            {t('Selecione uma empresa no Hub.', 'Seleccione una empresa en el Hub.', 'Select a company in the Hub.')}
          </p>
        ) : alerts.length === 0 ? (
          <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-8 text-center text-sm text-white/50">
            {t('Sem alertas activos.', 'Sin alertas activas.', 'No active alerts.')}
          </p>
        ) : (
          <ul className="space-y-2">
            {alerts.map((a) => (
              <li
                key={a.id}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-white/40">
                      {a.severity} · {a.type}
                    </p>
                    {a.link ? (
                      <Link href={a.link} className="mt-1 block text-sm font-semibold text-white hover:text-teal-200">
                        {a.title}
                      </Link>
                    ) : (
                      <p className="mt-1 text-sm font-semibold text-white">{a.title}</p>
                    )}
                    <p className="mt-1 text-sm text-white/55">{a.message}</p>
                  </div>
                  <button
                    type="button"
                    disabled={busy === a.id}
                    onClick={() => void markRead(a.id)}
                    className="shrink-0 rounded-lg border border-white/10 px-2.5 py-1 text-xs text-white/50 hover:bg-white/5 hover:text-white disabled:opacity-50"
                  >
                    {t('Marcar lida', 'Marcar leída', 'Mark read')}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
