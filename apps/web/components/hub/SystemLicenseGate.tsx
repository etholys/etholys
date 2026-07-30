'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useApp } from '@/app/providers';
import { Lock, ArrowLeft, Layers } from 'lucide-react';
import { parseSystemsJson, type WorkspaceSystemKey } from '@/lib/integrated-workspace-shared';
import { isLikelyDbId } from '@/lib/utils';
import { StateLoading } from '@/components/ui/StateBlocks';

type GateState = 'loading' | 'allowed' | 'denied';

type Props = {
  system: WorkspaceSystemKey;
  children: React.ReactNode;
  /** Rotas isentas de licença (ex.: FORGE público). */
  isExemptPath?: (pathname: string) => boolean;
};

export function SystemLicenseGate({ system, children, isExemptPath }: Props) {
  const { locale, activeCompanyId } = useApp();
  const pathname = usePathname() ?? '';
  const [state, setState] = useState<GateState>('loading');
  const { data: session } = useSession();

  const companyId = activeCompanyId && isLikelyDbId(activeCompanyId) ? activeCompanyId : '';
  const isCourseOnly = (session?.user as { forgeAccessMode?: string } | undefined)?.forgeAccessMode === 'course_only';

  const t = (pt: string, es: string, en: string) =>
    locale === 'pt' ? pt : locale === 'es' ? es : en;

  useEffect(() => {
    if (isExemptPath?.(pathname)) {
      setState('allowed');
      return;
    }

    // Convidados do jogo: só FORGE; sem empresa NÃO abrir outros sistemas
    if (isCourseOnly) {
      setState(system === 'FORGE' ? 'allowed' : 'denied');
      return;
    }

    if (!companyId) {
      setState('allowed');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/workspace/access?companyId=${encodeURIComponent(companyId)}`, {
          cache: 'no-store',
        });
        const data = (await r.json()) as { me?: { enabled?: boolean; systems?: unknown } };
        if (cancelled) return;
        if (!r.ok) {
          setState('allowed');
          return;
        }
        const me = data.me;
        if (!me?.enabled || me.systems == null) {
          setState('allowed');
          return;
        }
        const systems = parseSystemsJson(me.systems);
        if (systems.length === 0) {
          setState('allowed');
          return;
        }
        setState(systems.includes(system) ? 'allowed' : 'denied');
      } catch {
        if (!cancelled) setState('allowed');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [companyId, system, pathname, isExemptPath, isCourseOnly]);

  if (state === 'loading') {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-8">
        <StateLoading />
      </div>
    );
  }

  if (state === 'denied') {
    const forgeHome =
      (session?.user as { forgeHomePath?: string } | undefined)?.forgeHomePath || '/hub/forge/mis-cursos';
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50">
            <Lock className="h-7 w-7 text-amber-700" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">
            {isCourseOnly
              ? t('Acesso só ao teu curso', 'Acceso solo a tu curso', 'Course-only access')
              : t('Sem licença para este sistema', 'Sin licencia para este sistema', 'No license for this system')}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {isCourseOnly
              ? t(
                  'Esta conta só pode usar o curso FORGE a que foi convidada. Não tem acesso ao resto do Etholys.',
                  'Esta cuenta solo puede usar el curso FORGE al que fue invitada. No tiene acceso al resto de Etholys.',
                  'This account can only use the FORGE course you were invited to. No access to the rest of Etholys.',
                )
              : t(
                  `A sua conta não tem acesso a ${system} nesta empresa. Peça ao administrador ou escolha outro sistema no Hub.`,
                  `Su cuenta no tiene acceso a ${system} en esta empresa. Pida al administrador o elija otro sistema en el Hub.`,
                  `Your account does not have access to ${system} for this company. Ask your admin or pick another system in the Hub.`,
                )}
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link
              href={isCourseOnly ? forgeHome : '/hub'}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
            >
              <ArrowLeft className="h-4 w-4" />
              {isCourseOnly
                ? t('Voltar ao curso', 'Volver al curso', 'Back to course')
                : t('Voltar ao Hub', 'Volver al Hub', 'Back to Hub')}
            </Link>
            {!isCourseOnly && (
              <Link
                href="/hub/admin"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <Layers className="h-4 w-4" />
                {t('Administração', 'Administración', 'Administration')}
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
