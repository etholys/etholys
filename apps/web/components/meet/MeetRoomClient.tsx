'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ExternalLink,
  Loader2,
  PanelRightClose,
  PanelRightOpen,
  PhoneOff,
  Sparkles,
  Video,
} from 'lucide-react';
import { meetEmbedUrl } from '@/lib/meet/room';
import { canEmbedJitsiInIframe } from '@/lib/forge/jitsi-config';
import { useApp } from '@/app/providers';
import { isLikelyDbId } from '@/lib/utils';

type SessionRow = {
  id: string;
  title: string;
  status: string;
  meetingUrl: string | null;
  projectId: string | null;
};

type Briefing = {
  alert: string;
  themes: string[];
  openDecisions: string[];
  suggestedNextSteps: string[];
};

type Props = {
  sessionId: string;
};

export function MeetRoomClient({ sessionId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale, activeCompanyId } = useApp();
  const t = (pt: string, es: string, en: string) => (locale === 'pt' ? pt : locale === 'es' ? es : en);

  const companyId =
    searchParams.get('companyId')?.trim() ||
    (activeCompanyId && isLikelyDbId(activeCompanyId) ? activeCompanyId : '');

  const [session, setSession] = useState<SessionRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [notes, setNotes] = useState('');
  const [briefBusy, setBriefBusy] = useState(false);
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [ending, setEnding] = useState(false);

  const load = useCallback(async () => {
    if (!companyId) {
      setError(t('Empresa não selecionada.', 'Empresa no seleccionada.', 'No company selected.'));
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(
        `/api/meet/sessions/${sessionId}?companyId=${encodeURIComponent(companyId)}`,
      );
      const d = (await r.json()) as { session?: SessionRow; error?: string };
      if (!r.ok) throw new Error(d.error || 'Error');
      setSession(d.session ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, [companyId, sessionId, locale]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!companyId || !session || session.status === 'live' || session.status === 'ended') return;
    void fetch(`/api/meet/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, status: 'live' }),
    }).then(() => {
      setSession((s) => (s ? { ...s, status: 'live' } : s));
    });
  }, [companyId, session, sessionId]);

  const embedSrc = useMemo(() => {
    const url = session?.meetingUrl;
    if (!url || !canEmbedJitsiInIframe(url)) return null;
    return meetEmbedUrl(url, { host: true });
  }, [session?.meetingUrl]);

  async function runBriefing() {
    if (!companyId) return;
    setBriefBusy(true);
    setBriefing(null);
    try {
      const r = await fetch(`/api/meet/sessions/${sessionId}/briefing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, notesSoFar: notes, locale, markLive: true }),
      });
      const d = (await r.json()) as { error?: string; briefing?: Briefing };
      if (!r.ok) throw new Error(d.error || 'Error');
      setBriefing(d.briefing ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setBriefBusy(false);
    }
  }

  async function endMeeting() {
    if (!companyId) return;
    setEnding(true);
    try {
      await fetch(`/api/meet/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, status: 'ended' }),
      });
      router.push(`/hub/meet?post=${sessionId}`);
    } catch {
      setEnding(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-sky-400" />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-4">
        <p className="text-sm text-red-700">{error || t('Sessão não encontrada.', 'Sesión no encontrada.', 'Session not found.')}</p>
        <Link href="/hub/meet" className="text-sm font-medium text-sky-700 hover:underline">
          {t('Voltar ao Meet', 'Volver al Meet', 'Back to Meet')}
        </Link>
      </div>
    );
  }

  const backHref = session.projectId
    ? `/siep/projects/${session.projectId}?tab=meetings`
    : '/hub/meet';

  return (
    <div className="flex h-screen flex-col bg-slate-950 text-white">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900/95 px-3 py-2 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t('Sair', 'Salir', 'Leave')}
          </Link>
          <Video className="h-4 w-4 shrink-0 text-sky-400" />
          <span className="truncate text-sm font-semibold">{session.title}</span>
          <span className="rounded-full bg-sky-900 px-2 py-0.5 text-[10px] font-semibold uppercase text-sky-300">
            {session.status}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {session.meetingUrl && (
            <a
              href={session.meetingUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
            >
              Jitsi
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          <button
            type="button"
            onClick={() => setPanelOpen((o) => !o)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
          >
            {panelOpen ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
            {t('IA', 'IA', 'AI')}
          </button>
          <button
            type="button"
            onClick={() => void endMeeting()}
            disabled={ending || session.status === 'ended'}
            className="inline-flex items-center gap-1 rounded-lg bg-red-700 px-3 py-1 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-50"
          >
            {ending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PhoneOff className="h-3.5 w-3.5" />}
            {t('Encerrar', 'Cerrar', 'End')}
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <main className="relative min-w-0 flex-1 bg-black">
          {embedSrc ? (
            <iframe
              title="Etholys Meet"
              src={embedSrc}
              className="absolute inset-0 h-full w-full"
              allow="camera; microphone; fullscreen; display-capture; autoplay"
            />
          ) : session.meetingUrl ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
              <p className="max-w-md text-sm text-slate-400">
                {t(
                  'Este Jitsi não permite embed (ex.: meet.jit.si). Abra numa nova janela.',
                  'Este Jitsi no permite embed (ej.: meet.jit.si). Abre en una ventana nueva.',
                  'This Jitsi host does not allow embed (e.g. meet.jit.si). Open in a new window.',
                )}
              </p>
              <a
                href={session.meetingUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
              >
                {t('Abrir Jitsi', 'Abrir Jitsi', 'Open Jitsi')}
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">
              {t('Sala sem URL.', 'Sala sin URL.', 'Room has no URL.')}
            </div>
          )}
        </main>

        {panelOpen && (
          <aside className="flex w-full max-w-sm shrink-0 flex-col border-l border-slate-800 bg-slate-900 sm:w-80">
            <div className="border-b border-slate-800 px-3 py-2">
              <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-sky-400">
                <Sparkles className="h-3.5 w-3.5" />
                {t('Alerta em curso', 'Alerta en curso', 'Live briefing')}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {t(
                  'Cole notas parciais durante a call. A IA sugere temas e próximos passos (sem criar tarefas ainda).',
                  'Pega notas parciales durante la call. La IA sugiere temas y próximos pasos (sin crear tareas aún).',
                  'Paste partial notes during the call. AI suggests themes and next steps (no tasks yet).',
                )}
              </p>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={8}
                className="min-h-[120px] flex-1 resize-none rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 outline-none focus:ring-2 focus:ring-sky-600"
                placeholder={t(
                  'Notas da reunião…',
                  'Notas de la reunión…',
                  'Meeting notes…',
                )}
              />
              <button
                type="button"
                onClick={() => void runBriefing()}
                disabled={briefBusy || !notes.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-700 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-600 disabled:opacity-50"
              >
                {briefBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {t('Gerar alerta', 'Generar alerta', 'Generate briefing')}
              </button>
              {briefing && (
                <div className="space-y-2 overflow-y-auto rounded-lg border border-sky-900/50 bg-sky-950/40 p-3 text-xs">
                  <p className="font-semibold text-sky-200">{briefing.alert}</p>
                  {briefing.themes.length > 0 && (
                    <div>
                      <p className="font-medium text-slate-400">{t('Temas', 'Temas', 'Themes')}</p>
                      <ul className="mt-1 list-inside list-disc text-slate-300">
                        {briefing.themes.map((x) => (
                          <li key={x}>{x}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {briefing.openDecisions.length > 0 && (
                    <div>
                      <p className="font-medium text-slate-400">{t('Decisões abertas', 'Decisiones abiertas', 'Open decisions')}</p>
                      <ul className="mt-1 list-inside list-disc text-slate-300">
                        {briefing.openDecisions.map((x) => (
                          <li key={x}>{x}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {briefing.suggestedNextSteps.length > 0 && (
                    <div>
                      <p className="font-medium text-slate-400">{t('Próximos passos', 'Próximos pasos', 'Next steps')}</p>
                      <ul className="mt-1 list-inside list-disc text-slate-300">
                        {briefing.suggestedNextSteps.map((x) => (
                          <li key={x}>{x}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
