'use client';

import { useEffect, useRef, useState } from 'react';
import type { StudioCopilotMode } from '@/lib/studio/copilot-modes';
import { modeLabel, STUDIO_COPILOT_MODES } from '@/lib/studio/copilot-modes';
import { studioQuickPrompts } from '@/lib/studio/copilot-quick-prompts';
import { StudioChatAttachmentChips } from '@/components/studio/StudioChatAttachmentChips';
import {
  BookMarked,
  ChevronDown,
  Loader2,
  MessageSquare,
  Mic,
  MicOff,
  Paperclip,
  PenLine,
  Send,
  Target,
  Wand2,
} from 'lucide-react';

type Props = {
  locale: string;
  mode: StudioCopilotMode;
  hasSelection: boolean;
  disabled?: boolean;
  chatBusy?: boolean;
  loading?: boolean;
  canEdit?: boolean;
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onModeChange: (mode: StudioCopilotMode) => void;
  onQuickPrompt: (prompt: string) => void;
  onAttachClick: () => void;
  onFolderContextClick?: () => void;
  showFolderContext?: boolean;
  dictationSupported?: boolean;
  dictating?: boolean;
  dictationInterim?: string;
  onToggleDictation?: () => void;
  pendingFileNames: string[];
  onRemovePendingFile: (index: number) => void;
  statusHint?: string | null;
  onEscapeCancel?: () => void;
};

const MODE_ICONS: Record<StudioCopilotMode, typeof MessageSquare> = {
  discuss: MessageSquare,
  propose: PenLine,
  apply: Wand2,
  edit_selection: Target,
};

export function StudioCopilotComposer({
  locale,
  mode,
  hasSelection,
  disabled,
  chatBusy,
  loading,
  canEdit,
  input,
  onInputChange,
  onSend,
  onModeChange,
  onQuickPrompt,
  onAttachClick,
  onFolderContextClick,
  showFolderContext,
  dictationSupported,
  dictating,
  dictationInterim,
  onToggleDictation,
  pendingFileNames,
  onRemovePendingFile,
  statusHint,
  onEscapeCancel,
}: Props) {
  const loc = locale === 'en' || locale === 'es' ? locale : 'pt';
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const quickPrompts = studioQuickPrompts(loc);

  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [menuOpen]);

  const ModeIcon = MODE_ICONS[mode];
  const canSend = !!canEdit && !chatBusy && !loading && (input.trim().length > 0 || pendingFileNames.length > 0);

  return (
    <div className="relative z-20 shrink-0 border-t border-stone-200/80 bg-[#faf8f5] p-2">
      <StudioChatAttachmentChips
        locale={loc}
        names={pendingFileNames}
        editable
        onRemove={onRemovePendingFile}
      />
      <div
        ref={rootRef}
        className="overflow-visible rounded-lg border border-stone-200/90 bg-white shadow-sm"
      >
        <div className="flex min-w-0 items-center gap-1 border-b border-stone-100 px-2 py-1">
          <div className="relative min-w-0">
            <button
              type="button"
              disabled={disabled}
              onClick={() => setMenuOpen((v) => !v)}
              className="inline-flex max-w-full items-center gap-1 truncate rounded px-1 py-0.5 text-[11px] font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-40"
            >
              <ModeIcon className="h-3 w-3 shrink-0 text-stone-500" />
              <span className="truncate">{modeLabel(mode, loc)}</span>
              <ChevronDown className="h-3 w-3 shrink-0 text-stone-400" />
            </button>
            {menuOpen && (
              <div className="absolute bottom-full left-0 z-50 mb-1 max-h-[min(60vh,320px)] min-w-[10rem] overflow-y-auto rounded-lg border border-stone-200 bg-white py-1 shadow-lg">
                {STUDIO_COPILOT_MODES.map((id) => {
                  const Icon = MODE_ICONS[id];
                  const dimmed = id === 'edit_selection' && !hasSelection;
                  return (
                    <button
                      key={id}
                      type="button"
                      disabled={dimmed}
                      onClick={() => {
                        onModeChange(id);
                        setMenuOpen(false);
                      }}
                      className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[11px] ${
                        mode === id ? 'bg-orange-50 font-semibold text-orange-900' : 'text-stone-700 hover:bg-stone-50'
                      } ${dimmed ? 'cursor-not-allowed opacity-40' : ''}`}
                    >
                      <Icon className="h-3 w-3 shrink-0" />
                      {modeLabel(id, loc)}
                    </button>
                  );
                })}
                <div className="my-1 border-t border-stone-100" />
                <p className="px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-stone-400">
                  {loc === 'es' ? 'Atajos' : loc === 'en' ? 'Shortcuts' : 'Atalhos'}
                </p>
                {quickPrompts.map((q) => {
                  const QIcon = q.icon;
                  return (
                    <button
                      key={q.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        onQuickPrompt(q.prompt);
                        setMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[11px] text-stone-700 hover:bg-stone-50 disabled:opacity-40"
                    >
                      <QIcon className="h-3 w-3 shrink-0 text-orange-600" />
                      <span className="truncate">{q.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <span className="ml-auto shrink-0 text-[9px] text-stone-400">Ctrl+↵</span>
        </div>

        {statusHint ? (
          <p className="border-b border-stone-50 px-2 py-1 text-[10px] leading-snug text-stone-500">
            {statusHint}
          </p>
        ) : null}

        <div className="relative px-2 pt-1.5">
          <textarea
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            disabled={disabled || !canEdit}
            rows={2}
            placeholder={
              dictating
                ? loc === 'es'
                  ? 'Escuchando…'
                  : loc === 'en'
                    ? 'Listening…'
                    : 'A ouvir…'
                : loc === 'es'
                  ? 'Instrucciones para la IA…'
                  : loc === 'en'
                    ? 'Instructions for AI…'
                    : 'Instruções para a IA…'
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                if (canSend) onSend();
              }
              if (e.key === 'Escape' && onEscapeCancel) {
                e.preventDefault();
                onEscapeCancel();
              }
            }}
            className="min-h-[52px] w-full resize-none border-0 bg-transparent px-0 py-0 text-[13px] leading-snug text-stone-900 outline-none placeholder:text-stone-400"
          />
          {dictating && dictationInterim ? (
            <p className="pointer-events-none absolute bottom-0.5 left-2 right-2 truncate text-[10px] italic text-orange-700/80">
              {dictationInterim}
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-0.5 px-1.5 pb-1.5 pt-0.5">
          <button
            type="button"
            disabled={disabled || !canEdit}
            onClick={onAttachClick}
            className="rounded p-1 text-stone-500 hover:bg-stone-100 disabled:opacity-40"
            title={loc === 'es' ? 'Adjuntar' : loc === 'en' ? 'Attach' : 'Anexar'}
          >
            <Paperclip className="h-3.5 w-3.5" />
          </button>
          {showFolderContext && onFolderContextClick ? (
            <button
              type="button"
              onClick={onFolderContextClick}
              className="rounded p-1 text-stone-500 hover:bg-stone-100"
              title={loc === 'es' ? 'Contexto carpeta' : loc === 'en' ? 'Folder context' : 'Contexto pasta'}
            >
              <BookMarked className="h-3.5 w-3.5" />
            </button>
          ) : null}
          {dictationSupported && onToggleDictation ? (
            <button
              type="button"
              disabled={disabled || !canEdit}
              onClick={onToggleDictation}
              className={`rounded p-1 disabled:opacity-40 ${
                dictating ? 'text-red-600 animate-pulse' : 'text-stone-500 hover:bg-stone-100'
              }`}
              title={loc === 'es' ? 'Dictar' : loc === 'en' ? 'Dictate' : 'Ditar'}
            >
              {dictating ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
            </button>
          ) : null}
          <button
            type="button"
            disabled={!canSend}
            onClick={onSend}
            className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-md bg-stone-900 text-white hover:bg-stone-800 disabled:opacity-30"
            title="Ctrl+Enter"
          >
            {chatBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
