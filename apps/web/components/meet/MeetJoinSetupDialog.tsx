'use client';

import { Cloud, Mic, Video } from 'lucide-react';
import type { MeetSpeechLanguage } from '@/lib/meet/language';
import { meetSpeechLanguageLabel } from '@/lib/meet/language';

export type MeetJoinSetupPrefs = {
  language: MeetSpeechLanguage;
  /** Vídeo da chamada (requer Jibri no servidor; sem Jibri não há gravação automática da sala) */
  enableCloudRecording: boolean;
  /** Transcrição da reunião (Jigasi/Vosk ao vivo) — caminho normal, sem partilhar ecrã */
  enableLiveTranscript: boolean;
};

type Props = {
  locale: string;
  meetingTitle: string;
  isHost: boolean;
  cloudStorageReady: boolean;
  whisperAvailable: boolean;
  liveTranscriptionAvailable: boolean;
  /** true se gravação de vídeo da sala (Jibri) estiver operacional */
  callVideoRecordingAvailable?: boolean;
  prefs: MeetJoinSetupPrefs;
  onChange: (prefs: MeetJoinSetupPrefs) => void;
  onConfirm: () => void;
};

export function MeetJoinSetupDialog({
  locale,
  meetingTitle,
  isHost,
  cloudStorageReady,
  whisperAvailable,
  liveTranscriptionAvailable,
  callVideoRecordingAvailable = false,
  prefs,
  onChange,
  onConfirm,
}: Props) {
  const t = (pt: string, es: string, en: string) => (locale === 'pt' ? pt : locale === 'es' ? es : en);

  const canVideo = cloudStorageReady && callVideoRecordingAvailable;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-700 text-white">
            <Video className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-900">
              {isHost
                ? t('Antes de entrar na sala', 'Antes de entrar a la sala', 'Before joining the room')
                : t('Preferências da chamada', 'Preferencias de la llamada', 'Call preferences')}
            </h2>
            <p className="mt-0.5 truncate text-sm text-slate-500">{meetingTitle}</p>
          </div>
        </div>

        <label className="mt-5 block text-xs font-medium text-slate-600">
          {t('Idioma da reunião', 'Idioma de la reunión', 'Meeting language')}
          <select
            value={prefs.language}
            onChange={(e) =>
              onChange({ ...prefs, language: e.target.value as MeetSpeechLanguage })
            }
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            {(['pt', 'es', 'en', 'auto'] as const).map((lang) => (
              <option key={lang} value={lang}>
                {meetSpeechLanguageLabel(lang, t)}
              </option>
            ))}
          </select>
        </label>

        {liveTranscriptionAvailable ? (
          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-teal-200 bg-teal-50/60 px-3 py-3 hover:bg-teal-50">
            <input
              type="checkbox"
              checked={prefs.enableLiveTranscript}
              onChange={(e) =>
                onChange({ ...prefs, enableLiveTranscript: e.target.checked })
              }
              className="mt-0.5 rounded border-slate-300 text-teal-700"
            />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-teal-900">
                <Mic className="h-4 w-4" />
                {t('Transcrever a reunião', 'Transcribir la reunión', 'Transcribe the meeting')}
              </span>
              <span className="mt-0.5 block text-xs text-teal-900/80">
                {t(
                  'Recomendado. Texto ao vivo com nomes dos participantes — sem partilhar ecrã nem gravar vídeo. Ao sair, o CHORUS guarda a transcrição e pode gerar o resumo.',
                  'Recomendado. Texto en vivo con nombres de participantes — sin compartir pantalla ni grabar vídeo. Al salir, CHORUS guarda la transcripción y puede generar el resumen.',
                  'Recommended. Live text with participant names — no screen share or video file. When you leave, CHORUS keeps the transcript and can build the summary.',
                )}
              </span>
            </span>
          </label>
        ) : (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {t(
              'Transcrição ao vivo indisponível neste momento.',
              'Transcripción en vivo no disponible en este momento.',
              'Live transcription is unavailable right now.',
            )}
          </p>
        )}

        {isHost && (
          <div className="mt-3 space-y-2">
            <label
              className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 ${
                canVideo
                  ? 'border-slate-200 hover:bg-slate-50'
                  : 'border-slate-200 bg-slate-50 opacity-80'
              }`}
            >
              <input
                type="checkbox"
                checked={prefs.enableCloudRecording && canVideo}
                disabled={!canVideo}
                onChange={(e) =>
                  onChange({ ...prefs, enableCloudRecording: e.target.checked })
                }
                className="mt-0.5 rounded border-slate-300 text-teal-700"
              />
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
                  <Cloud className="h-4 w-4 text-slate-500" />
                  {t(
                    'Gravar vídeo da chamada (opcional)',
                    'Grabar vídeo de la llamada (opcional)',
                    'Record call video (optional)',
                  )}
                </span>
                <span className="mt-0.5 block text-xs text-slate-600">
                  {canVideo
                    ? t(
                        'Grava a sala no servidor (pessoas + partilhas) e depois pode transcrever.',
                        'Graba la sala en el servidor (personas + compartidos) y luego puede transcribir.',
                        'Records the room on the server (people + shares), then can transcribe.',
                      )
                    : t(
                        'Ainda não disponível: a gravação de vídeo da própria chamada (como no Meet) precisa do Jibri no servidor. Por agora use «Transcrever» — não é preciso escolher ecrã.',
                        'Aún no disponible: grabar el vídeo de la propia llamada (como en Meet) requiere Jibri en el servidor. Por ahora use «Transcribir» — no hace falta elegir pantalla.',
                        'Not available yet: true in-call video recording (Meet-style) needs Jibri on the server. For now use «Transcribe» — no screen picker.',
                      )}
                </span>
              </span>
            </label>
            {!cloudStorageReady && whisperAvailable && (
              <p className="text-xs text-slate-500">
                {t(
                  'Pode sempre enviar um áudio/vídeo depois no recap para transcrever.',
                  'Siempre puede subir un audio/vídeo después en el recap para transcribir.',
                  'You can always upload audio/video later in the recap to transcribe.',
                )}
              </p>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={onConfirm}
          className="mt-6 w-full rounded-full bg-teal-700 py-3 text-sm font-semibold text-white hover:bg-teal-800"
        >
          {t('Entrar na sala', 'Entrar a la sala', 'Join room')}
        </button>
      </div>
    </div>
  );
}
