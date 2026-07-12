'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ExpedicionV2PlayerState } from '@/lib/forge/expedicion-v2/types';

export type UseExpedicionV2Options = {
  /** Sala compartida — modo presencial equipa (mapa + ledger únicos) */
  roomId?: string | null;
  /** Facilitador observa jornada de um aluno */
  observeUserId?: string | null;
  /** Intervalo de sync entre telemóveis da mesa (ms) */
  pollMs?: number;
};

export function useExpedicionV2(courseId: string, opts?: UseExpedicionV2Options) {
  const roomId = opts?.roomId?.trim() || null;
  const observeUserId = opts?.observeUserId?.trim() || null;
  const pollMs =
    opts?.pollMs ?? (roomId || observeUserId ? (observeUserId ? 2000 : 3000) : 0);

  const [v2, setV2] = useState<ExpedicionV2PlayerState | null>(null);
  const [teamMode, setTeamMode] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [sessionFormat, setSessionFormat] = useState<'presencial' | 'online'>('online');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const q = new URLSearchParams();
      if (roomId) q.set('roomId', roomId);
      if (observeUserId) q.set('observeUserId', observeUserId);
      const qs = q.toString();
      const res = await fetch(`/api/forge/courses/${courseId}/expedicion-v2${qs ? `?${qs}` : ''}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro');
      setV2(data.v2);
      setTeamMode(Boolean(data.teamMode));
      setVideoEnabled(data.videoEnabled !== false);
      setSessionFormat(data.sessionFormat === 'presencial' ? 'presencial' : 'online');
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      setLoading(false);
    }
  }, [courseId, roomId, observeUserId]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (!pollMs || (!roomId && !observeUserId)) return;
    const t = setInterval(() => {
      void reload();
    }, pollMs);
    return () => clearInterval(t);
  }, [pollMs, roomId, observeUserId, reload]);

  const patch = useCallback(
    async (body: Record<string, unknown>) => {
      const res = await fetch(`/api/forge/courses/${courseId}/expedicion-v2`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(roomId ? { ...body, roomId } : body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro');
      setV2(data.v2);
      setTeamMode(Boolean(data.teamMode));
      return data.v2 as ExpedicionV2PlayerState;
    },
    [courseId, roomId]
  );

  return { v2, teamMode, videoEnabled, sessionFormat, loading, error, reload, patch };
}
