'use client';

import { useMemo, useState } from 'react';
import { useApp } from '@/app/providers';
import { isLikelyDbId } from '@/lib/utils';
import { Loader2, MessageCircle, Send, X } from 'lucide-react';

type Msg = { role: 'user' | 'assistant'; content: string };

export function FundHubAssistantDock() {
  const { locale, activeCompanyId } = useApp();
  const companyId = useMemo(() => {
    const s = String(activeCompanyId ?? '').trim();
    return isLikelyDbId(s) ? s : '';
  }, [activeCompanyId]);
  const t = (pt: string, es: string, en: string) =>
    locale === 'pt' ? pt : locale === 'es' ? es : en;

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [chat, setChat] = useState<Msg[]>([
    {
      role: 'assistant',
      content: t(
        'Sou o assistente de captação. Pergunte sobre a inbox, o perfil de elegibilidade, sócios para uma call, ou o próximo passo.',
        'Soy el asistente de captación. Pregunte sobre la bandeja, el perfil de elegibilidad, socios para una call, o el próximo paso.',
        'I am the capture assistant. Ask about the inbox, eligibility profile, partners for a call, or the next step.',
      ),
    },
  ]);

  const send = async (text?: string) => {
    const message = (text ?? input).trim();
    if (!companyId || !message || busy) return;
    setBusy(true);
    setInput('');
    setChat((prev) => [...prev, { role: 'user', content: message }]);
    try {
      const r = await fetch('/api/fundhub/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          message,
          locale,
          history: chat.slice(-6),
        }),
      });
      const d = (await r.json()) as { reply?: string; error?: string };
      if (!r.ok) throw new Error(d.error || 'Error');
      setChat((prev) => [...prev, { role: 'assistant', content: d.reply ?? '' }]);
    } catch (e) {
      setChat((prev) => [
        ...prev,
        { role: 'assistant', content: e instanceof Error ? e.message : 'Error' },
      ]);
    } finally {
      setBusy(false);
    }
  };

  if (!companyId) return null;

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-amber-700 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-amber-800"
        >
          <MessageCircle className="h-4 w-4" />
          {t('Assistente', 'Asistente', 'Assistant')}
        </button>
      )}

      {open && (
        <div className="fixed bottom-5 right-5 z-40 flex h-[min(560px,75vh)] w-[min(400px,94vw)] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-gray-100 bg-slate-900 px-4 py-3 text-white">
            <div>
              <p className="text-sm font-semibold">
                {t('Assistente FundHub', 'Asistente FundHub', 'FundHub assistant')}
              </p>
              <p className="text-xs text-slate-300">
                {t('Inbox, elegibilidade, sócios', 'Bandeja, elegibilidad, socios', 'Inbox, eligibility, partners')}
              </p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1 hover:bg-white/10">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5 border-b border-gray-100 px-3 py-2">
            {[
              t('O que falta no perfil?', '¿Qué falta en el perfil?', 'What is missing on the profile?'),
              t('Como ler a inbox?', '¿Cómo leer la bandeja?', 'How do I read the inbox?'),
              t('Quando preciso de sócio?', '¿Cuándo necesito socio?', 'When do I need a partner?'),
            ].map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => void send(q)}
                className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-900 ring-1 ring-amber-200"
              >
                {q}
              </button>
            ))}
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3 text-sm">
            {chat.map((m, i) => (
              <div
                key={`${i}-${m.role}`}
                className={`rounded-xl px-3 py-2 whitespace-pre-wrap ${
                  m.role === 'user' ? 'ml-8 bg-amber-100 text-amber-950' : 'mr-4 bg-slate-50 text-slate-800'
                }`}
              >
                {m.content}
              </div>
            ))}
            {busy && (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> …
              </div>
            )}
          </div>

          <form
            className="flex gap-2 border-t border-gray-100 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('Escreva a pergunta…', 'Escriba la pregunta…', 'Type your question…')}
              className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="rounded-lg bg-amber-700 p-2 text-white disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
