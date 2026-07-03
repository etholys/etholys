'use client';

import { useCallback, useRef, useState } from 'react';
import { inferReportOutputLanguage, type ReportOutputLanguage } from '@/lib/siep/report-copilot-prompts';
import type { InformeCanvasSelection } from '@/lib/siep/informe-canvas-selection';
import type { ReportCanvasState } from '@/lib/siep/report-canvas-types';

export type SiepInformeMsg = {
  id: string;
  role: string;
  content: string;
  createdAt: string;
};

const API = '/api/siep/report-copilot';

export function useSiepInformeSession(
  reportId: string | null,
  sessionId: string | null,
  canvas: ReportCanvasState | null,
  locale: 'pt' | 'es' | 'en' = 'pt',
  selection: InformeCanvasSelection | null = null,
) {
  const [messages, setMessages] = useState<SiepInformeMsg[]>([]);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const loadedRef = useRef<string | null>(null);

  const loadMessages = useCallback(async (sid: string) => {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch(`${API}/${sid}`, { cache: 'no-store' });
      if (!r.ok) throw new Error(`Erro ao carregar chat (${r.status})`);
      const data = await r.json();
      setMessages((data?.messages ?? []) as SiepInformeMsg[]);
      loadedRef.current = sid;
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erro ao carregar chat');
    } finally {
      setLoading(false);
    }
  }, []);

  const send = useCallback(async (): Promise<{ canvasState?: unknown } | null> => {
    if (!sessionId || !reportId || !input.trim() || sending) return null;
    setSending(true);
    setErr(null);
    const msg = input.trim();
    setInput('');
    setMessages((prev) => [
      ...prev,
      { id: `tmp-${Date.now()}`, role: 'user', content: msg, createdAt: new Date().toISOString() },
    ]);
    try {
      const outputLanguage: ReportOutputLanguage = canvas
        ? inferReportOutputLanguage(canvas)
        : 'pt';
      const r = await fetch(`${API}/${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          reportId,
          locale,
          outputLanguage,
          selection: selection ?? undefined,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(String(data.error || `Erro (${r.status})`));
      await loadMessages(sessionId);
      return { canvasState: data.canvasState };
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erro ao enviar');
      return null;
    } finally {
      setSending(false);
    }
  }, [sessionId, reportId, input, sending, loadMessages, canvas, locale, selection]);

  return {
    messages,
    sending,
    loading,
    err,
    input,
    setInput,
    send,
    loadMessages,
    loadedRef,
  };
}
