'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useApp } from '@/app/providers';
import { ETHOLYS_PRODUCTS } from '@/lib/etholys-products';

export function NexusModeChooser() {
  const { locale } = useApp();
  const L = locale === 'es' || locale === 'en' ? locale : 'pt';
  const products = [ETHOLYS_PRODUCTS.aurora, ETHOLYS_PRODUCTS.polaris, ETHOLYS_PRODUCTS.radar];

  return (
    <section className="relative overflow-hidden rounded-3xl bg-[#0c1222] text-white shadow-xl">
      <div className="relative px-6 py-10 sm:px-10 sm:py-14">
        <p className="text-xs font-semibold tracking-[0.2em] text-teal-300/90">ETHOLYS</p>
        <h1 className="mt-3 max-w-xl font-serif text-3xl leading-tight tracking-tight sm:text-4xl">
          {L === 'es'
            ? 'Tres productos. El NEXUS ya no es un solo menú.'
            : L === 'en'
              ? 'Three products. NEXUS is no longer one menu.'
              : 'Três produtos. O NEXUS deixou de ser um só menu.'}
        </h1>
        <div className="mt-10 grid gap-3 sm:grid-cols-3">
          {products.map((p) => (
            <Link
              key={p.id}
              href={p.href}
              className="group flex flex-col justify-between rounded-2xl border border-white/10 bg-white/5 px-5 py-5 transition hover:bg-white/10"
            >
              <div>
                <span className="text-sm font-semibold">{p.name}</span>
                <span className="mt-2 block text-xs text-slate-400">{p.tagline[L]}</span>
              </div>
              <ArrowRight className="mt-4 h-4 w-4 text-teal-300 transition group-hover:translate-x-1" />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
