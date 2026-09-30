'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/app/providers';
import { isLikelyDbId } from '@/lib/utils';
import { CrmSubnav } from '@/components/fundhub/CrmSubnav';
import { ArrowRight, Building2, Handshake, Landmark, Loader2 } from 'lucide-react';

type NetworkSnap = {
  readinessPct: number;
  profile: { ready: boolean; orgKind: string | null; themes: number; countries: number };
  partners: number;
  funders: number;
  pipelineOpen: number;
  links: Array<{ from: string; to: string; pt: string; es: string; en: string; active: boolean }>;
};

export default function FundHubCrmDashboardPage() {
  const { locale, activeCompanyId } = useApp();
  const companyId = useMemo(() => {
    const s = String(activeCompanyId ?? '').trim();
    return isLikelyDbId(s) ? s : '';
  }, [activeCompanyId]);
  const t = (pt: string, es: string, en: string) =>
    locale === 'pt' ? pt : locale === 'es' ? es : en;

  const [snap, setSnap] = useState<NetworkSnap | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const r = await fetch(
        `/api/fundhub/network-snapshot?companyId=${encodeURIComponent(companyId)}`,
        { cache: 'no-store' },
      );
      if (r.ok) setSnap((await r.json()) as NetworkSnap);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!companyId) {
    return (
      <p className="p-6 text-sm text-gray-400">
        {t('Seleccione uma empresa.', 'Seleccione una empresa.', 'Select a company.')}
      </p>
    );
  }

  const pillars = [
    {
      href: '/hub/fundhub/crm/perfil',
      icon: Building2,
      title: t('Perfil institucional', 'Perfil institucional', 'Institutional profile'),
      value: snap
        ? snap.profile.ready
          ? t('Pronto', 'Listo', 'Ready')
          : t('Incompleto', 'Incompleto', 'Incomplete')
        : '—',
      sub: snap
        ? t(
            `${snap.profile.themes} temas · ${snap.profile.countries} países · readiness ${snap.readinessPct}%`,
            `${snap.profile.themes} temas · ${snap.profile.countries} países · readiness ${snap.readinessPct}%`,
            `${snap.profile.themes} themes · ${snap.profile.countries} countries · readiness ${snap.readinessPct}%`,
          )
        : '',
    },
    {
      href: '/hub/fundhub/crm/aliados',
      icon: Handshake,
      title: t('Aliados', 'Aliados', 'Allies'),
      value: snap ? String(snap.partners) : '—',
      sub: t('Sócios para co-postular', 'Socios para co-postular', 'Partners for co-application'),
    },
    {
      href: '/hub/fundhub/crm/donantes',
      icon: Landmark,
      title: t('Doadores / financiadores', 'Donantes / financiadores', 'Donors / funders'),
      value: snap ? String(snap.funders) : '—',
      sub: t(
        `${snap?.pipelineOpen ?? 0} em curso no pipeline`,
        `${snap?.pipelineOpen ?? 0} en curso en el pipeline`,
        `${snap?.pipelineOpen ?? 0} in pipeline`,
      ),
    },
  ];

  return (
    <div className="space-y-6 text-gray-100">
      <CrmSubnav active="dashboard" />
      <div>
        <h1 className="text-2xl font-bold text-white md:text-3xl">
          {t('Rede de captação', 'Red de captación', 'Capture network')}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-400">
          {t(
            'Como perfil, aliados e financiadores se ligam na prática — sem misturar tudo numa página só.',
            'Cómo perfil, aliados y financiadores se conectan en la práctica — sin mezclarlo todo en una sola página.',
            'How profile, allies, and funders connect in practice — without dumping everything on one page.',
          )}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          …
        </div>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-3">
            {pillars.map((p) => (
              <Link
                key={p.href}
                href={p.href}
                className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 transition hover:border-amber-500/40"
              >
                <div className="flex items-center gap-2 text-sm font-medium text-gray-300">
                  <p.icon className="h-4 w-4 text-amber-400" />
                  {p.title}
                </div>
                <p className="mt-2 text-2xl font-semibold text-white">{p.value}</p>
                <p className="mt-1 text-xs text-gray-500">{p.sub}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-amber-300">
                  {t('Abrir', 'Abrir', 'Open')}
                  <ArrowRight className="h-3 w-3" />
                </span>
              </Link>
            ))}
          </section>

          <section className="rounded-2xl border border-white/10 bg-slate-900/40 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-200/90">
              {t('Como se comunicam', 'Cómo se comunican', 'How they connect')}
            </h2>
            <ul className="mt-3 space-y-3">
              {(snap?.links ?? []).map((link) => (
                <li
                  key={`${link.from}-${link.to}`}
                  className={`rounded-xl border px-3 py-2.5 text-sm ${
                    link.active
                      ? 'border-emerald-500/30 bg-emerald-950/30 text-gray-200'
                      : 'border-white/10 bg-slate-950/40 text-gray-400'
                  }`}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    {link.from} → {link.to}
                    {link.active
                      ? ` · ${t('activo', 'activo', 'active')}`
                      : ` · ${t('ainda fraco', 'aún débil', 'still weak')}`}
                  </p>
                  <p className="mt-1">{t(link.pt, link.es, link.en)}</p>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
