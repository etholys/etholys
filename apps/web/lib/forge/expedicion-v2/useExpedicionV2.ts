'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ExpedicionV2PlayerState } from '@/lib/forge/expedicion-v2/types';

export type UseExpedicionV2Options = {
  /** Sala compartida — modo presencial equipa (mapa + ledger únicos) */
  roomId?: string | null;
  /** Intervalo de sync entre telemóveis da mesa (ms) */
  pollMs?: number;
};

export function useExpedicionV2(courseId: string, opts?: UseExpedicionV2Options) {
  const roomId = opts?.roomId?.trim() || null;
  const pollMs = opts?.pollMs ?? (roomId ? 3000 : 0);

  const [v2, setV2] = useState<ExpedicionV2PlayerState | null>(null);
  const [teamMode, setTeamMode] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [sessionFormat, setSessionFormat] = useState<'presencial' | 'online'>('online');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const q = roomId ? `?roomId=${encodeURIComponent(roomId)}` : '';
      const res = await fetch(`/api/forge/courses/${courseId}/expedicion-v2${q}`);
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
  }, [courseId, roomId]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (!pollMs || !roomId) return;
    const t = setInterval(() => {
      void reload();
    }, pollMs);
    return () => clearInterval(t);
  }, [pollMs, roomId, reload]);

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
