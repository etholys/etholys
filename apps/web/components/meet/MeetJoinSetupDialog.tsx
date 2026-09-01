'use client';

import { Mic, HardDrive, Sparkles, Video } from 'lucide-react';
import type { MeetSpeechLanguage } from '@/lib/meet/language';
import { meetSpeechLanguageLabel } from '@/lib/meet/language';

export type MeetJoinSetupPrefs = {
  language: MeetSpeechLanguage;
  enableLiveTranscript: boolean;
  enableLocalRecording: boolean;
  enableWhisperOnEnd: boolean;
};

type Props = {
  locale: string;
  meetingTitle: string;
  isHost: boolean;
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
  whisperAvailable,
  liveTranscriptionAvailable,
  prefs,
  onChange,
  onConfirm,
}: Props) {
  const t = (pt: string, es: string, en: string) => (locale === 'pt' ? pt : locale === 'es' ? es : en);

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
          {t('Idioma principal da reunião', 'Idioma principal de la reunión', 'Main meeting language')}
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
          <p className="mt-1 text-[11px] text-slate-500">
            {t(
              'Usado na gravação e na transcrição. Evite misturar idiomas.',
              'Usado en la grabación y la transcripción. Evite mezclar idiomas.',
              'Used for recording and transcription. Avoid mixing languages.',
            )}
          </p>
        </label>

        <div className="mt-4 space-y-2">
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 px-3 py-3 hover:bg-slate-50">
            <input
              type="checkbox"
              checked={prefs.enableLocalRecording}
              onChange={(e) => {
                const enableLocalRecording = e.target.checked;
                onChange({
                  ...prefs,
                  enableLocalRecording,
                  enableWhisperOnEnd: enableLocalRecording ? prefs.enableWhisperOnEnd : false,
                });
              }}
              className="mt-0.5 rounded border-slate-300 text-teal-700"
            />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
                <HardDrive className="h-4 w-4 text-slate-500" />
                {t('Gravar no PC', 'Grabar en el PC', 'Record on this PC')}
              </span>
              <span className="mt-0.5 block text-xs text-slate-500">
                {t(
                  'Recomendado — áudio para transcrição de qualidade após a reunião.',
                  'Recomendado — audio para transcripción de calidad tras la reunión.',
                  'Recommended — audio for quality post-meeting transcription.',
                )}
              </span>
            </span>
          </label>

          {whisperAvailable && (
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-teal-200 bg-teal-50/50 px-3 py-3">
              <input
                type="checkbox"
                checked={prefs.enableWhisperOnEnd}
                onChange={(e) =>
                  onChange({ ...prefs, enableWhisperOnEnd: e.target.checked })
                }
                disabled={!prefs.enableLocalRecording}
                className="mt-0.5 rounded border-slate-300 text-teal-700 disabled:opacity-40"
              />
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-sm font-medium text-teal-900">
                  <Sparkles className="h-4 w-4" />
                  {t(
                    'Transcrição automática após a reunião',
                    'Transcripción automática tras la reunión',
                    'Automatic transcript after the meeting',
                  )}
                </span>
                <span className="mt-0.5 block text-xs text-teal-800/80">
                  {t(
                    'Ao parar a gravação, envia para o CHORUS e gera texto por participante.',
                    'Al detener la grabación, sube a CHORUS y genera texto por participante.',
                    'When you stop recording, uploads to CHORUS and generates per-speaker text.',
                  )}
                </span>
              </span>
            </label>
          )}

          {liveTranscriptionAvailable && (
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 px-3 py-3 hover:bg-slate-50">
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
                  {t('Transcrição ao vivo (limitada)', 'Transcripción en vivo (limitada)', 'Live transcript (limited)')}
                </span>
                <span className="mt-0.5 block text-xs text-amber-700">
                  {t(
                    'Qualidade inferior — pode errar. Prefira gravar e transcrever depois.',
                    'Calidad inferior — puede fallar. Prefiera grabar y transcribir después.',
                    'Lower quality — may be inaccurate. Prefer recording and transcribing afterwards.',
                  )}
                </span>
              </span>
            </label>
          )}
        </div>

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
