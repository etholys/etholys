'use client';

import { Clapperboard, Clock } from 'lucide-react';
import type { StudioVideoScene } from '@/lib/studio/video-timeline';
import { formatVideoTimestamp, totalVideoDurationSec } from '@/lib/studio/video-timeline';

type Props = {
  scenes: StudioVideoScene[];
  activePageId: string | null;
  locale: string;
  canEdit: boolean;
  onSelectPage: (pageId: string) => void;
  onDurationChange?: (pageId: string, blockId: string, durationSec: number) => void;
};

function t(locale: string, pt: string, es: string, en: string): string {
  return locale === 'es' ? es : locale === 'en' ? en : pt;
}

export function StudioVideoTimeline({
  scenes,
  activePageId,
  locale,
  canEdit,
  onSelectPage,
  onDurationChange,
}: Props) {
  if (!scenes.length) return null;

  const total = totalVideoDurationSec(scenes);
  let cursor = 0;

  return (
    <div className="border-t border-violet-900/40 bg-[#0c0814] px-3 py-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-violet-300">
          <Clapperboard className="h-3.5 w-3.5" />
          {t(locale, 'Timeline vídeo', 'Timeline vídeo', 'Video timeline')}
        </p>
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-200/80">
          <Clock className="h-3 w-3" />
          {formatVideoTimestamp(total)} · {scenes.length}{' '}
          {t(locale, 'planos', 'planos', 'scenes')}
        </span>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {scenes.map((scene, idx) => {
          const start = cursor;
          cursor += scene.durationSec;
          const active = scene.pageId === activePageId;
          const widthPct = Math.max(12, Math.min(28, (scene.durationSec / total) * 100));

          return (
            <button
              key={`${scene.pageId}-${scene.blockId}`}
              type="button"
              onClick={() => onSelectPage(scene.pageId)}
              style={{ minWidth: `${widthPct}%`, maxWidth: '180px' }}
              className={`group shrink-0 rounded-xl border px-2 py-2 text-left transition ${
                active
                  ? 'border-fuchsia-400 bg-violet-900/80 ring-1 ring-fuchsia-400/50'
                  : 'border-violet-800/60 bg-violet-950/50 hover:border-violet-500'
              }`}
            >
              <div className="mb-1 flex items-center justify-between gap-1">
                <span className="text-[10px] font-bold text-violet-300">
                  {t(locale, 'Plano', 'Plano', 'Scene')} {idx + 1}
                </span>
                <span className="text-[10px] tabular-nums text-violet-400">
                  {formatVideoTimestamp(start)}
                </span>
              </div>
              {scene.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={scene.thumbnailUrl}
                  alt=""
                  className="mb-1.5 h-12 w-full rounded-md object-cover"
                />
              ) : (
                <div className="mb-1.5 flex h-12 items-center justify-center rounded-md border border-dashed border-violet-700/50 bg-violet-950/80 text-[10px] text-violet-500">
                  {t(locale, 'Frame', 'Frame', 'Frame')}
                </div>
              )}
              <p className="line-clamp-2 text-[10px] leading-snug text-violet-100/90">
                {scene.narration || scene.caption || scene.pageTitle}
              </p>
              {canEdit && onDurationChange ? (
                <label className="mt-1.5 flex items-center gap-1 text-[10px] text-violet-400">
                  <span>{t(locale, 's', 's', 's')}</span>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={scene.durationSec}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (Number.isFinite(v) && v > 0) {
                        onDurationChange(scene.pageId, scene.blockId, v);
                      }
                    }}
                    className="w-10 rounded border border-violet-700/60 bg-violet-950 px-1 py-0.5 text-[10px] text-violet-100"
                  />
                </label>
              ) : (
                <p className="mt-1 text-[10px] text-violet-500">{scene.durationSec}s</p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
