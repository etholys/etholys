'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { BoardGuide } from '@/lib/forge/expedicion-board-multi';
import { cn } from '@/lib/utils';

export function ForgeGameCoach({
  guide,
  knowledge,
}: {
  guide?: BoardGuide | null;
  knowledge?: { title: string; body: string } | null;
}) {
  const [dismissed, setDismissed] = useState<string | null>(null);
  const key = guide ? `${guide.at}-${guide.message}` : knowledge ? `k-${knowledge.title}` : '';

  useEffect(() => {
    if (key && key !== dismissed) setDismissed(null);
  }, [key, dismissed]);

  if (!guide && !knowledge) return null;
  if (dismissed === key) return null;

  const isKnowledge = Boolean(knowledge?.body);

  return (
    <div
      className={cn(
        'fixed bottom-20 left-1/2 z-[55] w-[min(92vw,420px)] -translate-x-1/2 rounded-2xl border-2 px-4 py-3 shadow-2xl animate-in slide-in-from-bottom-4',
        isKnowledge
          ? 'border-violet-400 bg-violet-950/95 text-violet-50'
          : 'border-emerald-400/80 bg-emerald-950/95 text-emerald-50'
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wide opacity-80">
            {isKnowledge ? '📚 Conocimiento · facilitador' : '🎮 Guía del juego'}
          </p>
          {isKnowledge ? (
            <>
              <p className="mt-1 text-sm font-bold">{knowledge!.title}</p>
              <p className="mt-1 text-xs leading-relaxed whitespace-pre-wrap">{knowledge!.body}</p>
            </>
          ) : (
            <p className="mt-1 text-sm font-semibold leading-snug">{guide!.message}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setDismissed(key)}
          className="shrink-0 rounded-lg p-1 hover:bg-white/10"
          aria-label="Cerrar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
