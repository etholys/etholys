'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Bot, Loader2, Send, Sparkles, X } from 'lucide-react';
import { useSiepInformeSession } from '@/hooks/useSiepInformeSession';
import { useSiepLocale } from '@/lib/siep/use-siep-t';
import { siepT } from '@/lib/siep/i18n';
import { describeInformeSelection, type InformeCanvasSelection } from '@/lib/siep/informe-canvas-selection';
import type { ReportCanvasState } from '@/lib/siep/report-canvas-types';

type Props = {
  reportId: string;
  sessionId: string;
  canvas: ReportCanvasState;
  selection: InformeCanvasSelection | null;
  onClearSelection: () => void;
  onCanvasUpdate: (canvas: ReportCanvasState) => void;
};

export function SiepInformeChatPanel({
  reportId,
  sessionId,
  canvas,
  selection,
  onClearSelection,
  onCanvasUpdate,
}: Props) {
  const locale = useSiepLocale();
  const st = (key: string) => siepT(key, locale);
  const { messages, sending, loading, err, input, setInput, send, loadMessages, loadedRef } =
    useSiepInformeSession(reportId, sessionId, canvas, locale, selection);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const selectionLabel = useMemo(
    () => (selection ? describeInformeSelection(canvas, selection) : null),
    [canvas, selection],
  );

  useEffect(() => {
    if (sessionId && loadedRef.current !== sessionId) {
      void loadMessages(sessionId);
    }
  }, [sessionId, loadMessages, loadedRef]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, sending]);

  const handleSend = async () => {
    const result = await send();
    if (result?.canvasState) {
      onCanvasUpdate(result.canvasState as ReportCanvasState);
    }
  };

  const resizeTextarea = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(200, Math.max(56, el.scrollHeight))}px`;
  };

  useEffect(() => {
    resizeTextarea();
  }, [input]);

  return (
    <div className="flex flex-col h-full min-h-0 bg-slate-50/80">
      <div className="px-4 py-3 border-b border-slate-200 bg-white flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-indigo-600" />
        <div>
          <p className="text-sm font-semibold text-slate-900">{st('siep.informe.chat.title')}</p>
          <p className="text-[10px] text-slate-500">{st('siep.informe.chat.subtitle')}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
        {loading && (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
          </div>
        )}
        {!loading &&
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {m.role !== 'user' && (
                <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-indigo-700" />
                </div>
              )}
              <div
                className={`max-w-[90%] rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white border border-slate-200 text-slate-800'
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
        <div ref={bottomRef} />
      </div>

      {err && (
        <p className="mx-3 mb-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-2 py-1">
          {err}
        </p>
      )}

      <div className="p-3 border-t border-slate-200 bg-white">
        {selectionLabel && (
          <div className="mb-2 flex items-start gap-2 rounded-lg border border-indigo-200 bg-indigo-50/80 px-2.5 py-2">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-indigo-800 uppercase tracking-wide">
                {st('siep.informe.selection.chatFocus')}
              </p>
              <p className="text-xs text-indigo-900 truncate" title={selectionLabel}>
                {selectionLabel}
              </p>
            </div>
            <button
              type="button"
              onClick={onClearSelection}
              className="p-1 text-indigo-400 hover:text-indigo-700 shrink-0"
              title={st('siep.informe.selection.clear')}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                void handleSend();
              }
            }}
            rows={3}
            placeholder={
              selectionLabel
                ? st('siep.informe.chat.placeholderWithSelection')
                : st('siep.informe.chat.placeholder')
            }
            className="flex-1 text-sm rounded-lg border border-slate-200 px-3 py-2 resize-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 min-h-[3.5rem] max-h-[12rem]"
          />
          <button
            type="button"
            disabled={sending || !input.trim()}
            onClick={() => void handleSend()}
            className="self-end px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            title={st('siep.informe.chat.sendHint')}
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        <p className="mt-1.5 text-[10px] text-slate-400">{st('siep.informe.chat.sendHint')}</p>
      </div>
    </div>
  );
}
