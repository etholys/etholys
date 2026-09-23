'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/app/providers';
import { isLikelyDbId } from '@/lib/utils';
import { DeadlineAlertsPanel } from '@/components/opportunity/DeadlineAlertsPanel';
import { Search, Lightbulb, Heart, ArrowRight } from 'lucide-react';

export default function FundHubPage() {
  const { locale, activeCompanyId } = useApp();
  const companyId = useMemo(() => {
    const s = String(activeCompanyId ?? '').trim();
    return isLikelyDbId(s) ? s : '';
  }, [activeCompanyId]);

  const t = (pt: string, es: string, en: string) =>
    locale === 'pt' ? pt : locale === 'es' ? es : en;

  const [kpi, setKpi] = useState({
    newFundsWeek: 0,
    deadlinesSoon: 0,
    draftProposals: 0,
    complianceInProgress: 0,
  });

  const loadKpi = useCallback(async () => {
    if (!companyId) return;
    try {
      const r = await fetch(`/api/fundhub/overview?companyId=${encodeURIComponent(companyId)}`, {
        cache: 'no-store',
      });
      if (!r.ok) return;
      const d = (await r.json()) as { stats?: typeof kpi };
      if (d.stats) setKpi(d.stats);
    } catch {
      /* keep zeros */
    }
  }, [companyId]);

  useEffect(() => {
    void loadKpi();
  }, [loadKpi]);

  const steps = [
    {
      n: '1',
      title: t('Buscar', 'Buscar', 'Search'),
      detail: t('A IA encontra convocatórias. Você decide.', 'La IA encuentra convocatorias. Usted decide.', 'AI finds calls. You decide.'),
      href: '/hub/fundhub/discover',
      icon: Search,
      meta: kpi.newFundsWeek > 0 ? `${kpi.newFundsWeek}` : undefined,
    },
    {
      n: '2',
      title: t('Em curso', 'En curso', 'In progress'),
      detail: t('O que já guardou — prazos e próximos passos.', 'Lo que ya guardó — plazos y siguientes pasos.', 'What you saved — deadlines and next steps.'),
      href: '/hub/fundhub/my-funds',
      icon: Heart,
      meta: kpi.deadlinesSoon > 0 ? String(kpi.deadlinesSoon) : undefined,
    },
    {
      n: '3',
      title: t('Propostas', 'Propuestas', 'Proposals'),
      detail: t('Escrever e submeter a candidatura.', 'Escribir y enviar la candidatura.', 'Write and submit the application.'),
      href: '/hub/fundhub/proposals',
      icon: Lightbulb,
      meta: kpi.draftProposals > 0 ? String(kpi.draftProposals) : undefined,
    },
  ];

  return (
    <div className="space-y-6">
      <section className="etholys-site-rise overflow-hidden rounded-2xl border border-white/10 bg-[#0C1822]/80 p-6 md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-400/90">OPPORTUNITY</p>
        <h1 className="mt-3 font-[family-name:var(--font-etholys-display)] text-3xl font-semibold tracking-tight text-white md:text-4xl">
          {t('Buscar. Decidir. Candidatar.', 'Buscar. Decidir. Postular.', 'Search. Decide. Apply.')}
        </h1>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <DeadlineAlertsPanel variant="inline" />
          <Link
            href="/hub/fundhub/discover"
            className="inline-flex items-center gap-2 rounded-md bg-amber-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-amber-400"
          >
            <Search className="h-4 w-4" />
            {t('Começar a buscar', 'Empezar a buscar', 'Start searching')}
          </Link>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <Link
              key={step.href}
              href={step.href}
              className="group rounded-2xl border border-white/10 bg-[#0C1822]/70 p-5 transition hover:border-amber-400/30 hover:bg-white/[0.03]"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-white/35">{step.n}</span>
                {step.meta && (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-200">
                    {step.meta}
                  </span>
                )}
              </div>
              <div className="mt-3 flex items-center gap-2 text-amber-300">
                <Icon className="h-4 w-4" />
                <h2 className="font-[family-name:var(--font-etholys-display)] text-lg font-semibold text-white">
                  {step.title}
                </h2>
              </div>
              <p className="mt-2 text-sm text-white/45">{step.detail}</p>
              <p className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-white/35 group-hover:text-amber-300">
                {t('Abrir', 'Abrir', 'Open')}
                <ArrowRight className="h-3 w-3" />
              </p>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
