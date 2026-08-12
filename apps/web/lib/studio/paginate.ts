import type { StudioBlock, StudioCanvasState, StudioPage } from '@/lib/studio/types';

export type StudioOverflowInfo = {
  /** Blocos inteiros (já abaixo da folha) a passar para a seguinte */
  moveBlockIds: string[];
  /** Bloco que começa nesta folha mas não cabe — partir o texto */
  splitBlockId?: string;
  overflowPx: number;
};

const SPLITTABLE = new Set(['heading', 'paragraph', 'bullets', 'callout', 'table']);

/** Parte texto para a folha seguinte. `keep + rest` contém 100% do original. */
export function splitStudioBlockText(
  text: string,
  overflowPx = 80,
): { keep: string; rest: string } | null {
  const raw = String(text ?? '');
  if (!raw.trim()) return null;

  const extra = Math.max(48, overflowPx + 40);
  const approxLinePx = 26;

  const lines = raw.split('\n');
  if (lines.length > 1) {
    let moveCount = Math.max(1, Math.ceil(extra / approxLinePx));
    moveCount = Math.min(moveCount, lines.length - 1);
    if (moveCount < 1) return null;
    const cut = lines.length - moveCount;
    const keep = lines.slice(0, cut).join('\n');
    const rest = lines.slice(cut).join('\n');
    if (!keep.length && !rest.length) return null;
    if (!rest.length) return null;
    // keep pode ser só espaços/linhas vazias — ainda assim não perdemos texto
    return { keep, rest };
  }

  const words = raw.split(/(\s+)/);
  const wordTokens = words.filter((t) => t.trim().length > 0);
  if (wordTokens.length > 1) {
    const extraLines = Math.max(1, Math.ceil(extra / approxLinePx));
    let moveWords = Math.min(Math.max(extraLines * 7, 1), wordTokens.length - 1);
    const keepWords = wordTokens.length - moveWords;
    let seen = 0;
    let cutIndex = words.length;
    for (let i = 0; i < words.length; i++) {
      if (words[i]!.trim()) {
        seen += 1;
        if (seen >= keepWords) {
          cutIndex = i + 1;
          break;
        }
      }
    }
    const keep = words.slice(0, cutIndex).join('');
    const rest = words.slice(cutIndex).join('');
    if (!keep.trim() || !rest.trim()) return null;
    return { keep, rest };
  }

  if (raw.length < 12) return null;
  const cut = Math.max(1, Math.floor(raw.length * 0.55));
  return { keep: raw.slice(0, cut), rest: raw.slice(cut) };
}

function newBlockId(): string {
  return `block-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function newPageId(): string {
  return `page-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function reindex(blocks: StudioBlock[]): StudioBlock[] {
  return blocks.map((b, i) => ({ ...b, order: i }));
}

/**
 * Reflow automático: parte/move overflow para a folha seguinte.
 * Nunca apaga texto. Se não puder agir, devolve o mesmo `canvas`.
 */
export function applyStudioPagination(
  canvas: StudioCanvasState,
  fromPageId: string,
  info: StudioOverflowInfo,
  opts?: { pageTitlePrefix?: string },
): StudioCanvasState {
  const pages = canvas.pages.slice().sort((a, b) => a.order - b.order);
  const fromIdx = pages.findIndex((p) => p.id === fromPageId);
  if (fromIdx < 0) return canvas;

  const from = pages[fromIdx]!;
  const blocks = from.blocks.slice().sort((a, b) => a.order - b.order);
  if (!blocks.length) return canvas;

  const moveSet = new Set(info.moveBlockIds.filter(Boolean));
  let splitId = info.splitBlockId || '';
  const splitBlock = splitId ? blocks.find((b) => b.id === splitId) : undefined;
  const canSplit =
    !!splitBlock && SPLITTABLE.has(splitBlock.kind) && (splitBlock.text || '').length > 0;

  if (splitId && !canSplit) {
    moveSet.add(splitId);
    splitId = '';
  }

  let continuation: StudioBlock | null = null;
  const kept: StudioBlock[] = [];
  const moved: StudioBlock[] = [];

  for (const b of blocks) {
    if (canSplit && b.id === splitId) {
      const parts = splitStudioBlockText(b.text, info.overflowPx);
      if (!parts || !parts.rest.length) {
        kept.push(b);
        continue;
      }
      kept.push({ ...b, text: parts.keep });
      continuation = {
        ...b,
        id: newBlockId(),
        text: parts.rest,
        order: 0,
      };
      continue;
    }
    if (moveSet.has(b.id)) {
      moved.push(b);
      continue;
    }
    kept.push(b);
  }

  if (!continuation && !moved.length) return canvas;
  if (!kept.length) {
    // Nunca esvaziar a folha por completo (imagem/diagrama único maior que a folha)
    return canvas;
  }

  const toNext = reindex([...(continuation ? [continuation] : []), ...moved]);
  const keptIndexed = reindex(kept);
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
        if (i === fromIdx) return { ...p, blocks: keptIndexed };
        if (i === fromIdx + 1) return { ...p, blocks: prepended };
        return p;
      }),
    };
  }

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
      ...pages.map((p, i) => (i === fromIdx ? { ...p, blocks: keptIndexed } : p)),
      newPage,
    ].map((p, i) => ({ ...p, order: i })),
  };
}
