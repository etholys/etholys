'use client';

import Link from 'next/link';
import { Building2, Headphones, Sparkles } from 'lucide-react';
import { useApp } from '@/app/providers';

type Props = {
  withNet: (path: string) => string;
  /** Contagem rápida de casos AT abertos (opcional) */
  openAtCases?: number | null;
};

/**
 * Duas portas claras — evita misturar “melhorar a minha empresa” com “prestar AT a clientes”.
 */
export function NexusModeChooser({ withNet, openAtCases }: Props) {
  const { locale, activeCompanyId } = useApp();
  const L = locale === 'es' || locale === 'en' ? locale : 'pt';

  const copy =
    L === 'es'
      ? {
          title: '¿Qué querés hacer ahora?',
          mineTitle: 'Mejorar mi empresa',
          mineBody:
            'Diagnóstico, ruta y copiloto IA para la empresa activa. Es vuestro proceso interno de mejora continua — no es atención a terceros.',
          mineCta: 'Abrir copiloto y ruta',
          deliverTitle: 'Prestar AT a clientes',
          deliverBody:
            'Servicios → proyectos → empresas. Aquí atendéis MIPYMEs / contratos: filas, visitas, Meet y casos por cliente.',
          deliverCta: 'Abrir servicios y casos',
          tip: 'En el menú: «Mi empresa (con IA)» vs «AT a clientes». Son dos trabajos distintos.',
        }
      : L === 'en'
        ? {
            title: 'What do you want to do now?',
            mineTitle: 'Improve my company',
            mineBody:
              'Diagnosis, roadmap and AI copilot for the active company. Your internal continuous-improvement path — not client delivery.',
            mineCta: 'Open copilot & path',
            deliverTitle: 'Deliver AT to clients',
            deliverBody:
              'Services → projects → companies. Serve MIPYMEs / contracts: queues, visits, Meet and cases per client.',
            deliverCta: 'Open services & cases',
            tip: 'In the menu: “My company (with AI)” vs “Client AT delivery”. Two different jobs.',
          }
        : {
            title: 'O que queres fazer agora?',
            mineTitle: 'Melhorar a minha empresa',
            mineBody:
              'Diagnóstico, rota e copiloto IA para a empresa ativa. É o vosso processo interno de melhoria contínua — não é atendimento a terceiros.',
            mineCta: 'Abrir copiloto e rota',
            deliverTitle: 'Prestar AT a clientes',
            deliverBody:
              'Serviços → projetos → empresas. Aqui atendem MIPYMEs / contratos: filas, visitas, Meet e casos por cliente.',
            deliverCta: 'Abrir serviços e casos',
            tip: 'No menu: «A minha empresa (com IA)» vs «AT a clientes». São dois trabalhos diferentes.',
          };

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-slate-900">{copy.title}</h2>
        <p className="mt-1 text-xs text-slate-500">{copy.tip}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href={withNet('/hub/nexus/coach')}
          className="group flex flex-col rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-4 shadow-sm transition hover:border-violet-400 hover:shadow"
        >
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600 text-white">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="mt-3 text-sm font-semibold text-violet-950">{copy.mineTitle}</span>
          <span className="mt-1 flex-1 text-xs leading-relaxed text-slate-600">{copy.mineBody}</span>
          <span className="mt-3 text-xs font-semibold text-violet-700 group-hover:underline">{copy.mineCta} →</span>
        </Link>

        <Link
          href={withNet('/hub/nexus/at')}
          className="group flex flex-col rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-4 shadow-sm transition hover:border-emerald-400 hover:shadow"
        >
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-700 text-white">
            <Headphones className="h-4 w-4" />
          </span>
          <span className="mt-3 flex items-center gap-2 text-sm font-semibold text-emerald-950">
            {copy.deliverTitle}
            {typeof openAtCases === 'number' && openAtCases > 0 && (
              <span className="rounded-full bg-emerald-700 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {openAtCases}
              </span>
            )}
          </span>
          <span className="mt-1 flex-1 text-xs leading-relaxed text-slate-600">{copy.deliverBody}</span>
          <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 group-hover:underline">
            <Building2 className="h-3 w-3" />
            {copy.deliverCta} →
          </span>
        </Link>
      </div>
      {activeCompanyId && (
        <p className="text-[11px] text-slate-400">
          {L === 'es'
            ? 'La empresa del selector (arriba a la izquierda) es el contexto de «Mi empresa». En AT a clientes elegís servicio → proyecto → empresa-cliente.'
            : L === 'en'
              ? 'The company in the top-left selector is the “My company” context. In client AT you pick service → project → client company.'
              : 'A empresa do seletor (canto superior esquerdo) é o contexto de «A minha empresa». Em AT a clientes escolhes serviço → projeto → empresa-cliente.'}
        </p>
      )}
    </div>
  );
}
