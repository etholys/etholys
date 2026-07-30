'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { PenLine } from 'lucide-react';
import { useApp } from '@/app/providers';

const HIDDEN_PREFIXES = [
  '/login',
  '/acesso',
  '/hub/studio',
  '/lab',
  '/expedicion',
  '/verificar-forge',
];

/**
 * Atalho flutuante Studio — visível em todos os sistemas autenticados.
 * Posição: canto inferior esquerdo, acima do espaço tipicamente usado pelo Advisor.
 */
export function StudioHotButton() {
  const { status } = useSession();
  const pathname = usePathname() || '';
  const { locale } = useApp();

  if (status !== 'authenticated') return null;
  if (HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;
  if (pathname === '/' || pathname.startsWith('/vitrine')) return null;

  const label =
    locale === 'es' ? 'Studio — documentos' : locale === 'pt' ? 'Studio — documentos' : 'Studio — documents';

  return (
    <Link
      href="/hub/studio"
      title={label}
      aria-label={label}
      className="group fixed bottom-6 left-6 z-[60] flex items-center gap-2 rounded-full bg-gradient-to-br from-orange-500 to-amber-600 px-3.5 py-3 text-white shadow-lg shadow-orange-500/30 transition hover:scale-[1.03] hover:shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500"
    >
      <PenLine className="h-5 w-5 shrink-0" />
      <span className="max-w-0 overflow-hidden whitespace-nowrap text-sm font-semibold opacity-0 transition-all duration-200 group-hover:max-w-[9rem] group-hover:opacity-100">
        Studio
      </span>
    </Link>
  );
}
