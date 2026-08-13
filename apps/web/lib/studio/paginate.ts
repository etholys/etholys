import type { StudioBlock, StudioCanvasState, StudioPage } from '@/lib/studio/types';

export type StudioOverflowInfo = {
  /** Blocos inteiros a passar para a folha seguinte (nunca partir texto) */
  moveBlockIds: string[];
  overflowPx: number;
};

const MAX_AUTO_PAGES = 12;

function reindex(blocks: StudioBlock[]): StudioBlock[] {
  return blocks.map((b, i) => ({ ...b, order: i }));
}

function newPageId(): string {
  return `page-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Move apenas blocos inteiros. Nunca parte texto (evita picote / dezenas de folhas).
 * Em modo redação não deve ser chamado.
 */
export function applyStudioPagination(
  canvas: StudioCanvasState,
  fromPageId: string,
  info: StudioOverflowInfo,
  opts?: { pageTitlePrefix?: string },
): StudioCanvasState {
  if (canvas.studioMode === 'write' || canvas.studioMode === undefined) {
    // Redação: fluxo contínuo — sem paginação automática
    return canvas;
  }

  const pages = canvas.pages.slice().sort((a, b) => a.order - b.order);
  if (pages.length >= MAX_AUTO_PAGES) return canvas;

  const fromIdx = pages.findIndex((p) => p.id === fromPageId);
  if (fromIdx < 0) return canvas;

  const from = pages[fromIdx]!;
  const blocks = from.blocks.slice().sort((a, b) => a.order - b.order);
  if (blocks.length <= 1) return canvas;

  const moveSet = new Set((info.moveBlockIds || []).filter(Boolean));
  // Nunca mover o primeiro bloco da folha (evita esvaziar + loop)
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

  if (pages.length + 1 > MAX_AUTO_PAGES) return canvas;

  const newPage: StudioPage = {
    id: newPageId(),
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

/**
 * Reúne todas as folhas num único fluxo (modo redação).
 * Junta blocos de texto consecutivos do mesmo tipo que parecem continuação do picote.
 * Não apaga texto.
 */
export function mergeStudioDocument(
  canvas: StudioCanvasState,
  opts?: { pageTitle?: string },
): StudioCanvasState {
  const pages = canvas.pages.slice().sort((a, b) => a.order - b.order);
  const all: StudioBlock[] = [];
  for (const p of pages) {
    for (const b of p.blocks.slice().sort((x, y) => x.order - y.order)) {
      all.push({ ...b });
    }
  }

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
    merged.push({ ...b, id: b.id || `block-${merged.length}` });
  }

  const page: StudioPage = {
    id: pages[0]?.id || `page-${Date.now()}`,
    title: opts?.pageTitle || pages[0]?.title || 'Página 1',
    order: 0,
    pageSize: canvas.pageSize || pages[0]?.pageSize || 'A4',
    layoutMode: 'blank',
    moldId: null,
    blocks: reindex(merged),
  };

  return {
    ...canvas,
    studioMode: 'write',
    pages: [page],
  };
}

/** Conta folhas “suspeitas” de picote automático. */
export function studioLikelyOverPaginated(canvas: StudioCanvasState): boolean {
  return (canvas.pages?.length || 0) > 8;
}
