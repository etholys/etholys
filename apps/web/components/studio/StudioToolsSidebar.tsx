'use client';

import {
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  LayoutTemplate,
  PenLine,
  Pencil,
  Ruler,
  Sparkles,
} from 'lucide-react';
import type {
  StudioBlockKind,
  StudioMarginPresetId,
  StudioPageMarginsMm,
  StudioPageOrientation,
  StudioPageSize,
  StudioStudioMode,
} from '@/lib/studio/types';
import {
  STUDIO_MARGIN_PRESETS,
  STUDIO_PAGE_SIZES,
  matchStudioMarginPreset,
} from '@/lib/studio/types';

type Labels = {
  tools: string;
  collapse: string;
  expand: string;
  mode: string;
  write: string;
  writeHint: string;
  writeIntro: string;
  design: string;
  designHint: string;
  designIntro: string;
  page: string;
  size: string;
  orientation: string;
  portrait: string;
  landscape: string;
  margins: string;
  normal: string;
  narrow: string;
  moderate: string;
  wide: string;
  custom: string;
  top: string;
  right: string;
  bottom: string;
  left: string;
  allSides: string;
  insert: string;
  text: string;
  heading: string;
  list: string;
  callout: string;
  diagram: string;
  image: string;
  designTools: string;
  drawBoard: string;
  molds: string;
  aiScope: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: StudioStudioMode;
  onModeChange: (mode: StudioStudioMode) => void;
  pageSize: StudioPageSize;
  orientation: StudioPageOrientation;
  margins: StudioPageMarginsMm;
  disabled?: boolean;
  pageCount: number;
  labels: Labels;
  onPageSize: (size: StudioPageSize) => void;
  onOrientation: (o: StudioPageOrientation) => void;
  onMargins: (m: StudioPageMarginsMm) => void;
  onInsert: (kind: StudioBlockKind | 'image') => void;
  onOpenMolds?: () => void;
};

export function StudioToolsSidebar({
  open,
  onOpenChange,
  mode,
  onModeChange,
  pageSize,
  orientation,
  margins,
  disabled,
  pageCount,
  labels,
  onPageSize,
  onOrientation,
  onMargins,
  onInsert,
  onOpenMolds,
}: Props) {
  const preset = matchStudioMarginPreset(margins);
  const presetLabel = (id: StudioMarginPresetId) => {
    if (id === 'narrow') return labels.narrow;
    if (id === 'moderate') return labels.moderate;
    if (id === 'wide') return labels.wide;
    if (id === 'custom') return labels.custom;
    return labels.normal;
  };

  function applyPreset(id: string) {
    const found = STUDIO_MARGIN_PRESETS.find((p) => p.id === id);
    if (found) onMargins({ ...found.mm });
  }

  function setSide(side: keyof StudioPageMarginsMm, value: string) {
    const n = Number(value);
    if (!Number.isFinite(n)) return;
    onMargins({ ...margins, [side]: Math.min(60, Math.max(5, n)) });
  }

  if (!open) {
    return (
      <div className="flex shrink-0 flex-col items-center gap-2 border-l border-slate-200 bg-white px-1.5 py-3">
        <button
          type="button"
          onClick={() => onOpenChange(true)}
          title={labels.expand}
          className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:border-orange-300 hover:bg-orange-50"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onOpenChange(true)}
          className="writing-mode-vertical rounded px-1 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500"
          style={{ writingMode: 'vertical-rl' }}
        >
          {labels.tools}
        </button>
      </div>
    );
  }

  const isDesign = mode === 'design';

  return (
    <aside className="flex h-full w-[280px] shrink-0 flex-col border-l border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
          <Ruler className="h-3.5 w-3.5" />
          {labels.tools}
        </p>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          title={labels.collapse}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
        <section>
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
            {labels.mode}
          </p>
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              disabled={disabled}
              onClick={() => onModeChange('write')}
              className={`rounded-lg px-2 py-2 text-left ${
                mode === 'write' ? 'bg-white shadow-sm ring-1 ring-orange-200' : 'hover:bg-white/70'
              }`}
            >
              <span className="flex items-center gap-1 text-xs font-bold text-slate-900">
                <PenLine className="h-3.5 w-3.5 text-orange-600" />
                {labels.write}
              </span>
              <span className="mt-0.5 block text-[10px] leading-snug text-slate-500">
                {labels.writeHint}
              </span>
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onModeChange('design')}
              className={`rounded-lg px-2 py-2 text-left ${
                isDesign ? 'bg-white shadow-sm ring-1 ring-violet-300' : 'hover:bg-white/70'
              }`}
            >
              <span className="flex items-center gap-1 text-xs font-bold text-slate-900">
                <Sparkles className="h-3.5 w-3.5 text-violet-600" />
                {labels.design}
              </span>
              <span className="mt-0.5 block text-[10px] leading-snug text-slate-500">
                {labels.designHint}
              </span>
            </button>
          </div>
          <p
            className={`mt-2 rounded-lg px-2.5 py-2 text-[10px] leading-snug ${
              isDesign
                ? 'border border-violet-200 bg-violet-50 text-violet-900'
                : 'border border-orange-100 bg-orange-50/80 text-orange-950'
            }`}
          >
            {isDesign ? labels.designIntro : labels.writeIntro}
          </p>
        </section>

        <section>
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
            {labels.page}
          </p>
          <label className="mb-2 flex flex-col gap-1 text-[10px] font-semibold text-slate-500">
            {labels.size}
            <select
              value={pageSize}
              disabled={disabled}
              onChange={(e) => onPageSize(e.target.value as StudioPageSize)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-800"
            >
              {STUDIO_PAGE_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <div className="mb-2 flex flex-col gap-1 text-[10px] font-semibold text-slate-500">
            {labels.orientation}
            <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              <button
                type="button"
                disabled={disabled}
                onClick={() => onOrientation('portrait')}
                className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold ${
                  orientation === 'portrait' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                }`}
              >
                {labels.portrait}
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onOrientation('landscape')}
                className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold ${
                  orientation === 'landscape' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                }`}
              >
                {labels.landscape}
              </button>
            </div>
          </div>
          <label className="mb-2 flex flex-col gap-1 text-[10px] font-semibold text-slate-500">
            {labels.margins}
            <select
              value={preset}
              disabled={disabled}
              onChange={(e) => {
                if (e.target.value === 'custom') return;
                applyPreset(e.target.value);
              }}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-800"
            >
              {STUDIO_MARGIN_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {presetLabel(p.id)} ({p.mm.top} mm)
                </option>
              ))}
              <option value="custom">{presetLabel('custom')}</option>
            </select>
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {(
              [
                ['top', labels.top],
                ['bottom', labels.bottom],
                ['left', labels.left],
                ['right', labels.right],
              ] as const
            ).map(([side, label]) => (
              <label key={side} className="flex flex-col gap-0.5 text-[10px] font-semibold text-slate-500">
                {label}
                <input
                  type="number"
                  min={5}
                  max={60}
                  step={1}
                  disabled={disabled}
                  value={margins[side]}
                  onChange={(e) => setSide(side, e.target.value)}
                  className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-800"
                />
              </label>
            ))}
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={() =>
                onMargins({
                  top: margins.top,
                  right: margins.top,
                  bottom: margins.top,
                  left: margins.top,
                })
              }
              className="mt-1.5 text-[10px] font-semibold text-orange-700 hover:underline"
            >
              {labels.allSides}
            </button>
          )}
          <p className="mt-2 text-[10px] text-slate-400">
            {pageCount} {labels.page.toLowerCase()}(s) · {pageSize}
          </p>
        </section>

        {isDesign ? (
          <section>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-violet-500">
              {labels.designTools}
            </p>
            <div className="grid grid-cols-1 gap-1.5">
              <button
                type="button"
                disabled={disabled}
                onClick={() => onInsert('diagram')}
                className="inline-flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-2.5 text-left text-[11px] font-bold text-violet-950 hover:bg-violet-100 disabled:opacity-50"
              >
                <Pencil className="h-4 w-4 shrink-0" />
                <span>
                  {labels.drawBoard}
                  <span className="mt-0.5 block text-[10px] font-medium text-violet-700/80">
                    Excalidraw
                  </span>
                </span>
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onInsert('image')}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-2 text-[11px] font-semibold text-slate-700 hover:border-violet-300 hover:bg-violet-50 disabled:opacity-50"
              >
                <ImagePlus className="h-3.5 w-3.5" />
                {labels.image}
              </button>
              {onOpenMolds && (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={onOpenMolds}
                  className="inline-flex items-center gap-2 rounded-lg border border-violet-200 bg-white px-2.5 py-2 text-[11px] font-semibold text-violet-900 hover:bg-violet-50 disabled:opacity-50"
                >
                  <LayoutTemplate className="h-3.5 w-3.5" />
                  {labels.molds}
                </button>
              )}
            </div>
          </section>
        ) : (
          <section>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
              {labels.insert}
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {(
                [
                  ['paragraph', labels.text],
                  ['heading', labels.heading],
                  ['bullets', labels.list],
                  ['callout', labels.callout],
                ] as const
              ).map(([kind, label]) => (
                <button
                  key={kind}
                  type="button"
                  disabled={disabled}
                  onClick={() => onInsert(kind)}
                  className="rounded-lg border border-slate-200 px-2 py-1.5 text-left text-[11px] font-semibold text-slate-700 hover:border-orange-300 hover:bg-orange-50 disabled:opacity-50"
                >
                  {label}
                </button>
              ))}
              <button
                type="button"
                disabled={disabled}
                onClick={() => onInsert('image')}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] font-semibold text-slate-700 hover:border-orange-300 hover:bg-orange-50 disabled:opacity-50"
              >
                <ImagePlus className="h-3.5 w-3.5" />
                {labels.image}
              </button>
            </div>
            <p className="mt-2 text-[10px] text-slate-400">{labels.aiScope}</p>
          </section>
        )}
      </div>
    </aside>
  );
}
