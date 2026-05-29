'use client';

import { Mic, Radio, Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils';

type Loc = 'pt' | 'es' | 'en';

const copy = (loc: Loc) =>
  loc === 'es'
    ? {
        live: 'Diálogo en vivo',
        voiceOn: 'Micrófono activo — hablad; repetid clic para terminar',
        voiceOff: 'Hablar por voz (navegador compatible)',
        hear: 'Última respuesta en voz',
        noVoice: 'Voz no disponible en este navegador · usad el teclado',
      }
    : loc === 'en'
      ? {
          live: 'Live dialogue',
          voiceOn: 'Mic on — speak; tap again to finish',
          voiceOff: 'Speak with your voice (supported browsers)',
          hear: 'Speak last reply',
          noVoice: 'Voice not available in this browser — use the keyboard',
        }
      : {
          live: 'Diálogo ao vivo',
          voiceOn: 'Micro ligado — falem; clicar de novo para terminar',
          voiceOff: 'Falar por voz (navegador compatível)',
          hear: 'Ouvir última resposta',
          noVoice: 'Voz indisponível neste navegador · usem o teclado',
        };

type Props = {
  locale: Loc;
  speechSupported: boolean;
  listening: boolean;
  interimText: string;
  onToggleMic: () => void;
  onSpeakLast: () => void;
};

export function NexusVoiceToolbar({ locale, speechSupported, listening, interimText, onToggleMic, onSpeakLast }: Props) {
  const t = copy(locale);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/60 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-800">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          {t.live}
        </span>
        {!speechSupported ? (
          <span className="text-[10px] text-amber-700/90">{t.noVoice}</span>
        ) : (
          <>
            <button
              type="button"
              onClick={onToggleMic}
              className={cn(
                'relative inline-flex h-11 items-center gap-2 rounded-2xl px-4 text-xs font-semibold transition',
                listening
                  ? 'bg-rose-600 text-white shadow-lg shadow-rose-500/35 ring-4 ring-rose-400/30'
                  : 'border border-violet-200 bg-white text-violet-900 hover:bg-violet-50',
              )}
              title={listening ? t.voiceOn : t.voiceOff}
              aria-pressed={listening}
            >
              <Mic className={cn('h-5 w-5 shrink-0', listening && 'animate-pulse')} aria-hidden />
              {listening && <Radio className="h-4 w-4 shrink-0 opacity-90" aria-hidden />}
            </button>
            <button
              type="button"
              onClick={onSpeakLast}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 hover:bg-slate-50"
              title={t.hear}
            >
              <Volume2 className="h-4 w-4 text-violet-600" aria-hidden />
              <span className="hidden sm:inline">{t.hear}</span>
            </button>
          </>
        )}
      </div>
      {listening && interimText.trim() && (
        <p className="rounded-lg border border-violet-100 bg-violet-50/80 px-3 py-2 text-xs italic leading-snug text-violet-950/90">
          {interimText}
        </p>
      )}
    </div>
  );
}
