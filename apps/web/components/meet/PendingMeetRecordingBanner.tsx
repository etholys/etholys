'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CloudOff, Loader2, RefreshCw } from 'lucide-react';
import { useApp } from '@/app/providers';
import {
  flushPendingMeetRecording,
  flushPendingMeetRecordingById,
  listPendingMeetRecordingsForSession,
  pendingRecordingSizeMb,
} from '@/lib/meet/flush-pending-recording';
import type { PendingMeetRecording } from '@/lib/meet/pending-recording-store';
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

  const [rows, setRows] = useState<PendingMeetRecording[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const load = useCallback(async () => {
    const list = await listPendingMeetRecordingsForSession(sessionId);
    setRows(list);
  }, [sessionId]);

  const retryOne = useCallback(
    async (id: string) => {
      setBusyId(id);
      try {
        await flushPendingMeetRecordingById(id);
        await load();
        if ((await listPendingMeetRecordingsForSession(sessionId)).length === 0) {
          setDone(true);
          window.setTimeout(() => setDone(false), 4000);
        }
      } catch {
        await load();
      } finally {
        setBusyId(null);
      }
    },
    [load, sessionId],
  );

  const retryAll = useCallback(async () => {
    setBusyId('all');
    try {
      await flushPendingMeetRecording(sessionId);
      setRows([]);
      setDone(true);
      window.setTimeout(() => setDone(false), 4000);
    } catch {
      await load();
    } finally {
      setBusyId(null);
    }
  }, [sessionId, load]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (rows.length === 0) return;
    const onOnline = () => {
      void retryAll();
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [rows.length, retryAll]);

  if (rows.length === 0 || done) return null;

  const totalMb = rows
    .reduce((sum, r) => sum + r.blob.size / (1024 * 1024), 0)
    .toFixed(1);

  if (compact) {
    return (
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300/40 bg-amber-950/50 px-3 py-2 text-xs text-amber-100">
        <span className="flex items-center gap-2">
          <CloudOff className="h-3.5 w-3.5 shrink-0" />
          {t(
            `${rows.length} gravação(ões) local (${totalMb} MB) à espera`,
            `${rows.length} grabación(es) local (${totalMb} MB) pendiente`,
            `${rows.length} local recording(s) (${totalMb} MB) waiting`,
          )}
        </span>
        <button
          type="button"
          disabled={busyId !== null}
          onClick={() => void retryAll()}
          className="inline-flex items-center gap-1 rounded-full bg-amber-600 px-2.5 py-1 font-medium text-white hover:bg-amber-500 disabled:opacity-60"
        >
          {busyId ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
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
              `${rows.length} ficheiro(s) (${totalMb} MB) na fila local. Pode reenviar sem impedir novas gravações.`,
              `${rows.length} archivo(s) (${totalMb} MB) en cola local. Puede reenviar sin bloquear nuevas grabaciones.`,
              `${rows.length} file(s) (${totalMb} MB) in the local queue. You can retry without blocking new recordings.`,
            )}
          </p>
          <div className="mt-3 space-y-2">
            {rows.map((pending) => (
              <div
                key={pending.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-white/70 px-3 py-2 text-xs"
              >
                <span>
                  {pending.fileName} · {pendingRecordingSizeMb(pending.blob)} MB
                  {pending.lastError ? (
                    <span className="mt-0.5 block text-amber-800/60">{pending.lastError}</span>
                  ) : null}
                </span>
                <button
                  type="button"
                  disabled={busyId !== null}
                  onClick={() => void retryOne(pending.id)}
                  className="inline-flex items-center gap-1 rounded-full bg-amber-700 px-3 py-1.5 font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
                >
                  {busyId === pending.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3" />
                  )}
                  {t('Reenviar', 'Reenviar', 'Retry')}
                </button>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busyId !== null}
              onClick={() => void retryAll()}
              className="inline-flex items-center gap-2 rounded-full bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
            >
              {busyId === 'all' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {t('Reenviar todas', 'Reenviar todas', 'Retry all')}
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
