'use client';

import { useCallback, useRef, useState } from 'react';
import { inferReportOutputLanguage, type ReportOutputLanguage } from '@/lib/siep/report-copilot-prompts';
import type { InformeCanvasSelection } from '@/lib/siep/informe-canvas-selection';
import type { ReportCanvasState } from '@/lib/siep/report-canvas-types';
import { apiErrorMessage, readApiJson } from '@/lib/siep/read-api-json';

export type SiepInformeMsg = {
  id: string;
  role: string;
  content: string;
  createdAt: string;
};

const API = '/api/siep/report-copilot';

type SendOpts = {
  action?: 'send' | 'edit' | 'regenerate';
  fromUserMessageId?: string;
  message?: string;
};

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
      const { data } = await readApiJson<{ messages?: SiepInformeMsg[]; error?: string }>(r);
      if (!r.ok) throw new Error(apiErrorMessage(data, `Erro ao carregar chat (${r.status})`));
      setMessages((data?.messages ?? []) as SiepInformeMsg[]);
      loadedRef.current = sid;
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erro ao carregar chat');
    } finally {
      setLoading(false);
    }
  }, []);

  const runCopilot = useCallback(
    async (opts: SendOpts): Promise<{ canvasState?: unknown } | null> => {
      if (!sessionId || !reportId || sending) return null;
      const action = opts.action || 'send';
      const msg = String(opts.message ?? '').trim();
      if (action === 'send' && !msg) return null;
      if ((action === 'edit' || action === 'regenerate') && !opts.fromUserMessageId) return null;
      if (action === 'edit' && !msg) return null;

      setSending(true);
      setErr(null);

      if (action === 'send') {
        setInput('');
        setMessages((prev) => [
          ...prev,
          { id: `tmp-${Date.now()}`, role: 'user', content: msg, createdAt: new Date().toISOString() },
        ]);
      } else if (action === 'edit' && opts.fromUserMessageId) {
        setMessages((prev) => {
          const idx = prev.findIndex((m) => m.id === opts.fromUserMessageId);
          if (idx < 0) return prev;
          return [
            ...prev.slice(0, idx),
            { ...prev[idx], content: msg },
          ];
        });
      } else if (action === 'regenerate' && opts.fromUserMessageId) {
        setMessages((prev) => {
          const idx = prev.findIndex((m) => m.id === opts.fromUserMessageId);
          if (idx < 0) return prev;
          return prev.slice(0, idx + 1);
        });
      }

      try {
        const outputLanguage: ReportOutputLanguage = canvas
          ? inferReportOutputLanguage(canvas)
          : 'pt';
        const r = await fetch(`${API}/${sessionId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action,
            message: action === 'regenerate' ? undefined : msg,
            fromUserMessageId: opts.fromUserMessageId,
            reportId,
            locale,
            outputLanguage,
            selection: selection ?? undefined,
          }),
        });
        const { data } = await readApiJson<{ canvasState?: unknown; error?: string }>(r);
        if (!r.ok) throw new Error(apiErrorMessage(data, `Erro (${r.status})`));
        await loadMessages(sessionId);
        return { canvasState: data.canvasState };
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : 'Erro ao enviar');
        if (sessionId) await loadMessages(sessionId);
        return null;
      } finally {
        setSending(false);
      }
    },
    [sessionId, reportId, sending, loadMessages, canvas, locale, selection],
  );

  const send = useCallback(async (): Promise<{ canvasState?: unknown } | null> => {
    return runCopilot({ action: 'send', message: input });
  }, [runCopilot, input]);

  const editAndResend = useCallback(
    async (userMessageId: string, newContent: string) => {
      return runCopilot({ action: 'edit', fromUserMessageId: userMessageId, message: newContent });
    },
    [runCopilot],
  );

  const regenerate = useCallback(
    async (userMessageId: string) => {
      return runCopilot({ action: 'regenerate', fromUserMessageId: userMessageId });
    },
    [runCopilot],
  );

  return {
    messages,
    sending,
    loading,
    err,
    input,
    setInput,
    send,
    editAndResend,
    regenerate,
    loadMessages,
    loadedRef,
  };
}
