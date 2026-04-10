'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app/error]', error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 bg-slate-50 text-slate-900">
      <h1 className="text-xl font-semibold">Erro ao carregar a página</h1>
      <p className="text-sm text-slate-600 max-w-lg text-center">
        {error.message || 'Ocorreu um erro inesperado.'}
      </p>
      {error.digest ? (
        <p className="text-xs text-slate-400 font-mono">digest: {error.digest}</p>
      ) : null}
      <button
        type="button"
        onClick={() => reset()}
        className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700"
      >
        Tentar novamente
      </button>
    </div>
  );
}
