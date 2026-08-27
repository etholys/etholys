'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/app/providers';
import { Lock } from 'lucide-react';

type Props = {
  children: ReactNode;
  companyId: string | null;
};

/** Só administradores da empresa acedem a /hub/admin. */
export function AdminAccessGuard({ children, companyId }: Props) {
  const { locale } = useApp();
  const router = useRouter();
  const [state, setState] = useState<'loading' | 'allowed' | 'denied'>('loading');

  useEffect(() => {
    if (!companyId) {
      setState('denied');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/workspace/access?companyId=${encodeURIComponent(companyId)}`, {
          cache: 'no-store',
        });
        if (cancelled) return;
        if (!res.ok) {
          setState('denied');
          return;
        }
        const data = (await res.json()) as { canManage?: boolean };
        setState(data.canManage ? 'allowed' : 'denied');
      } catch {
        if (!cancelled) setState('denied');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  if (state === 'loading') {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-transparent" />
      </div>
    );
  }

  if (state === 'denied') {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <Lock className="mx-auto mb-4 h-10 w-10 text-slate-400" />
        <h2 className="mb-2 text-lg font-semibold text-slate-900">
          {locale === 'pt'
            ? 'Acesso restrito'
            : locale === 'es'
              ? 'Acceso restringido'
              : 'Restricted access'}
        </h2>
        <p className="mb-6 text-sm text-slate-600">
          {locale === 'pt'
            ? 'Apenas administradores da empresa podem gerir convites, equipa e configurações.'
            : locale === 'es'
              ? 'Solo los administradores de la empresa pueden gestionar invitaciones, equipo y configuración.'
              : 'Only company administrators can manage invites, team, and settings.'}
        </p>
        <button
          type="button"
          onClick={() => router.push('/hub')}
          className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900"
        >
          {locale === 'pt' ? 'Voltar ao Hub' : locale === 'es' ? 'Volver al Hub' : 'Back to Hub'}
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
