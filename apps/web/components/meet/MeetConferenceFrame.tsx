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
  onConferenceLeft?: () => void;
  onError?: (message: string) => void;
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
      existing.addEventListener('error', () => reject(new Error('Jitsi API indisponível')), {
        once: true,
      });
      return;
    }
    const script = document.createElement('script');
    script.src = `${origin}/external_api.js`;
    script.async = true;
    script.dataset.etholysJitsiApi = origin;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Não foi possível carregar a API do Jitsi'));
    document.head.appendChild(script);
  });
  return externalApiLoader;
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
      onConferenceLeft,
      onError,
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
      onConferenceLeft,
      onError,
    });
    const [loading, setLoading] = useState(true);

    callbacksRef.current = {
      onReady,
      onTranscriptionChunk,
      onRecordingStatus,
      onParticipantJoined,
      onParticipantLeft,
      onConferenceLeft,
      onError,
    };

    useImperativeHandle(
      ref,
      () => ({
        startTranscription() {
          apiRef.current?.executeCommand('startRecording', {
            mode: 'file',
            transcription: true,
          });
        },
        stopTranscription() {
          apiRef.current?.executeCommand('stopRecording', 'file', true);
        },
        startRecording(destination) {
          apiRef.current?.executeCommand('startRecording', {
            mode: destination === 'local' ? 'local' : 'file',
            ...(destination === 'local' ? { onlySelf: false } : { shouldShare: false }),
          });
        },
        stopRecording(destination) {
          apiRef.current?.executeCommand(
            'stopRecording',
            destination === 'local' ? 'local' : 'file',
          );
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
              prejoinConfig: { enabled: true },
              breakoutRooms: { hideAddRoomButton: false },
              startWithAudioMuted: false,
            },
          });
          apiRef.current = api;
          api.getIFrame().setAttribute(
            'allow',
            'camera; microphone; fullscreen; display-capture; autoplay',
          );

          api.addListener('videoConferenceJoined', () => {
            setLoading(false);
            callbacksRef.current.onReady?.();
          });
          api.addListener('transcriptionChunkReceived', (chunk: TranscriptionChunk) => {
            callbacksRef.current.onTranscriptionChunk?.(chunk);
          });
          api.addListener('recordingStatusChanged', (state: RecordingState) => {
            callbacksRef.current.onRecordingStatus?.(state);
          });
          api.addListener('participantJoined', (participant) => {
            callbacksRef.current.onParticipantJoined?.(participant);
          });
          api.addListener('participantLeft', (participant) => {
            callbacksRef.current.onParticipantLeft?.(participant);
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
      <div className="relative h-full w-full">
        <div ref={parentRef} className="absolute inset-0" />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <Loader2 className="h-8 w-8 animate-spin text-sky-400" />
          </div>
        )}
      </div>
    );
  },
);
