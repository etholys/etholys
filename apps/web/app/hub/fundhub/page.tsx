'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/app/providers';
import { isLikelyDbId } from '@/lib/utils';
import { DeadlineAlertsPanel } from '@/components/opportunity/DeadlineAlertsPanel';
import { Search, Lightbulb, ShieldCheck, Users, BadgeCheck, MapPin, ArrowRight } from 'lucide-react';

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
      // keep zeros
    }
  }, [companyId]);

  useEffect(() => {
    void loadKpi();
  }, [loadKpi]);

  const stats = [
    {
      label: t('Novos fundos', 'Nuevos fondos', 'New funds'),
      value: String(kpi.newFundsWeek),
      description: t('Adicionados na última semana', 'Añadidos la última semana', 'Added last week'),
    },
    {
      label: t('Prazos próximos', 'Plazos próximos', 'Upcoming deadlines'),
      value: String(kpi.deadlinesSoon),
      description: t('Editais em 14 dias', 'Convocatorias en 14 días', 'Calls within 14 days'),
    },
    {
      label: t('Propostas em rascunho', 'Borradores', 'Draft proposals'),
      value: String(kpi.draftProposals),
      description: t('Em elaboração', 'En elaboración', 'In progress'),
    },
    {
      label: t('Compliance', 'Compliance', 'Compliance'),
      value: String(kpi.complianceInProgress),
      description: t('Checklists registados', 'Checklists registrados', 'Saved checklists'),
    },
  ];

  const highlights = [
    ...(kpi.deadlinesSoon > 0
      ? [
          {
            title: t('Prazos próximos', 'Plazos próximos', 'Upcoming deadlines'),
            detail: t(
              `${kpi.deadlinesSoon} edital(is) nos próximos 14 dias`,
              `${kpi.deadlinesSoon} convocatoria(s) en los próximos 14 días`,
              `${kpi.deadlinesSoon} call(s) within 14 days`,
            ),
            badge: t('Atenção', 'Atención', 'Attention'),
          },
        ]
      : []),
    ...(kpi.draftProposals > 0
      ? [
          {
            title: t('Propostas em rascunho', 'Borradores', 'Draft proposals'),
            detail: t(
              `${kpi.draftProposals} proposta(s) por concluir`,
              `${kpi.draftProposals} propuesta(s) por completar`,
              `${kpi.draftProposals} proposal(s) to finish`,
            ),
            badge: t('Em curso', 'En curso', 'In progress'),
          },
        ]
      : []),
    ...(kpi.complianceInProgress > 0
      ? [
          {
            title: t('Compliance', 'Compliance', 'Compliance'),
            detail: t(
              `${kpi.complianceInProgress} checklist(s) em andamento`,
              `${kpi.complianceInProgress} checklist(s) en curso`,
              `${kpi.complianceInProgress} checklist(s) in progress`,
            ),
            badge: t('Revisar', 'Revisar', 'Review'),
          },
        ]
      : []),
  ];

  const actions = [
    {
      title: t('Perfil institucional', 'Perfil institucional', 'Institutional profile'),
      description: t(
        'Quem somos, o que entregamos e candidaturas em curso.',
        'Quiénes somos, qué entregamos y candidaturas en curso.',
        'Who you are, what you deliver, and active applications.',
      ),
      href: '/hub/fundhub/passport',
      icon: BadgeCheck,
    },
    {
      title: t('Procura territorial', 'Demanda territorial', 'Territory demand'),
      description: t('Onde há editais por país e sector.', 'Dónde hay convocatorias por país y sector.', 'Where calls cluster by country and sector.'),
      href: '/hub/fundhub/demand',
      icon: MapPin,
    },
    {
      title: t('Descobrir fundos', 'Descubrir fondos', 'Discover funds'),
      description: t('Briefing com IA, validação e catálogo vivo.', 'Briefing con IA, validación y catálogo vivo.', 'AI briefing, validation and living catalog.'),
      href: '/hub/fundhub/discover',
      icon: Search,
    },
    {
      title: t('Redigir proposta', 'Redactar propuesta', 'Write a proposal'),
      description: t('Abra um rascunho e gere texto base com IA.', 'Abra un borrador y genere texto con IA.', 'Open a draft and generate copy with AI.'),
      href: '/hub/fundhub/proposals',
      icon: Lightbulb,
    },
    {
      title: t('Compliance', 'Compliance', 'Compliance'),
      description: t('Checklist antes de submeter.', 'Checklist antes de enviar.', 'Checklist before submission.'),
      href: '/hub/fundhub/compliance',
      icon: ShieldCheck,
    },
    {
      title: t('Parceiros e coalizão', 'Socios y coalición', 'Partners and coalition'),
      description: t('Consórcio e rede local na mesma candidatura.', 'Consorcio y red local en la misma candidatura.', 'Consortium and local network on one application.'),
      href: '/hub/fundhub/partners',
      icon: Users,
    },
  ];

  return (
    <div className="space-y-6">
      <section className="etholys-site-rise overflow-hidden rounded-2xl border border-white/10 bg-[#0C1822]/80 p-6 shadow-[0_24px_80px_-40px_rgba(0,0,0,0.8)] backdrop-blur-sm md:p-8">
        <div className="grid items-start gap-8 xl:grid-cols-[1.4fr_0.8fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-400/90">
              FUNDHUB
            </p>
            <h1 className="mt-3 font-[family-name:var(--font-etholys-display)] text-3xl font-semibold leading-tight tracking-tight text-white md:text-4xl">
              {t('Captação de fundos, de ponta a ponta', 'Captación de fondos, de punta a punta', 'Fundraising, end to end')}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/55">
              {t(
                'Encontrar concursos, redigir propostas, cumprir requisitos e gerir o que já se administra — no mesmo sítio.',
                'Encontrar convocatorias, redactar propuestas, cumplir requisitos y gestionar lo que ya se administra.',
                'Find calls, write proposals, meet requirements and manage what you already administer.',
              )}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <DeadlineAlertsPanel variant="inline" />
              <Link
                href="/hub/fundhub/discover"
                className="inline-flex items-center gap-2 rounded-md bg-amber-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-amber-400"
              >
                <Search className="h-4 w-4" />
                {t('Descobrir fundos', 'Descubrir fondos', 'Discover funds')}
              </Link>
              <Link
                href="/hub/fundhub/proposals"
                className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-medium text-white/80 transition hover:border-white/30 hover:bg-white/10 hover:text-white"
              >
                {t('Abrir propostas', 'Abrir propuestas', 'Open proposals')}
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">{stat.label}</p>
                <p className="font-[family-name:var(--font-etholys-display)] text-3xl font-semibold text-white">{stat.value}</p>
                <p className="mt-2 text-xs text-white/40">{stat.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="etholys-site-rise grid gap-6 xl:grid-cols-[.8fr_1.2fr]" style={{ animationDelay: '120ms' }}>
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0C1822]/70 backdrop-blur-sm">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-400/90">
                {t('Prioridades', 'Prioridades', 'Priorities')}
              </p>
              <h2 className="mt-1 font-[family-name:var(--font-etholys-display)] text-lg font-semibold text-white">
                {t('O que precisa de atenção', 'Qué necesita atención', 'What needs attention')}
              </h2>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/45">
              {highlights.length > 0
                ? t('Com os seus dados', 'Según sus datos', 'From your data')
                : t('Sem alertas', 'Sin alertas', 'No alerts')}
            </span>
          </div>
          <div className="space-y-2 p-5">
            {highlights.length === 0 ? (
              <p className="rounded-lg border border-white/10 bg-white/[0.03] p-4 text-sm text-white/50">
                {t(
                  'Quando houver prazos, rascunhos ou checklists, aparecem aqui.',
                  'Cuando haya plazos, borradores o checklists, aparecerán aquí.',
                  'Deadlines, drafts and checklists will show up here.',
                )}
              </p>
            ) : (
              highlights.map((item) => (
                <div key={item.title} className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{item.title}</p>
                      <p className="mt-1 text-sm text-white/50">{item.detail}</p>
                    </div>
                    <span className="whitespace-nowrap rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-200">
                      {item.badge}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0C1822]/55 backdrop-blur-sm">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
                {t('Fluxo', 'Flujo', 'Flow')}
              </p>
              <h2 className="mt-1 font-[family-name:var(--font-etholys-display)] text-lg font-semibold text-white">
                {t('Por onde começar', 'Por dónde empezar', 'Where to start')}
              </h2>
            </div>
          </div>
          <div className="divide-y divide-white/[0.07]">
            {actions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.title}
                  href={action.href}
                  className="group flex items-start gap-4 px-5 py-4 transition hover:bg-white/[0.04]"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-amber-400/20 bg-amber-500/10 text-amber-300 transition group-hover:border-amber-400/40 group-hover:text-amber-200">
                    <Icon className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white">{action.title}</p>
                    <p className="mt-1 text-sm text-white/45">{action.description}</p>
                  </div>
                  <ArrowRight className="mt-2 h-4 w-4 shrink-0 text-white/20 transition group-hover:translate-x-0.5 group-hover:text-amber-300" />
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
