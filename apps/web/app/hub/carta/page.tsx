'use client';

import Link from 'next/link';
import { ArrowLeft, Scale, FileCheck, History } from 'lucide-react';
import { useApp } from '@/app/providers';

export default function CartaHubPage() {
  const { locale } = useApp();
  const t = (pt: string, es: string, en: string) => (locale === 'pt' ? pt : locale === 'es' ? es : en);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100/80 to-slate-50">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link
            href="/hub"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-800 hover:text-slate-600"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('Voltar ao Hub', 'Volver al Hub', 'Back to Hub')}
          </Link>
          <div className="flex items-center gap-2 text-slate-800">
            <Scale className="h-6 w-6" />
            <span className="font-bold tracking-tight">CARTA</span>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
              v0
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-bold text-slate-900">
            {t('Governança e aprovações (beta)', 'Gobernanza y aprobaciones (beta)', 'Governance & approvals (beta)')}
          </h1>
          <p className="mt-2 text-slate-600">
            {t(
              'CARTA é a camada transversal para decisões e trilho de auditoria mínima — sem substituir fluxos legais ou assinaturas externas. No MVP do beta, este ecrã fixa a promessa; fluxos concretos por módulo entram em ondas (Q1+).',
              'CARTA es la capa transversal de decisiones y trazabilidad m\u00ednima; los flujos por m\u00f3dulo entran en oleadas (Q1+).',
              'CARTA is the cross-cutting layer for decisions and a minimal audit trail — not a replacement for legal sign-off. For early beta, this page sets the product line; per-module flows roll in phases (Q1+).'
            )}
          </p>

          <ul className="mt-8 space-y-3">
            <li className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-800">
              <FileCheck className="h-5 w-5 shrink-0 text-slate-600" />
              <div>
                <p className="font-semibold">{t('O que v0 cobre (desenho)', 'Qu\u00e9 cubre v0 (dise\u00f1o)', 'What v0 covers (design)')}</p>
                <p className="mt-1 text-slate-600">
                  {t(
                    'Uma ação aprovada ou rejeitada com quem, quando, e ligação ao contexto (ex. orçamento, proposta) — pistas para relatórios e revisão interna.',
                    'Una acci\u00f3n aprobada o rechazada, qui\u00e9n, cu\u00e1ndo, y v\u00ednculo al contexto.',
                    'A single action approved or rejected with who, when, and link to context (e.g. budget, proposal) — internal review and report hooks.'
                  )}
                </p>
              </div>
            </li>
            <li className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-800">
              <History className="h-5 w-5 shrink-0 text-slate-600" />
              <div>
                <p className="font-semibold">{t('Iterações futuras', 'Iteraciones futuras', 'Later iterations')}</p>
                <p className="mt-1 text-slate-600">
                  {t(
                    'Múltiplos escalões, módulos (ATLAS, FUNDHUB, SIEP) e políticas por org — documentado em CARTA_V0 no repositório.',
                    'M\u00faltiples niveles, m\u00f3dulos y pol\u00edticas por org.',
                    'Multi-step approvals, module hooks (ATLAS, FUNDHUB, SIEP), and org policy — see CARTA_V0 in the repo.'
                  )}
                </p>
              </div>
            </li>
          </ul>

          <p className="mt-8 text-xs text-slate-500">
            {t(
              'CARTA não presta aconselhamento jurídico. Fluxos reais de compliance mantêm-se nos vossos processos e instrumentos oficiais.',
              'CARTA no ofrece asesoramiento legal. El cumplimiento sigue vuestros procedimientos oficiales.',
              'CARTA is not legal advice. Compliance remains in your own processes and official instruments.'
            )}
          </p>
        </div>
      </main>
    </div>
  );
}
