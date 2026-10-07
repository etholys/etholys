'use client';

import { Cloud, Video, X } from 'lucide-react';
import { useApp } from '@/app/providers';

type Props = {
  meetingTitle?: string;
  open: boolean;
  onClose: () => void;
  /** Gravar + abrir call (vai para captura) */
  onRecordAndOpen: () => void;
  /** Só abrir o link externo, sem gravar */
  onOpenOnly: () => void;
};

/**
 * Janela flutuante antes de abrir Zoom/Teams/Meet:
 * perguntar se quer gravar e transcrever no CHORUS.
 */
export function MeetExternalJoinPrompt({
  meetingTitle,
  open,
  onClose,
  onRecordAndOpen,
  onOpenOnly,
}: Props) {
  const { locale } = useApp();
  const t = (pt: string, es: string, en: string) =>
    locale === 'pt' ? pt : locale === 'es' ? es : en;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-800">
          <Cloud className="h-6 w-6" />
        </div>

        <h2 className="mt-4 text-lg font-semibold text-slate-900">
          {t('Gravar esta reunião?', '¿Grabar esta reunión?', 'Record this meeting?')}
        </h2>
        {meetingTitle ? (
          <p className="mt-1 line-clamp-2 text-sm font-medium text-slate-600">{meetingTitle}</p>
        ) : null}
        <p className="mt-2 text-sm text-slate-500">
          {t(
            'Podes gravar aba, janela ou ecrã inteiro. Ao parar, a transcrição gera-se sozinha no CHORUS.',
            'Puedes grabar pestaña, ventana o pantalla completa. Al detener, la transcripción se genera sola en CHORUS.',
            'You can record a tab, window, or full screen. When you stop, CHORUS transcribes automatically.',
          )}
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={onRecordAndOpen}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-teal-700 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-800"
          >
            <Cloud className="h-4 w-4" />
            {t(
              'Sim — gravar e transcrever',
              'Sí — grabar y transcribir',
              'Yes — record and transcribe',
            )}
          </button>
          <button
            type="button"
            onClick={onOpenOnly}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            <Video className="h-4 w-4" />
            {t('Não — só abrir a call', 'No — solo abrir la call', 'No — just open the call')}
          </button>
        </div>
      </div>
    </div>
  );
}
