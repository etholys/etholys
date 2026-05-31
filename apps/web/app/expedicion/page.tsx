'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { GraduationCap, Smartphone, Video, Zap } from 'lucide-react';

function ExpediciónContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token')?.trim();

  useEffect(() => {
    if (token) {
      router.replace(`/hub/forge/activar?token=${encodeURIComponent(token)}`);
    }
  }, [token, router]);

  if (token) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-600/30 border-t-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="text-center space-y-2">
        <span className="text-5xl" aria-hidden>
          🌱
        </span>
        <h1 className="text-2xl font-black text-slate-900 leading-tight">La Expedición Sostenible</h1>
        <p className="text-sm text-slate-600 max-w-sm mx-auto">
          Curso en vivo por celular o computador. Activa tu acceso con el enlace que te envió el facilitador.
        </p>
      </header>

      <div className="space-y-3">
        <Link
          href="/hub/forge/activar"
          className="flex w-full items-center gap-3 rounded-2xl bg-emerald-700 px-5 py-4 text-left text-white shadow-lg active:scale-[0.98] transition"
        >
          <Zap className="h-6 w-6 shrink-0" />
          <div>
            <p className="font-bold">Tengo mi enlace de invitación</p>
            <p className="text-xs text-emerald-100 mt-0.5">Abrir activación (pega el token si te lo mandaron)</p>
          </div>
        </Link>

        <Link
          href="/login?callbackUrl=%2Fhub%2Fforge%2Fmis-cursos"
          className="flex w-full items-center gap-3 rounded-2xl border-2 border-slate-200 bg-white px-5 py-4 text-left active:scale-[0.98] transition"
        >
          <GraduationCap className="h-6 w-6 shrink-0 text-blue-700" />
          <div>
            <p className="font-bold text-slate-900">Ya tengo cuenta</p>
            <p className="text-xs text-slate-500 mt-0.5">Entrar a mi curso</p>
          </div>
        </Link>

        <Link
          href="/login?callbackUrl=%2Fhub%2Fforge"
          className="flex w-full items-center gap-3 rounded-2xl border border-violet-200 bg-violet-50 px-5 py-3 text-left text-sm"
        >
          <Video className="h-5 w-5 shrink-0 text-violet-700" />
          <span className="font-semibold text-violet-900">Soy facilitador / organización</span>
        </Link>
      </div>

      <div className="rounded-xl bg-slate-100 p-4 text-xs text-slate-600 space-y-2">
        <p className="flex items-center gap-2 font-semibold text-slate-800">
          <Smartphone className="h-4 w-4" />
          En el celular
        </p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Abre el enlace del WhatsApp o email.</li>
          <li>Crea contraseña o usa enlace mágico.</li>
          <li>Tras activar, entras directo a la <strong>sala de juego</strong>: videollamada, tablero y mapa A2 juntos.</li>
          <li>Opcional: menú del navegador → Añadir a pantalla de inicio.</li>
        </ol>
      </div>
    </div>
  );
}

export default function ExpedicionPublicPage() {
  return (
    <div className="min-h-dvh bg-gradient-to-b from-emerald-50 to-slate-50 px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto w-full max-w-md">
        <Suspense
          fallback={
            <div className="flex justify-center py-16">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-600/30 border-t-emerald-600" />
            </div>
          }
        >
          <ExpediciónContent />
        </Suspense>
        <p className="mt-8 text-center text-[10px] text-slate-400">FORGE · Etholys</p>
      </div>
    </div>
  );
}
