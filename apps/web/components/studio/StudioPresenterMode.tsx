'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, MousePointer2, X } from 'lucide-react';
import type { StudioBlock, StudioPage } from '@/lib/studio/types';
import { imageEditClipStyle, imageEditToCssFilter, imageEditZoomStyle } from '@/lib/studio/image-edit';

type Props = {
  pages: StudioPage[];
  locale: string;
  initialPageId?: string | null;
  onClose: () => void;
};

function t(locale: string, pt: string, es: string, en: string): string {
  return locale === 'es' ? es : locale === 'en' ? en : pt;
}

function stripMd(s: string): string {
  return String(s || '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^#{1,4}\s+/, '')
    .trim();
}

function speakerNotes(page: StudioPage): string {
  const parts: string[] = [];
  for (const block of page.blocks.slice().sort((a, b) => a.order - b.order)) {
    if (block.mediaMeta?.type === 'video-scene' && block.mediaMeta.narration) {
      parts.push(block.mediaMeta.narration);
      continue;
    }
    if (block.kind === 'callout') {
      const text = stripMd(block.text);
      if (text) parts.push(text);
      continue;
    }
    if (block.kind === 'paragraph' && block.text.trim().length < 600) {
      parts.push(stripMd(block.text));
    }
  }
  return parts.join('\n\n');
}

function slideTitle(page: StudioPage): string {
  const heading = page.blocks.find((b) => b.kind === 'heading');
  if (heading?.text.trim()) return stripMd(heading.text);
  return page.title || '';
}

function PresenterBlock({ block }: { block: StudioBlock }) {
  const layout = block.layout;
  const pos =
    layout && (layout.xPct != null || layout.yPct != null)
      ? {
          position: 'absolute' as const,
          left: `${layout.xPct ?? 0}%`,
          top: `${layout.yPct ?? 0}%`,
          width: `${layout.wPct ?? 88}%`,
          height: layout.hPct != null ? `${layout.hPct}%` : undefined,
          zIndex: layout.zIndex ?? block.order,
          overflow: 'hidden' as const,
          boxSizing: 'border-box' as const,
        }
      : undefined;

  const wrap = (node: React.ReactNode) =>
    pos ? (
      <div style={pos}>{node}</div>
    ) : (
      <div className="relative">{node}</div>
    );

  if (block.kind === 'heading') {
    return wrap(
      <h2 className="text-2xl font-bold leading-tight text-slate-900 sm:text-3xl">
        {stripMd(block.text) || ' '}
      </h2>,
    );
  }
  if (block.kind === 'bullets') {
    const items = (block.text || '')
      .split(/\r?\n/)
      .map((l) => stripMd(l.replace(/^[-*•]\s*/, '')))
      .filter(Boolean);
    return wrap(
      <ul className="list-disc space-y-1 pl-5 text-lg text-slate-800 sm:text-xl">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>,
    );
  }
  if (block.kind === 'image' && block.imageUrl) {
    return wrap(
      <div className="overflow-hidden rounded-lg" style={imageEditClipStyle(block.imageEdit)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={block.imageUrl}
          alt={block.text || ''}
          className="mx-auto max-h-full w-full object-contain"
          style={{
            filter: imageEditToCssFilter(block.imageEdit),
            ...imageEditZoomStyle(block.imageEdit),
          }}
        />
      </div>,
    );
  }
  if (block.kind === 'callout') {
    return wrap(
      <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-base text-orange-950">
        {stripMd(block.text)}
      </div>,
    );
  }
  if (block.text.trim()) {
    return wrap(<p className="text-lg text-slate-700">{stripMd(block.text)}</p>);
  }
  return null;
}

/** Modo apresentador — slide fullscreen + notas do orador (PowerPoint-like). */
export function StudioPresenterMode({ pages, locale, initialPageId, onClose }: Props) {
  const sorted = pages.slice().sort((a, b) => a.order - b.order);
  const startIdx = Math.max(
    0,
    initialPageId ? sorted.findIndex((p) => p.id === initialPageId) : 0,
  );
  const [index, setIndex] = useState(startIdx >= 0 ? startIdx : 0);
  const [fullscreen, setFullscreen] = useState(false);
  const [laserOn, setLaserOn] = useState(false);
  const [laser, setLaser] = useState<{ x: number; y: number } | null>(null);
  const [slideElapsed, setSlideElapsed] = useState(0);
  const slideAreaRef = useRef<HTMLDivElement | null>(null);
  const page = sorted[index];
  const notes = page ? speakerNotes(page) : '';

  const go = useCallback(
    (delta: number) => {
      setSlideElapsed(0);
      setLaser(null);
      setIndex((i) => Math.max(0, Math.min(sorted.length - 1, i + delta)));
    },
    [sorted.length],
  );

  useEffect(() => {
    setSlideElapsed(0);
    setLaser(null);
  }, [index]);

  useEffect(() => {
    const t = window.setInterval(() => setSlideElapsed((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [index]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (fullscreen && document.fullscreenElement) {
          void document.exitFullscreen();
        } else {
          onClose();
        }
        return;
      }
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        go(1);
      }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        go(-1);
      }
      if (e.key === 'Home') setIndex(0);
      if (e.key === 'End') setIndex(sorted.length - 1);
      if (e.key === 'f' || e.key === 'F') {
        if (document.fullscreenElement) void document.exitFullscreen();
        else document.documentElement.requestFullscreen?.();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen, go, onClose, sorted.length]);

  useEffect(() => {
    function onFs() {
      setFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  if (!page) return null;

  const hasFreeform = page.blocks.some(
    (b) => b.layout && (b.layout.xPct != null || b.layout.yPct != null),
  );
  const bg = page.backgroundColor || '#ffffff';

  return (
    <div className="fixed inset-0 z-[210] flex flex-col bg-[#0a0610] text-white">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <p className="text-sm font-semibold">
          {t(locale, 'Modo apresentador', 'Modo presentador', 'Presenter mode')}
        </p>
        <div className="flex items-center gap-2">
          <span className="tabular-nums text-xs text-white/60">
            {index + 1} / {sorted.length} · {Math.floor(slideElapsed / 60)}:{String(slideElapsed % 60).padStart(2, '0')}
          </span>
          <button
            type="button"
            onClick={() => setLaserOn((v) => !v)}
            className={`rounded-lg p-2 ${laserOn ? 'bg-red-600 hover:bg-red-500' : 'bg-white/10 hover:bg-white/20'}`}
            title={t(locale, 'Apontador laser', 'Puntero láser', 'Laser pointer')}
          >
            <MousePointer2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              if (document.fullscreenElement) void document.exitFullscreen();
              else void document.documentElement.requestFullscreen?.();
            }}
            className="rounded-lg bg-white/10 p-2 hover:bg-white/20"
            title={t(locale, 'Ecrã completo (F)', 'Pantalla completa (F)', 'Fullscreen (F)')}
          >
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-white/10 p-2 hover:bg-white/20"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="flex min-h-0 flex-1 items-center justify-center p-4 lg:p-8">
          <div
            ref={slideAreaRef}
            className="relative aspect-video w-full max-w-5xl overflow-hidden rounded-xl shadow-2xl ring-1 ring-white/10"
            style={{ backgroundColor: bg, cursor: laserOn ? 'none' : undefined }}
            onMouseMove={(e) => {
              if (!laserOn || !slideAreaRef.current) return;
              const r = slideAreaRef.current.getBoundingClientRect();
              setLaser({
                x: ((e.clientX - r.left) / r.width) * 100,
                y: ((e.clientY - r.top) / r.height) * 100,
              });
            }}
            onMouseLeave={() => setLaser(null)}
          >
            <div
              className={`h-full w-full p-8 sm:p-10 ${hasFreeform ? 'relative' : 'flex flex-col gap-4'}`}
            >
              {!hasFreeform && slideTitle(page) ? (
                <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">{slideTitle(page)}</h1>
              ) : null}
              {page.blocks
                .slice()
                .sort((a, b) => {
                  const za = a.layout?.zIndex ?? a.order;
                  const zb = b.layout?.zIndex ?? b.order;
                  return za - zb;
                })
                .map((block) => (
                  <PresenterBlock key={block.id} block={block} />
                ))}
            </div>
            {laserOn && laser ? (
              <div
                className="pointer-events-none absolute z-50 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500 shadow-[0_0_12px_4px_rgba(239,68,68,0.7)]"
                style={{ left: `${laser.x}%`, top: `${laser.y}%` }}
              />
            ) : null}
          </div>
        </div>

        <aside className="flex max-h-[40vh] shrink-0 flex-col border-t border-white/10 bg-black/40 lg:max-h-none lg:w-80 lg:border-l lg:border-t-0">
          <p className="border-b border-white/10 px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-white/50">
            {t(locale, 'Notas do orador', 'Notas del presentador', 'Speaker notes')}
          </p>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 text-sm leading-relaxed text-white/85">
            {notes || t(locale, 'Sem notas neste slide.', 'Sin notas en esta diapositiva.', 'No notes on this slide.')}
          </div>
        </aside>
      </div>

      <div className="flex items-center justify-center gap-3 border-t border-white/10 px-4 py-3">
        <button
          type="button"
          disabled={index <= 0}
          onClick={() => go(-1)}
          className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/20 disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" />
          {t(locale, 'Anterior', 'Anterior', 'Previous')}
        </button>
        <button
          type="button"
          disabled={index >= sorted.length - 1}
          onClick={() => go(1)}
          className="inline-flex items-center gap-1 rounded-lg bg-fuchsia-600 px-4 py-2 text-sm font-bold hover:bg-fuchsia-500 disabled:opacity-30"
        >
          {t(locale, 'Seguinte', 'Siguiente', 'Next')}
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
