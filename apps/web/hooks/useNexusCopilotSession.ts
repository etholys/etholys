'use client';

import { useCallback, useRef, useState } from 'react';
import { NEXUS_MAX_FILES } from '@/lib/nexus-chat-attachments';

export const nexusCopilotLsKey = (companyId: string | null) => `etholys_nexus_copilot_v5_${companyId || 'noco'}`;

const NEXUS_COPILOT_API = '/api/nexus/copilot';

export type NexusCopilotMsg = { id: string; role: string; content: string; createdAt: string };

type NexusLocale = 'pt' | 'es' | 'en';

type Opts = {
  activeCompanyId: string | null;
  nexusLocale: NexusLocale;
  nexusBoost: Record<string, string | undefined>;
};

/**
 * Sessão do Copiloto NEXUS (rotas `/api/nexus/copilot`) — sessões `kind: NEXUS_COPILOT`, distintas do assessor workspace.
 * Mesma chave de localStorage por empresa, para a conversa continuar entre ecrãs.
 */
export function useNexusCopilotSession({ activeCompanyId, nexusLocale, nexusBoost }: Opts) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<NexusCopilotMsg[]>([]);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [booting, setBooting] = useState(false);
  const [input, setInput] = useState('');
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const sessionInFlight = useRef(false);

  const cleanBoost = useCallback(() => {
    const o: Record<string, string> = {};
    for (const [k, v] of Object.entries(nexusBoost)) {
      if (v) o[k] = v;
    }
    return o;
  }, [nexusBoost]);

  const loadMessages = useCallback(async (sid: string) => {
    const r = await fetch(`${NEXUS_COPILOT_API}/${sid}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-store' },
    });
    if (!r.ok) {
      const txt = await r.text();
      throw new Error(txt.slice(0, 200) || `Sincronização falhou (${r.status}).`);
    }
    const data = await r.json();
    setMessages((data?.messages ?? []) as NexusCopilotMsg[]);
  }, []);

  const startBootstrap = useCallback(
    async (sid: string) => {
      setBooting(true);
      setErr(null);
      const boost = cleanBoost();
      try {
        const r = await fetch(`${NEXUS_COPILOT_API}/${sid}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bootstrapNexus: true,
            nexusMode: 'design_partner',
            nexusLocale,
            nexusBoost: boost,
            ...(activeCompanyId ? { companyId: activeCompanyId } : {}),
          }),
        });
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error((j as { error?: string }).error || 'Não foi possível iniciar a conversa.');
        }
        await loadMessages(sid);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Erro na abertura.');
      } finally {
        setBooting(false);
      }
    },
    [loadMessages, nexusLocale, activeCompanyId, cleanBoost],
  );

  const ensureSession = useCallback(async () => {
    if (sessionInFlight.current) return;
    sessionInFlight.current = true;
    setLoading(true);
    setErr(null);
    const boost = cleanBoost();
    try {
      const key = nexusCopilotLsKey(activeCompanyId);
      const saved = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
      if (saved) {
        const r = await fetch(`${NEXUS_COPILOT_API}/${saved}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-store' },
        });
        if (r.ok) {
          const data = await r.json();
          const list = (data?.messages ?? []) as NexusCopilotMsg[];
          setSessionId(saved);
          setMessages(list);
          if (list.length === 0) {
            await startBootstrap(saved);
          }
          return;
        }
        localStorage.removeItem(key);
      }
      const cr = await fetch('/api/ai/advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'NEXUS — Copiloto (negócio & marca)',
          kind: 'NEXUS_COPILOT',
          ...(activeCompanyId ? { companyId: activeCompanyId } : {}),
        }),
      });
      const createdPayload = await cr.json().catch(() => null);
      if (!cr.ok) {
        const o =
          createdPayload && typeof createdPayload === 'object'
            ? (createdPayload as { error?: string; detail?: string; hint?: string })
            : {};
        const msg = [o.hint, o.detail, o.error].filter((x): x is string => Boolean(x && String(x).trim())).join(' — ');
        throw new Error(
          msg || `Não foi possível criar o copiloto (${cr.status}${cr.statusText ? ` ${cr.statusText}` : ''}).`,
        );
      }
      const created = createdPayload as { id: string };
      const id = created.id as string;
      setSessionId(id);
      if (typeof window !== 'undefined') localStorage.setItem(nexusCopilotLsKey(activeCompanyId), id);
      await startBootstrap(id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao iniciar.');
    } finally {
      setLoading(false);
      sessionInFlight.current = false;
    }
  }, [startBootstrap, activeCompanyId, cleanBoost]);

  const addAttachmentFiles = useCallback((list: FileList | null) => {
    if (!list?.length) return;
    setAttachmentFiles((prev) => {
      const next = [...prev];
      for (let i = 0; i < list.length && next.length < NEXUS_MAX_FILES; i++) {
        next.push(list[i]);
      }
      return next.slice(0, NEXUS_MAX_FILES);
    });
  }, []);

  const removeAttachmentAt = useCallback((idx: number) => {
    setAttachmentFiles((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const send = useCallback(async () => {
    if ((!input.trim() && attachmentFiles.length === 0) || !sessionId || sending) return;
    const text = input.trim();
    const tempUserId = `tmp-u-${Date.now()}`;
    const optimisticUser: NexusCopilotMsg = {
      id: tempUserId,
      role: 'user',
      content:
        text +
        (attachmentFiles.length
          ? (text ? '\n' : '') + `[${attachmentFiles.map((f) => f.name).join('; ')}]`
          : ''),
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticUser]);
    setSending(true);
    setErr(null);
    setInput('');
    const filesSnapshot = attachmentFiles;
    setAttachmentFiles([]);
    const boost = cleanBoost();
    try {
      let r: Response;
      if (filesSnapshot.length > 0) {
        const fd = new FormData();
        fd.set('message', text);
        fd.set('nexusMode', 'design_partner');
        fd.set('nexusLocale', nexusLocale);
        fd.append('nexusBoost', JSON.stringify(boost));
        if (activeCompanyId) fd.set('companyId', activeCompanyId);
        for (const f of filesSnapshot) {
          fd.append('files', f);
        }
        r = await fetch(`${NEXUS_COPILOT_API}/${sessionId}`, { method: 'POST', body: fd });
      } else {
        r = await fetch(`${NEXUS_COPILOT_API}/${sessionId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            nexusMode: 'design_partner',
            nexusLocale,
            nexusBoost: boost,
            ...(activeCompanyId ? { companyId: activeCompanyId } : {}),
          }),
        });
      }
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setAttachmentFiles(filesSnapshot);
        setMessages((prev) => prev.filter((m) => m.id !== tempUserId));
        throw new Error(
          (j as { error?: string; detail?: string }).error ||
            (j as { detail?: string }).detail ||
            'Resposta inválida da IA.',
        );
      }
      const aiMsg = (j as { message?: NexusCopilotMsg }).message;
      if (aiMsg?.id && typeof aiMsg.content === 'string' && aiMsg.role === 'assistant') {
        setMessages((prev) => [...prev, aiMsg]);
      }
      try {
        await loadMessages(sessionId);
      } catch (syncErr) {
        if (!aiMsg?.id) {
          setMessages((prev) => prev.filter((m) => m.id !== tempUserId));
          throw syncErr;
        }
        setErr(
          syncErr instanceof Error
            ? `${syncErr.message} (A resposta do copiloto já aparece acima.)`
            : 'Não foi possível sincronizar a lista completa.',
        );
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Falha ao enviar.');
    } finally {
      setSending(false);
    }
  }, [input, sessionId, sending, nexusLocale, activeCompanyId, loadMessages, cleanBoost, attachmentFiles]);

  return {
    sessionId,
    messages,
    loading,
    booting,
    sending,
    err,
    input,
    setInput,
    attachmentFiles,
    addAttachmentFiles,
    removeAttachmentAt,
    send,
    ensureSession,
    setErr,
  };
}
