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
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-bold text-slate-900">
            {t('Governança e aprovações', 'Gobernanza y aprobaciones', 'Governance & approvals')}
          </h1>
          <p className="mt-2 text-slate-600">
            {t(
              'CARTA é a camada transversal de governação: rastrea decisões e aprovações entre módulos, sem substituir fluxos legais ou assinaturas externas.',
              'CARTA es la capa transversal de gobernanza: rastrea decisiones y aprobaciones entre módulos, sin sustituir flujos legales ni firmas externas.',
              'CARTA is the cross-cutting governance layer: it tracks decisions and approvals across modules, without replacing legal workflows or external signatures.',
            )}
          </p>

          <ul className="mt-8 space-y-3">
            <li className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-800">
              <FileCheck className="h-5 w-5 shrink-0 text-slate-600" />
              <div>
                <p className="font-semibold">{t('Registo de decisões', 'Registro de decisiones', 'Decision log')}</p>
                <p className="mt-1 text-slate-600">
                  {t(
                    'Uma ação aprovada ou rejeitada com quem, quando, e ligação ao contexto (ex. orçamento, proposta) — para revisão interna e relatórios.',
                    'Una acción aprobada o rechazada con quién, cuándo y vínculo al contexto (ej. presupuesto, propuesta) — para revisión interna e informes.',
                    'An action approved or rejected with who, when, and a link to context (e.g. budget, proposal) — for internal review and reporting.',
                  )}
                </p>
              </div>
            </li>
            <li className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-800">
              <History className="h-5 w-5 shrink-0 text-slate-600" />
              <div>
                <p className="font-semibold">{t('Pontes entre módulos', 'Puentes entre módulos', 'Cross-module bridges')}</p>
                <p className="mt-1 text-slate-600">
                  {t(
                    'Aprovações ligadas a ATLAS, FUNDHUB, SIEP e outros sistemas contratados, com políticas por organização.',
                    'Aprobaciones vinculadas a ATLAS, FUNDHUB, SIEP y otros sistemas contratados, con políticas por organización.',
                    'Approvals linked to ATLAS, FUNDHUB, SIEP and other licensed systems, with per-organization policies.',
                  )}
                </p>
              </div>
            </li>
          </ul>

          <p className="mt-8 text-xs text-slate-500">
            {t(
              'CARTA não presta aconselhamento jurídico. O compliance mantém-se nos processos e instrumentos oficiais da organização.',
              'CARTA no ofrece asesoramiento legal. El cumplimiento sigue los procedimientos e instrumentos oficiales de la organización.',
              'CARTA is not legal advice. Compliance remains in the organization’s official processes and instruments.',
            )}
          </p>
        </div>
      </main>
    </div>
  );
}
