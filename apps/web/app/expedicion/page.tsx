'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { GraduationCap, QrCode, Smartphone, Video, Zap } from 'lucide-react';
import { ForgeLocaleSwitcher } from '@/components/forge/ForgeLocaleSwitcher';
import { useForgeT } from '@/lib/forge/use-forge-t';

function ExpediciónContent() {
  const ft = useForgeT();
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
      <div className="flex justify-end">
        <ForgeLocaleSwitcher />
      </div>

      <header className="text-center space-y-2">
        <span className="text-5xl" aria-hidden>
          🌱
        </span>
        <h1 className="text-2xl font-black text-slate-900 leading-tight">La Expedición Sostenible</h1>
        <p className="text-sm text-slate-600 max-w-sm mx-auto">{ft('forge.feria.subtitle')}</p>
      </header>

      <div className="space-y-3">
        <Link
          href="/expedicion/entrar"
          className="flex w-full items-center gap-3 rounded-2xl bg-emerald-700 px-5 py-4 text-left text-white shadow-lg active:scale-[0.98] transition"
        >
          <QrCode className="h-6 w-6 shrink-0" />
          <div>
            <p className="font-bold">{ft('forge.feria.enterTitle')}</p>
            <p className="text-xs text-emerald-100 mt-0.5">{ft('forge.feria.roomCodeHint')}</p>
          </div>
        </Link>

        <Link
          href="/expedicion/volver"
          className="flex w-full items-center gap-3 rounded-2xl border-2 border-emerald-200 bg-white px-5 py-4 text-left active:scale-[0.98] transition"
        >
          <Zap className="h-6 w-6 shrink-0 text-emerald-700" />
          <div>
            <p className="font-bold text-slate-900">{ft('forge.feria.returnTitle')}</p>
            <p className="text-xs text-slate-500 mt-0.5">{ft('forge.feria.returnSubtitle')}</p>
          </div>
        </Link>

        <Link
          href="/hub/forge/activar"
          className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-left text-sm"
        >
          <GraduationCap className="h-5 w-5 shrink-0 text-blue-700" />
          <span className="font-semibold text-slate-800">{ft('forge.invite.activate')}</span>
        </Link>

        <Link
          href="/login?callbackUrl=%2Fhub%2Fforge"
          className="flex w-full items-center gap-3 rounded-2xl border border-violet-200 bg-violet-50 px-5 py-3 text-left text-sm"
        >
          <Video className="h-5 w-5 shrink-0 text-violet-700" />
          <span className="font-semibold text-violet-900">{ft('forge.feria.facilitatorTitle')}</span>
        </Link>
      </div>

      <div className="rounded-xl bg-slate-100 p-4 text-xs text-slate-600 space-y-2">
        <p className="flex items-center gap-2 font-semibold text-slate-800">
          <Smartphone className="h-4 w-4" />
          {ft('forge.feria.enterTitle')}
        </p>
        <ol className="list-decimal list-inside space-y-1">
          <li>{ft('forge.feria.roomCodeHint')}</li>
          <li>{ft('forge.feria.emailRequiredHint')}</li>
          <li>{ft('forge.feria.goToRoom')}</li>
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
