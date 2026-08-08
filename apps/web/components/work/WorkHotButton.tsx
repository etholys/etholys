'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { CheckSquare } from 'lucide-react';
import { useApp } from '@/app/providers';

const HIDDEN_PREFIXES = [
  '/login',
  '/acesso',
  '/hub/work',
  '/hub/studio',
  '/hub/meet',
  '/lab',
  '/expedicion',
  '/verificar-forge',
];

/**
 * Atalho flutuante Work — acima do Studio (canto inferior esquerdo).
 */
export function WorkHotButton() {
  const { data: session, status } = useSession();
  const pathname = usePathname() || '';
  const { locale } = useApp();

  if (status !== 'authenticated') return null;
  const studioMode = (session?.user as { studioAccessMode?: string } | undefined)?.studioAccessMode;
  if (studioMode === 'share_only') return null;
  if (HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;
  if (pathname === '/' || pathname.startsWith('/vitrine') || pathname.startsWith('/studio')) return null;
  if (pathname === '/tasks' || pathname.startsWith('/tasks/')) return null;

  const label =
    locale === 'es' ? 'Work — tareas' : locale === 'pt' ? 'Work — tarefas' : 'Work — tasks';

  return (
    <Link
      href="/hub/work"
      title={label}
      aria-label={label}
      className="group fixed bottom-[4.75rem] left-6 z-[60] flex items-center gap-2 rounded-full bg-gradient-to-br from-cyan-500 to-teal-700 px-3.5 py-3 text-white shadow-lg shadow-cyan-500/30 transition hover:scale-[1.03] hover:shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500"
    >
      <CheckSquare className="h-5 w-5 shrink-0" />
      <span className="max-w-0 overflow-hidden whitespace-nowrap text-sm font-semibold opacity-0 transition-all duration-200 group-hover:max-w-[9rem] group-hover:opacity-100">
        Work
      </span>
    </Link>
  );
}
