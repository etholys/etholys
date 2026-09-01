'use client';

import Link from 'next/link';
import { Building2, Headphones, Sparkles } from 'lucide-react';
import { useApp } from '@/app/providers';

type Props = {
  withNet: (path: string) => string;
  openAtCases?: number | null;
};

export function NexusModeChooser({ withNet, openAtCases }: Props) {
  const { locale } = useApp();
  const L = locale === 'es' || locale === 'en' ? locale : 'pt';

  const copy =
    L === 'es'
      ? {
          title: '¿Qué querés hacer ahora?',
          mineTitle: 'Mejorar mi empresa',
          mineBody: 'Diagnóstico, ruta y copiloto para la empresa activa.',
          mineCta: 'Continuar',
          deliverTitle: 'Prestar asistencia a clientes',
          deliverBody: 'Trabajo separado por cliente.',
          deliverCta: 'Abrir asistencia técnica',
        }
      : L === 'en'
        ? {
            title: 'What do you want to do now?',
            mineTitle: 'Improve my company',
            mineBody: 'Diagnosis, roadmap and copilot for the active company.',
            mineCta: 'Continue',
            deliverTitle: 'Support clients',
            deliverBody: 'Separate work per client.',
            deliverCta: 'Open technical assistance',
          }
        : {
            title: 'O que queres fazer agora?',
            mineTitle: 'Melhorar a minha empresa',
            mineBody: 'Diagnóstico, rota e copiloto para a empresa ativa.',
            mineCta: 'Continuar',
            deliverTitle: 'Prestar assistência a clientes',
            deliverBody: 'Trabalho separado por cliente.',
            deliverCta: 'Abrir assistência técnica',
          };

  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold text-slate-900">{copy.title}</h2>
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
    </div>
  );
}
