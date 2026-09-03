'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CloudOff, Loader2, RefreshCw } from 'lucide-react';
import { useApp } from '@/app/providers';
import {
  flushPendingMeetRecording,
  getPendingMeetRecording,
  pendingRecordingSizeMb,
} from '@/lib/meet/flush-pending-recording';
import { meetRecapPath } from '@/lib/meet/types';

type Props = {
  sessionId: string;
  companyId?: string;
  compact?: boolean;
};

export function PendingMeetRecordingBanner({ sessionId, companyId, compact }: Props) {
  const { locale } = useApp();
  const t = (pt: string, es: string, en: string) =>
    locale === 'pt' ? pt : locale === 'es' ? es : en;

  const [pending, setPending] = useState<Awaited<ReturnType<typeof getPendingMeetRecording>>>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const load = useCallback(async () => {
    const row = await getPendingMeetRecording(sessionId);
    setPending(row);
  }, [sessionId]);

  const retry = useCallback(async () => {
    setBusy(true);
    try {
      await flushPendingMeetRecording(sessionId);
      setPending(null);
      setDone(true);
      window.setTimeout(() => setDone(false), 4000);
    } catch {
      await load();
    } finally {
      setBusy(false);
    }
  }, [sessionId, load]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!pending) return;
    const onOnline = () => {
      void retry();
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [pending, retry]);

  if (!pending || done) return null;

  const sizeMb = pendingRecordingSizeMb(pending.blob);

  if (compact) {
    return (
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300/40 bg-amber-950/50 px-3 py-2 text-xs text-amber-100">
        <span className="flex items-center gap-2">
          <CloudOff className="h-3.5 w-3.5 shrink-0" />
          {t(
            `Gravação local (${sizeMb} MB) à espera de envio`,
            `Grabación local (${sizeMb} MB) pendiente de envío`,
            `Local recording (${sizeMb} MB) waiting to upload`,
          )}
        </span>
        <button
          type="button"
          disabled={busy}
          onClick={() => void retry()}
          className="inline-flex items-center gap-1 rounded-full bg-amber-600 px-2.5 py-1 font-medium text-white hover:bg-amber-500 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          {t('Reenviar', 'Reenviar', 'Retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-2xl border border-amber-300/50 bg-amber-50 px-4 py-4 text-amber-950 shadow-sm">
      <div className="flex items-start gap-3">
        <CloudOff className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            {t(
              'Gravação guardada neste browser',
              'Grabación guardada en este navegador',
              'Recording saved in this browser',
            )}
          </p>
          <p className="mt-1 text-sm text-amber-900/85">
            {t(
              `O envio para a nuvem falhou (${sizeMb} MB). A gravação não se perdeu — está na fila local até ser enviada com sucesso.`,
              `El envío a la nube falló (${sizeMb} MB). La grabación no se perdió — está en cola local hasta enviarse.`,
              `Cloud upload failed (${sizeMb} MB). The recording was not lost — it's queued locally until upload succeeds.`,
            )}
          </p>
          {pending.lastError && (
            <p className="mt-2 text-xs text-amber-800/70">{pending.lastError}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void retry()}
              className="inline-flex items-center gap-2 rounded-full bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {t('Reenviar agora', 'Reenviar ahora', 'Retry upload now')}
            </button>
            {companyId && (
              <Link
                href={meetRecapPath(sessionId, companyId)}
                className="inline-flex items-center rounded-full border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-50"
              >
                {t('Ver resumo', 'Ver resumen', 'View recap')}
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
