'use client';

import Link from 'next/link';
import { Search, Lightbulb, ShieldCheck, Users, Trophy } from 'lucide-react';

const stats = [
  { label: 'Novos fundos', value: '12', description: 'Adicionados na última semana' },
  { label: 'Prazos próximos', value: '5', description: 'Editais com prazo em 14 dias' },
  { label: 'Propostas em rascunho', value: '8', description: 'Aguardando revisão' },
  { label: 'Compliance em revisão', value: '4', description: 'Checklists em progresso' },
];

const highlights = [
  { title: 'Prazo urgente', detail: 'Fundo rural com submissão em 10 dias', badge: 'Alta prioridade' },
  { title: 'Melhor potencial', detail: 'Edital ESG com alta compatibilidade', badge: 'Oportunidade' },
  { title: 'Parceria recomendada', detail: 'ONG local para edital social', badge: 'Parceiro' },
];

const actions = [
  { title: 'Descobrir oportunidades', description: 'Navegue por editais relevantes e salve os mais adequados.', href: '/hub/fundhub/discover', icon: Search },
  { title: 'Concluir proposta', description: 'Abra um rascunho e gere o texto base com IA.', href: '/hub/fundhub/proposals', icon: Lightbulb },
  { title: 'Ver compliance', description: 'Reveja checklist e prepare a documentação necessária.', href: '/hub/fundhub/compliance', icon: ShieldCheck },
  { title: 'Encontrar parceiros', description: 'Conecte-se com apoio jurídico e local.', href: '/hub/fundhub/partners', icon: Users },
];

export default function FundHubPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-gray-200 bg-white p-6 md:p-8 shadow-sm">
        <div className="grid gap-8 xl:grid-cols-[1.4fr_0.8fr] items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Visão geral</p>
            <h1 className="mt-3 text-3xl font-bold text-gray-900 md:text-4xl">Seu painel de captação</h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-gray-600">
              FundHub agora é um centro com fluxo claro: descubra oportunidades, salve seus melhores fundos, crie propostas com IA e acompanhe compliance e parceiros em um só lugar.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/hub/fundhub/discover"
                className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-700"
              >
                Explorar fundos
              </Link>
              <Link
                href="/hub/fundhub/proposals"
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Criar proposta
              </Link>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-lg border border-gray-200 bg-gray-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">{stat.label}</p>
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
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Prioridades</p>
                <h2 className="mt-2 text-xl font-semibold text-gray-900 md:text-2xl">O que precisa da sua atenção</h2>
              </div>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">Atualizado agora</span>
            </div>
            <div className="mt-6 space-y-3">
              {highlights.map((item) => (
                <div key={item.title} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                      <p className="mt-1 text-sm text-gray-600">{item.detail}</p>
                    </div>
                    <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-800 whitespace-nowrap">
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
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Fluxo de captura</p>
                <h2 className="mt-2 text-xl font-semibold text-gray-900 md:text-2xl">Próximos passos</h2>
              </div>
              <Trophy className="w-8 h-8 text-amber-500" />
            </div>
            <div className="mt-6 space-y-3">
              {actions.map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.title}
                    href={action.href}
                    className="flex items-start gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4 hover:bg-gray-100 transition"
                  >
                    <div className="rounded-lg bg-white p-2.5 shadow-sm border border-gray-100">
                      <Icon className="w-5 h-5 text-amber-600" />
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
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Navegação rápida</p>
            <div className="mt-4 space-y-2">
              <Link
                href="/hub/fundhub/discover"
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Buscar fundos
                <Search className="w-4 h-4 text-amber-600" />
              </Link>
              <Link
                href="/hub/fundhub/proposals"
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Criar proposta
                <Lightbulb className="w-4 h-4 text-amber-600" />
              </Link>
              <Link
                href="/hub/fundhub/compliance"
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Checklist de compliance
                <ShieldCheck className="w-4 h-4 text-amber-600" />
              </Link>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Resumo rápido</p>
            <ul className="mt-4 space-y-2 text-sm text-gray-600">
              <li className="rounded-lg border border-gray-100 bg-white px-4 py-3 shadow-sm">
                Use os filtros para separar fundos por tipo, categoria e país.
              </li>
              <li className="rounded-lg border border-gray-100 bg-white px-4 py-3 shadow-sm">
                Salve oportunidades promissoras e acompanhe no painel &quot;Meus Fundos&quot;.
              </li>
              <li className="rounded-lg border border-gray-100 bg-white px-4 py-3 shadow-sm">
                Crie propostas com IA e valide compliance antes de submeter.
              </li>
            </ul>
          </div>
        </aside>
      </section>
    </div>
  );
}
