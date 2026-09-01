'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
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
  Copy,
  Check,
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
import {
  MeetJoinSetupDialog,
  type MeetJoinSetupPrefs,
} from '@/components/meet/MeetJoinSetupDialog';
import { resolveMeetSpeechLanguage, type MeetSpeechLanguage } from '@/lib/meet/language';
import { uploadMeetRecordingFile } from '@/lib/meet/upload-recording-client';

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
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [participantCount, setParticipantCount] = useState(0);
  const [dominantSpeaker, setDominantSpeaker] = useState<string | null>(null);
  const [clock, setClock] = useState(() => formatMeetClock(locale, new Date()));
  const [features, setFeatures] = useState({
    liveTranscriptionEnabled: false,
    whisperTranscriptionEnabled: false,
  });
  const [joinSetupDone, setJoinSetupDone] = useState(false);
  const [joinPrefs, setJoinPrefs] = useState<MeetJoinSetupPrefs>(() => ({
    language: 'auto',
    enableLiveTranscript: false,
    enableLocalRecording: true,
    enableWhisperOnEnd: true,
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

  const isHost = Boolean(currentUserId && session?.createdById === currentUserId);
  const [pipActive, setPipActive] = useState(false);
  const [pipMode, setPipMode] = useState<'none' | 'document' | 'css'>('none');
  const [conferenceReady, setConferenceReady] = useState(false);
  const [autoFloat, setAutoFloat] = useState(true);
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
  const stageSlotRef = useRef<HTMLDivElement>(null);
  const stageHomeRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const pipWindowRef = useRef<Window | null>(null);
  const pipModeRef = useRef<'none' | 'document' | 'css'>('none');
  const conferenceReadyRef = useRef(false);
  const autoFloatRef = useRef(true);
  const pipEnteringRef = useRef(false);
  const segmentsRef = useRef<TranscriptSegment[]>([]);
  const transcriptionStartedAtRef = useRef<number | null>(null);

  useEffect(() => {
    segmentsRef.current = segments;
  }, [segments]);

  useEffect(() => {
    const prev = document.title;
    const label = session?.title?.trim();
    document.title = label ? `CHORUS — ${label}` : 'CHORUS · Etholys';
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
    if (!session || joinSetupDone || !currentUserId) return;
    if (session.createdById !== currentUserId) {
      setJoinSetupDone(true);
    }
  }, [session, currentUserId, joinSetupDone]);

  useEffect(() => {
    if (!companyId) return;
    void Promise.all([
      fetch('/api/meet/status')
        .then((r) => r.json())
        .then((d) =>
          setFeatures({
            liveTranscriptionEnabled: Boolean(d.liveTranscriptionEnabled),
            whisperTranscriptionEnabled: Boolean(d.whisperTranscriptionEnabled),
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

  useEffect(() => {
    autoFloatRef.current = autoFloat;
  }, [autoFloat]);

  useEffect(() => {
    conferenceReadyRef.current = conferenceReady;
  }, [conferenceReady]);

  const restoreStageFromPip = useCallback(() => {
    const stage = stageHomeRef.current;
    const slot = stageSlotRef.current;
    if (stage && slot && stage.parentElement !== slot) {
      slot.appendChild(stage);
      stage.style.width = '';
      stage.style.height = '';
      stage.style.position = '';
      stage.style.inset = '';
    }
    closeMeetDocumentPipWindow(pipWindowRef.current);
    pipWindowRef.current = null;
    pipModeRef.current = 'none';
    setPipMode('none');
    setPipActive(false);
  }, []);

  const enterDocumentPip = useCallback(
    async (opts?: { silent?: boolean }) => {
      const stage = stageHomeRef.current;
      const slot = stageSlotRef.current;
      if (!stage || !slot || !conferenceReadyRef.current) return false;
      if (pipEnteringRef.current) return false;
      if (pipModeRef.current === 'document' && pipWindowRef.current && !pipWindowRef.current.closed) {
        pipWindowRef.current.focus();
        return true;
      }

      pipEnteringRef.current = true;
      try {
        if (supportsDocumentPictureInPicture()) {
          try {
            const pipWin = await openMeetDocumentPip({
              stageEl: stage,
              homeEl: slot,
              onClose: restoreStageFromPip,
            });
            pipWindowRef.current = pipWin;
            pipModeRef.current = 'document';
            setPipMode('document');
            setPipActive(true);
            setPanelOpen(false);
            return true;
          } catch (err) {
            if (!opts?.silent) {
              const msg = err instanceof Error ? err.message : '';
              setError(
                t(
                  `Flutuante do sistema indisponível (${msg || 'sem permissão'}). Usa Chrome/Edge ou clica outra vez.`,
                  `Flotante del sistema no disponible (${msg || 'sin permiso'}). Usa Chrome/Edge o pulsa otra vez.`,
                  `System float unavailable (${msg || 'no permission'}). Use Chrome/Edge or try again.`,
                ),
              );
            }
          }
        }

        pipModeRef.current = 'css';
        setPipMode('css');
        setPipActive(true);
        setPanelOpen(false);
        if (!opts?.silent && !supportsDocumentPictureInPicture()) {
          setError(
            t(
              'Este browser não suporta janela flutuante fora do separador. Usa Chrome ou Edge para flutuante automático.',
              'Este navegador no soporta ventana flotante fuera de la pestaña. Usa Chrome o Edge para flotante automático.',
              'This browser does not support floating outside the tab. Use Chrome or Edge for auto float.',
            ),
          );
        }
        return true;
      } finally {
        pipEnteringRef.current = false;
      }
    },
    [restoreStageFromPip, t],
  );

  const exitFloating = useCallback(() => {
    if (pipModeRef.current === 'document') {
      closeMeetDocumentPipWindow(pipWindowRef.current);
      restoreStageFromPip();
      return;
    }
    restoreStageFromPip();
  }, [restoreStageFromPip]);

  useEffect(() => {
    const tryAutoFloat = () => {
      if (!autoFloatRef.current || !conferenceReadyRef.current) return;
      if (pipModeRef.current !== 'none') return;
      void enterDocumentPip({ silent: true });
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        tryAutoFloat();
        return;
      }
      if (
        document.visibilityState === 'visible' &&
        pipModeRef.current === 'document' &&
        pipWindowRef.current &&
        !pipWindowRef.current.closed
      ) {
        closeMeetDocumentPipWindow(pipWindowRef.current);
        restoreStageFromPip();
      }
    };

    const onBlur = () => {
      window.setTimeout(() => {
        if (document.visibilityState === 'hidden') tryAutoFloat();
      }, 80);
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
    };
  }, [enterDocumentPip, restoreStageFromPip]);

  useEffect(() => {
    return () => {
      closeMeetDocumentPipWindow(pipWindowRef.current);
      pipWindowRef.current = null;
    };
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
    [companyId, sessionId, locale],
  );

  function confirmJoinSetup() {
    const prefs = joinPrefsRef.current;
    setJoinSetupDone(true);
    if (prefs.enableLocalRecording) {
      window.setTimeout(() => void startLocalRecording(), 400);
    }
  }

  function maybeStartLiveTranscription() {
    if (!joinPrefsRef.current.enableLiveTranscript || !features.liveTranscriptionEnabled) {
      return;
    }
    setPanelOpen(true);
    transcriptionStartedAtRef.current = Date.now();
    setTranscriptionWaiting(true);
    setTranscriptionOn(true);
    conferenceRef.current?.startTranscription();
  }

  function toggleTranscription() {
    setError(null);
    if (!features.liveTranscriptionEnabled) {
      setError(
        t(
          'A transcrição ao vivo ainda não está activa no CHORUS.',
          'La transcripción en vivo aún no está activa en CHORUS.',
          'Live transcription is not enabled on CHORUS yet.',
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
            'A gravação terminou sem dados. Ao iniciar, escolhe a aba ou janela do CHORUS.',
            'La grabación terminó sin datos. Al iniciar, elige la pestaña o ventana de CHORUS.',
            'Recording finished with no data. When starting, pick the CHORUS tab or window.',
          ),
        );
        return;
      }
      setError(null);
      // Upload Whisper quando o organizador optou na entrada
      if (companyId && result.blob.size > 0) {
        const autoWhisper = joinPrefsRef.current.enableWhisperOnEnd && features.whisperTranscriptionEnabled;
        const wantUpload =
          autoWhisper ||
          window.confirm(
            t(
              'Gravação guardada. Enviar para gerar a transcrição?',
              'Grabación guardada. ¿Subir para generar la transcripción?',
              'Recording saved. Upload to generate the transcript?',
            ),
          );
        if (wantUpload) {
          try {
            const fileName = result.fileName || `chorus-${sessionId}.webm`;
            const contentType = result.blob.type || 'video/webm';
            const file = new File([result.blob], fileName, { type: contentType });
            await uploadMeetRecordingFile({ sessionId, companyId, file });
            const tr = await fetch(`/api/meet/sessions/${sessionId}/transcribe`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                companyId,
                locale,
                languageHint: meetingSpeechLang,
                finalize: false,
                diarize: true,
              }),
            });
            if (tr.ok) {
              setError(
                t(
                  'Gravação enviada. A transcrição está a ser gerada — veja o resumo ao sair.',
                  'Grabación enviada. La transcripción se está generando — vea el recap al salir.',
                  'Recording uploaded. The transcript is being generated — check the recap when you leave.',
                ),
              );
            } else {
              setError(
                t(
                  'Gravação pronta. Abra o resumo e use Transcrever se ainda não houver texto.',
                  'Grabación lista. Abra el recap y use Transcribir si aún no hay texto.',
                  'Cloud recording is ready. Open the recap and use Transcribe if there is no text yet.',
                ),
              );
            }
          } catch (upErr) {
            setError(
              upErr instanceof Error
                ? upErr.message
                : t(
                    'Não foi possível enviar a gravação. Fica no teu PC — podes fazer upload no recap.',
                    'No se pudo subir la grabación. Queda en tu PC — puedes subirla en el recap.',
                    'Could not upload the recording. It remains on your PC — you can upload it in the recap.',
                  ),
            );
          }
        }
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

  async function openFloatingWindow() {
    setError(null);
    if (pipActive) {
      exitFloating();
      return;
    }
    await enterDocumentPip();
  }

  const endInFlight = useRef(false);

  function tearDownConference() {
    exitFloating();
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
    // Sai deste browser: flush da transcrição live só se estava activa.
    leaveQuietRef.current = true;
    closingRef.current = true;
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
            onClick={openFloatingWindow}
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium shadow-sm ${
              pipActive
                ? 'bg-teal-400 text-slate-950 hover:bg-teal-300'
                : 'bg-slate-800/95 text-white/90 hover:bg-slate-700'
            }`}
            title={
              supportsDocumentPictureInPicture()
                ? t(
                    'Janela flutuante do sistema (Chrome/Edge). Activa automaticamente ao mudar de separador.',
                    'Ventana flotante del sistema (Chrome/Edge). Se activa al cambiar de pestaña.',
                    'System floating window (Chrome/Edge). Auto-activates when you switch tabs.',
                  )
                : t(
                    'Flutuante nesta página (browser limitado)',
                    'Flotante en esta página (navegador limitado)',
                    'Float on this page (limited browser)',
                  )
            }
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
              className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-2.5 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-rose-500 disabled:opacity-60"
            >
              <Square className="h-3 w-3" />
              {t('Parar gravação', 'Detener grabación', 'Stop recording')}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void startLocalRecording()}
              disabled={recordingBusy || ending}
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-800/95 px-2.5 py-1.5 text-xs font-medium text-white/90 shadow-sm hover:bg-slate-700 disabled:opacity-60"
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
        <main className="relative min-w-0 flex-1 px-3 pb-3 pt-14 sm:px-4 sm:pb-4">
          {pipActive && (
            <div className="mb-3 rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-xs text-white/60">
              {pipMode === 'document'
                ? t(
                    'Sala na janela flutuante do sistema. Volta a este separador para repor o ecrã completo.',
                    'Sala en la ventana flotante del sistema. Vuelve a esta pestaña para pantalla completa.',
                    'Meeting is in the system floating window. Return to this tab for full screen.',
                  )
                : t(
                    'Flutuante limitado nesta página — usa Chrome/Edge para janela fora do browser.',
                    'Flotante limitado en esta página — usa Chrome/Edge para ventana fuera del navegador.',
                    'Limited float on this page — use Chrome/Edge for a window outside the browser.',
                  )}
              <label className="mt-2 flex items-center gap-2 text-[11px] text-white/50">
                <input
                  type="checkbox"
                  checked={autoFloat}
                  onChange={(event) => setAutoFloat(event.target.checked)}
                  className="rounded border-white/20"
                />
                {t(
                  'Flutuante automático ao mudar de separador ou app',
                  'Flotante automático al cambiar de pestaña o app',
                  'Auto float when switching tab or app',
                )}
              </label>
            </div>
          )}
          <div
            ref={stageSlotRef}
            className={
              pipMode === 'document' && pipActive
                ? 'relative flex min-h-[min(70vh,640px)] w-full items-center justify-center overflow-hidden rounded-2xl border border-dashed border-white/15 bg-slate-950/80'
                : 'relative min-h-[min(70vh,640px)] w-full'
            }
          >
            {pipMode === 'document' && pipActive && (
              <p className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-white/45">
                {t(
                  'A reunião está na janela flutuante CHORUS',
                  'La reunión está en la ventana flotante CHORUS',
                  'The meeting is in the CHORUS floating window',
                )}
              </p>
            )}
            <div
              ref={stageHomeRef}
              className={
                pipMode === 'css' && pipActive
                  ? `fixed bottom-4 z-50 h-[220px] w-[min(92vw,360px)] overflow-hidden rounded-2xl bg-slate-950 shadow-2xl ring-2 ring-teal-400/50 ${
                      panelOpen ? 'right-[23.5rem]' : 'right-14'
                    }`
                  : 'relative h-full min-h-[min(70vh,640px)] w-full overflow-hidden rounded-2xl bg-slate-950'
              }
            >
            <div ref={stageRef} className="relative h-full w-full">
              {!joinSetupDone ? (
                <div className="flex h-full min-h-[min(70vh,640px)] items-center justify-center p-6 text-center text-sm text-white/50">
                  {t(
                    'Configura a reunião para entrar na sala.',
                    'Configura la reunión para entrar a la sala.',
                    'Set up the meeting to join the room.',
                  )}
                </div>
              ) : session.meetingUrl && canEmbedJitsiInIframe(session.meetingUrl) ? (
                <MeetConferenceFrame
                  ref={conferenceRef}
                  meetingUrl={session.meetingUrl}
                  title={session.title}
                  locale={locale}
                  transcriptionLanguage={meetingSpeechLang}
                  onReady={() => {
                    setConferenceReady(true);
                    maybeStartLiveTranscription();
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
                    {!features.liveTranscriptionEnabled
                      ? t(
                          'A transcrição ao vivo ainda está a ser activada no CHORUS.',
                          'La transcripción en vivo aún se está activando en CHORUS.',
                          'Live transcription is still being activated on CHORUS.',
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
                {joinPrefs.enableLiveTranscript
                  ? t(
                      'Transcrição ao vivo (qualidade limitada). Para texto mais fiável, grave e use Transcrever no resumo.',
                      'Transcripción en vivo (calidad limitada). Para texto más fiable, grabe y use Transcribir en el recap.',
                      'Live transcript (limited quality). For more reliable text, record and use Transcribe in the recap.',
                    )
                  : t(
                      'Grave nesta sessão e active a transcrição automática na entrada para um resumo após a reunião.',
                      'Grabe en esta sesión y active la transcripción automática al entrar para un resumen tras la reunión.',
                      'Record in this session and enable automatic transcription when joining for a post-meeting recap.',
                    )}
              </p>
            </div>
          </aside>
        )}
      </div>

      {!joinSetupDone && session && (
        <MeetJoinSetupDialog
          locale={locale}
          meetingTitle={session.title}
          isHost={isHost}
          whisperAvailable={features.whisperTranscriptionEnabled}
          liveTranscriptionAvailable={features.liveTranscriptionEnabled}
          prefs={joinPrefs}
          onChange={setJoinPrefs}
          onConfirm={confirmJoinSetup}
        />
      )}
    </div>
  );
}
