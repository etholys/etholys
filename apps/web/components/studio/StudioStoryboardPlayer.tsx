'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Loader2, Pause, Play, Square, X } from 'lucide-react';
import type { StudioVideoScene } from '@/lib/studio/video-timeline';
import { formatVideoTimestamp, totalVideoDurationSec } from '@/lib/studio/video-timeline';
import { downloadBlob, recordStoryboardWebm } from '@/lib/studio/storyboard-export';

type Props = {
  scenes: StudioVideoScene[];
  locale: string;
  documentTitle?: string;
  onSelectPage: (pageId: string) => void;
  onClose: () => void;
};

function t(locale: string, pt: string, es: string, en: string): string {
  return locale === 'es' ? es : locale === 'en' ? en : pt;
}

/** Preview playback estilo CapCut/Premiere — avança planos por duração. */
export function StudioStoryboardPlayer({
  scenes,
  locale,
  documentTitle,
  onSelectPage,
  onClose,
}: Props) {
  const [playing, setPlaying] = useState(true);
  const [index, setIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportPct, setExportPct] = useState(0);
  const timerRef = useRef<number | null>(null);
  const scene = scenes[index];
  const total = totalVideoDurationSec(scenes);

  const advance = useCallback(() => {
    setIndex((i) => {
      const next = i + 1;
      if (next >= scenes.length) {
        setPlaying(false);
        return i;
      }
      onSelectPage(scenes[next]!.pageId);
      return next;
    });
    setElapsed(0);
  }, [onSelectPage, scenes]);

  useEffect(() => {
    if (!playing || !scene) return;
    onSelectPage(scene.pageId);
    timerRef.current = window.setInterval(() => {
      setElapsed((e) => {
        const next = e + 0.1;
        if (next >= scene.durationSec) {
          advance();
          return 0;
        }
        return next;
      });
    }, 100);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [playing, scene, advance, onSelectPage]);

  if (!scene) return null;

  const sceneStart = scenes.slice(0, index).reduce((a, s) => a + s.durationSec, 0);
  const globalTime = sceneStart + elapsed;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-black/95 text-white">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <p className="text-sm font-semibold">
          {t(locale, 'Preview storyboard', 'Preview storyboard', 'Storyboard preview')}
        </p>
        <div className="flex items-center gap-2">
          <span className="tabular-nums text-xs text-white/60">
            {formatVideoTimestamp(globalTime)} / {formatVideoTimestamp(total)}
          </span>
          <button
            type="button"
            disabled={exporting}
            onClick={() => {
              setPlaying(false);
              setExporting(true);
              void recordStoryboardWebm(scenes, {
                onProgress: (p) => {
                  if (p.sceneTotal) setExportPct(Math.round((p.elapsedSec / total) * 100));
                },
              })
                .then((blob) => {
                  downloadBlob(blob, `${(documentTitle || 'storyboard').replace(/[^\w.-]+/g, '_')}.webm`);
                })
                .catch((e) => {
                  alert(e instanceof Error ? e.message : 'Export WebM falhou');
                })
                .finally(() => {
                  setExporting(false);
                  setExportPct(0);
                });
            }}
            className="inline-flex items-center gap-1 rounded-lg bg-fuchsia-600 px-2.5 py-1.5 text-[11px] font-bold hover:bg-fuchsia-500 disabled:opacity-50"
          >
            {exporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            WebM{exporting ? ` ${exportPct}%` : ''}
          </button>
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            className="rounded-lg bg-white/10 p-2 hover:bg-white/20"
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => {
              setPlaying(false);
              setIndex(0);
              setElapsed(0);
              onSelectPage(scenes[0]!.pageId);
            }}
            className="rounded-lg bg-white/10 p-2 hover:bg-white/20"
          >
            <Square className="h-4 w-4" />
          </button>
          <button type="button" onClick={onClose} className="rounded-lg bg-white/10 p-2 hover:bg-white/20">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-6">
        {scene.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={scene.thumbnailUrl}
            alt=""
            className="max-h-[55vh] max-w-full rounded-xl object-contain shadow-2xl"
          />
        ) : (
          <div className="flex h-64 w-full max-w-2xl items-center justify-center rounded-xl border border-white/20 bg-white/5 text-white/40">
            {t(locale, 'Frame sem imagem', 'Frame sin imagen', 'Frame without image')}
          </div>
        )}
        {scene.narration && (
          <p className="mt-6 max-w-2xl text-center text-lg leading-relaxed text-white/90">
            {scene.narration}
          </p>
        )}
        <p className="mt-2 text-sm text-white/50">
          {t(locale, 'Plano', 'Plano', 'Scene')} {index + 1}/{scenes.length} · {scene.durationSec}s
        </p>
      </div>

      <div className="border-t border-white/10 px-4 py-3">
        <div className="mx-auto h-1.5 max-w-3xl overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full bg-fuchsia-500 transition-all duration-100"
            style={{ width: `${total ? (globalTime / total) * 100 : 0}%` }}
          />
        </div>
      </div>
    </div>
  );
}
