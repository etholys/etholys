'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function HubError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[hub/error]', error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 bg-slate-50">
      <h1 className="text-xl font-semibold text-slate-900">Hub — erro ao carregar</h1>
      <p className="text-sm text-slate-600 max-w-lg text-center">{error.message}</p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700"
        >
          Tentar novamente
        </button>
        <Link
          href="/login"
          className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-100"
        >
          Ir ao login
        </Link>
      </div>
    </div>
  );
}
