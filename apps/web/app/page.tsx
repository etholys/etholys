'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Landing pré-comercial: sem login público.
 * Admins e allowlist vão ao Hub; convidados por função usam o link do e-mail.
 */
export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status !== 'authenticated') return;
    const u = session?.user as {
      workspaceAccessMode?: string;
      workspaceHomePath?: string;
      platformAdmin?: boolean;
      forgeAccessMode?: string;
      forgeHomePath?: string;
      studioAccessMode?: string;
      studioHomePath?: string;
    };
    if (u?.forgeAccessMode === 'course_only' && u.forgeHomePath) {
      router.replace(u.forgeHomePath);
      return;
    }
    if (u?.studioAccessMode === 'share_only' && u.studioHomePath) {
      router.replace(u.studioHomePath);
      return;
    }
    if (u?.platformAdmin || u?.workspaceAccessMode === 'full') {
      router.replace('/hub');
      return;
    }
    if (u?.workspaceAccessMode === 'function_only' && u.workspaceHomePath) {
      router.replace(u.workspaceHomePath);
      return;
    }
    if (u?.workspaceAccessMode === 'none') {
      router.replace('/acesso');
    }
  }, [status, session, router]);

  if (status === 'authenticated') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-500/30 border-t-teal-400" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-6 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-teal-400/90">Etholys</p>
      <h1 className="mt-4 max-w-lg text-3xl font-bold tracking-tight text-white sm:text-4xl">
        Fábrica de Soluciones
      </h1>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-400">
        Plataforma en fase privada. El acceso al Hub y a los sistemas es solo por invitación a
        funciones concretas — no hay registro público.
      </p>
      <p className="mt-8 text-xs text-slate-600">
        Si recibió un correo de invitación, use el enlace del mensaje.
      </p>
    </div>
  );
}
