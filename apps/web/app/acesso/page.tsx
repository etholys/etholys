'use client';

import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { useApp } from '@/app/providers';

/** Conta autenticada sem funções atribuídas (pré-comercial). */
export default function AcessoRestritoPage() {
  const { data: session } = useSession();
  const { locale } = useApp();
  const email = session?.user?.email;

  const t = (pt: string, es: string, en: string) =>
    locale === 'pt' ? pt : locale === 'es' ? es : en;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 text-center">
      <h1 className="text-xl font-bold text-slate-900">
        {t('Acesso limitado', 'Acceso limitado', 'Limited access')}
      </h1>
      <p className="mt-3 max-w-md text-sm text-slate-600">
        {t(
          `A sua conta${email ? ` (${email})` : ''} ainda não tem funções Etholys atribuídas. Peça a um administrador um convite para o sistema ou módulo de que precisa (SIEP, ATLAS, FORGE, etc.).`,
          `Su cuenta${email ? ` (${email})` : ''} aún no tiene funciones Etholys asignadas. Pida a un administrador una invitación al sistema o módulo que necesite (SIEP, ATLAS, FORGE, etc.).`,
          `Your account${email ? ` (${email})` : ''} does not have Etholys functions assigned yet. Ask an administrator for an invitation to the system or module you need (SIEP, ATLAS, FORGE, etc.).`,
        )}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/" className="text-sm font-medium text-teal-700 hover:underline">
          {t('Página inicial', 'Página de inicio', 'Home')}
        </Link>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: '/' })}
          className="text-sm font-medium text-slate-500 hover:underline"
        >
          {t('Sair', 'Salir', 'Sign out')}
        </button>
      </div>
    </div>
  );
}
