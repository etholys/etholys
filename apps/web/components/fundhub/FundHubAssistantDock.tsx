'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/app/providers';
import { isLikelyDbId } from '@/lib/utils';
import { Loader2, MessageCircle, Paperclip, Send, Sparkles, X } from 'lucide-react';

type Msg = { role: 'user' | 'assistant'; content: string };

type Attached = {
  name: string;
  size: number;
  textExcerpt?: string;
};

type SuggestedShortcut = {
  name: string;
  orientationText: string;
  classifications: Array<'direct' | 'client_bridge' | 'joint'>;
};

export function FundHubAssistantDock() {
  const { locale, activeCompanyId } = useApp();
  const companyId = useMemo(() => {
    const s = String(activeCompanyId ?? '').trim();
    return isLikelyDbId(s) ? s : '';
  }, [activeCompanyId]);
  const t = (pt: string, es: string, en: string) =>
    locale === 'pt' ? pt : locale === 'es' ? es : en;

  const fileRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [savingShortcut, setSavingShortcut] = useState(false);
  const [attachments, setAttachments] = useState<Attached[]>([]);
  const [suggested, setSuggested] = useState<SuggestedShortcut | null>(null);
  const [shortcutMsg, setShortcutMsg] = useState<string | null>(null);
  const [chat, setChat] = useState<Msg[]>([
    {
      role: 'assistant',
      content: t(
        'Sou o assistente de captação. Pergunte sobre a inbox, elegibilidade, sócios, ou peça ajuda para criar um atalho de busca mais específico. Pode anexar um briefing ou notas.',
        'Soy el asistente de captación. Pregunte sobre la bandeja, elegibilidad, socios, o pida ayuda para crear un atajo de búsqueda más específico. Puede adjuntar un briefing o notas.',
        'I am the capture assistant. Ask about the inbox, eligibility, partners, or help creating a more specific search shortcut. You can attach a briefing or notes.',
      ),
    },
  ]);

  const attachFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const TEXT_EXT = /\.(txt|md|csv|rtf)$/i;
    const ACCEPTED =
      /\.(pdf|docx?|xlsx?|txt|md|csv|rtf|png|jpe?g)$/i;
    const next: Attached[] = [];
    for (const file of Array.from(files).slice(0, 4)) {
      if (!ACCEPTED.test(file.name) || file.size > 12 * 1024 * 1024) continue;
      let textExcerpt: string | undefined;
      if (TEXT_EXT.test(file.name) && file.size < 400_000) {
        try {
          textExcerpt = (await file.text()).slice(0, 6000);
        } catch {
          textExcerpt = undefined;
        }
      }
      next.push({ name: file.name, size: file.size, textExcerpt });
    }
    if (next.length) setAttachments((prev) => [...prev, ...next].slice(0, 6));
    if (fileRef.current) fileRef.current.value = '';
  };

  const send = async (text?: string) => {
    const message = (text ?? input).trim();
    const attachPayload = attachments
      .slice(0, 4)
      .map((a) => ({ name: a.name, textExcerpt: a.textExcerpt }));
    if (!companyId || busy) return;
    if (!message && !attachPayload.some((a) => a.textExcerpt || a.name)) return;

    const display =
      message ||
      t('Anexos enviados.', 'Archivos adjuntos enviados.', 'Attachments sent.');
    const fullMessage = [
      message,
      attachPayload.length
        ? t(
            `(Com ${attachPayload.length} anexo(s) — use-os para afinar o atalho ou a resposta.)`,
            `(Con ${attachPayload.length} anexo(s) — úselos para afinar el atajo o la respuesta.)`,
            `(With ${attachPayload.length} attachment(s) — use them to refine the shortcut or answer.)`,
          )
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    setBusy(true);
    setInput('');
    setSuggested(null);
    setShortcutMsg(null);
    setChat((prev) => [...prev, { role: 'user', content: display }]);
    try {
      const r = await fetch('/api/fundhub/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          message: fullMessage || display,
          locale,
          history: chat.slice(-6),
          attachments: attachPayload,
        }),
      });
      const d = (await r.json()) as {
        reply?: string;
        error?: string;
        suggestedShortcut?: SuggestedShortcut | null;
      };
      if (!r.ok) throw new Error(d.error || 'Error');
      setChat((prev) => [...prev, { role: 'assistant', content: d.reply ?? '' }]);
      if (d.suggestedShortcut?.name && d.suggestedShortcut.orientationText) {
        setSuggested(d.suggestedShortcut);
      }
      setAttachments([]);
    } catch (e) {
      setChat((prev) => [
        ...prev,
        { role: 'assistant', content: e instanceof Error ? e.message : 'Error' },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const createShortcut = async () => {
    if (!companyId || !suggested || savingShortcut) return;
    setSavingShortcut(true);
    setShortcutMsg(null);
    try {
      const r = await fetch(
        `/api/opportunity/profiles?companyId=${encodeURIComponent(companyId)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: suggested.name,
            orientationText: suggested.orientationText,
            classifications: suggested.classifications?.length
              ? suggested.classifications
              : ['direct'],
          }),
        },
      );
      const d = (await r.json()) as { error?: string; profile?: { name?: string } };
      if (!r.ok) throw new Error(d.error || 'Error');
      setShortcutMsg(
        t(
          `Atalho «${suggested.name}» criado — abra Buscar para o usar.`,
          `Atajo «${suggested.name}» creado — abra Buscar para usarlo.`,
          `Shortcut «${suggested.name}» created — open Search to use it.`,
        ),
      );
      setSuggested(null);
    } catch (e) {
      setShortcutMsg(e instanceof Error ? e.message : 'Error');
    } finally {
      setSavingShortcut(false);
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
                {t(
                  'Inbox, elegibilidade, atalhos',
                  'Bandeja, elegibilidad, atajos',
                  'Inbox, eligibility, shortcuts',
                )}
              </p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1 hover:bg-white/10">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5 border-b border-gray-100 px-3 py-2">
            {[
              t('O que falta no perfil?', '¿Qué falta en el perfil?', 'What is missing on the profile?'),
              t(
                'Ajuda-me a criar um atalho de busca',
                'Ayúdame a crear un atajo de búsqueda',
                'Help me create a search shortcut',
              ),
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
            {suggested && (
              <div className="mr-2 rounded-xl border border-amber-200 bg-amber-50/90 px-3 py-2.5 text-xs text-amber-950">
                <p className="flex items-center gap-1.5 font-semibold">
                  <Sparkles className="h-3.5 w-3.5 text-amber-700" />
                  {t('Atalho sugerido', 'Atajo sugerido', 'Suggested shortcut')}
                </p>
                <p className="mt-1 font-medium">{suggested.name}</p>
                <p className="mt-1 max-h-28 overflow-y-auto whitespace-pre-wrap text-amber-900/90">
                  {suggested.orientationText}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={savingShortcut}
                    onClick={() => void createShortcut()}
                    className="rounded-lg bg-amber-800 px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-amber-900 disabled:opacity-50"
                  >
                    {savingShortcut
                      ? '…'
                      : t('Criar atalho', 'Crear atajo', 'Create shortcut')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSuggested(null)}
                    className="text-[11px] text-amber-800/80 underline"
                  >
                    {t('Descartar', 'Descartar', 'Dismiss')}
                  </button>
                </div>
              </div>
            )}
            {shortcutMsg && (
              <div className="mr-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                <p>{shortcutMsg}</p>
                <Link
                  href="/hub/fundhub/discover"
                  className="mt-1 inline-block font-medium text-emerald-800 underline"
                >
                  {t('Ir a Buscar', 'Ir a Buscar', 'Go to Search')}
                </Link>
              </div>
            )}
            {busy && (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> …
              </div>
            )}
          </div>

          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-1 border-t border-gray-100 px-3 py-1.5">
              {attachments.map((a, i) => (
                <span
                  key={`${a.name}-${i}`}
                  className="inline-flex max-w-[11rem] items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700"
                >
                  <span className="truncate">{a.name}</span>
                  <button
                    type="button"
                    className="text-slate-500 hover:text-red-600"
                    onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                    aria-label={t('Remover', 'Quitar', 'Remove')}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <form
            className="flex items-center gap-1.5 border-t border-gray-100 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <input
              ref={fileRef}
              type="file"
              multiple
              className="hidden"
              accept=".pdf,.doc,.docx,.txt,.md,.csv,.rtf,.png,.jpg,.jpeg"
              onChange={(e) => void attachFiles(e.target.files)}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-50 hover:text-gray-800"
              title={t('Anexar ficheiro', 'Adjuntar archivo', 'Attach file')}
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('Escreva a pergunta…', 'Escriba la pregunta…', 'Type your question…')}
              className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={busy || (!input.trim() && attachments.length === 0)}
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
