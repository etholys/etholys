'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/app/providers';
import { isLikelyDbId } from '@/lib/utils';
import { DeadlineAlertsPanel } from '@/components/opportunity/DeadlineAlertsPanel';
import { Search, Lightbulb, ShieldCheck, Users, Trophy, BadgeCheck, MapPin } from 'lucide-react';

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
      description: t('Na base de dados', 'En base de datos', 'In database'),
    },
    {
      label: t('Compliance', 'Compliance', 'Compliance'),
      value: String(kpi.complianceInProgress),
      description: t('Checklists registados', 'Checklists registrados', 'Saved checklists'),
    },
  ];

  const highlights = [
    {
      title: t('Prazo urgente', 'Plazo urgente', 'Urgent deadline'),
      detail: t('Fundo rural com submissão em 10 dias', 'Fondo rural con envío en 10 días', 'Rural fund due in 10 days'),
      badge: t('Alta prioridade', 'Alta prioridad', 'High priority'),
    },
    {
      title: t('Melhor potencial', 'Mejor potencial', 'Best fit'),
      detail: t('Edital ESG com alta compatibilidade', 'Convocatoria ESG con alta compatibilidad', 'ESG call with strong match'),
      badge: t('Oportunidade', 'Oportunidad', 'Opportunity'),
    },
    {
      title: t('Parceria recomendada', 'Alianza recomendada', 'Recommended partner'),
      detail: t('ONG local para edital social', 'ONG local para convocatoria social', 'Local NGO for social call'),
      badge: t('Parceiro', 'Socio', 'Partner'),
    },
  ];

  const actions = [
    {
      title: t('Perfil institucional', 'Perfil institucional', 'Institutional profile'),
      description: t(
        'Resumo da organização para financiadores: quem somos, o que entregamos e candidaturas em curso.',
        'Resumen de la organización para financiadores: quiénes somos, qué entregamos y candidaturas en curso.',
        'Organization summary for funders: who you are, what you deliver, and active applications.',
      ),
      href: '/hub/fundhub/passport',
      icon: BadgeCheck,
    },
    {
      title: t('Procura territorial', 'Demanda territorial', 'Territory demand'),
      description: t('Onde há editais por país e sector no seu portfólio.', 'Dónde hay convocatorias por país y sector.', 'Where calls cluster by country and sector.'),
      href: '/hub/fundhub/demand',
      icon: MapPin,
    },
    {
      title: t('Varredura de oportunidades', 'Barrido de oportunidades', 'Opportunity scan'),
      description: t('Briefing com IA, validação de candidatos e catálogo vivo.', 'Briefing con IA, validación y catálogo vivo.', 'AI briefing, candidate validation, living catalog.'),
      href: '/hub/fundhub/discover',
      icon: Search,
    },
    {
      title: t('Concluir proposta', 'Completar propuesta', 'Finish a proposal'),
      description: t('Abra um rascunho e gere texto base com IA.', 'Abra un borrador y genere texto con IA.', 'Open a draft and generate copy with AI.'),
      href: '/hub/fundhub/proposals',
      icon: Lightbulb,
    },
    {
      title: t('Ver compliance', 'Ver compliance', 'View compliance'),
      description: t('Checklist e documentação antes de submeter.', 'Checklist y documentación antes de enviar.', 'Checklist and docs before submission.'),
      href: '/hub/fundhub/compliance',
      icon: ShieldCheck,
    },
    {
      title: t('Coalizão de candidatura', 'Coalición de candidatura', 'Application coalition'),
      description: t('Consórcio multi-organização na mesma proposta.', 'Consorcio multi-organización en la misma propuesta.', 'Multi-org consortium on one application.'),
      href: '/hub/fundhub/coalition',
      icon: Users,
    },
    {
      title: t('Encontrar parceiros', 'Encontrar socios', 'Find partners'),
      description: t('Rede local e apoio jurídico para candidaturas.', 'Red local y apoyo jurídico para candidaturas.', 'Local network and legal support for applications.'),
      href: '/hub/fundhub/partners',
      icon: Users,
    },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-gray-200 bg-white p-6 md:p-8 shadow-sm">
        <div className="grid items-start gap-8 xl:grid-cols-[1.4fr_0.8fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              {t('Captação e rede', 'Captación y red', 'Funding & network')}
            </p>
            <h1 className="mt-3 text-3xl font-bold text-gray-900 md:text-4xl">
              {t('O seu painel de oportunidades', 'Su panel de oportunidades', 'Your opportunity cockpit')}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-gray-600">
              {t(
                'FUNDHUB une descoberta, propostas com IA, compliance, parceiros e perfil institucional para financiadores — execução real, não só busca de editais.',
                'FUNDHUB une descubrimiento, propuestas con IA, compliance, socios y perfil institucional — ejecución real, no solo búsqueda.',
                'FUNDHUB combines discovery, AI proposals, compliance, partners, and an institutional profile for funders — real delivery, not just grant search.',
              )}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <DeadlineAlertsPanel variant="inline" />
              <Link
                href="/hub/fundhub/passport"
                className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-700"
              >
                <BadgeCheck className="h-4 w-4" />
                {t('Ver perfil', 'Ver perfil', 'View profile')}
              </Link>
              <Link
                href="/hub/fundhub/discover"
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                {t('Explorar fundos', 'Explorar fondos', 'Explore funds')}
              </Link>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-lg border border-gray-200 bg-gray-50 p-5">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{stat.label}</p>
                <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                <p className="mt-2 text-sm text-gray-600">{stat.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[.75fr_1fr]">
        <div className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                  {t('Prioridades', 'Prioridades', 'Priorities')}
                </p>
                <h2 className="mt-2 text-xl font-semibold text-gray-900 md:text-2xl">
                  {t('O que precisa da sua atenção', 'Qué necesita su atención', 'What needs your attention')}
                </h2>
              </div>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                {t('Actualizado', 'Actualizado', 'Updated')}
              </span>
            </div>
            <div className="mt-6 space-y-3">
              {highlights.map((item) => (
                <div key={item.title} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                      <p className="mt-1 text-sm text-gray-600">{item.detail}</p>
                    </div>
                    <span className="whitespace-nowrap rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-800">
                      {item.badge}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {t('Fluxo de captação', 'Flujo de captación', 'Funding flow')}
                </p>
                <h2 className="mt-2 text-xl font-semibold text-gray-900 md:text-2xl">
                  {t('Próximos passos', 'Próximos pasos', 'Next steps')}
                </h2>
              </div>
              <Trophy className="h-8 w-8 text-amber-500" />
            </div>
            <div className="mt-6 space-y-3">
              {actions.map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.title}
                    href={action.href}
                    className="flex items-start gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4 transition hover:bg-gray-100"
                  >
                    <div className="rounded-lg border border-gray-100 bg-white p-2.5 shadow-sm">
                      <Icon className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{action.title}</p>
                      <p className="mt-1 text-sm text-gray-600">{action.description}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
              {t('Diferencial FUNDHUB', 'Diferencial FUNDHUB', 'FUNDHUB edge')}
            </p>
            <ul className="mt-4 space-y-2 text-sm text-amber-950">
              <li>• {t('Perfil institucional (dados SIEP + pipeline)', 'Perfil institucional (datos SIEP + pipeline)', 'Institutional profile (SIEP data + pipeline)')}</li>
              <li>• {t('Propostas com contexto da organização', 'Propuestas con contexto organizacional', 'Proposals with org context')}</li>
              <li>• {t('Parceiros e compliance no mesmo fluxo', 'Socios y compliance en el mismo flujo', 'Partners and compliance in one flow')}</li>
            </ul>
            <Link href="/hub/fundhub/passport" className="mt-4 inline-flex text-sm font-semibold text-amber-900 hover:underline">
              {t('Abrir perfil →', 'Abrir perfil →', 'Open profile →')}
            </Link>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              {t('Navegação rápida', 'Navegación rápida', 'Quick links')}
            </p>
            <div className="mt-4 space-y-2">
              <Link
                href="/hub/fundhub/passport"
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                {t('Perfil institucional', 'Perfil institucional', 'Institutional profile')}
                <BadgeCheck className="h-4 w-4 text-amber-600" />
              </Link>
              <Link
                href="/hub/fundhub/discover"
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                {t('Buscar fundos', 'Buscar fondos', 'Search funds')}
                <Search className="h-4 w-4 text-amber-600" />
              </Link>
              <Link
                href="/hub/fundhub/proposals"
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                {t('Criar proposta', 'Crear propuesta', 'Create proposal')}
                <Lightbulb className="h-4 w-4 text-amber-600" />
              </Link>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
