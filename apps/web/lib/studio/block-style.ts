import type { StudioBlockStyle } from '@/lib/studio/types';

export function normalizeStudioBlockStyle(raw: unknown): StudioBlockStyle | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const align =
    o.align === 'left' || o.align === 'center' || o.align === 'right' || o.align === 'justify'
      ? o.align
      : undefined;
  const textScale =
    o.textScale === 'sm' || o.textScale === 'md' || o.textScale === 'lg' || o.textScale === 'xl'
      ? o.textScale
      : undefined;
  const frame =
    o.frame === 'none' || o.frame === 'subtle' || o.frame === 'card' || o.frame === 'accent'
      ? o.frame
      : undefined;
  if (!align && !textScale && !frame) return undefined;
  return { align, textScale, frame };
}

export function studioBlockAlignClass(style?: StudioBlockStyle): string {
  switch (style?.align) {
    case 'center':
      return 'text-center';
    case 'right':
      return 'text-right';
    case 'justify':
      return 'text-justify';
    default:
      return 'text-left';
  }
}

export function studioBlockScaleClass(style?: StudioBlockStyle, kind?: string): string {
  const scale = style?.textScale;
  if (kind === 'heading') {
    if (scale === 'sm') return 'text-xl tracking-tight';
    if (scale === 'lg') return 'text-3xl tracking-tight';
    if (scale === 'xl') return 'text-4xl tracking-tight';
    return 'text-[1.65rem] tracking-tight';
  }
  if (scale === 'sm') return 'text-sm leading-relaxed';
  if (scale === 'lg') return 'text-lg leading-[1.7]';
  if (scale === 'xl') return 'text-xl leading-[1.65]';
  return 'text-[15px] leading-[1.75]';
}

export function studioBlockFrameClass(style?: StudioBlockStyle): string {
  switch (style?.frame) {
    case 'subtle':
      return 'rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2';
    case 'card':
      return 'rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm';
    case 'accent':
      return 'rounded-lg border border-orange-200 bg-orange-50/50 px-3 py-2';
    default:
      return '';
  }
}

export function studioBlockStyleToInlineCss(style?: StudioBlockStyle): string {
  const parts: string[] = [];
  if (style?.align === 'center') parts.push('text-align:center');
  else if (style?.align === 'right') parts.push('text-align:right');
  else if (style?.align === 'justify') parts.push('text-align:justify');
  if (style?.frame === 'subtle') {
    parts.push('border:1px solid #e2e8f0;background:#f8fafc;padding:10px 12px;border-radius:8px');
  } else if (style?.frame === 'card') {
    parts.push(
      'border:1px solid #e2e8f0;background:#fff;padding:12px 14px;border-radius:12px;box-shadow:0 1px 2px rgba(0,0,0,.06)',
    );
  } else if (style?.frame === 'accent') {
    parts.push('border:1px solid #fed7aa;background:#fff7ed;padding:10px 12px;border-radius:8px');
  }
  return parts.join(';');
}
