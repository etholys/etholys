'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Download,
  Loader2,
  Mic,
  MonitorUp,
  Square,
  Video,
} from 'lucide-react';
import { useApp } from '@/app/providers';

type Props = {
  companyId?: string;
  sessionId?: string;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

/**
 * Captura para reuniões externas (Zoom / Teams / Meet de terceiros):
 * ecrã + microfone → ficheiro local + transcrição ao vivo (Web Speech) + upload opcional.
 */
export function MeetExternalCapture({ companyId, sessionId }: Props) {
  const { locale } = useApp();
  const t = (pt: string, es: string, en: string) =>
    locale === 'pt' ? pt : locale === 'es' ? es : en;

  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [liveLine, setLiveLine] = useState('');
  const [transcriptLines, setTranscriptLines] = useState<string[]>([]);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState(false);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const speechRef = useRef<SpeechRecognitionLike | null>(null);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);

  const cleanupStreams = useCallback(() => {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    micStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    micStreamRef.current = null;
    try {
      speechRef.current?.stop();
    } catch {
      /* ignore */
    }
    speechRef.current = null;
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => () => cleanupStreams(), [cleanupStreams]);

  function startSpeech() {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;
    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = locale === 'pt' ? 'pt-BR' : locale === 'en' ? 'en-US' : 'es-ES';
    recognition.onresult = (event: any) => {
      let interim = '';
      let finalText = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const row = event.results[i];
        const text = String(row?.[0]?.transcript || '').trim();
        if (!text) continue;
        if (row.isFinal) finalText += `${text} `;
        else interim += `${text} `;
      }
      if (finalText.trim()) {
        setTranscriptLines((prev) => [...prev, finalText.trim()]);
        setLiveLine('');
      } else {
        setLiveLine(interim.trim());
      }
    };
    recognition.onerror = () => {
      /* Chrome corta por silêncio — recomeça se ainda a gravar */
    };
    recognition.onend = () => {
      if (recorderRef.current && recorderRef.current.state === 'recording') {
        try {
          recognition.start();
        } catch {
          /* ignore */
        }
      }
    };
    speechRef.current = recognition;
    try {
      recognition.start();
    } catch {
      /* ignore */
    }
  }

  async function startCapture() {
    setError(null);
    setBusy(true);
    setDownloadUrl(null);
    setFileName(null);
    setUploaded(false);
    setTranscriptLines([]);
    setLiveLine('');
    setElapsedSec(0);
    chunksRef.current = [];
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: true,
      });
      let mic: MediaStream | null = null;
      try {
        mic = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
          },
          video: false,
        });
      } catch {
        // Sem microfone: continua só com áudio do ecrã (se o SO permitir)
      }

      const tracks: MediaStreamTrack[] = [...display.getVideoTracks()];
      const audioTracks = [
        ...display.getAudioTracks(),
        ...(mic?.getAudioTracks() || []),
      ];
      if (audioTracks.length) {
        // Preferir um único stream composto
        const audioCtx = new AudioContext();
        const dest = audioCtx.createMediaStreamDestination();
        for (const track of audioTracks) {
          const src = audioCtx.createMediaStreamSource(new MediaStream([track]));
          src.connect(dest);
        }
        tracks.push(...dest.stream.getAudioTracks());
      }

      const composed = new MediaStream(tracks);
      mediaStreamRef.current = display;
      micStreamRef.current = mic;

      const mimeCandidates = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
      ];
      const mimeType =
        mimeCandidates.find((type) => MediaRecorder.isTypeSupported(type)) || '';
      const recorder = new MediaRecorder(
        composed,
        mimeType ? { mimeType, videoBitsPerSecond: 2_500_000 } : undefined,
      );
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'video/webm',
        });
        const url = URL.createObjectURL(blob);
        const name = `etholys-capture-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.webm`;
        setDownloadUrl(url);
        setFileName(name);
        setRecording(false);
        cleanupStreams();
      };

      display.getVideoTracks()[0]?.addEventListener('ended', () => {
        if (recorder.state === 'recording') recorder.stop();
      });

      recorderRef.current = recorder;
      recorder.start(1000);
      setRecording(true);
      startedAtRef.current = Date.now();
      timerRef.current = window.setInterval(() => {
        setElapsedSec(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }, 1000);
      startSpeech();
    } catch (err) {
      cleanupStreams();
      setError(
        err instanceof Error
          ? err.message
          : t(
              'Não foi possível iniciar a captura.',
              'No se pudo iniciar la captura.',
              'Could not start capture.',
            ),
      );
    } finally {
      setBusy(false);
    }
  }

  function stopCapture() {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      setRecording(false);
      cleanupStreams();
      return;
    }
    recorder.stop();
  }

  async function uploadToSession() {
    if (!companyId || !sessionId || !downloadUrl || !fileName) {
      setError(
        t(
          'Abra esta página a partir de uma sessão Meet para enviar à nuvem.',
          'Abre esta página desde una sesión Meet para subir a la nube.',
          'Open this page from a Meet session to upload to the cloud.',
        ),
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const blob = await fetch(downloadUrl).then((r) => r.blob());
      const presign = await fetch(`/api/meet/sessions/${sessionId}/recording`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          action: 'presign',
          fileName,
          contentType: blob.type || 'video/webm',
        }),
      });
      const presignData = (await presign.json()) as {
        error?: string;
        uploadUrl?: string;
        storageKey?: string;
      };
      if (!presign.ok || !presignData.uploadUrl || !presignData.storageKey) {
        throw new Error(presignData.error || 'Presign falhou');
      }
      const put = await fetch(presignData.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': blob.type || 'video/webm' },
        body: blob,
      });
      if (!put.ok) throw new Error(`Upload HTTP ${put.status}`);
      const confirm = await fetch(`/api/meet/sessions/${sessionId}/recording`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          action: 'confirm',
          storageKey: presignData.storageKey,
        }),
      });
      const confirmData = (await confirm.json()) as { error?: string };
      if (!confirm.ok) throw new Error(confirmData.error || 'Confirm falhou');

      const fullTranscript = [...transcriptLines, liveLine].filter(Boolean).join('\n');
      if (fullTranscript.length >= 20) {
        await fetch(`/api/meet/sessions/${sessionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId,
            transcriptText: fullTranscript,
          }),
        }).catch(() => undefined);
      }
      setUploaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload error');
    } finally {
      setBusy(false);
    }
  }

  const mm = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
  const ss = String(elapsedSec % 60).padStart(2, '0');

  return (
    <div className="min-h-screen bg-[#0f1115] text-white">
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/hub/meet"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/15"
            aria-label={t('Voltar', 'Volver', 'Back')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold tracking-tight">
              {t('Captura Etholys', 'Captura Etholys', 'Etholys Capture')}
            </h1>
            <p className="truncate text-xs text-white/50">
              {t(
                'Para Zoom, Teams ou Meet externo — ecrã + microfone',
                'Para Zoom, Teams o Meet externo — pantalla + micrófono',
                'For Zoom, Teams or external Meet — screen + microphone',
              )}
            </p>
          </div>
        </div>
        <div className="tabular-nums text-sm text-white/70">
          {recording ? `${mm}:${ss}` : '00:00'}
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border border-white/10 bg-[#171a21] p-6">
          <div className="mb-5 flex items-start gap-3">
            <MonitorUp className="mt-0.5 h-5 w-5 text-[#8ab4f8]" />
            <div>
              <h2 className="text-sm font-medium">
                {t('Gravar ecrã da reunião', 'Grabar pantalla de la reunión', 'Record meeting screen')}
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-white/50">
                {t(
                  'Escolha a janela do Zoom/Teams e permita o microfone. O ficheiro descarrega ao parar.',
                  'Elige la ventana de Zoom/Teams y permite el micrófono. El archivo se descarga al detener.',
                  'Pick the Zoom/Teams window and allow the microphone. The file downloads when you stop.',
                )}
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-950/40 px-3 py-2 text-xs text-red-200">
              {error}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {!recording ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void startCapture()}
                className="inline-flex items-center gap-2 rounded-full bg-[#8ab4f8] px-4 py-2.5 text-sm font-semibold text-[#202124] hover:bg-[#aecbfa] disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
                {t('Iniciar captura', 'Iniciar captura', 'Start capture')}
              </button>
            ) : (
              <button
                type="button"
                onClick={stopCapture}
                className="inline-flex items-center gap-2 rounded-full bg-[#ea4335] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#f28b82]"
              >
                <Square className="h-3.5 w-3.5" />
                {t('Parar e guardar', 'Detener y guardar', 'Stop and save')}
              </button>
            )}

            {downloadUrl && fileName && (
              <>
                <a
                  href={downloadUrl}
                  download={fileName}
                  className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/15"
                >
                  <Download className="h-4 w-4" />
                  {t('Descarregar vídeo', 'Descargar vídeo', 'Download video')}
                </a>
                {companyId && sessionId && (
                  <button
                    type="button"
                    disabled={busy || uploaded}
                    onClick={() => void uploadToSession()}
                    className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/15 disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
                    {uploaded
                      ? t('Enviado', 'Enviado', 'Uploaded')
                      : t('Enviar à sessão Meet', 'Subir a sesión Meet', 'Upload to Meet session')}
                  </button>
                )}
              </>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-[#171a21] p-6">
          <h2 className="mb-3 text-sm font-medium">
            {t('Transcrição ao vivo', 'Transcripción en vivo', 'Live transcript')}
          </h2>
          <p className="mb-4 text-[11px] text-white/45">
            {t(
              'Usa o reconhecimento de voz do browser (melhor no Chrome). Para Zoom/Teams, o microfone local captura a tua fala; o áudio remoto depende da partilha de áudio do sistema.',
              'Usa el reconocimiento de voz del navegador (mejor en Chrome). En Zoom/Teams, el mic captura tu voz; el audio remoto depende de compartir audio del sistema.',
              'Uses browser speech recognition (best in Chrome). For Zoom/Teams, the mic captures your voice; remote audio depends on system audio share.',
            )}
          </p>
          <div className="max-h-[28rem] min-h-[16rem] overflow-y-auto rounded-2xl bg-[#0f1115] p-3 text-xs leading-relaxed text-white/80">
            {transcriptLines.length === 0 && !liveLine ? (
              <p className="text-white/35">
                {t(
                  'A transcrição aparece aqui enquanto captura.',
                  'La transcripción aparece aquí mientras capturas.',
                  'Transcript appears here while capturing.',
                )}
              </p>
            ) : (
              <ol className="space-y-2">
                {transcriptLines.map((line, index) => (
                  <li key={`${index}-${line.slice(0, 12)}`}>{line}</li>
                ))}
                {liveLine ? <li className="text-white/45">{liveLine}</li> : null}
              </ol>
            )}
          </div>
          {(transcriptLines.length > 0 || liveLine) && (
            <button
              type="button"
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs hover:bg-white/15"
              onClick={() => {
                const text = [...transcriptLines, liveLine].filter(Boolean).join('\n');
                const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `etholys-transcript-${Date.now()}.txt`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download className="h-3.5 w-3.5" />
              {t('Descarregar texto', 'Descargar texto', 'Download text')}
            </button>
          )}
        </section>
      </main>
    </div>
  );
}
