'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  ArrowLeft,
  Cloud,
  ExternalLink,
  FileText,
  Info,
  LayoutGrid,
  Loader2,
  Mic,
  PhoneOff,
  Square,
  Users,
  ChevronLeft,
  PanelRightOpen,
  Copy,
  Check,
  X,
} from 'lucide-react';
import { meetEmbedUrl } from '@/lib/meet/room';
import { meetRecapPath } from '@/lib/meet/types';
import { canEmbedChorusRoom } from '@/lib/meet/video-engine';
import { useApp } from '@/app/providers';
import { isLikelyDbId } from '@/lib/utils';
import {
  MeetConferenceFrame,
  type MeetConferenceHandle,
  type MeetLayoutMode,
} from '@/components/meet/MeetConferenceFrame';
import {
  saveMeetRecordingBlob,
  startMeetLocalRecorder,
  type MeetLocalRecorder,
} from '@/lib/meet/local-recorder';
import { browserLiveSttSupported, startBrowserLiveStt, type BrowserLiveStt } from '@/lib/meet/browser-live-stt';
import { type MeetJoinSetupPrefs } from '@/components/meet/MeetJoinSetupDialog';
import { PendingMeetRecordingBanner } from '@/components/meet/PendingMeetRecordingBanner';
import { resolveMeetSpeechLanguage, type MeetSpeechLanguage } from '@/lib/meet/language';
import { queueMeetRecordingUpload } from '@/lib/meet/flush-pending-recording';

type SessionRow = {
  id: string;
  title: string;
  status: string;
  meetingUrl: string | null;
  projectId: string | null;
  createdById?: string | null;
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
  const { data: authSession } = useSession();
  const { locale, activeCompanyId } = useApp();
  const currentUserId = (authSession?.user as { id?: string } | undefined)?.id || null;
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
  const [cloudSyncing, setCloudSyncing] = useState(false);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [participantCount, setParticipantCount] = useState(0);
  const [dominantSpeaker, setDominantSpeaker] = useState<string | null>(null);
  const [clock, setClock] = useState(() => formatMeetClock(locale, new Date()));
  const [features, setFeatures] = useState({
    liveTranscriptionEnabled: false,
    whisperTranscriptionEnabled: false,
    cloudStorageReady: false,
  });
  const [joinPrefs, setJoinPrefs] = useState<MeetJoinSetupPrefs>(() => ({
    language: 'auto',
    enableCloudRecording: false,
    enableLiveTranscript: false,
  }));
  const joinPrefsRef = useRef(joinPrefs);
  useEffect(() => {
    joinPrefsRef.current = joinPrefs;
  }, [joinPrefs]);

  useEffect(() => {
    setJoinPrefs((prev) => ({
      ...prev,
      language: (resolveMeetSpeechLanguage({ uiLocale: locale }) || 'pt') as MeetSpeechLanguage,
    }));
  }, [locale]);

  const meetingSpeechLang = useMemo(
    () =>
      resolveMeetSpeechLanguage({
        explicit: joinPrefs.language,
        uiLocale: locale,
      }),
    [joinPrefs.language, locale],
  );

  const [isHost, setIsHost] = useState(false);
  const displayName =
    (authSession?.user as { name?: string | null } | undefined)?.name?.trim() ||
    (authSession?.user as { email?: string | null } | undefined)?.email?.trim() ||
    '';
  const [layoutMode, setLayoutMode] = useState<MeetLayoutMode>('speaker');
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false);
  const [transcriptCopied, setTranscriptCopied] = useState(false);
  const conferenceRef = useRef<MeetConferenceHandle>(null);
  const layoutMenuRef = useRef<HTMLDivElement>(null);
  const dominantSpeakerRef = useRef<string | null>(null);
  const leaveQuietRef = useRef(false);
  const closingRef = useRef(false);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const localRecorderRef = useRef<MeetLocalRecorder | null>(null);
  const recordingFinalizeRef = useRef(false);
  const hadParticipantsRef = useRef(false);
  /** Evita encerrar a reunião só porque o utilizador mudou de aba (falsos videoConferenceLeft). */
  const lastHiddenAtRef = useRef(0);
  const segmentsRef = useRef<TranscriptSegment[]>([]);
  const transcriptionStartedAtRef = useRef<number | null>(null);
  const transcriptionWantedRef = useRef(false);
  const roomDialAttemptsRef = useRef(0);
  const browserSttRef = useRef<BrowserLiveStt | null>(null);
  const serverTranscriptSeenRef = useRef(false);
  const onBrowserTextRef = useRef<(text: string, isFinal: boolean) => void>(() => undefined);

  useEffect(() => {
    segmentsRef.current = segments;
  }, [segments]);

  useEffect(() => {
    const prev = document.title;
    const apply = () => {
      const label = session?.title?.trim();
      // Título limpo e estável — evita nomes estranhos do Chrome ao gravar.
      document.title = label ? `CHORUS — ${label}` : 'CHORUS · Etholys';
    };
    apply();
    const id = window.setInterval(apply, 2000);
    return () => {
      window.clearInterval(id);
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
      const d = (await r.json()) as { session?: SessionRow; isHost?: boolean; error?: string };
      if (!r.ok) throw new Error(d.error || 'Error');
      if (d.session?.seriesParentId && d.session.seriesParentId !== sessionId) {
        router.replace(
          `/hub/meet/${d.session.seriesParentId}?companyId=${encodeURIComponent(companyId)}`,
        );
        return;
      }
      setSession(d.session ?? null);
      setIsHost(
        Boolean(
          d.isHost ||
            (currentUserId && d.session?.createdById && d.session.createdById === currentUserId),
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, [companyId, sessionId, locale, currentUserId, router]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const tick = () => setClock(formatMeetClock(locale, new Date()));
    tick();
    const id = window.setInterval(tick, 15_000);
    return () => window.clearInterval(id);
  }, [locale]);

  // Entra já na sala (Zoom): sem modal que bloqueia. Transcrição/gravação são botões à parte.

  useEffect(() => {
    if (!companyId) return;
    void Promise.all([
      fetch('/api/meet/status')
        .then((r) => r.json())
        .then((d) => {
          const liveOn = Boolean(d.liveTranscriptionEnabled);
          setFeatures({
            liveTranscriptionEnabled: liveOn,
            whisperTranscriptionEnabled: Boolean(d.whisperTranscriptionEnabled),
            cloudStorageReady: Boolean(d.cloudStorageReady),
          });
          setJoinPrefs((prev) => ({
            ...prev,
            enableLiveTranscript: false,
            enableCloudRecording: false,
          }));
        }),
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
    if (!transcriptionOn || !companyId) return;
    let cancelled = false;
    const pull = async () => {
      try {
        const response = await fetch(
          `/api/meet/sessions/${sessionId}/transcript?companyId=${encodeURIComponent(companyId)}`,
        );
        if (!response.ok) return;
        const data = (await response.json()) as {
          segments?: Array<{
            messageId: string;
            participantId?: string | null;
            participantName: string;
            text: string;
            language?: string | null;
            startedAt: string;
          }>;
        };
        if (cancelled || !Array.isArray(data.segments) || data.segments.length === 0) return;
        setSegments((current) => {
          const interim = current.filter((row) => !row.final);
          const byId = new Map(
            current.filter((row) => row.final).map((row) => [row.messageId.replace(/^live-jigasi-/, ''), row]),
          );
          for (const row of data.segments || []) {
            const key = String(row.messageId || '').replace(/^live-jigasi-/, '');
            if (!key || !row.text) continue;
            const prev = byId.get(key);
            byId.set(key, {
              messageId: key,
              participantId: row.participantId || prev?.participantId,
              participantName: row.participantName || prev?.participantName || '',
              text: row.text,
              language: row.language || prev?.language || undefined,
              startedAt: row.startedAt || prev?.startedAt || new Date().toISOString(),
              final: true,
            });
          }
          const finals = [...byId.values()].sort(
            (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(),
          );
          return [...finals, ...interim];
        });
      } catch {
        /* ignore */
      }
    };
    const id = window.setInterval(() => void pull(), 4000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [transcriptionOn, companyId, sessionId]);

  useEffect(() => {
    if (!recordingOn || !joinPrefsRef.current.enableCloudRecording) return;
    const flush = (ev: PageTransitionEvent) => {
      // Só ao sair/fechar de verdade — não ao mudar de aba (visibility).
      if (ev.persisted) return;
      void stopRecording({ cloudAuto: true, quiet: true });
    };
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, [recordingOn]);

  useEffect(() => {
    if (participantCount > 0) hadParticipantsRef.current = true;
  }, [participantCount]);

  // NÃO parar gravação só porque o contador foi a 0 (falhas de contagem em background).
  // A gravação só para: utilizador, pagehide real, ou fim da reunião.

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

  // Indicador enquanto não chega texto. Não mostrar erro a pedir para carregar em Transcrever.
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
    if (!transcriptionStartedAtRef.current) transcriptionStartedAtRef.current = Date.now();
  }, [transcriptionOn, segments]);

  useEffect(() => {
    return () => {
      const rec = localRecorderRef.current;
      if (rec) {
        void rec.stop().catch(() => rec.destroy());
        localRecorderRef.current = null;
      }
      browserSttRef.current?.stop();
      browserSttRef.current = null;
    };
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') lastHiddenAtRef.current = Date.now();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    if (!layoutMenuOpen) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setLayoutMenuOpen(false);
    };
    const onPointer = (ev: MouseEvent) => {
      const el = layoutMenuRef.current;
      if (el && !el.contains(ev.target as Node)) setLayoutMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onPointer);
    };
  }, [layoutMenuOpen]);

  const handleTranscriptionChunk = useCallback(
    (
      chunk: {
        language?: string;
        messageID?: string;
        participant?: { id?: string; name?: string };
        final?: string;
        stable?: string;
        unstable?: string;
      },
      source?: 'room' | 'browser',
    ) => {
      if (source === 'browser') {
        if (serverTranscriptSeenRef.current && meetingSpeechLang !== 'pt') return;
      } else {
        serverTranscriptSeenRef.current = true;
        if (meetingSpeechLang !== 'pt') {
          browserSttRef.current?.stop();
          browserSttRef.current = null;
        }
      }
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
          const updated = { ...current[index], ...row };
          next[index] = updated;
          if (isFinal && companyId && joinPrefsRef.current.enableLiveTranscript) {
            const persist = updated;
            queueMicrotask(() => {
              void fetch(`/api/meet/sessions/${sessionId}/transcript`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  companyId,
                  messageId: persist.messageId,
                  participantId: persist.participantId,
                  participantName: persist.participantName,
                  language: persist.language,
                  text: persist.text,
                  startedAt: persist.startedAt,
                }),
              }).catch(() => undefined);
            });
          }
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
        let persistRow = row;
        let next: TranscriptSegment[];
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
          persistRow = merged;
          next = [...withoutInterim.slice(0, -1), merged];
        } else {
          next = [...withoutInterim, row];
        }

        if (companyId && joinPrefsRef.current.enableLiveTranscript) {
          const persist = persistRow;
          queueMicrotask(() => {
            void fetch(`/api/meet/sessions/${sessionId}/transcript`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                companyId,
                messageId: persist.messageId,
                participantId: persist.participantId,
                participantName: persist.participantName,
                language: persist.language,
                text: persist.text,
                startedAt: persist.startedAt,
              }),
            }).catch(() => undefined);
          });
        }
        return next;
      });
    },
    [companyId, sessionId, locale, meetingSpeechLang],
  );

  onBrowserTextRef.current = (text, isFinal) => {
    if (!transcriptionWantedRef.current || serverTranscriptSeenRef.current) return;
    const speaker = displayName.trim() || (locale === 'en' ? 'Me' : locale === 'pt' ? 'Eu' : 'Yo');
    const lang = meetingSpeechLang === 'en' || meetingSpeechLang === 'es' ? meetingSpeechLang : 'pt';
    handleTranscriptionChunk(
      {
        messageID: isFinal ? `browser-${Date.now()}-${text.slice(0, 12)}` : 'browser-interim',
        participant: { id: 'local-mic', name: speaker },
        language: lang,
        final: isFinal ? text : undefined,
        stable: isFinal ? undefined : text,
      },
      'browser',
    );
  };

  function stopBrowserStt() {
    browserSttRef.current?.stop();
    browserSttRef.current = null;
  }

  function startBrowserStt() {
    stopBrowserStt();
    if (!browserLiveSttSupported()) return;
    const lang = meetingSpeechLang === 'en' || meetingSpeechLang === 'es' ? meetingSpeechLang : 'pt';
    browserSttRef.current = startBrowserLiveStt({
      locale: lang,
      onText: (text, isFinal) => onBrowserTextRef.current(text, isFinal),
      onError: (code) => {
        if (!transcriptionWantedRef.current) return;
        if (serverTranscriptSeenRef.current) return;
        const micBlocked = code === 'not-allowed' || code === 'audio-capture' || code === 'service-not-allowed';
        setError(
          micBlocked
            ? t(
                'O browser não conseguiu ouvir o microfone para a transcrição. Permite o microfone nesta página (Chrome ou Edge) e carrega outra vez em Transcrever.',
                'El navegador no pudo oír el micrófono para la transcripción. Permite el micrófono en esta página (Chrome o Edge) y pulsa Transcribir otra vez.',
                'The browser could not hear the microphone for transcription. Allow the microphone on this page (Chrome or Edge) and press Transcribe again.',
              )
            : t(
                'A transcrição do microfone neste browser falhou. Continua na chamada e fala de novo: se a sala entrar, o texto aparece na mesma.',
                'La transcripción del micrófono en este navegador falló. Sigue en la llamada y habla de nuevo: si la sala entra, el texto aparece igual.',
                'Microphone transcription in this browser failed. Stay in the call and speak again — room text still appears if the room service joins.',
              ),
        );
      },
    });
  }

  function toggleTranscription() {
    setError(null);
    const browserOk = browserLiveSttSupported();
    if (!features.liveTranscriptionEnabled && !browserOk) {
      setError(
        t(
          'A transcrição ao vivo ainda não está activa neste browser.',
          'La transcripción en vivo aún no está activa en este navegador.',
          'Live transcription is not available in this browser yet.',
        ),
      );
      return;
    }
    if (transcriptionOn) {
      transcriptionWantedRef.current = false;
      serverTranscriptSeenRef.current = false;
      stopBrowserStt();
      conferenceRef.current?.stopTranscription();
      setTranscriptionOn(false);
      setTranscriptionWaiting(false);
      setJoinPrefs((p) => ({ ...p, enableLiveTranscript: false }));
      return;
    }
    setJoinPrefs((p) => ({ ...p, enableLiveTranscript: true }));
    setPanelOpen(true);
    transcriptionWantedRef.current = true;
    serverTranscriptSeenRef.current = false;
    roomDialAttemptsRef.current = 0;
    transcriptionStartedAtRef.current = Date.now();
    setTranscriptionWaiting(true);
    setTranscriptionOn(true);
    if (features.liveTranscriptionEnabled) conferenceRef.current?.startTranscription();
    startBrowserStt();
  }

  function startInRoomVideoRecording() {
    setError(null);
    if (recordingBusy || localRecorderRef.current) return;
    setRecordingBusy(true);
    // Sem Jibri no Contabo: gravar ecrã/janela e enviar à nuvem → Whisper.
    // Nunca a aba desta reunião (Chrome deixa o vídeo preto).
    void (async () => {
      try {
        const roomStarted = await conferenceRef.current?.startRoomRecording?.();
        if (roomStarted) {
          const suggested = session?.title || 'chorus';
          localRecorderRef.current = {
            async stop(opts) {
              const blob = (await conferenceRef.current?.stopRoomRecording?.()) || new Blob();
              const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
              const fileName = `${suggested.replace(/[^\w\-áàâãéêíóôõúçñ ]+/gi, '').trim().slice(0, 48) || 'chorus'}-${stamp}.webm`;
              const saveToDisk = opts?.saveToDisk !== false;
              const savedWithPicker = saveToDisk ? await saveMeetRecordingBlob(blob, fileName) : false;
              return { blob, fileName, savedWithPicker };
            },
            destroy() {
              void conferenceRef.current?.stopRoomRecording?.();
            },
          };
          setRecordingOn(true);
          setJoinPrefs((p) => ({ ...p, enableCloudRecording: true }));
          setError(null);
          return;
        }
        const { recorder } = await startMeetLocalRecorder({
          suggestedTitle: session?.title || 'chorus',
          captureMode: 'room',
          captureMicrophone: false,
        });
        localRecorderRef.current = recorder;
        setRecordingOn(true);
        setJoinPrefs((p) => ({ ...p, enableCloudRecording: true }));
        setError(
          t(
            'A gravar. No diálogo escolhe esta aba do CHORUS (ou a janela do browser) e liga o áudio da aba. Ao sair, a gravação fica no CHORUS.',
            'Grabando. En el diálogo elige esta pestaña de CHORUS (o la ventana del navegador) y activa el audio de la pestaña. Al salir, la grabación queda en CHORUS.',
            'Recording. In the dialog pick this CHORUS tab (or the browser window) and share tab audio. When you leave, the file stays in CHORUS.',
          ),
        );
      } catch (err) {
        setRecordingOn(false);
        setError(
          err instanceof Error
            ? err.message
            : t(
                'Não foi possível iniciar a gravação. No diálogo escolhe esta aba do CHORUS, uma janela ou o ecrã inteiro.',
                'No se pudo iniciar la grabación. En el diálogo elige esta pestaña de CHORUS, una ventana o la pantalla completa.',
                'Could not start recording. In the dialog pick this CHORUS tab, a window, or the entire screen.',
              ),
        );
      } finally {
        setRecordingBusy(false);
      }
    })();
  }

  async function stopRecording(opts?: { cloudAuto?: boolean; quiet?: boolean }) {
    const recorder = localRecorderRef.current;
    if (!recorder || recordingFinalizeRef.current) {
      if (!recorder) setRecordingOn(false);
      return;
    }
    const cloudMode =
      joinPrefsRef.current.enableCloudRecording && features.cloudStorageReady;
    const autoCloud = opts?.cloudAuto ?? cloudMode;

    setRecordingBusy(true);
    if (autoCloud) setCloudSyncing(true);
    try {
      const result = await recorder.stop({ saveToDisk: !autoCloud });
      localRecorderRef.current = null;
      setRecordingOn(false);
      if (result.blob.size <= 0) {
        if (!opts?.quiet) {
          setError(
            t(
              'A gravação terminou sem dados. Ao iniciar, escolhe a aba ou janela do CHORUS.',
              'La grabación terminó sin datos. Al iniciar, elige la pestaña o ventana de CHORUS.',
              'Recording finished with no data. When starting, pick the CHORUS tab or window.',
            ),
          );
        }
        return;
      }
      if (!opts?.quiet) setError(null);

      if (companyId && autoCloud) {
        recordingFinalizeRef.current = true;
        try {
          const fileName = result.fileName || `chorus-${sessionId}.webm`;
          await queueMeetRecordingUpload({
            sessionId,
            companyId,
            blob: result.blob,
            fileName,
            locale,
            languageHint: meetingSpeechLang,
            whisperEnabled: features.whisperTranscriptionEnabled,
          });
          if (!opts?.quiet) {
            setError(
              t(
                'Gravação enviada. A transcrição está a ser gerada no CHORUS.',
                'Grabación enviada. La transcripción se está generando en CHORUS.',
                'Recording uploaded. Transcript is being generated in CHORUS.',
              ),
            );
          }
        } catch (upErr) {
          const msg =
            upErr instanceof Error
              ? upErr.message
              : t(
                  'Não foi possível enviar agora. A gravação ficou guardada neste browser — reenvie no resumo.',
                  'No se pudo enviar ahora. La grabación quedó guardada en este navegador — reenvíe en el resumen.',
                  'Could not upload now. Recording saved in this browser — retry from the recap.',
                );
          // Se a gravação já está na nuvem e só falhou a transcrição, não reabrir o fluxo
          recordingFinalizeRef.current = /nuvem OK|cloud OK|Grabación en la nube OK/i.test(msg);
          if (!opts?.quiet) {
            setError(msg);
          }
        }
      }
    } catch (err) {
      if (!opts?.quiet) {
        setError(
          err instanceof Error
            ? err.message
            : t('Falha ao terminar a gravação.', 'Error al finalizar la grabación.', 'Failed to stop recording.'),
        );
      }
    } finally {
      setRecordingBusy(false);
      setCloudSyncing(false);
    }
  }

  const endInFlight = useRef(false);

  function tearDownConference() {
    transcriptionWantedRef.current = false;
    stopBrowserStt();
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
        transcriptionWantedRef.current = false;
        stopBrowserStt();
        try {
          conferenceRef.current?.stopTranscription();
        } catch {
          /* ignore */
        }
      }
      if (recordingOn && localRecorderRef.current) {
        try {
          await stopRecording({ cloudAuto: true, quiet: true });
        } catch {
          /* ignore */
        }
      }

      let transcript = joinPrefsRef.current.enableLiveTranscript
        ? buildTranscriptText(segmentsRef.current)
        : '';
      if (companyId) {
        try {
          const tr = await fetch(
            `/api/meet/sessions/${sessionId}/transcript?companyId=${encodeURIComponent(companyId)}`,
          );
          const td = (await tr.json()) as { transcriptText?: string; source?: string };
          if (
            joinPrefsRef.current.enableLiveTranscript &&
            (td.transcriptText || '').trim().length > transcript.length
          ) {
            transcript = td.transcriptText!.trim();
          } else if (td.source === 'whisper' && (td.transcriptText || '').trim()) {
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

  async function leaveToMeetHome() {
    leaveQuietRef.current = true;
    closingRef.current = true;
    if (recordingOn && localRecorderRef.current) {
      try {
        await stopRecording({ cloudAuto: true, quiet: true });
      } catch {
        /* ignore */
      }
    }
    if (companyId && joinPrefsRef.current.enableLiveTranscript) {
      const transcript = buildTranscriptText(segmentsRef.current);
      if (transcript) {
        void fetch(`/api/meet/sessions/${sessionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyId, transcriptText: transcript }),
        }).catch(() => undefined);
      }
    }
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

  async function copyLiveTranscript() {
    const text = buildTranscriptText(segmentsRef.current);
    if (!text) {
      setError(
        t(
          'Ainda não há texto final para copiar.',
          'Aún no hay texto final para copiar.',
          'No final transcript text to copy yet.',
        ),
      );
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setTranscriptCopied(true);
      window.setTimeout(() => setTranscriptCopied(false), 2000);
    } catch {
      setError(t('Não foi possível copiar.', 'No se pudo copiar.', 'Could not copy.'));
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-teal-300/80" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-4">
        <p className="text-sm text-red-700">{error || t('Sessão não encontrada.', 'Sesión no encontrada.', 'Session not found.')}</p>
        <Link href="/hub/meet" className="text-sm font-medium text-teal-800 hover:underline">
          {t('Voltar ao CHORUS', 'Volver a CHORUS', 'Back to CHORUS')}
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
    <div className="relative flex h-screen flex-col overflow-hidden bg-slate-950 text-white">
      {/* Top bar — CHORUS */}
      <header
        className={`pointer-events-none absolute left-0 top-0 z-30 flex items-start justify-between gap-3 px-4 pb-2 pt-3 sm:px-5 ${
          panelOpen ? 'right-0 sm:right-[22rem]' : 'right-10'
        }`}
      >
        <div className="pointer-events-auto flex min-w-0 max-w-[min(100%,48rem)] items-center gap-2 text-[13px] text-white/90 sm:text-sm">
          <button
            type="button"
            onClick={() => void leaveToMeetHome()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-slate-800/95 px-2.5 py-1.5 text-xs font-medium text-white/90 shadow-sm ring-1 ring-white/10 hover:bg-slate-700"
            title={t('Voltar ao CHORUS', 'Volver a CHORUS', 'Back to CHORUS')}
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
            <span className="hidden tracking-[0.12em] sm:inline">CHORUS</span>
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
            <div className="hidden items-center gap-2 rounded-full bg-slate-800/95 px-2.5 py-1.5 text-xs text-white/90 shadow-sm sm:flex">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-400 text-[11px] font-semibold text-slate-950">
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
            className="inline-flex items-center gap-1.5 rounded-full bg-slate-800/95 px-2.5 py-1.5 text-xs text-white/90 shadow-sm"
            title={t('Participantes', 'Participantes', 'Participants')}
          >
            <Users className="h-3.5 w-3.5 text-white/75" strokeWidth={1.75} />
            <span className="min-w-[0.75rem] tabular-nums">{Math.max(participantCount, 0)}</span>
          </div>
          <div className="relative" ref={layoutMenuRef}>
            <button
              type="button"
              onClick={() => setLayoutMenuOpen((o) => !o)}
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-800/95 px-2.5 py-1.5 text-xs font-medium text-white/90 shadow-sm hover:bg-slate-700"
              title={t('Vista dos participantes', 'Vista de participantes', 'Participant layout')}
              aria-expanded={layoutMenuOpen}
            >
              <LayoutGrid className="h-3.5 w-3.5 text-white/75" strokeWidth={1.75} />
              <span className="hidden sm:inline">{layoutLabel(layoutMode, t)}</span>
            </button>
            {layoutMenuOpen && (
              <div className="absolute right-0 top-full z-50 mt-1.5 min-w-[11rem] overflow-hidden rounded-xl border border-white/10 bg-slate-900 py-1 shadow-2xl">
                {LAYOUT_MODES.map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => applyLayout(mode)}
                    className={`flex w-full px-3 py-2 text-left text-xs hover:bg-white/10 ${
                      layoutMode === mode ? 'font-semibold text-teal-300' : 'text-white/85'
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
            onClick={toggleTranscription}
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium shadow-sm ${
              transcriptionOn
                ? 'bg-teal-400 text-slate-950 hover:bg-teal-300'
                : 'bg-slate-800/95 text-white/90 hover:bg-slate-700'
            }`}
            title={t(
              'Transcrever a conversa — sem gravar vídeo nem escolher ecrã',
              'Transcribir la conversación — sin grabar vídeo ni elegir pantalla',
              'Transcribe the conversation — no video file, no screen picker',
            )}
          >
            <Mic className="h-3.5 w-3.5" strokeWidth={1.75} />
            <span className="hidden sm:inline">
              {transcriptionOn
                ? t('A transcrever', 'Transcribiendo', 'Transcribing')
                : t('Transcrever', 'Transcribir', 'Transcribe')}
            </span>
          </button>
          {recordingOn || cloudSyncing ? (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium shadow-sm ${
                cloudSyncing ? 'bg-amber-600/90 text-white' : 'bg-rose-600 text-white'
              }`}
            >
              <Cloud className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span className="hidden sm:inline">
                {cloudSyncing
                  ? t('A enviar…', 'Enviando…', 'Uploading…')
                  : t('A gravar', 'Grabando', 'Recording')}
              </span>
            </span>
          ) : (
            <button
              type="button"
              onClick={startInRoomVideoRecording}
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-800/95 px-2.5 py-1.5 text-xs font-medium text-white/90 shadow-sm hover:bg-slate-700"
              title={t(
                'Gravar esta chamada. Ao sair, o ficheiro fica no CHORUS.',
                'Grabar esta llamada. Al salir, el archivo queda en CHORUS.',
                'Record this call. When you leave, the file stays in CHORUS.',
              )}
            >
              <Cloud className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span className="hidden sm:inline">{t('Gravar', 'Grabar', 'Record')}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              const ok = window.confirm(
                t(
                  'Encerrar a reunião para todos e ir ao recap CHORUS?',
                  '¿Finalizar la reunión para todos e ir al recap CHORUS?',
                  'End the meeting for everyone and go to the CHORUS recap?',
                ),
              );
              if (ok) void endMeeting();
            }}
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
        <div className="absolute left-4 top-14 z-40 w-[min(100%-2rem,20rem)] rounded-2xl border border-white/10 bg-slate-900 p-4 shadow-2xl sm:left-5">
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
            CHORUS
            {session.status === 'live'
              ? ` · ${t('Ao vivo', 'En vivo', 'Live')}`
              : ` · ${session.status}`}
          </p>
          <div className="mt-3 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
              const ok = window.confirm(
                t(
                  'Encerrar a reunião para todos e ir ao recap CHORUS?',
                  '¿Finalizar la reunión para todos e ir al recap CHORUS?',
                  'End the meeting for everyone and go to the CHORUS recap?',
                ),
              );
              if (ok) void endMeeting();
            }}
              disabled={ending}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#ea4335] px-3 py-2 text-xs font-semibold text-white hover:bg-[#f28b82] disabled:opacity-60"
            >
              <PhoneOff className="h-3.5 w-3.5" />
              {t('Encerrar reunião', 'Finalizar reunión', 'End meeting')}
            </button>
            <button
              type="button"
              onClick={() => void leaveToMeetHome()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-teal-400 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-[#aecbfa]"
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
        <main className="relative flex min-h-0 min-w-0 flex-1 flex-col px-3 pb-3 pt-14 sm:px-4 sm:pb-4">
          {error && (
            <div className="mb-3 flex shrink-0 items-start justify-between gap-3 rounded-xl border border-red-400/30 bg-red-950/80 px-4 py-3 text-xs text-red-100">
              <p className="min-w-0 flex-1 leading-relaxed">{error}</p>
              <button
                type="button"
                onClick={() => setError(null)}
                className="shrink-0 rounded-full p-1 text-red-200/80 hover:bg-white/10 hover:text-white"
                aria-label={t('Fechar', 'Cerrar', 'Close')}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <div className="relative min-h-0 w-full flex-1">
            <div className="relative h-full min-h-0 w-full overflow-hidden rounded-2xl bg-slate-950">
            <div className="relative h-full min-h-0 w-full">
              {session.meetingUrl && canEmbedChorusRoom(session.meetingUrl) ? (
                <MeetConferenceFrame
                  ref={conferenceRef}
                  meetingUrl={session.meetingUrl}
                  title={session.title}
                  locale={locale}
                  displayName={displayName}
                  transcriptionLanguage={meetingSpeechLang}
                  onTranscriptionChunk={handleTranscriptionChunk}
                  onParticipantCountChange={setParticipantCount}
                  onDominantSpeakerChanged={(name) => {
                    dominantSpeakerRef.current = name;
                    setDominantSpeaker(name);
                  }}
                  onTranscriptToolbarClick={() => {
                    setPanelOpen((open) => {
                      const next = !open;
                      if (
                        next &&
                        !transcriptionOn &&
                        (features.liveTranscriptionEnabled || browserLiveSttSupported())
                      ) {
                        window.setTimeout(() => {
                          transcriptionWantedRef.current = true;
                          serverTranscriptSeenRef.current = false;
                          roomDialAttemptsRef.current = 0;
                          transcriptionStartedAtRef.current = Date.now();
                          setTranscriptionWaiting(true);
                          setTranscriptionOn(true);
                          setJoinPrefs((p) => ({ ...p, enableLiveTranscript: true }));
                          if (features.liveTranscriptionEnabled) {
                            conferenceRef.current?.startTranscription();
                          }
                          startBrowserStt();
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
                    // Desligar na barra = sair desta pessoa. Flutuar nunca encerra a chamada.
                    if (document.visibilityState === 'hidden') return;
                    if (Date.now() - lastHiddenAtRef.current < 15_000) return;
                    void leaveToMeetHome();
                  }}
                  onRecordingStatus={(state) => {
                    if (state.transcription) {
                      // Um falhanço do motor da sala não desliga o botão: o microfone local continua.
                      if (state.on) setTranscriptionOn(true);
                      else if (!transcriptionWantedRef.current) setTranscriptionOn(false);
                      return;
                    }
                    if (state.error) {
                      // Sem Jibri: ignoramos o erro da nuvem — o gravador local é o caminho real.
                      if (localRecorderRef.current) {
                        setRecordingOn(true);
                        return;
                      }
                      setRecordingOn(false);
                      return;
                    }
                    setRecordingOn(Boolean(state.on));
                  }}
                  onError={(message) => {
                    setError(message);
                  }}
                  onRoomTranscription={(result) => {
                    if (!transcriptionWantedRef.current) return;
                    if (result.ok) {
                      setTranscriptionWaiting(false);
                      return;
                    }
                    if (result.error === 'room-not-ready' && roomDialAttemptsRef.current < 4) {
                      roomDialAttemptsRef.current += 1;
                      window.setTimeout(() => {
                        if (transcriptionWantedRef.current) conferenceRef.current?.startTranscription();
                      }, 2500);
                      return;
                    }
                    if (result.error === 'not-moderator' && !browserLiveSttSupported()) {
                      setError(
                        t(
                          'Só quem modera a sala pode ligar a transcrição de todos. Entra primeiro na chamada.',
                          'Solo quien modera la sala puede activar la transcripción de todos. Entra primero en la llamada.',
                          'Only the room moderator can turn on transcription for everyone. Join the call first.',
                        ),
                      );
                    }
                  }}
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
                    className="inline-flex items-center gap-2 rounded-full bg-teal-400 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-[#aecbfa]"
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
          </div>
        </main>

        {!panelOpen && (
          <button
            type="button"
            onClick={() => setPanelOpen(true)}
            className="flex w-10 shrink-0 flex-col items-center justify-center gap-2 border-l border-white/10 bg-slate-900 pt-14 text-white/65 hover:bg-slate-800 hover:text-white"
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
          <aside className="relative z-20 flex w-full max-w-sm shrink-0 flex-col border-l border-white/10 bg-slate-900 pt-14 sm:w-[22rem]">
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
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => void copyLiveTranscript()}
                  className="rounded-full p-1.5 text-white/55 hover:bg-white/10 hover:text-white"
                  aria-label={t('Copiar transcrição', 'Copiar transcripción', 'Copy transcript')}
                  title={t('Copiar', 'Copiar', 'Copy')}
                >
                  {transcriptCopied ? (
                    <Check className="h-4 w-4 text-teal-300" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
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
                    : 'bg-teal-400 text-slate-950 hover:bg-teal-300'
                }`}
              >
                {transcriptionOn ? <Square className="h-3 w-3" /> : <Mic className="h-3.5 w-3.5" />}
                {transcriptionOn
                  ? t('Parar transcrição', 'Detener transcripción', 'Stop transcription')
                  : t('Transcrever', 'Transcribir', 'Transcribe')}
              </button>

              <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl bg-slate-950/80 p-3">
                {segments.length === 0 ? (
                  <div className="flex h-full min-h-32 items-center justify-center px-3 text-center text-[11px] text-white/40">
                    {transcriptionWaiting || transcriptionOn
                      ? t(
                          'Transcrição activa. Fala com o microfone ligado — o texto deve aparecer aqui em poucos segundos.',
                          'Transcripción activa. Habla con el micrófono abierto — el texto debe aparecer aquí en pocos segundos.',
                          'Transcription is on. Speak with the mic open — text should appear here in a few seconds.',
                        )
                      : !features.liveTranscriptionEnabled && !browserLiveSttSupported()
                        ? t(
                            'A transcrição ao vivo ainda está a ser activada no CHORUS.',
                            'La transcripción en vivo aún se está activando en CHORUS.',
                            'Live transcription is still being activated on CHORUS.',
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
                {joinPrefs.enableLiveTranscript
                  ? t(
                      'Transcrição ao vivo activa — ao sair, o texto fica no recap (pode gerar resumo sem vídeo).',
                      'Transcripción en vivo activa — al salir, el texto queda en el recap (puede generar resumen sin vídeo).',
                      'Live transcript on — when you leave, text stays in the recap (summary without video).',
                    )
                  : t(
                      'Carrega em Transcrever para ver o texto. Gravar guarda o vídeo desta chamada.',
                      'Pulsa Transcribir para ver el texto. Grabar guarda el vídeo de esta llamada.',
                      'Press Transcribe to see the text. Record saves this call’s video.',
                    )}
              </p>
            </div>
          </aside>
        )}
      </div>

      {companyId && (
        <div className="pointer-events-none absolute bottom-4 left-4 right-4 z-40 mx-auto max-w-lg">
          <div className="pointer-events-auto">
            <PendingMeetRecordingBanner
              sessionId={sessionId}
              companyId={companyId}
              compact
            />
          </div>
        </div>
      )}

    </div>
  );
}
