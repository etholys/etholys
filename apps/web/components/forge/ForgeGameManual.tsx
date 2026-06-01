'use client';

import { BookOpen, X } from 'lucide-react';
import { EXPEDICION_GAME_MANUAL } from '@/lib/forge/expedicion-game-manual';
import { useForgeT } from '@/lib/forge/use-forge-t';

export function ForgeGameManualButton({ onOpen }: { onOpen: () => void }) {
  const ft = useForgeT();
  return (
    <button
      type="button"
      onClick={onOpen}
      className="inline-flex items-center gap-1 rounded-lg border border-sky-500/60 bg-sky-950 px-2.5 py-1 text-[10px] font-bold text-sky-200 hover:bg-sky-900"
      title={ft('forge.manual.open')}
    >
      <BookOpen className="h-3.5 w-3.5" />
      {ft('forge.manual.button')}
    </button>
  );
}

export function ForgeGameManualModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ft = useForgeT();
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-white text-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="flex items-center gap-2 text-lg font-black">
            <BookOpen className="h-5 w-5 text-sky-600" />
            {ft('forge.manual.title')}
          </h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <p className="text-sm text-slate-600">{ft('forge.manual.intro')}</p>
          {EXPEDICION_GAME_MANUAL.map((sec) => (
            <section key={sec.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <h3 className="text-sm font-black text-slate-900">
                <span className="mr-1">{sec.icon}</span>
                {sec.title}
              </h3>
              <ul className="mt-2 space-y-1.5 text-sm text-slate-700 list-disc list-inside">
                {sec.body.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <div className="border-t border-slate-200 p-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-sky-700 py-2.5 text-sm font-bold text-white"
          >
            {ft('forge.general.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
