'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ForgeExpedicionPublicShell } from '@/components/forge/ForgeExpedicionPublicShell';
import { ForgeFeriaRegisterForm } from '@/components/forge/ForgeFeriaKioskForms';
import { useForgeT } from '@/lib/forge/use-forge-t';

function EntrarContent() {
  const ft = useForgeT();
  const searchParams = useSearchParams();
  const room = searchParams.get('room')?.trim().toUpperCase() ?? '';

  return (
    <ForgeExpedicionPublicShell>
      <header className="text-center space-y-2">
        <span className="text-4xl" aria-hidden>
          🌱
        </span>
        <h1 className="text-xl font-black text-slate-900">{ft('forge.feria.enterTitle')}</h1>
        <p className="text-sm text-slate-600">{ft('forge.feria.subtitle')}</p>
      </header>
      <ForgeFeriaRegisterForm initialRoomCode={room} />
    </ForgeExpedicionPublicShell>
  );
}

export default function ExpedicionEntrarPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-600/30 border-t-emerald-600" />
        </div>
      }
    >
      <EntrarContent />
    </Suspense>
  );
}
