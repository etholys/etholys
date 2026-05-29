'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Bot,
  FileText,
  Loader2,
  Paperclip,
  Send,
  Sparkles,
  Factory,
  Orbit,
  LayoutGrid,
  Route,
  ClipboardList,
  X,
} from 'lucide-react';
import { useApp } from '@/app/providers';
import { cn } from '@/lib/utils';
import { useNexusCopilotSession } from '@/hooks/useNexusCopilotSession';
import { useNexusVoiceDialog, type NexusVoiceLocaleCode } from '@/hooks/useNexusVoiceDialog';
import { NexusVoiceToolbar } from '@/components/nexus/NexusVoiceToolbar';
import { NEXUS_MAX_FILES } from '@/lib/nexus-chat-attachments';

type NetworkRow = {
  id: string;
  name: string;
  siepProject?: { id: string; name: string } | null;
};

function nexusLocaleFromApp(loc: string): 'pt' | 'es' | 'en' {
  if (loc === 'es' || loc === 'en') return loc;
  return 'pt';
}

export type NexusCoachPanelProps = {
  /** Em `/hub/nexus`: painel lateral — sem crumbs “Resumen”. Na página só copiloto, mantém o link atrás */
  embeddedOnHub?: boolean;
  /** Mais altura ao chat quando em coluna ao lado da trilha */
  dense?: boolean;
  /** Ligado ao espelho na coluna direita (AiAdvisorSession) */
  onAdvisorSessionId?: (sessionId: string | null) => void;
  /** Quando mensagens atualizam (ex.: gravar/leit espelho) */
  onConversationActivity?: () => void;
};

export function NexusCoachPanel({
  embeddedOnHub = false,
  dense = false,
  onAdvisorSessionId,
  onConversationActivity,
}: NexusCoachPanelProps) {
  const { activeCompanyId, locale: appLocale } = useApp();
  const nexusLocale = nexusLocaleFromApp(appLocale);
  const searchParams = useSearchParams();
  const networkId = searchParams.get('network');
  const projectFromQs = searchParams.get('project');

  const [networks, setNetworks] = useState<NetworkRow[]>([]);
  const [projectOverride, setProjectOverride] = useState<string | null>(
    projectFromQs?.trim() ? projectFromQs.trim() : null,
  );
  const bottomRef = useRef<HTMLDivElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const [voicePreview, setVoicePreview] = useState('');

  const withNet = (href: string) => {
    const path = href.split('?')[0];
    if (!networkId) return path;
    return `${path}?network=${encodeURIComponent(networkId)}`;
  };

  const effectiveProjectId = useMemo(() => {
    if (projectOverride?.trim()) return projectOverride.trim();
    if (!networkId || networks.length === 0) return null;
    const n = networks.find((x) => x.id === networkId);
    return n?.siepProject?.id ?? null;
  }, [projectOverride, networkId, networks]);

  const nexusBoost = useMemo(
    () => ({
      ...(networkId ? { networkId } : {}),
      ...(effectiveProjectId ? { projectId: effectiveProjectId } : {}),
    }),
    [networkId, effectiveProjectId],
  );

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

  const onVoiceCommitted = useCallback(
    (text: string) => {
      const t = text.trim();
      if (!t) return;
      setInput((prev) => {
        const p = prev.trim();
        if (!p) return t;
        return `${p} ${t}`;
      });
    },
    [setInput],
  );

  const { speechSupported, listening, toggleListen, abortListening, speakAssistant, stopSpeaking } = useNexusVoiceDialog(
    nexusLocale as NexusVoiceLocaleCode,
    { onCommittedText: onVoiceCommitted, onInterim: setVoicePreview },
  );

  const speakLastAssistant = useCallback(() => {
    const last = [...messages].reverse().find((m) => m.role === 'assistant');
    if (last?.content?.trim()) speakAssistant(last.content);
  }, [messages, speakAssistant]);

  useEffect(() => {
    if (sending) stopSpeaking();
  }, [sending, stopSpeaking]);

  const submitMessage = () => {
    abortListening();
    stopSpeaking();
    void send();
  };

  useEffect(() => {
    fetch('/api/nexus/networks')
      .then((r) => r.json())
      .then((d) => setNetworks((d?.networks ?? []) as NetworkRow[]))
      .catch(() => setNetworks([]));
  }, []);

  useEffect(() => {
    void ensureSession();
  }, [ensureSession]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, booting, sending]);

  const tThinking =
    nexusLocale === 'es'
      ? {
          tag: 'Escribiendo',
          hint: 'Puede tardar un poco si pegaste texto largo; no cierres el chat.',
        }
      : nexusLocale === 'en'
        ? {
            tag: 'Drafting',
            hint: 'Long pastes take longer — keep this tab open.',
          }
        : {
            tag: 'A redigir',
            hint: 'Textos grandes demoram mais um pouco — mantém esta aberta.',
          };

  useEffect(() => {
    onAdvisorSessionId?.(sessionId);
  }, [sessionId, onAdvisorSessionId]);

  useEffect(() => {
    if (!sessionId) return;
    const id = window.setTimeout(() => onConversationActivity?.(), 500);
    return () => window.clearTimeout(id);
  }, [sessionId, messages.length, onConversationActivity]);

  const tIntro =
    nexusLocale === 'es'
      ? {
          h1: 'Copiloto NEXUS',
          sub: 'Una voz que acompaña: vamos a conocer vuestro negocio en diálogo, para alinear modelo, plan y marca, con pruebas y documentos (podéis pegar textos o describirlos; los archivos reales viven luego en Etholys o los referís aquí).',
        }
      : nexusLocale === 'en'
        ? {
            h1: 'NEXUS co-pilot',
            sub: 'A voice that stays with you: we explore the business in conversation—model, go-to-market, and brand—grounded in what you can paste, describe, or point to. Real files can stay in Etholys; you reference them here.',
          }
        : {
            h1: 'Copiloto NEXUS',
            sub: 'Uma voz presente: vamos conhecer o negócio no diálogo, para alinhar modelo, plano comercial e identidade, com o que forem colando ou descrevendo (ficheiros podem ficar no Etholys; descrevam o que têm). O copiloto vê tarefas pendentes na NEXUS e lembra-vos de forma concreta.',
          };

  const tNav =
    nexusLocale === 'es'
      ? {
          label: 'Atajos (mismo NEXUS)',
          journey: 'Fase y metas',
          journeyHint: 'Nivel, mercados',
          road: 'Ruta viva',
          roadHint: 'Acciones abiertas',
          diag: 'Diagnóstico',
          diagHint: 'Cuestionario',
          workspace: 'Centro hoy',
          workspaceHint: 'Etholys',
        }
      : nexusLocale === 'en'
        ? {
            label: 'Shortcuts (same NEXUS)',
            journey: 'Phase & goals',
            journeyHint: 'Level, markets',
            road: 'Live roadmap',
            roadHint: 'Open actions',
            diag: 'Diagnosis',
            diagHint: 'Questionnaire',
            workspace: 'Today hub',
            workspaceHint: 'Etholys',
          }
        : {
            label: 'Atalhos (mesmo NEXUS)',
            journey: 'Fase e metas',
            journeyHint: 'Nível, mercados',
            road: 'Rota viva',
            roadHint: 'Ações em aberto',
            diag: 'Diagnóstico',
            diagHint: 'Questionário',
            workspace: 'Centro hoje',
            workspaceHint: 'Etholys',
          };

  const immersiveChrome = !!(dense || embeddedOnHub);

  return (
    <div className={cn('w-full min-w-0', !embeddedOnHub && 'mx-auto max-w-md px-4 py-6 sm:max-w-lg')}>
      {embeddedOnHub ? (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500 to-violet-600 text-xl shadow-lg sm:h-14 sm:w-14 sm:text-2xl">
              <Bot className="h-7 w-7 text-white sm:h-8 sm:w-8" />
            </div>
            <div className="min-w-0">
              <h1 className="flex flex-wrap items-center gap-2 text-xl font-bold text-gray-900 sm:text-2xl">
                <Sparkles className="h-6 w-6 shrink-0 text-violet-600" aria-hidden />
                {tIntro.h1}
              </h1>
              <p
                className={cn(
                  'mt-1.5 max-w-xl leading-relaxed text-gray-600',
                  dense ? 'line-clamp-3 text-xs sm:text-sm' : 'text-xs sm:text-sm',
                )}
              >
                {tIntro.sub}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <Link
                href={withNet('/hub/nexus')}
                className="mb-2 inline-flex items-center gap-1 text-sm text-violet-700 hover:text-violet-900"
              >
                {nexusLocale === 'en' ? 'Overview' : nexusLocale === 'es' ? 'Resumen' : 'Visão geral'}
              </Link>
              <div className="flex items-start gap-3">
                <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500 to-violet-600 text-2xl shadow-lg">
                  <Bot className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold text-gray-900">
                    <Sparkles className="h-7 w-7 text-violet-600" />
                    {tIntro.h1}
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-600">{tIntro.sub}</p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {!embeddedOnHub ? (
        <div className="mb-4">
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">{tNav.label}</p>
          <div className="flex flex-wrap gap-2">
            <Link
              href={withNet('/hub/nexus/journey')}
              className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50/80 px-3 py-1.5 text-xs font-medium text-violet-900 transition hover:border-violet-300"
              title={tNav.journeyHint}
            >
              <Orbit className="h-3.5 w-3.5" />
              {tNav.journey}
            </Link>
            <Link
              href={withNet('/hub/nexus/roadmap')}
              className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50/80 px-3 py-1.5 text-xs font-medium text-indigo-900 transition hover:border-indigo-300"
              title={tNav.roadHint}
            >
              <Route className="h-3.5 w-3.5" />
              {tNav.road}
            </Link>
            <Link
              href={withNet('/hub/nexus/diagnosis')}
              className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50/80 px-3 py-1.5 text-xs font-medium text-sky-900 transition hover:border-sky-300"
              title={tNav.diagHint}
            >
              <ClipboardList className="h-3.5 w-3.5" />
              {tNav.diag}
            </Link>
            <Link
              href="/hub/workspace"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800 transition hover:border-slate-300"
              title={tNav.workspaceHint}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              {tNav.workspace}
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50/80 px-3 py-1.5 text-xs font-medium text-teal-900 transition hover:border-teal-300"
              title="ATLAS"
            >
              <Factory className="h-3.5 w-3.5" />
              ATLAS
            </Link>
          </div>
        </div>
      ) : (
        <div className="mb-3 hidden flex-wrap gap-1.5 sm:flex xl:hidden">
          <p className="mb-1 w-full text-[10px] font-semibold uppercase tracking-wide text-slate-400">{tNav.label}</p>
          <Link
            href={withNet('/hub/nexus/journey')}
            className="rounded-full border border-violet-200 bg-violet-50/70 px-2 py-1 text-[11px] font-medium text-violet-900"
          >
            {tNav.journey}
          </Link>
          <Link
            href={withNet('/hub/nexus/diagnosis')}
            className="rounded-full border border-sky-200 bg-sky-50/70 px-2 py-1 text-[11px] font-medium text-sky-900"
          >
            {tNav.diag}
          </Link>
          <Link href="/hub/workspace" className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-800">
            {tNav.workspace}
          </Link>
        </div>
      )}

      {networkId && !effectiveProjectId && (
        <div className="mb-4 rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-700">
          <label className="block text-xs font-medium text-gray-500">Projeto SIEP (opcional)</label>
          <input
            className="mt-1 w-full rounded border border-gray-200 px-2 py-1.5 font-mono text-xs"
            placeholder="cuid do projeto"
            value={projectOverride ?? ''}
            onChange={(e) => setProjectOverride(e.target.value || null)}
          />
        </div>
      )}

      <div className="mb-3">
        <NexusVoiceToolbar
          locale={nexusLocale as NexusVoiceLocaleCode}
          speechSupported={speechSupported}
          listening={listening}
          interimText={voicePreview}
          onToggleMic={toggleListen}
          onSpeakLast={speakLastAssistant}
        />
      </div>

      <div
        className={cn(
          'relative flex min-h-[300px] flex-col overflow-hidden rounded-3xl shadow-md',
          immersiveChrome &&
            'min-h-[min(72vh,calc(100vh-12rem))] shadow-[0_28px_70px_-20px_rgba(91,33,182,0.28)] ring-1 ring-violet-400/35',
          immersiveChrome &&
            'bg-[radial-gradient(90%_100%_at_50%_-10%,rgba(124,58,237,0.16),transparent_50%),linear-gradient(180deg,rgba(124,58,237,0.06),transparent_35%),linear-gradient(to_bottom,#f5f3ff,white)]',
          !immersiveChrome && 'border border-violet-200/85 bg-white',
        )}
      >
        <div
          className={cn(
            'border-b px-3 py-2.5 sm:px-4',
            immersiveChrome ? 'border-violet-200/80 bg-black/[0.04] backdrop-blur-sm' : 'border-violet-100 bg-violet-50/50',
          )}
        >
          <div className="flex items-start gap-2 text-[11px] leading-snug text-violet-900 sm:text-xs">
            <FileText className="mt-0.5 inline h-3.5 w-3.5 flex-shrink-0 text-violet-600" aria-hidden />
            <span>
              {nexusLocale === 'en'
                ? 'Speak (mic), hear the reply, or type — same thread; short & concrete beats long walls of text.'
                : nexusLocale === 'es'
                  ? 'Hablad por el micrófono, escuchá la última respuesta o escribid — el mismo hilo; breves y precisos.'
                  : 'Falem pelo microfone, ouçam a última resposta ou escrevam — o mesmo fio; breves e concretos.'}
            </span>
          </div>
        </div>
        <div
          className={cn(
            'relative flex-1 space-y-4 overflow-y-auto scroll-smooth p-3 sm:p-5',
            immersiveChrome ? 'max-h-[min(58vh,640px)] min-h-[260px]' : 'max-h-[58vh] min-h-[200px]',
            listening ? 'ring-2 ring-violet-300/35 ring-offset-2' : '',
          )}
        >
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 text-violet-600">
              <Loader2 className="h-10 w-10 animate-spin" />
              <p className="mt-2 text-sm text-gray-500">
                {booting
                  ? nexusLocale === 'en'
                    ? 'Starting the first message…'
                    : nexusLocale === 'es'
                      ? 'Preparando el primer saludo…'
                      : 'A preparar a primeira voz do copiloto…'
                  : nexusLocale === 'en'
                    ? 'Loading…'
                    : 'A carregar…'}
              </p>
            </div>
          )}
          {!loading &&
            messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  'rounded-2xl px-4 py-3.5 text-[15px] leading-relaxed shadow-sm backdrop-blur-[2px]',
                  m.role === 'user'
                    ? 'ml-auto max-w-[92%] border border-violet-200/70 bg-white/90 text-gray-900'
                    : 'mr-auto max-w-[96%] border border-white/70 bg-white/95 text-gray-800',
                  m.role === 'assistant' &&
                    immersiveChrome &&
                    'border-l-4 border-l-emerald-500/85 bg-[linear-gradient(to_right,rgba(16,185,129,0.06),transparent)]',
                )}
              >
                {m.role === 'assistant' && (
                  <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-800/95">
                    {nexusLocale === 'es' ? 'Copiloto' : nexusLocale === 'en' ? 'Co‑pilot' : 'Copiloto'}
                  </div>
                )}
                <p className="whitespace-pre-wrap">{m.content}</p>
              </div>
            ))}
          {!loading && sending && (
            <div
              aria-live="polite"
              className={cn(
                'mr-auto flex max-w-[96%] items-start gap-3 rounded-2xl border px-4 py-3.5 shadow-sm backdrop-blur-[2px]',
                immersiveChrome
                  ? 'border-emerald-300/65 bg-emerald-50/60'
                  : 'border-emerald-200 bg-emerald-50/90',
              )}
            >
              <Loader2 className="mt-1 h-4 w-4 shrink-0 animate-spin text-emerald-600" aria-hidden />
              <div className="min-w-0 text-[14px] leading-relaxed">
                <p className="font-semibold text-emerald-900">{tThinking.tag}</p>
                <p className="mt-1 text-emerald-800/95">{tThinking.hint}</p>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {err && <p className="border-t border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}

        <div className={cn('flex flex-col gap-2 border-t p-3', immersiveChrome ? 'border-violet-200/60 bg-violet-50/40' : 'border-gray-100 bg-white')}>
          {attachmentFiles.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {attachmentFiles.map((f, i) => (
                <button
                  key={`${f.name}-${i}-${f.size}`}
                  type="button"
                  onClick={() => removeAttachmentAt(i)}
                  className="inline-flex max-w-full items-center gap-1 rounded-full border border-violet-200/90 bg-white/90 px-2.5 py-1 text-[11px] font-medium text-violet-950 shadow-sm hover:border-red-300 hover:bg-red-50/80"
                  title={nexusLocale === 'es' ? 'Quitar' : nexusLocale === 'en' ? 'Remove' : 'Remover'}
                >
                  <span className="truncate">{f.name}</span>
                  <X className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <textarea
              className="min-h-[52px] flex-1 resize-none rounded-2xl border border-violet-200/70 bg-white/95 px-3 py-3 text-sm shadow-inner focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-300/50"
              rows={2}
              placeholder={
                nexusLocale === 'en'
                  ? 'Type… dictate, or attach files (paperclip)'
                  : nexusLocale === 'es'
                    ? 'Escribid, dictad o adjuntá documentos (clip)'
                    : 'Escrevei, ditai ou anexam ficheiros (clip)'
              }
              value={input}
              disabled={loading || sending || booting || !sessionId}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submitMessage();
                }
              }}
            />
            <input
              ref={attachmentInputRef}
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
              disabled={
                loading || sending || booting || !sessionId || attachmentFiles.length >= NEXUS_MAX_FILES
              }
              onClick={() => attachmentInputRef.current?.click()}
              className="flex h-[52px] w-[44px] flex-shrink-0 items-center justify-center self-end rounded-2xl border border-violet-200/70 bg-white/95 text-violet-800 shadow-inner transition hover:border-violet-300 hover:bg-violet-50 disabled:opacity-40"
              title={
                nexusLocale === 'es'
                  ? 'Adjuntar archivos'
                  : nexusLocale === 'en'
                    ? 'Attach files'
                    : 'Anexar ficheiros'
              }
            >
              <Paperclip className="h-5 w-5" />
            </button>
            <button
              type="button"
              disabled={
                loading ||
                sending ||
                booting ||
                !sessionId ||
                (!input.trim() && attachmentFiles.length === 0)
              }
              onClick={() => submitMessage()}
              className="flex h-[52px] w-[52px] flex-shrink-0 items-center justify-center self-end rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-md transition hover:brightness-105 disabled:opacity-40"
              title="Enviar"
            >
              {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
