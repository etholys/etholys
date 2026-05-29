'use client';

import { Suspense, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Loader2, MessageCircle, Paperclip, Send, Sparkles } from 'lucide-react';
import { useApp } from '@/app/providers';
import { getNexusHybridCopy, nexusHybridLocale } from '@/lib/nexus-hybrid';
import { useNexusCopilotSession } from '@/hooks/useNexusCopilotSession';
import { cn } from '@/lib/utils';
import { NEXUS_MAX_FILES } from '@/lib/nexus-chat-attachments';

function nexusLoc(app: string): 'pt' | 'es' | 'en' {
  return nexusHybridLocale(app);
}

function TeaserInner({
  withNet,
  variant = 'card',
}: {
  withNet: (path: string) => string;
  variant?: 'card' | 'flow';
}) {
  const { activeCompanyId, locale: appLoc } = useApp();
  const searchParams = useSearchParams();
  const networkId = searchParams.get('network');
  const nexusLocale = nexusLoc(appLoc);
  const t = getNexusHybridCopy(appLoc);

  const nexusBoost = useMemo(
    () => ({
      ...(networkId ? { networkId } : {}),
    }),
    [networkId],
  );

  const attRef = useRef<HTMLInputElement>(null);
  const {
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
  } = useNexusCopilotSession({
    activeCompanyId,
    nexusLocale,
    nexusBoost,
  });

  useEffect(() => {
    void ensureSession();
  }, [ensureSession]);

  const lastAssistant = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return messages[i].content;
    }
    return null;
  }, [messages]);

  const coachHref = withNet('/hub/nexus/coach');
  const preview = lastAssistant
    ? lastAssistant.length > 220
      ? `${lastAssistant.slice(0, 220).trim()}…`
      : lastAssistant
    : null;

  const isFlow = variant === 'flow';

  return (
    <div
      className={cn(
        isFlow
          ? 'overflow-hidden rounded-2xl bg-violet-50/50 px-2 py-2 sm:px-3'
          : 'overflow-hidden rounded-2xl border border-violet-200 bg-white shadow-sm',
      )}
    >
      {!isFlow && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-violet-100 bg-violet-50/50 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-violet-600 text-white" aria-hidden>
              <Sparkles className="h-4 w-4" />
            </span>
            <p className="text-sm font-semibold text-slate-900">{t.chatTeaserTitle}</p>
          </div>
          <Link
            href={coachHref}
            className="inline-flex items-center gap-1 text-xs font-medium text-violet-700 hover:text-violet-900"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            {t.chatTeaserOpenFull}
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}
      {isFlow && (
        <div className="mb-1 flex justify-end">
          <Link
            href={coachHref}
            className="inline-flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-800"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            {t.chatTeaserOpenFull}
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}

      <div className={cn('p-3', isFlow && 'p-0 pt-1')}>
        {loading && (
          <div className="flex items-center justify-center gap-2 py-6 text-violet-600">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-sm text-slate-500">…</span>
          </div>
        )}

        {!loading && (booting || preview) && (
          <div
            className={cn(
              'mb-2 max-h-24 overflow-y-auto rounded-xl border border-slate-100/80 bg-white/60 px-3 py-2 text-sm leading-snug text-slate-800',
              isFlow && 'border-violet-100/60 bg-white/80',
              booting && 'flex items-center gap-2 text-slate-500',
            )}
          >
            {booting ? (
              <>
                <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin" />
                <span className="text-xs">…</span>
              </>
            ) : (
              <p className="whitespace-pre-wrap">{preview}</p>
            )}
          </div>
        )}

        {err && <p className="mb-2 text-xs text-red-600">{err}</p>}

        <div className="space-y-1.5">
          {attachmentFiles.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {attachmentFiles.map((f, i) => (
                <button
                  key={`${f.name}-${i}-${f.size}`}
                  type="button"
                  onClick={() => removeAttachmentAt(i)}
                  className="max-w-[140px] truncate rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-700 hover:bg-red-50"
                >
                  {f.name}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <label className="sr-only" htmlFor="nexus-home-chat-input">
              {t.chatTeaserTitle}
            </label>
            <textarea
              id="nexus-home-chat-input"
              className="min-h-[40px] flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-400"
              rows={2}
              placeholder={t.chatTeaserPlaceholder}
              value={input}
              disabled={loading || !sessionId || sending || booting}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <input
              ref={attRef}
              type="file"
              className="sr-only"
              multiple
              accept="*/*"
              onChange={(e) => {
                addAttachmentFiles(e.target.files);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              disabled={loading || !sessionId || sending || booting || attachmentFiles.length >= NEXUS_MAX_FILES}
              onClick={() => attRef.current?.click()}
              className="flex h-10 w-9 flex-shrink-0 items-center justify-center self-end rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              title="Anexar"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={
                loading || !sessionId || sending || booting || (!input.trim() && attachmentFiles.length === 0)
              }
              onClick={() => void send()}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center self-end rounded-xl bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40"
              title="Enviar"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

type OuterProps = {
  withNet: (path: string) => string;
  variant?: 'card' | 'flow';
};

/**
 * Teaser de copiloto na visão geral: mesma sessão que a página do coach.
 * `flow`: encaixado numa "lição" única, sem caixa a competir.
 */
export function NexusHomeChatTeaser({ withNet, variant = 'card' }: OuterProps) {
  return (
    <Suspense
      fallback={
        <div className="h-32 animate-pulse rounded-2xl border border-violet-100 bg-violet-50/30" aria-hidden />
      }
    >
      <TeaserInner withNet={withNet} variant={variant} />
    </Suspense>
  );
}
