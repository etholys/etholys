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
  LayoutGrid,
  Loader2,
  Mic,
  PhoneOff,
  PictureInPicture2,
  Square,
  Users,
  ChevronLeft,
  PanelRightOpen,
  X,
} from 'lucide-react';
import { meetEmbedUrl } from '@/lib/meet/room';
import { meetRecapPath } from '@/lib/meet/types';
import { canEmbedJitsiInIframe } from '@/lib/forge/jitsi-config';
import { useApp } from '@/app/providers';
import { isLikelyDbId } from '@/lib/utils';
import {
  MeetConferenceFrame,
  type MeetConferenceHandle,
  type MeetLayoutMode,
} from '@/components/meet/MeetConferenceFrame';
import {
  startMeetLocalRecorder,
  type MeetLocalRecorder,
} from '@/lib/meet/local-recorder';

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

const LAYOUT_MODES: MeetLayoutMode[] = [
  'speaker',
  'gallery',
  'stage',
  'presentation',
  'crowded',
];

function formatMeetClock(locale: string, date: Date): string {
  const tag = locale === 'pt' ? 'pt-BR' : locale === 'es' ? 'es' : 'en-US';
  return date.toLocaleTimeString(tag, { hour: 'numeric', minute: '2-digit' });
}

function buildTranscriptText(segments: TranscriptSegment[]): string {
  return segments
    .filter((row) => row.final)
    .map((row) => `${row.participantName}: ${row.text}`)
    .join('\n')
    .trim();
}

function isWeakSpeakerName(name?: string | null): boolean {
  const n = (name || '').trim();
  if (!n) return true;
  return /^(participante|participant|eu|you|tú|tu|me|transcriber|jigasi|vosk|transcri)/i.test(n);
}

function speakerAccent(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  const hues = [210, 160, 30, 280, 340, 120, 190];
  const hue = hues[Math.abs(hash) % hues.length];
  return `hsl(${hue} 70% 68%)`;
}

function layoutLabel(
  mode: MeetLayoutMode,
  t: (pt: string, es: string, en: string) => string,
): string {
  switch (mode) {
    case 'gallery':
      return t('Galeria', 'Galería', 'Gallery');
    case 'stage':
      return t('Palco', 'Escenario', 'Stage');
    case 'presentation':
      return t('Apresentação', 'Presentación', 'Presentation');
    case 'crowded':
      return t('Compacta', 'Compacta', 'Compact');
    case 'speaker':
    default:
      return t('Orador', 'Orador', 'Speaker');
  }
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
  const [transcriptionWaiting, setTranscriptionWaiting] = useState(false);
  const [recordingOn, setRecordingOn] = useState(false);
  const [recordingBusy, setRecordingBusy] = useState(false);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [participantCount, setParticipantCount] = useState(0);
  const [dominantSpeaker, setDominantSpeaker] = useState<string | null>(null);
  const [clock, setClock] = useState(() => formatMeetClock(locale, new Date()));
  const [features, setFeatures] = useState({
    liveTranscriptionEnabled: false,
  });
  const [pipActive, setPipActive] = useState(false);
  const [layoutMode, setLayoutMode] = useState<MeetLayoutMode>('speaker');
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false);
  const conferenceRef = useRef<MeetConferenceHandle>(null);
  const dominantSpeakerRef = useRef<string | null>(null);
  const leaveQuietRef = useRef(false);
  const closingRef = useRef(false);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const localRecorderRef = useRef<MeetLocalRecorder | null>(null);
  const stageHomeRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const segmentsRef = useRef<TranscriptSegment[]>([]);
  const transcriptionStartedAtRef = useRef<number | null>(null);

  useEffect(() => {
    segmentsRef.current = segments;
  }, [segments]);

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

  // Aguarda texto do transcriber (Jigasi) sem alarmes ruidosos.
  useEffect(() => {
    if (!transcriptionOn) {
      setTranscriptionWaiting(false);
      transcriptionStartedAtRef.current = null;
      return;
    }
    if (segments.some((s) => s.text.trim())) {
      setTranscriptionWaiting(false);
      return;
    }
    setTranscriptionWaiting(true);
  }, [transcriptionOn, segments]);

  useEffect(() => {
    return () => {
      localRecorderRef.current?.destroy();
      localRecorderRef.current = null;
    };
  }, []);

  const handleTranscriptionChunk = useCallback(
    (chunk: {
      language?: string;
      messageID?: string;
      participant?: { id?: string; name?: string };
      final?: string;
      stable?: string;
      unstable?: string;
    }) => {
      const isFinal = Boolean(chunk.final);
      const text = (chunk.final || chunk.stable || chunk.unstable || '').trim();
      if (!text) return;
      setTranscriptionOn(true);
      setTranscriptionWaiting(false);

      let speakerName = chunk.participant?.name?.trim() || '';
      if (isWeakSpeakerName(speakerName) && dominantSpeakerRef.current) {
        speakerName = dominantSpeakerRef.current;
      }
      if (isWeakSpeakerName(speakerName)) {
        speakerName = t('Participante', 'Participante', 'Participant');
      }

      const messageId =
        chunk.messageID ||
        `${chunk.participant?.id || speakerName}-${isFinal ? 'f' : 'i'}-${text.slice(0, 24)}`;

      const row: TranscriptSegment = {
        messageId,
        participantId: chunk.participant?.id,
        participantName: speakerName,
        text,
        language: chunk.language,
        startedAt: new Date().toISOString(),
        final: isFinal,
      };

      setSegments((current) => {
        const index = current.findIndex((item) => item.messageId === messageId);
        if (index >= 0) {
          const next = [...current];
          next[index] = { ...current[index], ...row };
          return next;
        }

        // Um único bubble interino (ainda a falar)
        if (!isFinal) {
          const interimIdx = current.findIndex((item) => !item.final);
          if (interimIdx >= 0) {
            const next = [...current];
            next[interimIdx] = row;
            return next;
          }
          return [...current, row];
        }

        // Juntar finais consecutivos do mesmo falante (≈ Otter / blocos)
        const withoutInterim = current.filter((item) => item.final);
        const last = withoutInterim[withoutInterim.length - 1];
        if (
          last &&
          last.final &&
          last.participantName === row.participantName &&
          Date.now() - new Date(last.startedAt).getTime() < 12_000
        ) {
          const merged: TranscriptSegment = {
            ...last,
            text: `${last.text} ${row.text}`.replace(/\s+/g, ' ').trim(),
            messageId: last.messageId,
          };
          return [...withoutInterim.slice(0, -1), merged];
        }

        return [...withoutInterim, row];
      });

      if (isFinal && companyId) {
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
        }).catch(() => undefined);
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
      setTranscriptionWaiting(false);
      return;
    }
    setPanelOpen(true);
    transcriptionStartedAtRef.current = Date.now();
    setTranscriptionWaiting(true);
    setTranscriptionOn(true);
    conferenceRef.current?.startTranscription();
  }

  async function startLocalRecording() {
    setError(null);
    if (recordingOn || recordingBusy) return;
    setRecordingBusy(true);
    try {
      const { recorder } = await startMeetLocalRecorder();
      localRecorderRef.current = recorder;
      setRecordingOn(true);
    } catch (err) {
      localRecorderRef.current = null;
      setRecordingOn(false);
      if (err instanceof DOMException && err.name === 'AbortError') {
        /* utilizador cancelou o picker / partilha — silêncio */
        return;
      }
      setError(
        err instanceof Error
          ? err.message
          : t(
              'Não foi possível iniciar a gravação neste PC.',
              'No se pudo iniciar la grabación en este PC.',
              'Could not start recording on this PC.',
            ),
      );
    } finally {
      setRecordingBusy(false);
    }
  }

  async function stopRecording() {
    const recorder = localRecorderRef.current;
    if (!recorder) {
      setRecordingOn(false);
      return;
    }
    setRecordingBusy(true);
    try {
      const result = await recorder.stop();
      localRecorderRef.current = null;
      setRecordingOn(false);
      if (result.blob.size <= 0) {
        setError(
          t(
            'A gravação terminou sem dados. Ao iniciar, escolhe a aba ou janela da reunião Etholys.',
            'La grabación terminó sin datos. Al iniciar, elige la pestaña o ventana de Etholys Meet.',
            'Recording finished with no data. When starting, pick the Etholys Meet tab or window.',
          ),
        );
      } else if (result.savedWithPicker) {
        setError(null);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('Falha ao guardar a gravação.', 'Error al guardar la grabación.', 'Failed to save recording.'),
      );
    } finally {
      setRecordingBusy(false);
    }
  }

  function openFloatingWindow() {
    setError(null);
    // Flutuante na mesma página (CSS). Mover o iframe Jitsi para Document PiP
    // recarrega a sala e volta ao ecrã de pré-entrada.
    setPipActive((active) => !active);
    if (!pipActive) setPanelOpen(false);
  }

  const endInFlight = useRef(false);

  function tearDownConference() {
    try {
      conferenceRef.current?.stopTranscription();
    } catch {
      /* ignore */
    }
    try {
      conferenceRef.current?.hangup();
    } catch {
      /* ignore */
    }
    try {
      conferenceRef.current?.dispose();
    } catch {
      /* ignore */
    }
  }

  async function endMeeting(opts?: { skipHangup?: boolean }) {
    if (endInFlight.current) return;
    if (session?.status === 'ended' && opts?.skipHangup) {
      tearDownConference();
      router.push(
        companyId ? meetRecapPath(sessionId, companyId) : '/hub/meet',
      );
      return;
    }
    endInFlight.current = true;
    closingRef.current = true;
    setEnding(true);
    try {
      if (transcriptionOn) {
        try {
          conferenceRef.current?.stopTranscription();
        } catch {
          /* ignore */
        }
      }
      if (recordingOn && localRecorderRef.current) {
        try {
          await localRecorderRef.current.stop();
        } catch {
          /* ignore */
        }
        localRecorderRef.current = null;
        setRecordingOn(false);
      }

      let transcript = buildTranscriptText(segmentsRef.current);
      if (companyId) {
        try {
          const tr = await fetch(
            `/api/meet/sessions/${sessionId}/transcript?companyId=${encodeURIComponent(companyId)}`,
          );
          const td = (await tr.json()) as { transcriptText?: string };
          if ((td.transcriptText || '').trim().length > transcript.length) {
            transcript = td.transcriptText!.trim();
          }
        } catch {
          /* ignore */
        }

        if (session?.status !== 'ended') {
          const canFinalize = transcript.length >= 20;
          const endpoint = canFinalize
            ? `/api/meet/sessions/${sessionId}/finalize`
            : `/api/meet/sessions/${sessionId}`;
          const response = await fetch(endpoint, {
            method: canFinalize ? 'POST' : 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(
              canFinalize
                ? {
                    companyId,
                    transcriptText: transcript,
                    endMeeting: true,
                    replaceDrafts: true,
                    locale,
                  }
                : {
                    companyId,
                    status: 'ended',
                    ...(transcript ? { transcriptText: transcript } : {}),
                  },
            ),
          });
          if (!response.ok) {
            const data = (await response.json().catch(() => ({}))) as { error?: string };
            throw new Error(data.error || 'Falha ao encerrar reunião');
          }
          setSession((s) => (s ? { ...s, status: 'ended' } : s));
        }
      }

      if (!opts?.skipHangup) {
        try {
          conferenceRef.current?.hangup();
        } catch {
          /* ignore */
        }
      }
      try {
        conferenceRef.current?.dispose();
      } catch {
        /* ignore */
      }
      router.push(
        companyId ? meetRecapPath(sessionId, companyId) : '/hub/meet',
      );
    } catch (e) {
      endInFlight.current = false;
      closingRef.current = false;
      setError(e instanceof Error ? e.message : 'Error');
      setEnding(false);
    }
  }

  function leaveToMeetHome() {
    // Sai e destrói a sala neste browser (já não fica “fantasma” ligada).
    leaveQuietRef.current = true;
    closingRef.current = true;
    tearDownConference();
    router.push(
      companyId
        ? `/hub/meet?companyId=${encodeURIComponent(companyId)}`
        : '/hub/meet',
    );
  }

  function applyLayout(mode: MeetLayoutMode) {
    setLayoutMode(mode);
    setLayoutMenuOpen(false);
    conferenceRef.current?.setLayoutMode(mode);
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

  const speakerInitial = (dominantSpeaker || session.title).trim().charAt(0).toUpperCase() || 'E';

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-[#202124] text-white">
      {/* Top bar — estilo Google Meet */}
      <header
        className={`pointer-events-none absolute left-0 top-0 z-30 flex items-start justify-between gap-3 px-4 pb-2 pt-3 sm:px-5 ${
          panelOpen ? 'right-0 sm:right-[22rem]' : 'right-10'
        }`}
      >
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
          <div className="relative">
            <button
              type="button"
              onClick={() => setLayoutMenuOpen((o) => !o)}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#3c4043]/95 px-2.5 py-1.5 text-xs font-medium text-white/90 shadow-sm hover:bg-[#4a4d51]"
              title={t('Vista dos participantes', 'Vista de participantes', 'Participant layout')}
            >
              <LayoutGrid className="h-3.5 w-3.5 text-white/75" strokeWidth={1.75} />
              <span className="hidden sm:inline">{layoutLabel(layoutMode, t)}</span>
            </button>
            {layoutMenuOpen && (
              <div className="absolute right-0 top-full z-50 mt-1.5 min-w-[11rem] overflow-hidden rounded-xl border border-white/10 bg-[#292a2d] py-1 shadow-2xl">
                {LAYOUT_MODES.map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => applyLayout(mode)}
                    className={`flex w-full px-3 py-2 text-left text-xs hover:bg-white/10 ${
                      layoutMode === mode ? 'font-semibold text-[#8ab4f8]' : 'text-white/85'
                    }`}
                  >
                    {layoutLabel(mode, t)}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={openFloatingWindow}
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium shadow-sm ${
              pipActive
                ? 'bg-[#8ab4f8] text-[#202124] hover:bg-[#aecbfa]'
                : 'bg-[#3c4043]/95 text-white/90 hover:bg-[#4a4d51]'
            }`}
            title={t(
              'Janela flutuante nesta página (não recarrega a sala)',
              'Ventana flotante en esta página (no recarga la sala)',
              'Floating window on this page (does not reload the room)',
            )}
          >
            <PictureInPicture2 className="h-3.5 w-3.5" strokeWidth={1.75} />
            <span className="hidden sm:inline">
              {pipActive
                ? t('Fechar flutuante', 'Cerrar flotante', 'Close float')
                : t('Flutuante', 'Flotante', 'Float')}
            </span>
          </button>
          {recordingOn ? (
            <button
              type="button"
              onClick={() => void stopRecording()}
              disabled={recordingBusy || ending}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#ea4335] px-2.5 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-[#f28b82] disabled:opacity-60"
            >
              <Square className="h-3 w-3" />
              {t('Parar gravação', 'Detener grabación', 'Stop recording')}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void startLocalRecording()}
              disabled={recordingBusy || ending}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#3c4043]/95 px-2.5 py-1.5 text-xs font-medium text-white/90 shadow-sm hover:bg-[#4a4d51] disabled:opacity-60"
              title={t(
                'Primeiro escolhe onde guardar; depois a aba/janela da reunião',
                'Primero elige dónde guardar; luego la pestaña/ventana de la reunión',
                'First choose where to save; then the meeting tab/window',
              )}
            >
              <HardDrive className="h-3.5 w-3.5 text-white/75" strokeWidth={1.75} />
              {recordingBusy
                ? t('A preparar…', 'Preparando…', 'Preparing…')
                : t('Gravar', 'Grabar', 'Record')}
            </button>
          )}
          <button
            type="button"
            onClick={() => void endMeeting()}
            disabled={ending}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#ea4335] px-2.5 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-[#f28b82] disabled:opacity-60"
            title={t('Encerrar e sair', 'Finalizar y salir', 'End and leave')}
          >
            <PhoneOff className="h-3.5 w-3.5" strokeWidth={1.75} />
            <span className="hidden sm:inline">
              {ending
                ? t('A encerrar…', 'Cerrando…', 'Ending…')
                : t('Encerrar', 'Finalizar', 'End')}
            </span>
          </button>
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
              onClick={() => void endMeeting()}
              disabled={ending}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#ea4335] px-3 py-2 text-xs font-semibold text-white hover:bg-[#f28b82] disabled:opacity-60"
            >
              <PhoneOff className="h-3.5 w-3.5" />
              {t('Encerrar reunião', 'Finalizar reunión', 'End meeting')}
            </button>
            <button
              type="button"
              onClick={leaveToMeetHome}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#8ab4f8] px-3 py-2 text-xs font-semibold text-[#202124] hover:bg-[#aecbfa]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {t('Sair da sala', 'Salir de la sala', 'Leave room')}
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
          {pipActive && (
            <div className="mb-3 rounded-xl border border-white/10 bg-[#292a2d] px-4 py-3 text-xs text-white/60">
              {t(
                'Modo flutuante: a sala está no canto. Clica outra vez em Flotante para voltar ao ecrã completo.',
                'Modo flotante: la sala está en la esquina. Pulsa otra vez Flotante para volver a pantalla completa.',
                'Float mode: the room is in the corner. Click Float again to return to full screen.',
              )}
            </div>
          )}
          <div
            ref={stageHomeRef}
            className={
              pipActive
                ? `fixed bottom-4 z-50 h-[220px] w-[min(92vw,360px)] overflow-hidden rounded-2xl bg-[#131314] shadow-2xl ring-2 ring-[#8ab4f8]/60 ${
                    panelOpen ? 'right-[23.5rem]' : 'right-14'
                  }`
                : 'relative h-full w-full overflow-hidden rounded-2xl bg-[#131314]'
            }
          >
            <div ref={stageRef} className="relative h-full w-full">
              {session.meetingUrl && canEmbedJitsiInIframe(session.meetingUrl) ? (
                <MeetConferenceFrame
                  ref={conferenceRef}
                  meetingUrl={session.meetingUrl}
                  title={session.title}
                  locale={locale}
                  onReady={() => {
                    if (!features.liveTranscriptionEnabled) return;
                    // STT em fundo — painel fica fechado até o utilizador abrir
                    window.setTimeout(() => {
                      transcriptionStartedAtRef.current = Date.now();
                      setTranscriptionWaiting(true);
                      setTranscriptionOn(true);
                      conferenceRef.current?.startTranscription();
                    }, 800);
                  }}
                  onTranscriptionChunk={handleTranscriptionChunk}
                  onParticipantCountChange={setParticipantCount}
                  onDominantSpeakerChanged={(name) => {
                    dominantSpeakerRef.current = name;
                    setDominantSpeaker(name);
                  }}
                  onTranscriptToolbarClick={() => {
                    setPanelOpen((open) => {
                      const next = !open;
                      if (next && !transcriptionOn && features.liveTranscriptionEnabled) {
                        window.setTimeout(() => {
                          transcriptionStartedAtRef.current = Date.now();
                          setTranscriptionWaiting(true);
                          setTranscriptionOn(true);
                          conferenceRef.current?.startTranscription();
                        }, 0);
                      }
                      return next;
                    });
                  }}
                  onConferenceLeft={() => {
                    if (leaveQuietRef.current || closingRef.current) {
                      leaveQuietRef.current = false;
                      return;
                    }
                    void endMeeting({ skipHangup: true });
                  }}
                  onRecordingStatus={(state) => {
                    if (state.transcription) {
                      setTranscriptionOn(state.on);
                      if (!state.on) setTranscriptionWaiting(false);
                    }
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
          </div>
        </main>

        {!panelOpen && (
          <button
            type="button"
            onClick={() => setPanelOpen(true)}
            className="flex w-10 shrink-0 flex-col items-center justify-center gap-2 border-l border-white/10 bg-[#292a2d] pt-14 text-white/65 hover:bg-[#3c4043] hover:text-white"
            title={t('Abrir transcrição', 'Abrir transcripción', 'Open transcript')}
          >
            <PanelRightOpen className="h-4 w-4" />
            <span className="max-h-40 overflow-hidden text-[10px] font-medium tracking-wide [writing-mode:vertical-rl]">
              {t('Transcrição', 'Transcripción', 'Transcript')}
            </span>
            {transcriptionOn && (
              <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden />
            )}
          </button>
        )}

        {panelOpen && (
          <aside className="relative z-20 flex w-full max-w-sm shrink-0 flex-col border-l border-white/10 bg-[#292a2d] pt-14 sm:w-[22rem]">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-medium text-white">
                  <FileText className="h-4 w-4 shrink-0 text-white/70" strokeWidth={1.75} />
                  {t('Transcrição ao vivo', 'Transcripción en vivo', 'Live transcript')}
                </p>
                <p className="mt-0.5 text-[11px] text-white/45">
                  {t(
                    'Trechos do transcriber com o nome de cada participante.',
                    'Fragmentos del transcriber con el nombre de cada participante.',
                    'Transcriber segments with each participant name.',
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                className="rounded-full p-1.5 text-white/55 hover:bg-white/10 hover:text-white"
                aria-label={t('Minimizar painel', 'Minimizar panel', 'Minimize panel')}
                title={t('Minimizar', 'Minimizar', 'Minimize')}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
              {error && (
                <div className="rounded-xl border border-red-500/30 bg-red-950/40 px-3 py-2 text-[11px] text-red-200">
                  {error}
                </div>
              )}
              <button
                type="button"
                onClick={toggleTranscription}
                className={`inline-flex w-full items-center justify-center gap-1.5 rounded-full px-2 py-2.5 text-xs font-medium ${
                  transcriptionOn
                    ? 'bg-[#ea4335] text-white hover:bg-[#f28b82]'
                    : 'bg-[#8ab4f8] text-[#202124] hover:bg-[#aecbfa]'
                }`}
              >
                {transcriptionOn ? <Square className="h-3 w-3" /> : <Mic className="h-3.5 w-3.5" />}
                {transcriptionOn
                  ? t('Parar transcrição', 'Detener transcripción', 'Stop transcription')
                  : t('Transcrever', 'Transcribir', 'Transcribe')}
              </button>

              <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl bg-[#1f1f1f] p-3">
                {segments.length === 0 ? (
                  <div className="flex h-full min-h-32 items-center justify-center px-3 text-center text-[11px] text-white/40">
                    {!features.liveTranscriptionEnabled
                      ? t(
                          'A transcrição ao vivo ainda está a ser activada no Etholys Meet.',
                          'La transcripción en vivo aún se está activando en Etholys Meet.',
                          'Live transcription is still being activated on Etholys Meet.',
                        )
                      : transcriptionWaiting || transcriptionOn
                        ? t(
                            'Transcrição activa. Fala com o microfone ligado — o texto deve aparecer aqui em poucos segundos.',
                            'Transcripción activa. Habla con el micrófono abierto — el texto debe aparecer aquí en pocos segundos.',
                            'Transcription is on. Speak with the mic open — text should appear here in a few seconds.',
                          )
                        : t(
                            'Clique em «Transcrever». Os trechos aparecerão aqui com o nome de quem falou.',
                            'Haz clic en «Transcribir». Los fragmentos aparecerán con el nombre de quien habló.',
                            'Click “Transcribe”. Segments will appear here with the speaker name.',
                          )}
                  </div>
                ) : (
                  <ol className="space-y-3">
                    {segments.map((row) => (
                      <li
                        key={row.messageId}
                        className={`rounded-xl border-l-2 pl-2.5 ${
                          row.final ? 'opacity-100' : 'opacity-60'
                        }`}
                        style={{ borderLeftColor: speakerAccent(row.participantName) }}
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span
                            className="truncate text-[11px] font-semibold"
                            style={{ color: speakerAccent(row.participantName) }}
                          >
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
                  'A transcrição vem do servidor Meet (por participante). Minimiza este painel com «‹» à direita.',
                  'La transcripción viene del servidor Meet (por participante). Minimiza este panel con «‹» a la derecha.',
                  'Transcript comes from the Meet server (per participant). Minimize this panel with “‹” on the right.',
                )}
              </p>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
