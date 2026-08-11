'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ExternalLink,
  FileText,
  HardDrive,
  Info,
  Loader2,
  Mic,
  Square,
  Users,
  X,
} from 'lucide-react';
import { meetEmbedUrl } from '@/lib/meet/room';
import { canEmbedJitsiInIframe } from '@/lib/forge/jitsi-config';
import { useApp } from '@/app/providers';
import { isLikelyDbId } from '@/lib/utils';
import {
  MeetConferenceFrame,
  type MeetConferenceHandle,
} from '@/components/meet/MeetConferenceFrame';

type SessionRow = {
  id: string;
  title: string;
  status: string;
  meetingUrl: string | null;
  projectId: string | null;
  transcriptText?: string | null;
  seriesParentId?: string | null;
};

type TranscriptSegment = {
  messageId: string;
  participantId?: string;
  participantName: string;
  text: string;
  language?: string;
  startedAt: string;
  final: boolean;
};

type Props = {
  sessionId: string;
};

function formatMeetClock(locale: string, date: Date): string {
  const tag = locale === 'pt' ? 'pt-BR' : locale === 'es' ? 'es' : 'en-US';
  return date.toLocaleTimeString(tag, { hour: 'numeric', minute: '2-digit' });
}

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
  const [panelOpen, setPanelOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [ending, setEnding] = useState(false);
  const [transcriptionOn, setTranscriptionOn] = useState(false);
  const [recordingMode, setRecordingMode] = useState<'local' | null>(null);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [participantCount, setParticipantCount] = useState(0);
  const [dominantSpeaker, setDominantSpeaker] = useState<string | null>(null);
  const [clock, setClock] = useState(() => formatMeetClock(locale, new Date()));
  const [features, setFeatures] = useState({
    liveTranscriptionEnabled: false,
  });
  const conferenceRef = useRef<MeetConferenceHandle>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const leaveQuietRef = useRef(false);

  useEffect(() => {
    const prev = document.title;
    const label = session?.title?.trim();
    document.title = label ? `Etholys Meet — ${label}` : 'Etholys Meet';
    return () => {
      document.title = prev;
    };
  }, [session?.title]);

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
      if (d.session?.seriesParentId && d.session.seriesParentId !== sessionId) {
        router.replace(
          `/hub/meet/${d.session.seriesParentId}?companyId=${encodeURIComponent(companyId)}`,
        );
        return;
      }
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
    const tick = () => setClock(formatMeetClock(locale, new Date()));
    tick();
    const id = window.setInterval(tick, 15_000);
    return () => window.clearInterval(id);
  }, [locale]);

  useEffect(() => {
    if (!companyId) return;
    void Promise.all([
      fetch('/api/meet/status')
        .then((r) => r.json())
        .then((d) =>
          setFeatures({
            liveTranscriptionEnabled: Boolean(d.liveTranscriptionEnabled),
          }),
        ),
      fetch(
        `/api/meet/sessions/${sessionId}/transcript?companyId=${encodeURIComponent(companyId)}`,
      )
        .then((r) => r.json())
        .then((d) => {
          if (!Array.isArray(d.segments)) return;
          setSegments(
            d.segments.map((row: any) => ({
              messageId: row.messageId,
              participantId: row.participantId || undefined,
              participantName: row.participantName,
              text: row.text,
              language: row.language || undefined,
              startedAt: row.startedAt,
              final: true,
            })),
          );
        }),
    ]).catch(() => {
      // A sala continua funcional mesmo se o estado auxiliar ainda não estiver disponível.
    });
  }, [companyId, sessionId]);

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

  const externalRoomUrl = useMemo(() => {
    const url = session?.meetingUrl;
    if (!url) return null;
    return meetEmbedUrl(url, { host: true, title: session.title });
  }, [session?.meetingUrl, session?.title]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [segments]);

  const handleTranscriptionChunk = useCallback(
    (chunk: {
      language?: string;
      messageID?: string;
      participant?: { id?: string; name?: string };
      final?: string;
      stable?: string;
      unstable?: string;
    }) => {
      const text = (chunk.final || chunk.stable || chunk.unstable || '').trim();
      if (!text) return;
      const messageId =
        chunk.messageID ||
        `${chunk.participant?.id || 'unknown'}-${Date.now()}-${text.slice(0, 12)}`;
      const row: TranscriptSegment = {
        messageId,
        participantId: chunk.participant?.id,
        participantName:
          chunk.participant?.name?.trim() ||
          t('Participante', 'Participante', 'Participant'),
        text,
        language: chunk.language,
        startedAt: new Date().toISOString(),
        final: Boolean(chunk.final),
      };
      setSegments((current) => {
        const index = current.findIndex((item) => item.messageId === messageId);
        if (index < 0) return [...current, row];
        const next = [...current];
        next[index] = { ...current[index], ...row };
        return next;
      });

      if (chunk.final && companyId) {
        void fetch(`/api/meet/sessions/${sessionId}/transcript`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId,
            messageId,
            participantId: row.participantId,
            participantName: row.participantName,
            language: row.language,
            text: row.text,
            startedAt: row.startedAt,
          }),
        }).catch(() => setError(t(
          'Falha ao guardar um trecho da transcrição.',
          'No se pudo guardar un fragmento de la transcripción.',
          'Failed to save a transcript segment.',
        )));
      }
    },
    [companyId, sessionId, locale],
  );

  function toggleTranscription() {
    setError(null);
    if (!features.liveTranscriptionEnabled) {
      setError(
        t(
          'A transcrição ao vivo ainda não está activa no Etholys Meet.',
          'La transcripción en vivo aún no está activa en Etholys Meet.',
          'Live transcription is not enabled on Etholys Meet yet.',
        ),
      );
      return;
    }
    if (transcriptionOn) {
      conferenceRef.current?.stopTranscription();
      setTranscriptionOn(false);
      return;
    }
    setPanelOpen(true);
    conferenceRef.current?.startTranscription();
    // Feedback imediato; o evento recordingStatusChanged confirma depois
    setTranscriptionOn(true);
  }

  function startLocalRecording() {
    setError(null);
    conferenceRef.current?.startRecording('local');
    setRecordingMode('local');
  }

  function stopRecording() {
    if (!recordingMode) return;
    conferenceRef.current?.stopRecording(recordingMode);
  }

  const endInFlight = useRef(false);

  async function endMeeting(opts?: { skipHangup?: boolean }) {
    if (!companyId || endInFlight.current || session?.status === 'ended') return;
    endInFlight.current = true;
    setEnding(true);
    try {
      if (transcriptionOn) conferenceRef.current?.stopTranscription();
      if (recordingMode) conferenceRef.current?.stopRecording(recordingMode);

      const transcript = segments
        .filter((row) => row.final)
        .map((row) => `${row.participantName}: ${row.text}`)
        .join('\n');
      const endpoint =
        transcript.length >= 20
          ? `/api/meet/sessions/${sessionId}/finalize`
          : `/api/meet/sessions/${sessionId}`;
      const response = await fetch(endpoint, {
        method: transcript.length >= 20 ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          transcript.length >= 20
            ? {
                companyId,
                transcriptText: transcript,
                endMeeting: true,
                replaceDrafts: true,
                locale,
              }
            : { companyId, status: 'ended' },
        ),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || 'Falha ao encerrar reunião');
      }
      if (!opts?.skipHangup) conferenceRef.current?.hangup();
      router.push(`/hub/meet?post=${sessionId}`);
    } catch (e) {
      endInFlight.current = false;
      setError(e instanceof Error ? e.message : 'Error');
      setEnding(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#202124]">
        <Loader2 className="h-8 w-8 animate-spin text-white/70" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f8f9fa] px-4">
        <p className="text-sm text-red-700">{error || t('Sessão não encontrada.', 'Sesión no encontrada.', 'Session not found.')}</p>
        <Link href="/hub/meet" className="text-sm font-medium text-[#1a73e8] hover:underline">
          {t('Voltar ao Meet', 'Volver al Meet', 'Back to Meet')}
        </Link>
      </div>
    );
  }

  const backHref = session.projectId
    ? `/siep/projects/${session.projectId}?tab=meetings`
    : companyId
      ? `/hub/meet?companyId=${encodeURIComponent(companyId)}`
      : '/hub/meet';
  const meetHomeHref = companyId
    ? `/hub/meet?companyId=${encodeURIComponent(companyId)}`
    : '/hub/meet';

  const speakerInitial = (dominantSpeaker || session.title).trim().charAt(0).toUpperCase() || 'E';

  function leaveToMeetHome() {
    // Sai da UI sem encerrar a reunião para os outros participantes
    leaveQuietRef.current = true;
    try {
      conferenceRef.current?.hangup();
    } catch {
      /* ignore */
    }
    router.push(meetHomeHref);
  }

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-[#202124] text-white">
      {/* Top bar — estilo Google Meet */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-3 px-4 pb-2 pt-3 sm:px-5">
        <div className="pointer-events-auto flex min-w-0 max-w-[min(100%,48rem)] items-center gap-2 text-[13px] text-white/90 sm:text-sm">
          <button
            type="button"
            onClick={leaveToMeetHome}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#3c4043]/95 px-2.5 py-1.5 text-xs font-medium text-white/90 shadow-sm hover:bg-[#4a4d51]"
            title={t('Voltar ao Meet', 'Volver a Meet', 'Back to Meet')}
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
            <span className="hidden sm:inline">Meet</span>
          </button>
          <time className="shrink-0 tabular-nums text-white/80">{clock}</time>
          <span className="shrink-0 text-white/35" aria-hidden>
            |
          </span>
          <h1 className="truncate font-medium tracking-tight text-white">{session.title}</h1>
          <button
            type="button"
            onClick={() => setInfoOpen((o) => !o)}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
            aria-label={t('Informação da reunião', 'Información de la reunión', 'Meeting info')}
            title={t('Informação', 'Información', 'Info')}
          >
            <Info className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>

        <div className="pointer-events-auto flex shrink-0 items-center gap-2">
          {dominantSpeaker && (
            <div className="hidden items-center gap-2 rounded-full bg-[#3c4043]/95 px-2.5 py-1.5 text-xs text-white/90 shadow-sm sm:flex">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#8ab4f8] text-[11px] font-semibold text-[#202124]">
                {speakerInitial}
              </span>
              <span className="max-w-[12rem] truncate">
                {dominantSpeaker}{' '}
                <span className="text-white/55">
                  ({t('a falar', 'hablando', 'speaking')})
                </span>
              </span>
            </div>
          )}
          <div
            className="inline-flex items-center gap-1.5 rounded-full bg-[#3c4043]/95 px-2.5 py-1.5 text-xs text-white/90 shadow-sm"
            title={t('Participantes', 'Participantes', 'Participants')}
          >
            <Users className="h-3.5 w-3.5 text-white/75" strokeWidth={1.75} />
            <span className="min-w-[0.75rem] tabular-nums">{Math.max(participantCount, 0)}</span>
          </div>
          {recordingMode ? (
            <button
              type="button"
              onClick={stopRecording}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#ea4335] px-2.5 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-[#f28b82]"
            >
              <Square className="h-3 w-3" />
              {t('Parar gravação', 'Detener grabación', 'Stop recording')}
            </button>
          ) : (
            <button
              type="button"
              onClick={startLocalRecording}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#3c4043]/95 px-2.5 py-1.5 text-xs font-medium text-white/90 shadow-sm hover:bg-[#4a4d51]"
              title={t(
                'Grava e guarda no teu computador ao parar',
                'Graba y guarda en tu ordenador al detener',
                'Records and saves to your computer when stopped',
              )}
            >
              <HardDrive className="h-3.5 w-3.5 text-white/75" strokeWidth={1.75} />
              {t('Gravar', 'Grabar', 'Record')}
            </button>
          )}
        </div>
      </header>

      {infoOpen && (
        <div className="absolute left-4 top-14 z-40 w-[min(100%-2rem,20rem)] rounded-2xl border border-white/10 bg-[#292a2d] p-4 shadow-2xl sm:left-5">
          <div className="mb-2 flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-white">{session.title}</p>
            <button
              type="button"
              onClick={() => setInfoOpen(false)}
              className="rounded-full p-1 text-white/60 hover:bg-white/10 hover:text-white"
              aria-label={t('Fechar', 'Cerrar', 'Close')}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs leading-relaxed text-white/55">
            Etholys Meet
            {session.status === 'live'
              ? ` · ${t('Ao vivo', 'En vivo', 'Live')}`
              : ` · ${session.status}`}
          </p>
          <div className="mt-3 flex flex-col gap-2">
            <button
              type="button"
              onClick={leaveToMeetHome}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#8ab4f8] px-3 py-2 text-xs font-semibold text-[#202124] hover:bg-[#aecbfa]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {t('Voltar ao Meet', 'Volver a Meet', 'Back to Meet')}
            </button>
            {session.projectId && (
              <Link
                href={backHref}
                className="inline-flex w-full items-center justify-center rounded-full bg-white/10 px-3 py-1.5 text-xs text-white/90 hover:bg-white/15"
              >
                {t('Voltar ao projeto', 'Volver al proyecto', 'Back to project')}
              </Link>
            )}
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <main className="relative min-w-0 flex-1 px-3 pb-3 pt-14 sm:px-4 sm:pb-4">
          <div className="relative h-full w-full overflow-hidden rounded-2xl bg-[#131314]">
            {session.meetingUrl && canEmbedJitsiInIframe(session.meetingUrl) ? (
              <MeetConferenceFrame
                ref={conferenceRef}
                meetingUrl={session.meetingUrl}
                title={session.title}
                locale={locale}
                onReady={() => {
                  if (!features.liveTranscriptionEnabled) return;
                  // Arranque automático do STT ao vivo (Vosk) — evita “esquecer” o botão
                  setPanelOpen(true);
                  window.setTimeout(() => {
                    conferenceRef.current?.startTranscription();
                    setTranscriptionOn(true);
                  }, 800);
                }}
                onTranscriptionChunk={handleTranscriptionChunk}
                onParticipantCountChange={setParticipantCount}
                onDominantSpeakerChanged={setDominantSpeaker}
                onTranscriptToolbarClick={() => {
                  setPanelOpen((open) => {
                    const next = !open;
                    // Ao abrir o painel, arranca STT se ainda não estiver activo
                    if (next && !transcriptionOn && features.liveTranscriptionEnabled) {
                      window.setTimeout(() => conferenceRef.current?.startTranscription(), 0);
                    }
                    return next;
                  });
                }}
                onConferenceLeft={() => {
                  if (leaveQuietRef.current) {
                    leaveQuietRef.current = false;
                    return;
                  }
                  void endMeeting({ skipHangup: true });
                }}
                onRecordingStatus={(state) => {
                  if (state.transcription) {
                    setTranscriptionOn(state.on);
                    return;
                  }
                  // Só gravação local neste PC
                  setRecordingMode(state.on && state.mode === 'local' ? 'local' : state.on ? 'local' : null);
                }}
                onError={setError}
              />
            ) : externalRoomUrl ? (
              <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
                <p className="max-w-md text-sm text-white/55">
                  {t(
                    'Esta sala não pode ser incorporada neste ecrã. Abra numa nova janela.',
                    'Esta sala no se puede incorporar en esta pantalla. Abre en una ventana nueva.',
                    'This room cannot be embedded on this screen. Open it in a new window.',
                  )}
                </p>
                <a
                  href={externalRoomUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-[#8ab4f8] px-4 py-2 text-sm font-medium text-[#202124] hover:bg-[#aecbfa]"
                >
                  {t('Abrir em nova janela', 'Abrir en nueva ventana', 'Open in new window')}
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-white/40">
                {t('Sala sem URL.', 'Sala sin URL.', 'Room has no URL.')}
              </div>
            )}
          </div>
        </main>

        {panelOpen && (
          <aside className="flex w-full max-w-sm shrink-0 flex-col border-l border-white/10 bg-[#292a2d] sm:w-[22rem]">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div>
                <p className="flex items-center gap-1.5 text-sm font-medium text-white">
                  <FileText className="h-4 w-4 text-white/70" strokeWidth={1.75} />
                  {t('Transcrição ao vivo', 'Transcripción en vivo', 'Live transcript')}
                </p>
                <p className="mt-0.5 text-[11px] text-white/45">
                  {t(
                    'Trechos atribuídos ao nome de cada participante.',
                    'Fragmentos atribuidos al nombre de cada participante.',
                    'Segments attributed to each participant name.',
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                className="rounded-full p-1.5 text-white/55 hover:bg-white/10 hover:text-white"
                aria-label={t('Fechar painel', 'Cerrar panel', 'Close panel')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
              {error && (
                <div className="rounded-xl border border-red-500/30 bg-red-950/40 px-3 py-2 text-[11px] text-red-200">
                  {error}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={toggleTranscription}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-full px-2 py-2.5 text-xs font-medium ${
                    transcriptionOn
                      ? 'bg-[#ea4335] text-white hover:bg-[#f28b82]'
                      : 'bg-[#8ab4f8] text-[#202124] hover:bg-[#aecbfa]'
                  }`}
                >
                  {transcriptionOn ? <Square className="h-3 w-3" /> : <Mic className="h-3.5 w-3.5" />}
                  {transcriptionOn
                    ? t('Parar', 'Detener', 'Stop')
                    : t('Transcrever', 'Transcribir', 'Transcribe')}
                </button>
                <div className="relative">
                  {recordingMode ? (
                    <button
                      type="button"
                      onClick={stopRecording}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-[#ea4335] px-2 py-2.5 text-xs font-medium text-white hover:bg-[#f28b82]"
                      title={t(
                        'Para e descarrega o ficheiro no teu computador',
                        'Detiene y descarga el archivo en tu ordenador',
                        'Stops and downloads the file to your computer',
                      )}
                    >
                      <Square className="h-3 w-3" />
                      {t('Parar e guardar', 'Detener y guardar', 'Stop and save')}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={startLocalRecording}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-white/10 px-2 py-2.5 text-xs font-medium text-white hover:bg-white/15"
                      title={t(
                        'Grava no browser e guarda no teu disco (Downloads / pasta que escolheres)',
                        'Graba en el navegador y guarda en tu disco (Descargas / carpeta que elijas)',
                        'Records in the browser and saves to your disk (Downloads / folder you choose)',
                      )}
                    >
                      <HardDrive className="h-3.5 w-3.5" strokeWidth={1.75} />
                      {t('Gravar neste PC', 'Grabar en este PC', 'Record to this PC')}
                    </button>
                  )}
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl bg-[#1f1f1f] p-3">
                {segments.length === 0 ? (
                  <div className="flex h-full min-h-32 items-center justify-center px-3 text-center text-[11px] text-white/40">
                    {features.liveTranscriptionEnabled
                      ? t(
                          'Clique em «Transcrever». Os trechos aparecerão aqui com o nome de quem falou.',
                          'Haz clic en «Transcribir». Los fragmentos aparecerán con el nombre de quien habló.',
                          'Click “Transcribe”. Segments will appear here with the speaker name.',
                        )
                      : t(
                          'A transcrição ao vivo ainda está a ser activada no Etholys Meet.',
                          'La transcripción en vivo aún se está activando en Etholys Meet.',
                          'Live transcription is still being activated on Etholys Meet.',
                        )}
                  </div>
                ) : (
                  <ol className="space-y-3">
                    {segments.map((row) => (
                      <li
                        key={row.messageId}
                        className={row.final ? 'opacity-100' : 'opacity-60'}
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-[11px] font-medium text-[#8ab4f8]">
                            {row.participantName}
                          </span>
                          <time className="shrink-0 text-[9px] text-white/35">
                            {new Date(row.startedAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </time>
                        </div>
                        <p className="mt-0.5 text-xs leading-relaxed text-white/80">
                          {row.text}
                        </p>
                      </li>
                    ))}
                    <div ref={transcriptEndRef} />
                  </ol>
                )}
              </div>

              <p className="text-[10px] leading-relaxed text-white/35">
                {t(
                  'Avise os participantes antes de iniciar transcrição ou gravação.',
                  'Avisa a los participantes antes de iniciar la transcripción o grabación.',
                  'Notify participants before starting transcription or recording.',
                )}
              </p>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
