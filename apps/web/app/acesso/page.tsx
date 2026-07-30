'use client';

import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';

/** Conta autenticada sem funções atribuídas (pré-comercial). */
export default function AcessoRestritoPage() {
  const { data: session } = useSession();
  const email = session?.user?.email;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 text-center">
      <h1 className="text-xl font-bold text-slate-900">Acesso limitado</h1>
      <p className="mt-3 max-w-md text-sm text-slate-600">
        A sua conta{email ? ` (${email})` : ''} ainda não tem funções Etholys atribuídas. Peça a um
        administrador (ex.: tiagorezende@ruralcommerceglobal.com) um convite para SIEP, ATLAS, FORGE
        ou outro módulo.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/" className="text-sm font-medium text-teal-700 hover:underline">
          Página inicial
        </Link>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: '/' })}
          className="text-sm font-medium text-slate-500 hover:underline"
        >
          Sair
        </button>
      </div>
    </div>
  );
}
