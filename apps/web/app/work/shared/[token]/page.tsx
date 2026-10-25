'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { signIn, useSession } from 'next-auth/react';
import { CheckSquare, Loader2 } from 'lucide-react';

export default function WorkSharedAcceptPage() {
  const params = useParams();
  const token = String(params?.token || '');
  const router = useRouter();
  const { status } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<{
    companyName: string;
    title: string;
    accessMode: string;
    email: string;
    magicLoginToken: string | null;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const autoStarted = useRef(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/work-folders/shares/accept?token=${encodeURIComponent(token)}`);
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
        if (cancelled) return;
        setInfo({
          companyName: d.share.companyName,
          title: d.share.folder?.name || 'eTask',
          accessMode: d.share.accessMode,
          email: d.share.email,
          magicLoginToken: d.share.magicLoginToken || null,
        });
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erro');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function openShare() {
    if (!token || !info) return;
    setBusy(true);
    setError(null);
    try {
      if (status !== 'authenticated' && info.magicLoginToken && info.email) {
        const res = await signIn('credentials', {
          redirect: false,
          email: info.email,
          workMagicToken: info.magicLoginToken,
        });
        if (res?.error) throw new Error(res.error || 'Não foi possível iniciar sessão com o convite');
      }

      const r = await fetch('/api/work-folders/shares/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      router.replace(d.href || '/hub/work');
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro');
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!info || autoStarted.current) return;
    if (status === 'loading') return;
    autoStarted.current = true;
    void openShare();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info, status]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-teal-50 to-white px-4">
      <div className="w-full max-w-md rounded-2xl border border-teal-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2 text-teal-700">
          <CheckSquare className="h-6 w-6" />
          <span className="font-bold">Etholys eTask</span>
        </div>
        {error ? (
          <>
            <p className="text-sm text-red-700">{error}</p>
            {info && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  autoStarted.current = false;
                  void openShare();
                }}
                className="mt-4 w-full rounded-xl bg-teal-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                Tentar novamente
              </button>
            )}
          </>
        ) : !info || busy || status === 'loading' ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              {info ? 'A abrir o tablero…' : 'A carregar convite…'}
            </div>
            {info && (
              <>
                <h1 className="text-xl font-bold text-slate-900">{info.title}</h1>
                <p className="text-sm text-slate-600">{info.companyName}</p>
                {info.accessMode === 'external_guest' && (
                  <p className="text-xs text-slate-400">Acesso limitado apenas a este tablero.</p>
                )}
              </>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => void openShare()}
            className="w-full rounded-xl bg-teal-600 py-3 text-sm font-semibold text-white"
          >
            Abrir tablero
          </button>
        )}
      </div>
    </div>
  );
}
