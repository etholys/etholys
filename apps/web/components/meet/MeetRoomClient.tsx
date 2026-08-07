'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Cloud,
  ExternalLink,
  FileText,
  HardDrive,
  Loader2,
  Mic,
  PanelRightClose,
  PanelRightOpen,
  PhoneOff,
  Square,
  Video,
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
  const [ending, setEnding] = useState(false);
  const [transcriptionOn, setTranscriptionOn] = useState(false);
  const [recordingMode, setRecordingMode] = useState<'local' | 'cloud' | null>(null);
  const [showRecordMenu, setShowRecordMenu] = useState(false);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [features, setFeatures] = useState({
    liveTranscriptionEnabled: false,
    cloudRecordingEnabled: false,
  });
  const conferenceRef = useRef<MeetConferenceHandle>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

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
    if (!companyId) return;
    void Promise.all([
      fetch('/api/meet/status')
        .then((r) => r.json())
        .then((d) =>
          setFeatures({
            liveTranscriptionEnabled: Boolean(d.liveTranscriptionEnabled),
            cloudRecordingEnabled: Boolean(d.cloudRecordingEnabled),
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
    if (transcriptionOn) conferenceRef.current?.stopTranscription();
    else conferenceRef.current?.startTranscription();
  }

  function startRecording(destination: 'local' | 'cloud') {
    setError(null);
    if (destination === 'cloud' && !features.cloudRecordingEnabled) {
      setError(
        t(
          'A gravação na nuvem Etholys ainda não está disponível. Escolha «Este computador» por agora.',
          'La grabación en la nube Etholys aún no está disponible. Elige «Este ordenador» por ahora.',
          'Etholys cloud recording is not available yet. Choose “This computer” for now.',
        ),
      );
      return;
    }
    conferenceRef.current?.startRecording(destination);
    setShowRecordMenu(false);
  }

  function stopRecording() {
    if (!recordingMode) return;
    conferenceRef.current?.stopRecording(recordingMode);
  }

  async function endMeeting() {
    if (!companyId) return;
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
      conferenceRef.current?.hangup();
      router.push(`/hub/meet?post=${sessionId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
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

  if (!session) {
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
          {externalRoomUrl && (
            <a
              href={externalRoomUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
            >
              {t('Nova janela', 'Nueva ventana', 'New window')}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          <button
            type="button"
            onClick={() => setPanelOpen((o) => !o)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
          >
            {panelOpen ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
            {t('Transcrição', 'Transcripción', 'Transcript')}
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
          {session.meetingUrl && canEmbedJitsiInIframe(session.meetingUrl) ? (
            <MeetConferenceFrame
              ref={conferenceRef}
              meetingUrl={session.meetingUrl}
              title={session.title}
              locale={locale}
              onTranscriptionChunk={handleTranscriptionChunk}
              onRecordingStatus={(state) => {
                if (state.transcription) {
                  setTranscriptionOn(state.on);
                  return;
                }
                setRecordingMode(
                  state.on ? (state.mode === 'local' ? 'local' : 'cloud') : null,
                );
              }}
              onError={setError}
            />
          ) : externalRoomUrl ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
              <p className="max-w-md text-sm text-slate-400">
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
                className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
              >
                {t('Abrir em nova janela', 'Abrir en nueva ventana', 'Open in new window')}
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
                <FileText className="h-3.5 w-3.5" />
                {t('Transcrição ao vivo', 'Transcripción en vivo', 'Live transcript')}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {t(
                  'O transcritor ouve a sala e atribui cada trecho ao nome usado pelo participante.',
                  'El transcriptor escucha la sala y atribuye cada fragmento al nombre usado por el participante.',
                  'The transcriber listens to the room and attributes each segment to the participant name.',
                )}
              </p>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
              {error && (
                <div className="rounded-lg border border-red-900/70 bg-red-950/50 px-3 py-2 text-[11px] text-red-200">
                  {error}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={toggleTranscription}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold ${
                    transcriptionOn
                      ? 'bg-red-700 text-white hover:bg-red-600'
                      : 'bg-sky-700 text-white hover:bg-sky-600'
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
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-red-700 px-2 py-2 text-xs font-semibold text-white hover:bg-red-600"
                    >
                      <Square className="h-3 w-3" />
                      {t('Parar gravação', 'Detener grabación', 'Stop recording')}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowRecordMenu((open) => !open)}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-700 px-2 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
                    >
                      <Video className="h-3.5 w-3.5" />
                      {t('Gravar', 'Grabar', 'Record')}
                    </button>
                  )}
                  {showRecordMenu && (
                    <div className="absolute right-0 top-full z-20 mt-1 w-52 rounded-lg border border-slate-700 bg-slate-900 p-1 shadow-xl">
                      <button
                        type="button"
                        onClick={() => startRecording('local')}
                        className="flex w-full items-start gap-2 rounded px-2 py-2 text-left text-xs text-slate-200 hover:bg-slate-800"
                      >
                        <HardDrive className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>
                          <strong className="block">{t('Este computador', 'Este ordenador', 'This computer')}</strong>
                          <span className="text-[10px] text-slate-500">
                            {t('Descarrega ao parar', 'Descarga al detener', 'Downloads when stopped')}
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => startRecording('cloud')}
                        className="flex w-full items-start gap-2 rounded px-2 py-2 text-left text-xs text-slate-200 hover:bg-slate-800"
                      >
                        <Cloud className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>
                          <strong className="block">{t('Nuvem Etholys', 'Nube Etholys', 'Etholys cloud')}</strong>
                          <span className="text-[10px] text-slate-500">
                            {features.cloudRecordingEnabled
                              ? 'R2'
                              : t('Em breve', 'Próximamente', 'Coming soon')}
                          </span>
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/60 p-2">
                {segments.length === 0 ? (
                  <div className="flex h-full min-h-32 items-center justify-center px-3 text-center text-[11px] text-slate-500">
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
                  <ol className="space-y-2">
                    {segments.map((row) => (
                      <li
                        key={row.messageId}
                        className={row.final ? 'opacity-100' : 'opacity-60'}
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-[11px] font-semibold text-sky-300">
                            {row.participantName}
                          </span>
                          <time className="shrink-0 text-[9px] text-slate-600">
                            {new Date(row.startedAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </time>
                        </div>
                        <p className="mt-0.5 text-xs leading-relaxed text-slate-300">
                          {row.text}
                        </p>
                      </li>
                    ))}
                    <div ref={transcriptEndRef} />
                  </ol>
                )}
              </div>

              <p className="text-[10px] leading-relaxed text-slate-600">
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
