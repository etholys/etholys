'use client';

import Link from 'next/link';
import { ForgeLocaleSwitcher } from '@/components/forge/ForgeLocaleSwitcher';
import { useForgeT } from '@/lib/forge/use-forge-t';

export function ForgeExpedicionPublicShell({
  children,
  backHref = '/expedicion',
}: {
  children: React.ReactNode;
  backHref?: string;
}) {
  const ft = useForgeT();

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
      <div className="mx-auto max-w-md px-4 py-6 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <Link href={backHref} className="text-xs font-semibold text-emerald-800 hover:underline">
            ← {ft('forge.feria.backHome')}
          </Link>
          <ForgeLocaleSwitcher />
        </div>
        {children}
      </div>
    </div>
  );
}
