'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Check, Loader2, Pencil, RefreshCw, Send, Sparkles, X } from 'lucide-react';
import { useSiepInformeSession, type SiepInformeMsg } from '@/hooks/useSiepInformeSession';
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

function findPrecedingUserMessage(
  messages: SiepInformeMsg[],
  assistantId: string,
): SiepInformeMsg | null {
  const idx = messages.findIndex((m) => m.id === assistantId);
  if (idx <= 0) return null;
  for (let i = idx - 1; i >= 0; i -= 1) {
    if (messages[i].role === 'user') return messages[i];
  }
  return null;
}

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
  const {
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
  } = useSiepInformeSession(reportId, sessionId, canvas, locale, selection);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editRef = useRef<HTMLTextAreaElement>(null);

  const [selectedMsgId, setSelectedMsgId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');

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

  useEffect(() => {
    if (editingId && editRef.current) {
      editRef.current.focus();
      editRef.current.style.height = 'auto';
      editRef.current.style.height = `${Math.min(280, Math.max(80, editRef.current.scrollHeight))}px`;
    }
  }, [editingId, editDraft]);

  const applyResult = (result: { canvasState?: unknown } | null) => {
    if (result?.canvasState) {
      onCanvasUpdate(result.canvasState as ReportCanvasState);
    }
  };

  const handleSend = async () => {
    const result = await send();
    applyResult(result);
    setSelectedMsgId(null);
    setEditingId(null);
  };

  const startEdit = (m: SiepInformeMsg) => {
    setSelectedMsgId(m.id);
    setEditingId(m.id);
    setEditDraft(m.content);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft('');
  };

  const saveEdit = async () => {
    if (!editingId || !editDraft.trim() || sending) return;
    const result = await editAndResend(editingId, editDraft.trim());
    applyResult(result);
    setEditingId(null);
    setEditDraft('');
    setSelectedMsgId(null);
  };

  const handleRegenerateFromUser = async (userMsgId: string) => {
    if (sending) return;
    const result = await regenerate(userMsgId);
    applyResult(result);
    setSelectedMsgId(null);
    setEditingId(null);
  };

  const handleRegenerateAssistant = async (assistantId: string) => {
    const userMsg = findPrecedingUserMessage(messages, assistantId);
    if (!userMsg) return;
    await handleRegenerateFromUser(userMsg.id);
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
          messages.map((m) => {
            const isUser = m.role === 'user';
            const isSelected = selectedMsgId === m.id;
            const isEditing = editingId === m.id;
            const isTemp = m.id.startsWith('tmp-');

            return (
              <div
                key={m.id}
                className={`flex gap-2 group ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-indigo-700" />
                  </div>
                )}
                <div className={`max-w-[90%] flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
                  {isEditing ? (
                    <div className="w-full min-w-[220px] rounded-xl border border-indigo-300 bg-white p-2 shadow-sm">
                      <textarea
                        ref={editRef}
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                        rows={4}
                        className="w-full text-sm rounded-lg border border-slate-200 px-2 py-1.5 resize-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            e.preventDefault();
                            cancelEdit();
                          }
                          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                            e.preventDefault();
                            void saveEdit();
                          }
                        }}
                      />
                      <div className="mt-1.5 flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={cancelEdit}
                          disabled={sending}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                        >
                          <X className="w-3 h-3" />
                          {st('siep.informe.chat.cancelEdit')}
                        </button>
                        <button
                          type="button"
                          onClick={() => void saveEdit()}
                          disabled={sending || !editDraft.trim()}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                        >
                          {sending ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Check className="w-3 h-3" />
                          )}
                          {st('siep.informe.chat.saveAndResend')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={sending || isTemp}
                      onClick={() => setSelectedMsgId(isSelected ? null : m.id)}
                      className={`text-left rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap transition ${
                        isUser
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white border border-slate-200 text-slate-800'
                      } ${
                        isSelected
                          ? 'ring-2 ring-offset-1 ring-amber-400'
                          : 'hover:opacity-95'
                      } disabled:opacity-70`}
                    >
                      {m.content}
                    </button>
                  )}

                  {!isEditing && isSelected && !isTemp && (
                    <div
                      className={`flex flex-wrap gap-1 ${isUser ? 'justify-end' : 'justify-start'}`}
                    >
                      {isUser && (
                        <>
                          <button
                            type="button"
                            disabled={sending}
                            onClick={() => startEdit(m)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            <Pencil className="w-3 h-3" />
                            {st('siep.informe.chat.edit')}
                          </button>
                          <button
                            type="button"
                            disabled={sending}
                            onClick={() => void handleRegenerateFromUser(m.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md border border-indigo-200 bg-indigo-50 text-indigo-800 hover:bg-indigo-100 disabled:opacity-50"
                          >
                            <RefreshCw className="w-3 h-3" />
                            {st('siep.informe.chat.regenerate')}
                          </button>
                        </>
                      )}
                      {!isUser && (
                        <button
                          type="button"
                          disabled={sending}
                          onClick={() => void handleRegenerateAssistant(m.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md border border-indigo-200 bg-indigo-50 text-indigo-800 hover:bg-indigo-100 disabled:opacity-50"
                        >
                          <RefreshCw className="w-3 h-3" />
                          {st('siep.informe.chat.regenerate')}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        {sending && (
          <div className="flex items-center gap-2 text-xs text-slate-500 px-1">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
            {st('siep.informe.chat.thinking')}
          </div>
        )}
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
        <p className="mt-1.5 text-[10px] text-slate-400">
          {st('siep.informe.chat.sendHint')} · {st('siep.informe.chat.selectHint')}
        </p>
      </div>
    </div>
  );
}
