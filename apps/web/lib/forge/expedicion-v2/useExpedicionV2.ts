'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ExpedicionV2PlayerState } from '@/lib/forge/expedicion-v2/types';

export function useExpedicionV2(courseId: string) {
  const [v2, setV2] = useState<ExpedicionV2PlayerState | null>(null);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [sessionFormat, setSessionFormat] = useState<'presencial' | 'online'>('online');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/forge/courses/${courseId}/expedicion-v2`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro');
      setV2(data.v2);
      setVideoEnabled(data.videoEnabled !== false);
      setSessionFormat(data.sessionFormat === 'presencial' ? 'presencial' : 'online');
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const patch = useCallback(
    async (body: Record<string, unknown>) => {
      const res = await fetch(`/api/forge/courses/${courseId}/expedicion-v2`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro');
      setV2(data.v2);
      return data.v2 as ExpedicionV2PlayerState;
    },
    [courseId]
  );

  return { v2, videoEnabled, sessionFormat, loading, error, reload, patch };
}
