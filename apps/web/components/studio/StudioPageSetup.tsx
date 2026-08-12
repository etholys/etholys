'use client';

import { Ruler } from 'lucide-react';
import type {
  StudioMarginPresetId,
  StudioPageMarginsMm,
  StudioPageOrientation,
  StudioPageSize,
} from '@/lib/studio/types';
import {
  STUDIO_MARGIN_PRESETS,
  STUDIO_PAGE_SIZES,
  matchStudioMarginPreset,
} from '@/lib/studio/types';

type Labels = {
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
};

type Props = {
  pageSize: StudioPageSize;
  orientation: StudioPageOrientation;
  margins: StudioPageMarginsMm;
  disabled?: boolean;
  labels: Labels;
  onPageSize: (size: StudioPageSize) => void;
  onOrientation: (o: StudioPageOrientation) => void;
  onMargins: (m: StudioPageMarginsMm) => void;
};

export function StudioPageSetup({
  pageSize,
  orientation,
  margins,
  disabled,
  labels,
  onPageSize,
  onOrientation,
  onMargins,
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

  return (
    <div className="mx-auto mb-4 w-full max-w-[720px] rounded-xl border border-slate-200 bg-white/95 p-3 shadow-sm">
      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
        <Ruler className="h-3.5 w-3.5" />
        {labels.page}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-[88px] flex-col gap-1 text-[10px] font-semibold text-slate-500">
          {labels.size}
          <select
            value={pageSize}
            disabled={disabled}
            onChange={(e) => onPageSize(e.target.value as StudioPageSize)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-800 disabled:opacity-50"
          >
            {STUDIO_PAGE_SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-1 text-[10px] font-semibold text-slate-500">
          {labels.orientation}
          <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            <button
              type="button"
              disabled={disabled}
              onClick={() => onOrientation('portrait')}
              className={`rounded-md px-2.5 py-1.5 text-xs font-semibold ${
                orientation === 'portrait' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
            >
              {labels.portrait}
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onOrientation('landscape')}
              className={`rounded-md px-2.5 py-1.5 text-xs font-semibold ${
                orientation === 'landscape' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
            >
              {labels.landscape}
            </button>
          </div>
        </div>

        <label className="flex min-w-[120px] flex-col gap-1 text-[10px] font-semibold text-slate-500">
          {labels.margins}
          <select
            value={preset}
            disabled={disabled}
            onChange={(e) => {
              if (e.target.value === 'custom') return;
              applyPreset(e.target.value);
            }}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-800 disabled:opacity-50"
          >
            {STUDIO_MARGIN_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {presetLabel(p.id)} ({p.mm.top} mm)
              </option>
            ))}
            <option value="custom">{presetLabel('custom')}</option>
          </select>
        </label>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(
          [
            ['top', labels.top],
            ['bottom', labels.bottom],
            ['left', labels.left],
            ['right', labels.right],
          ] as const
        ).map(([side, label]) => (
          <label key={side} className="flex flex-col gap-1 text-[10px] font-semibold text-slate-500">
            {label}
            <span className="flex items-center gap-1">
              <input
                type="number"
                min={5}
                max={60}
                step={1}
                disabled={disabled}
                value={margins[side]}
                onChange={(e) => setSide(side, e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-semibold text-slate-800 disabled:opacity-50"
              />
              <span className="text-[10px] text-slate-400">mm</span>
            </span>
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
          className="mt-2 text-[11px] font-semibold text-orange-700 hover:underline"
        >
          {labels.allSides}
        </button>
      )}
    </div>
  );
}
