'use client';

import { Cloud, Mic, Video } from 'lucide-react';
import type { MeetSpeechLanguage } from '@/lib/meet/language';
import { meetSpeechLanguageLabel } from '@/lib/meet/language';

export type MeetJoinSetupPrefs = {
  language: MeetSpeechLanguage;
  enableCloudRecording: boolean;
  enableLiveTranscript: boolean;
};

type Props = {
  locale: string;
  meetingTitle: string;
  isHost: boolean;
  cloudStorageReady: boolean;
  whisperAvailable: boolean;
  liveTranscriptionAvailable: boolean;
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
  prefs,
  onChange,
  onConfirm,
}: Props) {
  const t = (pt: string, es: string, en: string) => (locale === 'pt' ? pt : locale === 'es' ? es : en);

  const canCloud = cloudStorageReady && whisperAvailable;

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

        {isHost && (
          <div className="mt-4 space-y-2">
            <label
              className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 ${
                canCloud
                  ? 'border-teal-200 bg-teal-50/60 hover:bg-teal-50'
                  : 'border-slate-200 bg-slate-50 opacity-70'
              }`}
            >
              <input
                type="checkbox"
                checked={prefs.enableCloudRecording && canCloud}
                disabled={!canCloud}
                onChange={(e) =>
                  onChange({ ...prefs, enableCloudRecording: e.target.checked })
                }
                className="mt-0.5 rounded border-slate-300 text-teal-700"
              />
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-teal-900">
                  <Cloud className="h-4 w-4" />
                  {t(
                    'Gravar e transcrever na nuvem',
                    'Grabar y transcribir en la nube',
                    'Record & transcribe in the cloud',
                  )}
                </span>
                <span className="mt-0.5 block text-xs text-teal-900/80">
                  {t(
                    'Automático — grava ao entrar, envia para o CHORUS e gera transcrição ao sair (encerrar, fechar ou sair da sala).',
                    'Automático — graba al entrar, sube a CHORUS y transcribe al salir (finalizar, cerrar o salir de la sala).',
                    'Automatic — records when you join, uploads to CHORUS, and transcribes when you leave (end, close tab, or leave room).',
                  )}
                </span>
              </span>
            </label>
            {!canCloud && (
              <p className="text-xs text-amber-800">
                {t(
                  'Armazenamento na nuvem indisponível. Contacte o administrador.',
                  'Almacenamiento en la nube no disponible. Contacte al administrador.',
                  'Cloud storage unavailable. Contact your administrator.',
                )}
              </p>
            )}
          </div>
        )}

        {liveTranscriptionAvailable && (
          <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 px-3 py-3 hover:bg-slate-50">
            <input
              type="checkbox"
              checked={prefs.enableLiveTranscript}
              onChange={(e) =>
                onChange({ ...prefs, enableLiveTranscript: e.target.checked })
              }
              className="mt-0.5 rounded border-slate-300 text-teal-700"
            />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
                <Mic className="h-4 w-4 text-slate-500" />
                {t('Transcrição ao vivo (opcional)', 'Transcripción en vivo (opcional)', 'Live transcript (optional)')}
              </span>
              <span className="mt-0.5 block text-xs text-amber-700">
                {t(
                  'Qualidade inferior — só se precisar de texto em tempo real.',
                  'Calidad inferior — solo si necesita texto en tiempo real.',
                  'Lower quality — only if you need real-time text.',
                )}
              </span>
            </span>
          </label>
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
