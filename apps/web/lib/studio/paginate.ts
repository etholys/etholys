import type { StudioBlock, StudioCanvasState, StudioPage, StudioPageMarginsMm } from '@/lib/studio/types';
import {
  DEFAULT_STUDIO_MARGINS_MM,
  normalizeStudioMargins,
  studioMarginsToCssPx,
  studioPageCssSize,
} from '@/lib/studio/types';

export type StudioOverflowInfo = {
  /** Blocos inteiros a passar para a folha seguinte (nunca partir texto) */
  moveBlockIds: string[];
  overflowPx: number;
};

/** Limite de segurança — evita o bug das 98/1000 folhas. */
const MAX_SAFE_PAGES = 40;

function reindex(blocks: StudioBlock[]): StudioBlock[] {
  return blocks.map((b, i) => ({ ...b, order: i }));
}

function newPageId(i: number): string {
  return `page-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 5)}`;
}

function newBlockId(): string {
  return `block-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Em modo desenho: move só blocos inteiros. Em redação: no-op
 * (a paginação de redação é `reflowStudioDocument`, não ResizeObserver).
 */
export function applyStudioPagination(
  canvas: StudioCanvasState,
  fromPageId: string,
  info: StudioOverflowInfo,
  opts?: { pageTitlePrefix?: string },
): StudioCanvasState {
  if (canvas.studioMode !== 'design') return canvas;

  const pages = canvas.pages.slice().sort((a, b) => a.order - b.order);
  if (pages.length >= MAX_SAFE_PAGES) return canvas;

  const fromIdx = pages.findIndex((p) => p.id === fromPageId);
  if (fromIdx < 0) return canvas;

  const from = pages[fromIdx]!;
  const blocks = from.blocks.slice().sort((a, b) => a.order - b.order);
  if (blocks.length <= 1) return canvas;

  const moveSet = new Set((info.moveBlockIds || []).filter(Boolean));
  const firstId = blocks[0]?.id;
  if (firstId) moveSet.delete(firstId);

  let moving = blocks.filter((b) => moveSet.has(b.id));
  if (!moving.length) return canvas;
  if (moving.length >= blocks.length) {
    moving = moving.slice(1);
    if (!moving.length) return canvas;
  }

  const ids = new Set(moving.map((b) => b.id));
  const kept = reindex(blocks.filter((b) => !ids.has(b.id)));
  if (!kept.length) return canvas;

  const toNext = reindex(moving);
  const titlePrefix = opts?.pageTitlePrefix || 'Página';
  const existingNext = pages[fromIdx + 1];

  if (existingNext) {
    const prepended = reindex([
      ...toNext,
      ...existingNext.blocks.slice().sort((a, b) => a.order - b.order),
    ]);
    return {
      ...canvas,
      pages: pages.map((p, i) => {
        if (i === fromIdx) return { ...p, blocks: kept };
        if (i === fromIdx + 1) return { ...p, blocks: prepended };
        return p;
      }),
    };
  }

  if (pages.length + 1 > MAX_SAFE_PAGES) return canvas;

  const newPage: StudioPage = {
    id: newPageId(pages.length),
    title: `${titlePrefix} ${pages.length + 1}`,
    order: pages.length,
    pageSize: canvas.pageSize || from.pageSize || 'A4',
    layoutMode: 'blank',
    blocks: toNext,
  };

  return {
    ...canvas,
    pages: [
      ...pages.map((p, i) => (i === fromIdx ? { ...p, blocks: kept } : p)),
      newPage,
    ].map((p, i) => ({ ...p, order: i })),
  };
}

/** Junta fragmentos do picote (mesmo tipo consecutivos). Não apaga texto. */
export function flattenAndJoinStudioBlocks(
  canvas: StudioCanvasState,
  opts?: { joinChops?: boolean },
): StudioBlock[] {
  const pages = canvas.pages.slice().sort((a, b) => a.order - b.order);
  const all: StudioBlock[] = [];
  for (const p of pages) {
    for (const b of p.blocks.slice().sort((x, y) => x.order - y.order)) {
      all.push({ ...b });
    }
  }

  if (!opts?.joinChops) return reindex(all);

  const merged: StudioBlock[] = [];
  for (const b of all) {
    const prev = merged[merged.length - 1];
    const textish =
      b.kind === 'paragraph' || b.kind === 'bullets' || b.kind === 'callout' || b.kind === 'heading';
    const canJoin =
      prev &&
      prev.kind === b.kind &&
      textish &&
      !b.imageUrl &&
      prev.kind !== 'diagram' &&
      b.kind !== 'diagram' &&
      (!b.title || !prev.title || b.title === prev.title);

    if (canJoin && prev) {
      const joiner =
        prev.kind === 'bullets' || prev.text.endsWith('\n') || b.text.startsWith('\n') ? '' : '\n';
      prev.text = `${prev.text}${joiner}${b.text}`;
      continue;
    }
    merged.push({ ...b, id: b.id || newBlockId() });
  }
  return reindex(merged);
}

function estimateBlockHeightPx(block: StudioBlock, contentWidthPx: number): number {
  if (block.kind === 'image') return Math.min(220, 160);
  if (block.kind === 'diagram') return 220;
  const scale =
    block.style?.textScale === 'sm'
      ? 0.9
      : block.style?.textScale === 'lg'
        ? 1.15
        : block.style?.textScale === 'xl'
          ? 1.3
          : 1;
  const fontSize = block.kind === 'heading' ? 22 * scale : 15 * scale;
  const lineHeight = fontSize * (block.kind === 'heading' ? 1.3 : 1.75);
  const avgChar = fontSize * 0.52;
  const charsPerLine = Math.max(20, Math.floor(contentWidthPx / avgChar));
  const raw = String(block.text || '');
  const explicitLines = raw.length ? raw.split('\n').length : 1;
  const wrapped = raw
    .split('\n')
    .reduce((n, line) => n + Math.max(1, Math.ceil((line.length || 1) / charsPerLine)), 0);
  const lines = Math.max(explicitLines, wrapped, 1);
  const framePad = block.style?.frame && block.style.frame !== 'none' ? 24 : 8;
  const gap = 14;
  return Math.ceil(lines * lineHeight + framePad + gap);
}

/**
 * Parte bloco só em limites de linha (`\n`), nunca a meio da palavra por heurística cega.
 * Garante que keep+rest = texto original.
 */
function splitBlockByLinesToFit(
  block: StudioBlock,
  remainingPx: number,
  pageContentPx: number,
  contentWidthPx: number,
): { keep: StudioBlock; rest: StudioBlock } | null {
  const text = String(block.text || '');
  if (!text.includes('\n')) return null;
  const lines = text.split('\n');
  if (lines.length < 2) return null;

  let keepCount = 0;
  let height = 0;
  for (let i = 0; i < lines.length - 1; i++) {
    const trial = { ...block, text: lines.slice(0, i + 1).join('\n') };
    const h = estimateBlockHeightPx(trial, contentWidthPx);
    if (h <= remainingPx || (keepCount === 0 && h <= pageContentPx)) {
      keepCount = i + 1;
      height = h;
      continue;
    }
    break;
  }
  if (keepCount < 1) return null;
  if (keepCount >= lines.length) return null;

  return {
    keep: { ...block, text: lines.slice(0, keepCount).join('\n') },
    rest: { ...block, id: newBlockId(), text: lines.slice(keepCount).join('\n') },
  };
}

/**
 * Paginação tipo Word (nível de bloco / linhas):
 * - junta o picote
 * - distribui por folhas no tamanho do documento (pageSize + orientação + margens)
 * - sem ResizeObserver em loop
 */
export function reflowStudioDocument(
  canvas: StudioCanvasState,
  opts?: {
    pageTitlePrefix?: string;
    maxWidthPx?: number;
    marginsMm?: StudioPageMarginsMm;
    /** true = recuperar picote juntando fragmentos consecutivos */
    joinChops?: boolean;
  },
): StudioCanvasState {
  const blocks = flattenAndJoinStudioBlocks(canvas, {
    joinChops: opts?.joinChops === true || studioLikelyOverPaginated(canvas),
  });
  if (!blocks.length) {
    return {
      ...canvas,
      studioMode: 'write',
      pages: [
        {
          id: canvas.pages[0]?.id || newPageId(0),
          title: `${opts?.pageTitlePrefix || 'Página'} 1`,
          order: 0,
          pageSize: canvas.pageSize || 'A4',
          layoutMode: 'blank',
          moldId: null,
          blocks: [],
        },
      ],
    };
  }

  const size = canvas.pageSize || 'A4';
  const orientation = canvas.orientation || (size === 'Slide' ? 'landscape' : 'portrait');
  const { width, height, wMm, hMm } = studioPageCssSize(size, opts?.maxWidthPx || 680, orientation);
  const margins = normalizeStudioMargins(opts?.marginsMm || canvas.marginsMm || DEFAULT_STUDIO_MARGINS_MM);
  const pad = studioMarginsToCssPx(margins, { w: wMm, h: hMm }, { width, height });
  const contentH = Math.max(120, height - pad.top - pad.bottom);
  const contentW = Math.max(120, width - pad.left - pad.right);

  const titlePrefix = opts?.pageTitlePrefix || 'Página';
  const existingPages = canvas.pages.slice().sort((a, b) => a.order - b.order);
  const pagesOut: StudioPage[] = [];
  let bucket: StudioBlock[] = [];
  let used = 0;

  const flush = () => {
    if (!bucket.length && pagesOut.length > 0) return;
    const idx = pagesOut.length;
    const prevPage = existingPages[idx];
    pagesOut.push({
      id: prevPage?.id || newPageId(idx),
      title: prevPage?.title || `${titlePrefix} ${idx + 1}`,
      order: idx,
      pageSize: size,
      layoutMode: prevPage?.layoutMode || 'blank',
      moldId: prevPage?.moldId ?? null,
      blocks: reindex(bucket),
    });
    bucket = [];
    used = 0;
  };

  const queue = blocks.slice();
  let guard = 0;
  while (queue.length && pagesOut.length < MAX_SAFE_PAGES && guard < 5000) {
    guard += 1;
    const block = queue.shift()!;
    const h = estimateBlockHeightPx(block, contentW);
    const remaining = contentH - used;

    if (bucket.length === 0) {
      if (h <= contentH) {
        bucket.push(block);
        used += h;
        continue;
      }
      const split = splitBlockByLinesToFit(block, contentH, contentH, contentW);
      if (split) {
        bucket.push(split.keep);
        used += estimateBlockHeightPx(split.keep, contentW);
        queue.unshift(split.rest);
        flush();
        continue;
      }
      // Bloco indivisível maior que a folha: fica sozinho (como ProseKit — não parte mid-line)
      bucket.push(block);
      flush();
      continue;
    }

    if (h <= remaining) {
      bucket.push(block);
      used += h;
      continue;
    }

    const split = splitBlockByLinesToFit(block, remaining, contentH, contentW);
    if (split && estimateBlockHeightPx(split.keep, contentW) <= remaining) {
      bucket.push(split.keep);
      flush();
      queue.unshift(split.rest);
      continue;
    }

    flush();
    queue.unshift(block);
  }

  // Resto se atingimos MAX_SAFE_PAGES — mete tudo na última folha (não cria milhares)
  if (queue.length) {
    if (!bucket.length) flush();
    const last = pagesOut[pagesOut.length - 1];
    if (last) {
      last.blocks = reindex([...last.blocks, ...queue, ...bucket]);
      bucket = [];
    } else {
      bucket.push(...queue);
      flush();
    }
  } else {
    flush();
  }

  if (!pagesOut.length) {
    pagesOut.push({
      id: canvas.pages[0]?.id || newPageId(0),
      title: `${titlePrefix} 1`,
      order: 0,
      pageSize: size,
      layoutMode: 'blank',
      moldId: null,
      blocks: reindex(blocks),
    });
  }

  return {
    ...canvas,
    studioMode: 'write',
    pages: pagesOut.map((p, i) => ({ ...p, order: i })),
  };
}

/**
 * Recuperar picote + paginar no tamanho actual do documento (comportamento tipo Word).
 */
export function mergeStudioDocument(
  canvas: StudioCanvasState,
  opts?: { pageTitle?: string; pageTitlePrefix?: string },
): StudioCanvasState {
  return reflowStudioDocument(canvas, {
    pageTitlePrefix: opts?.pageTitlePrefix || opts?.pageTitle || 'Página',
    joinChops: true,
  });
}

/** Conta folhas “suspeitas” de picote automático. */
export function studioLikelyOverPaginated(canvas: StudioCanvasState): boolean {
  const n = canvas.pages?.length || 0;
  if (n <= 8) return false;
  // Muitas folhas com pouco texto = picote
  const avgBlocks =
    canvas.pages.reduce((s, p) => s + (p.blocks?.length || 0), 0) / Math.max(1, n);
  return avgBlocks <= 2 || n > 20;
}
