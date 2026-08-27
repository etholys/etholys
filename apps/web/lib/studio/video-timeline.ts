import type { StudioBlock, StudioCanvasState } from '@/lib/studio/types';

export type StudioVideoScene = {
  pageId: string;
  blockId: string;
  pageTitle: string;
  pageOrder: number;
  narration?: string;
  durationSec: number;
  thumbnailUrl?: string | null;
  caption?: string;
};

/** Recolhe planos de storyboard vídeo a partir do canvas. */
export function collectStudioVideoScenes(canvas: StudioCanvasState): StudioVideoScene[] {
  const scenes: StudioVideoScene[] = [];
  const pages = canvas.pages.slice().sort((a, b) => a.order - b.order);

  for (const page of pages) {
    for (const block of page.blocks.slice().sort((a, b) => a.order - b.order)) {
      if (block.mediaMeta?.type !== 'video-scene') continue;
      scenes.push({
        pageId: page.id,
        blockId: block.id,
        pageTitle: page.title,
        pageOrder: page.order,
        narration: block.mediaMeta.narration,
        durationSec:
          typeof block.mediaMeta.durationSec === 'number' && block.mediaMeta.durationSec > 0
            ? block.mediaMeta.durationSec
            : 5,
        thumbnailUrl: block.imageUrl,
        caption: block.text || block.title,
      });
    }
  }

  return scenes;
}

export function totalVideoDurationSec(scenes: StudioVideoScene[]): number {
  return scenes.reduce((acc, s) => acc + s.durationSec, 0);
}

export function formatVideoTimestamp(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

export function patchBlockMediaMeta(
  block: StudioBlock,
  patch: Partial<NonNullable<StudioBlock['mediaMeta']>>,
): StudioBlock {
  const base =
    block.mediaMeta?.type === 'video-scene'
      ? block.mediaMeta
      : { type: 'video-scene' as const, durationSec: 5 };
  return {
    ...block,
    mediaMeta: { ...base, ...patch, type: 'video-scene' },
  };
}

function srtTimestamp(totalSec: number): string {
  const ms = Math.max(0, Math.round(totalSec * 1000));
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const r = ms % 1000;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(r).padStart(3, '0')}`;
}

/** Legendas SRT para importar em CapCut / Premiere. */
export function storyboardToSrt(scenes: StudioVideoScene[]): string {
  let t = 0;
  const lines: string[] = [];
  scenes.forEach((scene, i) => {
    const start = t;
    const end = t + scene.durationSec;
    t = end;
    const text = (scene.narration || scene.caption || scene.pageTitle || `Plano ${i + 1}`).trim();
    lines.push(String(i + 1));
    lines.push(`${srtTimestamp(start)} --> ${srtTimestamp(end)}`);
    lines.push(text);
    lines.push('');
  });
  return lines.join('\n');
}

/** Guião texto com timestamps para locução. */
export function storyboardToScript(scenes: StudioVideoScene[]): string {
  let t = 0;
  return scenes
    .map((scene, i) => {
      const start = formatVideoTimestamp(t);
      t += scene.durationSec;
      const end = formatVideoTimestamp(t);
      const text = (scene.narration || scene.caption || scene.pageTitle || `Plano ${i + 1}`).trim();
      return `[${start} – ${end}] ${text}`;
    })
    .join('\n\n');
}
