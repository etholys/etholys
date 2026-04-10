'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 bg-slate-50 text-slate-900">
        <h1 className="text-xl font-semibold">Erro crítico</h1>
        <p className="text-sm text-slate-600 max-w-lg text-center">
          {error.message || 'Falha ao iniciar a aplicação.'}
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700"
        >
          Recarregar
        </button>
      </body>
    </html>
  );
}
