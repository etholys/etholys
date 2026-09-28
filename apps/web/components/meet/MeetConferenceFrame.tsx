'use client';

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { Loader2 } from 'lucide-react';
import { normalizeChorusLiveTranscript } from '@/lib/meet/parse-transcript-event';

type TranscriptionChunk = {
  language?: string;
  messageID?: string;
  participant?: {
    id?: string;
    name?: string;
    avatarUrl?: string;
  };
  final?: string;
  stable?: string;
  unstable?: string;
};

type RecordingState = {
  on: boolean;
  mode: 'local' | 'file' | 'stream' | string;
  transcription?: boolean;
  error?: string | null;
};

type JitsiApi = {
  addListener: (event: string, listener: (payload: any) => void) => void;
  executeCommand: (command: string, ...args: any[]) => void;
  getIFrame: () => HTMLIFrameElement;
  getNumberOfParticipants?: () => number;
  getParticipantsInfo?: () => Array<{ displayName?: string; formattedDisplayName?: string }>;
  dispose: () => void;
};

type JitsiConstructor = new (
  domain: string,
  options: Record<string, unknown>,
) => JitsiApi;

declare global {
  interface Window {
    JitsiMeetExternalAPI?: JitsiConstructor;
  }
}

const ETHOLYS_TRANSCRIPT_BUTTON_ID = 'etholys-transcript';

/**
 * Chrome 116+ exige allow com `*` (ou origem explícita) em iframes cross-origin.
 * Sem isto o browser bloqueia getUserMedia e o mic/câmara “não ligam”.
 */
export const MEET_IFRAME_ALLOW =
  'camera *; microphone *; display-capture *; autoplay *; clipboard-write *; hid *; screen-wake-lock *; fullscreen *; speaker-selection *';

function applyMeetIframeMediaPermissions(iframe: HTMLIFrameElement) {
  iframe.setAttribute('allow', MEET_IFRAME_ALLOW);
  iframe.setAttribute('allowfullscreen', 'true');
  // Atributo legado — alguns Chromium ainda consultam
  iframe.setAttribute('allowusermedia', 'true');
}

/** Toolbar order CHORUS (mic → cam → share → … → hangup). */
const MEET_TOOLBAR_BUTTONS = [
  'microphone',
  'camera',
  'desktop',
  'raisehand',
  'reactions',
  'chat',
  'closedcaptions',
  ETHOLYS_TRANSCRIPT_BUTTON_ID,
  'participants-pane',
  'tileview',
  'hangup',
  'settings',
  'fullscreen',
  'select-background',
  'noisesuppression',
  'shortcuts',
  'videoquality',
  'invite',
  'whiteboard',
  'highlight',
] as const;

export type MeetLayoutMode = 'speaker' | 'gallery' | 'presentation' | 'stage' | 'crowded';

export type MeetConferenceHandle = {
  startTranscription: () => void;
  stopTranscription: () => void;
  startRecording: (destination: 'local' | 'cloud') => void;
  stopRecording: (destination: 'local' | 'cloud') => void;
  hangup: () => void;
  dispose: () => void;
  setLayoutMode: (mode: MeetLayoutMode) => void;
};

type Props = {
  meetingUrl: string;
  title: string;
  locale: string;
  /** Nome visível na sala (evita «Participante» / slug técnico). */
  displayName?: string;
  /** Idioma da transcrição ao vivo (pt/es/en) — independente do idioma da UI */
  transcriptionLanguage?: string;
  onReady?: () => void;
  onTranscriptionChunk?: (chunk: TranscriptionChunk) => void;
  onRecordingStatus?: (state: RecordingState) => void;
  onParticipantJoined?: (participant: { id?: string; displayName?: string }) => void;
  onParticipantLeft?: (participant: { id?: string }) => void;
  onParticipantCountChange?: (count: number) => void;
  onDominantSpeakerChanged?: (name: string | null) => void;
  onConferenceLeft?: () => void;
  /** Clique no botão Etholys da toolbar (abrir/fechar painel de transcrição). */
  onTranscriptToolbarClick?: () => void;
  onError?: (message: string) => void;
};

const JOIN_TIMEOUT_MS = 25_000;

let externalApiLoader: Promise<void> | null = null;

function loadExternalApi(origin: string): Promise<void> {
  if (window.JitsiMeetExternalAPI) return Promise.resolve();
  if (externalApiLoader) return externalApiLoader;

  externalApiLoader = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[data-etholys-jitsi-api="${origin}"]`,
    );
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('API de vídeo do Meet indisponível')), {
        once: true,
      });
      return;
    }
    const script = document.createElement('script');
    script.src = `${origin}/external_api.js`;
    script.async = true;
    script.dataset.etholysJitsiApi = origin;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Não foi possível carregar a sala de vídeo do Meet'));
    document.head.appendChild(script);
  });
  return externalApiLoader;
}

function readParticipantCount(api: JitsiApi, opts?: { assumeLocalJoined?: boolean }): number {
  try {
    const info = api.getParticipantsInfo?.();
    if (Array.isArray(info) && info.length > 0) return info.length;
  } catch {
    /* ignore */
  }
  try {
    const n = api.getNumberOfParticipants?.();
    if (typeof n === 'number' && n > 0) return n;
  } catch {
    /* ignore */
  }
  // Alguns builds devolvem 0 até o roster estabilizar — após join há pelo menos o local.
  return opts?.assumeLocalJoined ? 1 : 0;
}

function sizeMeetIframe(parent: HTMLElement, iframe: HTMLIFrameElement) {
  const rect = parent.getBoundingClientRect();
  // Preferir a altura real do contentor (não o teto antigo de 640px).
  const w = Math.max(Math.floor(rect.width || parent.clientWidth), 320);
  const h = Math.max(Math.floor(rect.height || parent.clientHeight), 240);
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.minWidth = '100%';
  iframe.style.minHeight = '100%';
  iframe.style.maxWidth = '100%';
  iframe.style.maxHeight = '100%';
  // Jitsi External API também lê width/height em px no mount — manter valores úteis.
  if (w > 0 && h > 0) {
    iframe.setAttribute('width', String(w));
    iframe.setAttribute('height', String(h));
  }
  iframe.style.display = 'block';
}

export const MeetConferenceFrame = forwardRef<MeetConferenceHandle, Props>(
  function MeetConferenceFrame(
    {
      meetingUrl,
      title,
      locale,
      displayName,
      transcriptionLanguage,
      onReady,
      onTranscriptionChunk,
      onRecordingStatus,
      onParticipantJoined,
      onParticipantLeft,
      onParticipantCountChange,
      onDominantSpeakerChanged,
      onConferenceLeft,
      onTranscriptToolbarClick,
      onError,
    },
    ref,
  ) {
    const parentRef = useRef<HTMLDivElement>(null);
    const apiRef = useRef<JitsiApi | null>(null);
    const filmstripHiddenRef = useRef(false);
    const joinedRef = useRef(false);
    const callbacksRef = useRef({
      onReady,
      onTranscriptionChunk,
      onRecordingStatus,
      onParticipantJoined,
      onParticipantLeft,
      onParticipantCountChange,
      onDominantSpeakerChanged,
      onConferenceLeft,
      onTranscriptToolbarClick,
      onError,
    });
    const [loading, setLoading] = useState(true);
    const [joinError, setJoinError] = useState<string | null>(null);

    callbacksRef.current = {
      onReady,
      onTranscriptionChunk,
      onRecordingStatus,
      onParticipantJoined,
      onParticipantLeft,
      onParticipantCountChange,
      onDominantSpeakerChanged,
      onConferenceLeft,
      onTranscriptToolbarClick,
      onError,
    };

    useImperativeHandle(
      ref,
      () => ({
        startTranscription() {
          const api = apiRef.current;
          if (!api) return;
          const lang = locale === 'pt' ? 'pt' : locale === 'en' ? 'en' : 'es';
          // Vários builds aceitam assinaturas diferentes de setSubtitles.
          for (const args of [
            [true, true, lang],
            [true, true, `translation-languages:${lang}`],
            [true, true],
          ] as unknown[][]) {
            try {
              api.executeCommand('setSubtitles', ...args);
              break;
            } catch {
              /* tenta a seguinte */
            }
          }
          try {
            // Só o transcritor (Jigasi). Nunca gravação de ficheiro nem ecrã.
            api.executeCommand('startRecording', {
              mode: 'file',
              transcription: true,
              onlyTranscribe: true,
              onlyTranscription: true,
            });
          } catch {
            /* STT ao vivo pode falhar se o serviço não estiver activo */
          }
        },
        stopTranscription() {
          const api = apiRef.current;
          if (!api) return;
          try {
            api.executeCommand('setSubtitles', false);
          } catch {
            /* ignore */
          }
          try {
            api.executeCommand('stopRecording', 'file', true);
          } catch {
            /* ignore */
          }
        },
        startRecording(_destination) {
          // Só gravação da chamada no Jitsi (Jibri). Nunca getDisplayMedia.
          apiRef.current?.executeCommand('startRecording', {
            mode: 'file',
            transcription: false,
          });
        },
        stopRecording(_destination) {
          try {
            apiRef.current?.executeCommand('stopRecording', 'file');
          } catch {
            /* ignore */
          }
        },
        hangup() {
          try {
            apiRef.current?.executeCommand('hangup');
          } catch {
            /* ignore */
          }
        },
        dispose() {
          const api = apiRef.current;
          apiRef.current = null;
          try {
            api?.dispose();
          } catch {
            /* ignore */
          }
        },
        setLayoutMode(mode) {
          const api = apiRef.current;
          if (!api) return;
          const run = (cmd: string, ...args: unknown[]) => {
            try {
              api.executeCommand(cmd, ...args);
            } catch {
              /* ignore */
            }
          };
          const ensureFilmstrip = (hidden: boolean) => {
            if (filmstripHiddenRef.current === hidden) return;
            run('toggleFilmstrip');
            filmstripHiddenRef.current = hidden;
          };
          switch (mode) {
            case 'gallery':
            case 'crowded':
              ensureFilmstrip(false);
              run('setTileView', true);
              break;
            case 'presentation':
              run('setTileView', false);
              ensureFilmstrip(true);
              break;
            case 'stage':
            case 'speaker':
            default:
              ensureFilmstrip(false);
              run('setTileView', false);
              break;
          }
        },
      }),
      [locale],
    );

    useEffect(() => {
      let disposed = false;
      let api: JitsiApi | null = null;
      let joinTimer: number | undefined;
      let countTimer: number | undefined;
      let resizeObserver: ResizeObserver | null = null;
      joinedRef.current = false;
      setLoading(true);
      setJoinError(null);

      const failJoin = (message: string) => {
        if (disposed) return;
        setLoading(false);
        setJoinError(message);
        callbacksRef.current.onError?.(message);
      };

      const emitCount = () => {
        if (!api) return;
        callbacksRef.current.onParticipantCountChange?.(
          readParticipantCount(api, { assumeLocalJoined: joinedRef.current }),
        );
      };

      async function mount() {
        try {
          const url = new URL(meetingUrl);
          const roomName = decodeURIComponent(url.pathname.replace(/^\/+/, '')).split('/')[0];
          if (!roomName || !parentRef.current) throw new Error('Sala Meet inválida');

          await loadExternalApi(url.origin);
          if (disposed || !parentRef.current || !window.JitsiMeetExternalAPI) return;

          // Limpar restos de um mount anterior (Strict Mode / remount).
          parentRef.current.replaceChildren();

          const parent = parentRef.current;
          const initialRect = parent.getBoundingClientRect();
          const initialW = Math.max(Math.floor(initialRect.width), 320);
          const initialH = Math.max(Math.floor(initialRect.height), 360);

          const userName = (displayName || '').trim().slice(0, 80);

          api = new window.JitsiMeetExternalAPI(url.host, {
            roomName,
            parentNode: parent,
            width: initialW,
            height: initialH,
            lang: locale === 'pt' ? 'ptBR' : locale === 'en' ? 'en' : 'es',
            ...(userName
              ? {
                  userInfo: {
                    displayName: userName,
                  },
                }
              : {}),
            configOverwrite: {
              subject: title,
              disableDeepLinking: true,
              // Hub já tem MeetJoinSetupDialog — pré-sala Jitsi deixa 0 participantes
              // e ecrã preto se o utilizador nunca clica «Entrar» / UI falha.
              prejoinConfig: {
                enabled: false,
              },
              prejoinPageEnabled: false,
              breakoutRooms: { hideAddRoomButton: false },
              startWithAudioMuted: false,
              startWithVideoMuted: false,
              startSilent: false,
              disableInitialGUM: false,
              enableNoAudioDetection: true,
              enableNoisyMicDetection: true,
              hideConferenceSubject: true,
              hideConferenceTimer: true,
              disableResponsiveTiles: false,
              disableTileEnlargement: false,
              defaultLogoUrl: 'https://app.etholys.com/meet-brand/etholys-mark.svg',
              defaultRemoteDisplayName: 'Participante',
              fileRecordingsEnabled: true,
              recordingService: {
                enabled: false,
                hideStorageWarning: true,
              },
              // Local recording = getDisplayMedia da aba → ecrã preto no Chrome.
              localRecording: {
                disable: true,
                disableSelfRecording: true,
                notifyAllParticipants: false,
              },
              liveStreamingEnabled: false,
              transcription: {
                enabled: true,
                autoCaptionOnTranscribe: true,
                useAppLanguage: false,
                preferredLanguage:
                  transcriptionLanguage === 'pt' ||
                  transcriptionLanguage === 'en' ||
                  transcriptionLanguage === 'es'
                    ? transcriptionLanguage
                    : locale === 'pt'
                      ? 'pt'
                      : locale === 'en'
                        ? 'en'
                        : 'es',
                disableStartForAll: false,
              },
              disableVirtualBackground: false,
              virtualBackgrounds: [
                {
                  id: 'etholys-ocean',
                  src: 'https://app.etholys.com/meet-brand/backgrounds/soft-ocean.svg',
                },
                {
                  id: 'etholys-studio',
                  src: 'https://app.etholys.com/meet-brand/backgrounds/warm-studio.svg',
                },
                {
                  id: 'etholys-forest',
                  src: 'https://app.etholys.com/meet-brand/backgrounds/forest-mist.svg',
                },
                {
                  id: 'etholys-office',
                  src: 'https://app.etholys.com/meet-brand/backgrounds/office-soft.svg',
                },
              ],
              customToolbarButtons: [
                {
                  id: ETHOLYS_TRANSCRIPT_BUTTON_ID,
                  text: locale === 'pt' ? 'Transcrição' : locale === 'en' ? 'Transcript' : 'Transcripción',
                  icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIj48cmVjdCB4PSI0IiB5PSIzIiB3aWR0aD0iMTYiIGhlaWdodD0iMTgiIHJ4PSIyIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjEuNzUiLz48cGF0aCBkPSJNOCA4aDhNOCAxMmg4TTggMTZoNSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIxLjc1IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48L3N2Zz4=',
                },
              ],
              toolbarButtons: [...MEET_TOOLBAR_BUTTONS],
              filmstrip: {
                disableResizable: false,
                disableStageFilmstrip: false,
                stageFilmstripParticipants: 6,
                disableTopPanel: false,
              },
              tileView: {
                numberOfVisibleTiles: 25,
              },
              autoPinLatestScreenShare: 'remote-only',
              notifications: [
                'connection.CONNFAIL',
                'dialog.cameraNotSendingData',
                'dialog.kick',
                'dialog.liveStreaming',
                'dialog.lockTitle',
                'dialog.maxUsersLimitReached',
                'dialog.micNotSendingData',
                'dialog.passwordNotSupportedTitle',
                'dialog.recording',
                'dialog.remoteControlTitle',
                'dialog.reservationError',
                'dialog.serviceUnavailable',
                'dialog.sessTerminated',
                'dialog.sessionRestarted',
                'dialog.tokenAuthFailed',
                'dialog.transcribing',
                'notify.disconnected',
                'notify.grantedTo',
                'notify.invitedOneGuest',
                'notify.invitedGuests',
                'notify.kickParticipant',
                'notify.mutedRemotelyTitle',
                'notify.newDeviceAudioTitle',
                'notify.newDeviceCameraTitle',
                'notify.passwordRemovedRemotely',
                'notify.passwordSetRemotely',
                'notify.raisedHand',
                'notify.startSilentTitle',
                'notify.unmutedTitle',
                'toolbar.noAudioSignalTitle',
                'toolbar.noisyAudioInputTitle',
                'toolbar.talkWhileMutedPopup',
              ],
            },
            interfaceConfigOverwrite: {
              APP_NAME: 'CHORUS',
              NATIVE_APP_NAME: 'CHORUS',
              PROVIDER_NAME: 'Etholys',
              SHOW_JITSI_WATERMARK: false,
              SHOW_WATERMARK_FOR_GUESTS: false,
              SHOW_BRAND_WATERMARK: false,
              SHOW_POWERED_BY: false,
              SHOW_CHROME_EXTENSION_BANNER: false,
              MOBILE_APP_PROMO: false,
              DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
              DISABLE_PRESENCE_STATUS: false,
              HIDE_INVITE_MORE_HEADER: true,
              HIDE_DEEP_LINKING_LOGO: true,
              GENERATE_ROOMNAMES_ON_WELCOME_PAGE: false,
              DISPLAY_WELCOME_FOOTER: false,
              VERTICAL_FILMSTRIP: true,
              FILM_STRIP_MAX_HEIGHT: 140,
              TILE_VIEW_MAX_COLUMNS: 7,
              DEFAULT_BACKGROUND: '#0f172a',
              DEFAULT_LOCAL_DISPLAY_NAME: 'Eu',
              DEFAULT_REMOTE_DISPLAY_NAME: 'Participante',
              TOOLBAR_ALWAYS_VISIBLE: false,
              INITIAL_TOOLBAR_TIMEOUT: 20000,
              TOOLBAR_TIMEOUT: 4000,
              TOOLBAR_BUTTONS: [...MEET_TOOLBAR_BUTTONS],
              SETTINGS_SECTIONS: ['devices', 'language', 'moderator', 'profile', 'calendar', 'sounds', 'more'],
              VIDEO_LAYOUT_FIT: 'both',
              AUTO_PIN_LATEST_SCREEN_SHARE: true,
              JITSI_WATERMARK_LINK: 'https://app.etholys.com/hub/meet',
              BRAND_WATERMARK_LINK: 'https://app.etholys.com/hub/meet',
              SUPPORT_URL: 'https://app.etholys.com/hub/meet',
              DEFAULT_LOGO_URL: 'https://app.etholys.com/meet-brand/etholys-mark.svg',
              DEFAULT_WELCOME_PAGE_LOGO_URL: 'https://app.etholys.com/meet-brand/etholys-meet.svg',
            },
          });
          apiRef.current = api;
          const iframe = api.getIFrame();
          applyMeetIframeMediaPermissions(iframe);
          iframe.style.border = '0';
          iframe.style.borderRadius = '16px';
          iframe.style.background = '#202124';
          sizeMeetIframe(parent, iframe);

          resizeObserver = new ResizeObserver(() => {
            if (disposed || !apiRef.current || !parentRef.current) return;
            try {
              sizeMeetIframe(parentRef.current, apiRef.current.getIFrame());
            } catch {
              /* ignore */
            }
          });
          resizeObserver.observe(parent);

          const allowWatch = window.setInterval(() => {
            if (disposed || !apiRef.current) {
              window.clearInterval(allowWatch);
              return;
            }
            try {
              const frame = apiRef.current.getIFrame();
              if (frame.getAttribute('allow') !== MEET_IFRAME_ALLOW) {
                applyMeetIframeMediaPermissions(frame);
              }
            } catch {
              window.clearInterval(allowWatch);
            }
          }, 1500);
          window.setTimeout(() => window.clearInterval(allowWatch), 30_000);

          const resolveParticipantName = (id?: string | null): string | null => {
            if (!id || !api) return null;
            try {
              const info = api.getParticipantsInfo?.() || [];
              const match = info.find(
                (p: any) => p.participantId === id || p.id === id,
              );
              const name = (match?.displayName || match?.formattedDisplayName || '').trim();
              return name || null;
            } catch {
              return null;
            }
          };

          const markJoined = () => {
            if (disposed || joinedRef.current) return;
            joinedRef.current = true;
            if (joinTimer) window.clearTimeout(joinTimer);
            setLoading(false);
            setJoinError(null);
            emitCount();
            // Roster pode atrasar — reforçar contagem local.
            window.setTimeout(emitCount, 400);
            window.setTimeout(emitCount, 1500);
            callbacksRef.current.onReady?.();
            countTimer = window.setInterval(emitCount, 4000);
          };

          api.addListener('videoConferenceJoined', markJoined);
          api.addListener('videoAvailabilityChanged', () => {
            if (joinedRef.current) emitCount();
          });

          const emitTranscript = (raw: unknown) => {
            const chunk = normalizeChorusLiveTranscript(raw);
            if (!chunk) return;
            const pid = chunk.participant?.id;
            const resolved = resolveParticipantName(pid);
            if (resolved) {
              chunk.participant = {
                id: pid,
                name: resolved,
                ...(chunk.participant?.avatarUrl
                  ? { avatarUrl: chunk.participant.avatarUrl }
                  : {}),
              };
            }
            callbacksRef.current.onTranscriptionChunk?.(chunk);
          };
          api.addListener('transcriptionChunkReceived', emitTranscript);
          api.addListener('endpointTextMessageReceived', emitTranscript);
          api.addListener('incomingMessage', emitTranscript);
          api.addListener('transcribingStatusChanged', (state: { on?: boolean } | boolean) => {
            const on = typeof state === 'boolean' ? state : Boolean(state?.on);
            callbacksRef.current.onRecordingStatus?.({
              on,
              mode: 'file',
              transcription: true,
            });
          });
          api.addListener('recordingStatusChanged', (state: RecordingState) => {
            callbacksRef.current.onRecordingStatus?.({
              on: Boolean(state?.on),
              mode: state?.mode || 'file',
              transcription: Boolean(state?.transcription),
              error: state?.error ?? null,
            });
          });
          api.addListener('participantJoined', (participant) => {
            emitCount();
            callbacksRef.current.onParticipantJoined?.(participant);
          });
          api.addListener('participantLeft', (participant) => {
            emitCount();
            callbacksRef.current.onParticipantLeft?.(participant);
          });
          api.addListener('dominantSpeakerChanged', (payload: { id?: string }) => {
            if (!payload?.id || !api) {
              callbacksRef.current.onDominantSpeakerChanged?.(null);
              return;
            }
            const name = resolveParticipantName(payload.id);
            callbacksRef.current.onDominantSpeakerChanged?.(name);
          });
          api.addListener('toolbarButtonClicked', (payload: { key?: string; id?: string }) => {
            const key = payload?.key || payload?.id;
            if (key === ETHOLYS_TRANSCRIPT_BUTTON_ID) {
              callbacksRef.current.onTranscriptToolbarClick?.();
            }
          });

          const onFatal = (payload?: { error?: { message?: string; name?: string }; message?: string }) => {
            if (joinedRef.current) return;
            const detail =
              payload?.error?.message ||
              payload?.error?.name ||
              payload?.message ||
              'Falha ao ligar à sala de vídeo';
            failJoin(detail);
          };
          api.addListener('conferenceFailed', onFatal);
          api.addListener('connectionFailed', onFatal);
          api.addListener('errorOccurred', (payload: { error?: { message?: string; isFatal?: boolean } }) => {
            if (payload?.error?.isFatal) onFatal(payload);
          });

          let leftEmitted = false;
          const emitLeft = () => {
            if (leftEmitted || disposed) return;
            leftEmitted = true;
            callbacksRef.current.onConferenceLeft?.();
          };
          api.addListener('videoConferenceLeft', emitLeft);
          api.addListener('readyToClose', emitLeft);

          joinTimer = window.setTimeout(() => {
            if (disposed || joinedRef.current) return;
            failJoin(
              locale === 'pt'
                ? 'A sala de vídeo não entrou a tempo. Atualiza a página ou abre numa nova janela.'
                : locale === 'en'
                  ? 'The video room did not join in time. Refresh or open in a new window.'
                  : 'La sala de vídeo no entró a tiempo. Actualiza la página o ábrela en una ventana nueva.',
            );
          }, JOIN_TIMEOUT_MS);
        } catch (error) {
          failJoin(
            error instanceof Error ? error.message : 'Erro ao abrir videoconferência',
          );
        }
      }

      void mount();
      return () => {
        disposed = true;
        if (joinTimer) window.clearTimeout(joinTimer);
        if (countTimer) window.clearInterval(countTimer);
        resizeObserver?.disconnect();
        const current = apiRef.current;
        apiRef.current = null;
        try {
          current?.executeCommand('hangup');
        } catch {
          /* ignore */
        }
        try {
          current?.dispose();
        } catch {
          /* ignore */
        }
      };
    }, [meetingUrl, title, locale, displayName, transcriptionLanguage]);

    return (
      <div className="relative h-full min-h-0 w-full overflow-hidden rounded-2xl bg-[#202124]">
        <div
          ref={parentRef}
          className="absolute inset-0 h-full w-full overflow-hidden rounded-2xl [&_iframe]:h-full [&_iframe]:w-full [&_iframe]:border-0"
        />
        {loading && !joinError && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-2xl bg-[#202124]">
            <Loader2 className="h-8 w-8 animate-spin text-white/70" />
            <p className="text-xs text-white/50">
              {locale === 'pt'
                ? 'A entrar na sala…'
                : locale === 'en'
                  ? 'Joining the room…'
                  : 'Entrando a la sala…'}
            </p>
          </div>
        )}
        {joinError && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 rounded-2xl bg-slate-950/95 px-6 text-center">
            <p className="max-w-md text-sm text-red-200">{joinError}</p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-full bg-teal-400 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-teal-300"
              >
                {locale === 'pt' ? 'Atualizar' : locale === 'en' ? 'Refresh' : 'Actualizar'}
              </button>
              <a
                href={meetingUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-white/10 px-4 py-2 text-xs font-medium text-white hover:bg-white/15"
              >
                {locale === 'pt'
                  ? 'Abrir numa nova janela'
                  : locale === 'en'
                    ? 'Open in new window'
                    : 'Abrir en ventana nueva'}
              </a>
            </div>
          </div>
        )}
      </div>
    );
  },
);
