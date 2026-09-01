'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Cloud, Loader2, MonitorUp, Square } from 'lucide-react';
import { useApp } from '@/app/providers';
import { CHORUS_PRODUCT_NAME } from '@/lib/meet/brand';
import { uploadAndTranscribeMeetRecording } from '@/lib/meet/finalize-cloud-recording';
import {
  meetSpeechLanguageLabel,
  resolveMeetSpeechLanguage,
  type MeetSpeechLanguage,
} from '@/lib/meet/language';
import { startMeetLocalRecorder, type MeetLocalRecorder } from '@/lib/meet/local-recorder';
import { meetRecapPath } from '@/lib/meet/types';

type Props = {
  companyId?: string;
  sessionId?: string;
};

type Phase = 'setup' | 'recording' | 'processing';

/**
 * Reuniões externas (Zoom / Teams / Google Meet): mesmo pipeline CHORUS que a sala interna —
 * gravação → R2 → Whisper/Gemini + diarização (sem Web Speech ao vivo).
 */
export function MeetExternalCapture({ companyId, sessionId: initialSessionId }: Props) {
  const { locale } = useApp();
  const router = useRouter();
  const t = (pt: string, es: string, en: string) =>
    locale === 'pt' ? pt : locale === 'es' ? es : en;

  const [phase, setPhase] = useState<Phase>('setup');
  const [sessionId, setSessionId] = useState(initialSessionId || '');
  const [title, setTitle] = useState('');
  const [language, setLanguage] = useState<MeetSpeechLanguage>(() =>
    (resolveMeetSpeechLanguage({ uiLocale: locale }) || 'pt') as MeetSpeechLanguage,
  );
  const [error, setError] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [features, setFeatures] = useState({
    cloudStorageReady: false,
    whisperTranscriptionEnabled: false,
  });

  const recorderRef = useRef<MeetLocalRecorder | null>(null);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const finalizeRef = useRef(false);

  const speechLang = useMemo(
    () => resolveMeetSpeechLanguage({ explicit: language, uiLocale: locale }),
    [language, locale],
  );

  const canRecord = features.cloudStorageReady;

  useEffect(() => {
    void fetch('/api/meet/status')
      .then((r) => r.json())
      .then((d) =>
        setFeatures({
          cloudStorageReady: Boolean(d.cloudStorageReady),
          whisperTranscriptionEnabled: Boolean(d.whisperTranscriptionEnabled),
        }),
      )
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!companyId || !initialSessionId) return;
    void fetch(
      `/api/meet/sessions/${initialSessionId}?companyId=${encodeURIComponent(companyId)}`,
    )
      .then((r) => r.json())
      .then((d) => {
        if (d.session?.title) setTitle(d.session.title);
      })
      .catch(() => undefined);
  }, [companyId, initialSessionId]);

  useEffect(() => {
    if (!title) {
      const stamp = new Date().toLocaleDateString(locale === 'en' ? 'en-GB' : locale === 'es' ? 'es' : 'pt-PT');
      setTitle(
        t(`Reunião externa — ${stamp}`, `Reunión externa — ${stamp}`, `External meeting — ${stamp}`),
      );
    }
  }, [locale, t, title]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const finalizeRecording = useCallback(async () => {
    if (finalizeRef.current) return;
    const recorder = recorderRef.current;
    if (!recorder) return;
    if (!companyId) {
      setError(
        t('Selecione uma empresa no CHORUS.', 'Seleccione una empresa en CHORUS.', 'Select a company in CHORUS.'),
      );
      return;
    }

    finalizeRef.current = true;
    setPhase('processing');
    stopTimer();
    setError(null);

    try {
      const result = await recorder.stop({ saveToDisk: false });
      recorderRef.current = null;
      if (result.blob.size <= 0) {
        throw new Error(
          t(
            'Gravação sem áudio. Ao partilhar o ecrã, escolhe a janela da reunião com áudio do sistema.',
            'Grabación sin audio. Al compartir pantalla, elige la ventana de la reunión con audio del sistema.',
            'Recording has no audio. When sharing screen, pick the meeting window with system audio.',
          ),
        );
      }

      let activeSessionId = sessionId;
      if (!activeSessionId) {
        const create = await fetch('/api/meet/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId,
            title: title.trim() || t('Reunião externa', 'Reunión externa', 'External meeting'),
            unscheduled: true,
            locale,
          }),
        });
        const created = (await create.json()) as { session?: { id: string }; error?: string };
        if (!create.ok || !created.session?.id) {
          throw new Error(created.error || 'Não foi possível criar a sessão.');
        }
        activeSessionId = created.session.id;
        setSessionId(activeSessionId);
      }

      await uploadAndTranscribeMeetRecording({
        sessionId: activeSessionId,
        companyId,
        blob: result.blob,
        fileName: result.fileName,
        locale,
        languageHint: speechLang,
        whisperEnabled: features.whisperTranscriptionEnabled,
      });

      await fetch(`/api/meet/sessions/${activeSessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, status: 'ended' }),
      }).catch(() => undefined);

      router.push(meetRecapPath(activeSessionId, companyId));
    } catch (err) {
      finalizeRef.current = false;
      setPhase('setup');
      setError(err instanceof Error ? err.message : t('Erro ao finalizar.', 'Error al finalizar.', 'Could not finish.'));
    }
  }, [
    companyId,
    features.whisperTranscriptionEnabled,
    locale,
    router,
    sessionId,
    speechLang,
    stopTimer,
    t,
    title,
  ]);

  async function startRecording() {
    if (!companyId) {
      setError(
        t('Selecione uma empresa no CHORUS.', 'Seleccione una empresa en CHORUS.', 'Select a company in CHORUS.'),
      );
      return;
    }
    if (!canRecord) {
      setError(
        t(
          'Armazenamento na nuvem indisponível.',
          'Almacenamiento en la nube no disponible.',
          'Cloud storage unavailable.',
        ),
      );
      return;
    }

    setError(null);
    finalizeRef.current = false;
    try {
      const { recorder } = await startMeetLocalRecorder({
        suggestedTitle: title.trim() || 'chorus-externa',
      });
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      setElapsedSec(0);
      timerRef.current = window.setInterval(() => {
        setElapsedSec(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }, 1000);
      setPhase('recording');
    } catch (err) {
      recorderRef.current = null;
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(
        err instanceof Error
          ? err.message
          : t('Não foi possível iniciar a gravação.', 'No se pudo iniciar la grabación.', 'Could not start recording.'),
      );
    }
  }

  useEffect(() => {
    if (phase !== 'recording') return;
    const flush = () => {
      void finalizeRecording();
    };
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, [phase, finalizeRecording]);

  useEffect(() => {
    return () => {
      stopTimer();
      const rec = recorderRef.current;
      if (rec && !finalizeRef.current) {
        void rec.stop({ saveToDisk: false }).catch(() => rec.destroy());
      }
    };
  }, [stopTimer]);

  const mm = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
  const ss = String(elapsedSec % 60).padStart(2, '0');

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href={companyId ? `/hub/meet?companyId=${encodeURIComponent(companyId)}` : '/hub/meet'}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/15"
            aria-label={t('Voltar', 'Volver', 'Back')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold tracking-tight">
              {CHORUS_PRODUCT_NAME} — {t('Reunião externa', 'Reunión externa', 'External meeting')}
            </h1>
            <p className="truncate text-xs text-white/50">
              {t(
                'Zoom, Teams ou outro — mesma gravação e transcrição que no CHORUS',
                'Zoom, Teams u otro — misma grabación y transcripción que en CHORUS',
                'Zoom, Teams or other — same recording and transcript as CHORUS',
              )}
            </p>
          </div>
        </div>
        {phase === 'recording' && (
          <span className="inline-flex items-center gap-2 rounded-full bg-rose-600 px-3 py-1 text-sm font-medium tabular-nums">
            <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
            {mm}:{ss}
          </span>
        )}
      </header>

      <main className="mx-auto max-w-lg px-4 py-10 sm:px-6">
        {error && (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {phase === 'setup' && (
          <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl">
            <div className="mb-5 flex items-start gap-3">
              <MonitorUp className="mt-0.5 h-5 w-5 shrink-0 text-teal-400" />
              <div className="text-sm text-white/70">
                <p className="font-medium text-white">
                  {t('Como funciona', 'Cómo funciona', 'How it works')}
                </p>
                <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-xs leading-relaxed text-white/55">
                  <li>
                    {t(
                      'Abre a reunião externa (Zoom, Teams, etc.) noutra janela.',
                      'Abre la reunión externa (Zoom, Teams, etc.) en otra ventana.',
                      'Open the external meeting (Zoom, Teams, etc.) in another window.',
                    )}
                  </li>
                  <li>
                    {t(
                      'Clica «Gravar na nuvem» e escolhe essa janela com áudio.',
                      'Pulsa «Grabar en la nube» y elige esa ventana con audio.',
                      'Click «Record to cloud» and pick that window with audio.',
                    )}
                  </li>
                  <li>
                    {t(
                      'Ao parar, o vídeo vai para o CHORUS e a transcrição com participantes é gerada automaticamente.',
                      'Al detener, el vídeo va a CHORUS y la transcripción con participantes se genera automáticamente.',
                      'When you stop, video uploads to CHORUS and speaker-attributed transcript is generated automatically.',
                    )}
                  </li>
                </ol>
              </div>
            </div>

            <label className="block text-xs font-medium text-white/60">
              {t('Título da reunião', 'Título de la reunión', 'Meeting title')}
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950 px-3 py-2.5 text-sm text-white"
              />
            </label>

            <label className="mt-4 block text-xs font-medium text-white/60">
              {t('Idioma da transcrição', 'Idioma de la transcripción', 'Transcript language')}
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as MeetSpeechLanguage)}
                className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950 px-3 py-2.5 text-sm text-white"
              >
                {(['pt', 'es', 'en', 'auto'] as const).map((lang) => (
                  <option key={lang} value={lang}>
                    {meetSpeechLanguageLabel(lang, t)}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              disabled={!canRecord}
              onClick={() => void startRecording()}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-teal-700 py-3.5 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-50"
            >
              <Cloud className="h-4 w-4" />
              {t('Gravar na nuvem', 'Grabar en la nube', 'Record to cloud')}
            </button>

            {!canRecord && (
              <p className="mt-3 text-center text-xs text-amber-300/90">
                {t(
                  'Armazenamento na nuvem indisponível. Contacte o administrador.',
                  'Almacenamiento en la nube no disponible.',
                  'Cloud storage unavailable.',
                )}
              </p>
            )}
          </div>
        )}

        {phase === 'recording' && (
          <div className="rounded-3xl border border-teal-500/30 bg-slate-900/80 p-8 text-center shadow-xl">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-600/20 text-rose-400">
              <Cloud className="h-7 w-7" />
            </span>
            <h2 className="mt-4 text-lg font-semibold">
              {t('A gravar na nuvem', 'Grabando en la nube', 'Recording to cloud')}
            </h2>
            <p className="mt-2 text-sm text-white/55">
              {t(
                'Mantém a janela da reunião aberta. A transcrição com speakers aparece no resumo ao parar.',
                'Mantén la ventana de la reunión abierta. La transcripción con participantes aparece en el resumen al parar.',
                'Keep the meeting window open. Speaker-attributed transcript appears in the recap when you stop.',
              )}
            </p>
            <button
              type="button"
              onClick={() => void finalizeRecording()}
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-rose-600 px-6 py-3 text-sm font-semibold text-white hover:bg-rose-500"
            >
              <Square className="h-3.5 w-3.5" />
              {t('Parar e gerar transcrição', 'Detener y generar transcripción', 'Stop and transcribe')}
            </button>
          </div>
        )}

        {phase === 'processing' && (
          <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-white/10 bg-slate-900/80 p-12 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-teal-400" />
            <p className="text-sm text-white/70">
              {t(
                'A enviar gravação e gerar transcrição com participantes…',
                'Enviando grabación y generando transcripción con participantes…',
                'Uploading recording and generating speaker-attributed transcript…',
              )}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
