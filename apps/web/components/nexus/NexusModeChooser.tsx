'use client';

import Link from 'next/link';
import { ArrowRight, Headphones, Sparkles } from 'lucide-react';
import { useApp } from '@/app/providers';

type Props = {
  withNet: (path: string) => string;
  openAtCases?: number | null;
};

/**
 * Entrada NEXUS — uma composição, dois caminhos claros.
 * Sem grelha de cards genéricos.
 */
export function NexusModeChooser({ withNet, openAtCases }: Props) {
  const { locale } = useApp();
  const L = locale === 'es' || locale === 'en' ? locale : 'pt';

  const copy =
    L === 'es'
      ? {
          brand: 'NEXUS',
          line: 'Elegí el camino',
          mine: 'Autodesarrollo',
          mineHint: 'Tu módulo · cuaderno',
          deliver: 'Asistencia técnica',
          deliverHint: 'Clientes MIPYME',
        }
      : L === 'en'
        ? {
            brand: 'NEXUS',
            line: 'Choose your path',
            mine: 'Self-development',
            mineHint: 'Your module · field book',
            deliver: 'Technical assistance',
            deliverHint: 'MSME clients',
          }
        : {
            brand: 'NEXUS',
            line: 'Escolhe o caminho',
            mine: 'Autodesenvolvimento',
            mineHint: 'O teu módulo · caderno',
            deliver: 'Assistência técnica',
            deliverHint: 'Clientes MIPYME',
          };

  return (
    <section className="relative overflow-hidden rounded-3xl bg-[#0c1222] text-white shadow-xl">
      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 10% 20%, rgba(45,212,191,0.18), transparent 55%), radial-gradient(ellipse 70% 50% at 90% 80%, rgba(251,146,60,0.12), transparent 50%)',
        }}
      />
      <div className="relative px-6 py-10 sm:px-10 sm:py-14">
        <p className="text-xs font-semibold tracking-[0.2em] text-teal-300/90">{copy.brand}</p>
        <h1 className="mt-3 max-w-lg font-serif text-3xl leading-tight tracking-tight sm:text-4xl">
          {copy.line}
        </h1>

        <div className="mt-10 grid gap-3 sm:grid-cols-2">
          <Link
            href={withNet('/hub/nexus/campo')}
            className="group flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-5 py-5 backdrop-blur-sm transition duration-300 hover:border-teal-400/40 hover:bg-white/10"
          >
            <div className="min-w-0">
              <span className="flex items-center gap-2 text-sm font-semibold text-white">
                <Sparkles className="h-4 w-4 text-teal-300" />
                {copy.mine}
              </span>
              <span className="mt-1 block text-xs text-slate-400">{copy.mineHint}</span>
            </div>
            <ArrowRight className="h-5 w-5 shrink-0 text-teal-300 transition group-hover:translate-x-1" />
          </Link>

          <Link
            href={withNet('/hub/nexus/at')}
            className="group flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-5 py-5 backdrop-blur-sm transition duration-300 hover:border-orange-400/35 hover:bg-white/10"
          >
            <div className="min-w-0">
              <span className="flex items-center gap-2 text-sm font-semibold text-white">
                <Headphones className="h-4 w-4 text-orange-300" />
                {copy.deliver}
                {typeof openAtCases === 'number' && openAtCases > 0 && (
                  <span className="rounded-md bg-orange-500/90 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {openAtCases}
                  </span>
                )}
              </span>
              <span className="mt-1 block text-xs text-slate-400">{copy.deliverHint}</span>
            </div>
            <ArrowRight className="h-5 w-5 shrink-0 text-orange-300 transition group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </section>
  );
}
