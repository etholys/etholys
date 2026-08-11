'use client';

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { Loader2 } from 'lucide-react';

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

/** Toolbar order aproximado ao Google Meet (mic → cam → share → … → hangup). */
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
  'recording',
  'shortcuts',
  'videoquality',
  'invite',
  'whiteboard',
  'highlight',
] as const;

export type MeetConferenceHandle = {
  startTranscription: () => void;
  stopTranscription: () => void;
  startRecording: (destination: 'local' | 'cloud') => void;
  stopRecording: (destination: 'local' | 'cloud') => void;
  hangup: () => void;
};

type Props = {
  meetingUrl: string;
  title: string;
  locale: string;
  onReady?: () => void;
  onTranscriptionChunk?: (chunk: TranscriptionChunk) => void;
  onRecordingStatus?: (state: RecordingState) => void;
  onParticipantJoined?: (participant: { id?: string; displayName?: string }) => void;
  onParticipantLeft?: (participant: { id?: string }) => void;
  onParticipantCountChange?: (count: number) => void;
  onDominantSpeakerChanged?: (name: string | null) => void;
  onConferenceLeft?: () => void;
  /** Clique no botão Etholys da toolbar Jitsi (abrir/fechar painel de transcrição). */
  onTranscriptToolbarClick?: () => void;
  onError?: (message: string) => void;
  /** Mic/câmara indisponíveis ou bloqueados pelo browser (iframe / permissões). */
  onMediaBlocked?: (payload: {
    kind: 'microphone' | 'camera' | 'both';
    message: string;
  }) => void;
};

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

function readParticipantCount(api: JitsiApi): number {
  try {
    const n = api.getNumberOfParticipants?.();
    if (typeof n === 'number' && n >= 0) return n;
  } catch {
    /* ignore */
  }
  return 0;
}

export const MeetConferenceFrame = forwardRef<MeetConferenceHandle, Props>(
  function MeetConferenceFrame(
    {
      meetingUrl,
      title,
      locale,
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
      onMediaBlocked,
    },
    ref,
  ) {
    const parentRef = useRef<HTMLDivElement>(null);
    const apiRef = useRef<JitsiApi | null>(null);
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
      onMediaBlocked,
    });
    const [loading, setLoading] = useState(true);

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
      onMediaBlocked,
    };

    useImperativeHandle(
      ref,
      () => ({
        startTranscription() {
          const api = apiRef.current;
          if (!api) return;
          // 1) Pedido nativo de legendas → convida o transcriber (Jigasi/Vosk)
          try {
            api.executeCommand('setSubtitles', true, true, 'es');
          } catch {
            try {
              api.executeCommand('toggleSubtitles');
            } catch {
              /* ignore */
            }
          }
          // 2) Caminho clássico External API (alguns builds só reagem a isto)
          try {
            api.executeCommand('startRecording', {
              mode: 'file',
              transcription: true,
            });
          } catch {
            /* ignore — sem Jibri pode falhar; setSubtitles basta para STT */
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
        startRecording(destination) {
          // Só gravação local (browser → disco do utilizador). Sem Jibri/nuvem.
          apiRef.current?.executeCommand('startRecording', {
            mode: 'local',
            onlySelf: false,
          });
        },
        stopRecording(_destination) {
          apiRef.current?.executeCommand('stopRecording', 'local');
        },
        hangup() {
          apiRef.current?.executeCommand('hangup');
        },
      }),
      [],
    );

    useEffect(() => {
      let disposed = false;
      let api: JitsiApi | null = null;

      const emitCount = () => {
        if (!api) return;
        callbacksRef.current.onParticipantCountChange?.(readParticipantCount(api));
      };

      async function mount() {
        try {
          const url = new URL(meetingUrl);
          const roomName = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
          if (!roomName || !parentRef.current) throw new Error('Sala Meet inválida');

          await loadExternalApi(url.origin);
          if (disposed || !parentRef.current || !window.JitsiMeetExternalAPI) return;

          api = new window.JitsiMeetExternalAPI(url.host, {
            roomName,
            parentNode: parentRef.current,
            width: '100%',
            height: '100%',
            lang: locale === 'pt' ? 'ptBR' : locale === 'en' ? 'en' : 'es',
            configOverwrite: {
              subject: title,
              disableDeepLinking: true,
              prejoinConfig: {
                enabled: true,
                // Força ecrã de dispositivos antes de entrar — menos “mic morto” na call
                hideDisplayName: false,
              },
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
              // Sem serviço de gravação na nuvem (Jibri) — só local no browser
              recordingService: {
                enabled: false,
                hideStorageWarning: true,
              },
              localRecording: {
                disable: false,
                notifyAllParticipants: true,
                disableSelfRecording: false,
              },
              liveStreamingEnabled: false,
              transcription: {
                enabled: true,
                autoCaptionOnTranscribe: true,
                // Servidor usa Vosk ES — pedir legendas em espanhol
                useAppLanguage: false,
                preferredLanguage: 'es',
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
              },
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
                'prejoin.errorDialOut',
                'prejoin.errorDialOutDisconnected',
                'prejoin.errorDialOutFailed',
                'prejoin.errorDialOutStatus',
                'prejoin.errorStatusCode',
                'prejoin.errorValidation',
                'toolbar.noAudioSignalTitle',
                'toolbar.noisyAudioInputTitle',
                'toolbar.talkWhileMutedPopup',
              ],
            },
            interfaceConfigOverwrite: {
              APP_NAME: 'Etholys Meet',
              NATIVE_APP_NAME: 'Etholys Meet',
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
              TILE_VIEW_MAX_COLUMNS: 5,
              DEFAULT_BACKGROUND: '#202124',
              DEFAULT_LOCAL_DISPLAY_NAME: 'Eu',
              DEFAULT_REMOTE_DISPLAY_NAME: 'Participante',
              TOOLBAR_ALWAYS_VISIBLE: false,
              INITIAL_TOOLBAR_TIMEOUT: 20000,
              TOOLBAR_TIMEOUT: 4000,
              TOOLBAR_BUTTONS: [...MEET_TOOLBAR_BUTTONS],
              SETTINGS_SECTIONS: ['devices', 'language', 'moderator', 'profile', 'calendar', 'sounds', 'more'],
              VIDEO_LAYOUT_FIT: 'both',
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
          // Cantos arredondados no iframe (chrome Etholys à volta).
          iframe.style.border = '0';
          iframe.style.borderRadius = '16px';
          iframe.style.background = '#202124';
          // Reaplicar se o External API recriar atributos ao carregar.
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

          api.addListener('videoConferenceJoined', () => {
            setLoading(false);
            emitCount();
            callbacksRef.current.onReady?.();
          });
          api.addListener('micError', (payload: { type?: string; message?: string }) => {
            callbacksRef.current.onMediaBlocked?.({
              kind: 'microphone',
              message:
                payload?.message ||
                'O browser bloqueou o microfone nesta janela embutida.',
            });
          });
          api.addListener('cameraError', (payload: { type?: string; message?: string }) => {
            callbacksRef.current.onMediaBlocked?.({
              kind: 'camera',
              message:
                payload?.message ||
                'O browser bloqueou a câmara nesta janela embutida.',
            });
          });
          api.addListener(
            'audioAvailabilityChanged',
            (payload: { available?: boolean }) => {
              if (payload?.available === false) {
                callbacksRef.current.onMediaBlocked?.({
                  kind: 'microphone',
                  message: 'Microfone indisponível nesta sessão.',
                });
              }
            },
          );
          api.addListener(
            'videoAvailabilityChanged',
            (payload: { available?: boolean }) => {
              if (payload?.available === false) {
                callbacksRef.current.onMediaBlocked?.({
                  kind: 'camera',
                  message: 'Câmara indisponível nesta sessão.',
                });
              }
            },
          );
          api.addListener('transcriptionChunkReceived', (chunk: TranscriptionChunk) => {
            callbacksRef.current.onTranscriptionChunk?.(chunk);
          });
          api.addListener('recordingStatusChanged', (state: RecordingState) => {
            callbacksRef.current.onRecordingStatus?.(state);
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
            try {
              const info = api.getParticipantsInfo?.() || [];
              const match = info.find(
                (p: any) => p.participantId === payload.id || p.id === payload.id,
              );
              const name =
                match?.displayName ||
                match?.formattedDisplayName ||
                null;
              callbacksRef.current.onDominantSpeakerChanged?.(name);
            } catch {
              callbacksRef.current.onDominantSpeakerChanged?.(null);
            }
          });
          api.addListener('toolbarButtonClicked', (payload: { key?: string; id?: string }) => {
            const key = payload?.key || payload?.id;
            if (key === ETHOLYS_TRANSCRIPT_BUTTON_ID) {
              callbacksRef.current.onTranscriptToolbarClick?.();
            }
          });
          api.addListener('videoConferenceLeft', () => {
            callbacksRef.current.onConferenceLeft?.();
          });
          api.addListener('readyToClose', () => {
            callbacksRef.current.onConferenceLeft?.();
          });

          // A pré-sala pode ficar aberta antes de videoConferenceJoined.
          window.setTimeout(() => {
            if (!disposed) setLoading(false);
          }, 2500);
        } catch (error) {
          setLoading(false);
          callbacksRef.current.onError?.(
            error instanceof Error ? error.message : 'Erro ao abrir videoconferência',
          );
        }
      }

      void mount();
      return () => {
        disposed = true;
        apiRef.current = null;
        api?.dispose();
      };
    }, [meetingUrl, title, locale]);

    return (
      <div className="relative h-full w-full overflow-hidden rounded-2xl bg-[#202124]">
        <div ref={parentRef} className="absolute inset-0 overflow-hidden rounded-2xl" />
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-[#202124]">
            <Loader2 className="h-8 w-8 animate-spin text-white/70" />
          </div>
        )}
      </div>
    );
  },
);
