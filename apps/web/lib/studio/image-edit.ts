/** Filtros CSS estilo Photoshop-lite para blocos image. */
import type { CSSProperties } from 'react';
import type { StudioImageEdit } from '@/lib/studio/types';

export const DEFAULT_IMAGE_EDIT: StudioImageEdit = {
  brightness: 100,
  contrast: 100,
  saturate: 100,
  grayscale: false,
  zoom: 100,
};

export function imageEditToCssFilter(edit?: StudioImageEdit): string {
  const e = { ...DEFAULT_IMAGE_EDIT, ...edit };
  const parts = [
    `brightness(${e.brightness ?? 100}%)`,
    `contrast(${e.contrast ?? 100}%)`,
    `saturate(${e.saturate ?? 100}%)`,
  ];
  if (e.grayscale) parts.push('grayscale(100%)');
  return parts.join(' ');
}

export function imageEditZoomStyle(edit?: StudioImageEdit): CSSProperties {
  const zoom = edit?.zoom ?? 100;
  if (zoom <= 100) return {};
  return {
    transform: `scale(${zoom / 100})`,
    transformOrigin: 'center center',
  };
}

export function imageEditClipStyle(edit?: StudioImageEdit): CSSProperties {
  const e = { ...DEFAULT_IMAGE_EDIT, ...edit };
  const top = e.cropTop ?? 0;
  const right = e.cropRight ?? 0;
  const bottom = e.cropBottom ?? 0;
  const left = e.cropLeft ?? 0;
  if (!top && !right && !bottom && !left) return {};
  return { clipPath: `inset(${top}% ${right}% ${bottom}% ${left}%)` };
}
