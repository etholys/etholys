'use client';

import Link from 'next/link';
import { useApp } from '@/app/providers';
import { ArrowLeft } from 'lucide-react';

const SUBS = [
  { href: '/hub/fundhub/crm/perfil', pt: 'Perfil institucional', es: 'Perfil institucional', en: 'Institutional profile' },
  { href: '/hub/fundhub/crm/aliados', pt: 'Aliados', es: 'Aliados', en: 'Allies' },
  { href: '/hub/fundhub/crm/donantes', pt: 'Doadores / financiadores', es: 'Donantes / financiadores', en: 'Donors / funders' },
] as const;

export function CrmSubnav({ active }: { active: 'dashboard' | 'perfil' | 'aliados' | 'donantes' }) {
  const { locale } = useApp();
  const t = (pt: string, es: string, en: string) =>
    locale === 'pt' ? pt : locale === 'es' ? es : en;

  return (
    <div className="space-y-3">
      <Link
        href="/hub/fundhub/crm"
        className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-100"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('Rede', 'Red', 'Network')}
      </Link>
      <nav className="flex flex-wrap gap-1 border-b border-white/10 pb-px">
        <Link
          href="/hub/fundhub/crm"
          className={`border-b-2 px-3 py-2 text-sm font-medium transition ${
            active === 'dashboard'
              ? 'border-amber-400 text-amber-100'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          {t('Painel', 'Panel', 'Dashboard')}
        </Link>
        {SUBS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className={`border-b-2 px-3 py-2 text-sm font-medium transition ${
              active === s.href.split('/').pop()
                ? 'border-amber-400 text-amber-100'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            {t(s.pt, s.es, s.en)}
          </Link>
        ))}
      </nav>
    </div>
  );
}
