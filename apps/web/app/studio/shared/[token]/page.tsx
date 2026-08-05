'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { signIn, useSession } from 'next-auth/react';
import { Loader2, PenLine, Shield } from 'lucide-react';

export default function StudioSharedAcceptPage() {
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

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/studio/shares/accept?token=${encodeURIComponent(token)}`);
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
        if (cancelled) return;
        setInfo({
          companyName: d.share.companyName,
          title:
            d.share.document?.title ||
            d.share.folder?.name ||
            'Studio',
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
          studioMagicToken: info.magicLoginToken,
        });
        if (res?.error) throw new Error(res.error);
      }

      const r = await fetch('/api/studio/shares/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      router.replace(d.href || '/studio/shared');
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro');
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-amber-50 to-white px-4">
      <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2 text-orange-700">
          <PenLine className="h-6 w-6" />
          <span className="font-bold">Etholys Studio</span>
        </div>
        {error ? (
          <p className="text-sm text-red-700">{error}</p>
        ) : !info ? (
          <div className="flex items-center gap-2 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />A carregar partilha…
          </div>
        ) : (
          <>
            <h1 className="text-xl font-bold text-slate-900">{info.title}</h1>
            <p className="mt-1 text-sm text-slate-600">{info.companyName}</p>
            {info.accessMode === 'external_guest' && (
              <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-950">
                <Shield className="mt-0.5 h-4 w-4 shrink-0" />
                O seu acesso é limitado apenas a este conteúdo partilhado — não verá o resto da
                empresa.
              </p>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => void openShare()}
              className="mt-6 w-full rounded-xl bg-orange-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? '…' : 'Abrir conteúdo'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
