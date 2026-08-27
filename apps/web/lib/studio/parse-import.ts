/**
 * Import estruturado — Word/PDF/TXT → blocos Studio (headings, listas, tabelas).
 */
import type { StudioBlock, StudioBlockKind, StudioCanvasState } from '@/lib/studio/types';
import { emptyStudioCanvas } from '@/lib/studio/types';
import { parseMarkdownTable } from '@/lib/studio/table-markdown';

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isTableStart(lines: string[], i: number): boolean {
  const line = lines[i]?.trim() || '';
  if (!line.includes('|')) return false;
  const next = lines[i + 1]?.trim() || '';
  return /^\|[\s\-:|]+\|/.test(next) || (line.startsWith('|') && line.endsWith('|'));
}

function collectTable(lines: string[], start: number): { text: string; next: number } {
  const rows: string[] = [];
  let i = start;
  while (i < lines.length) {
    const t = lines[i]!.trim();
    if (!t.includes('|')) break;
    rows.push(t);
    i++;
  }
  return { text: rows.join('\n'), next: i };
}

function collectBullets(lines: string[], start: number): { text: string; next: number } {
  const rows: string[] = [];
  let i = start;
  while (i < lines.length) {
    const t = lines[i]!.trim();
    if (!/^[-*•]\s+/.test(t) && !/^\d+[.)]\s+/.test(t)) break;
    rows.push(t.replace(/^\d+[.)]\s+/, '- '));
    i++;
  }
  return { text: rows.join('\n'), next: i };
}

function collectParagraph(lines: string[], start: number): { text: string; next: number } {
  const parts: string[] = [];
  let i = start;
  while (i < lines.length) {
    const t = lines[i]!.trim();
    if (!t) break;
    if (
      /^#{1,4}\s+/.test(t) ||
      isTableStart(lines, i) ||
      /^[-*•]\s+/.test(t) ||
      /^\d+[.)]\s+/.test(t)
    ) {
      break;
    }
    parts.push(t);
    i++;
    if (i < lines.length && !lines[i]?.trim()) break;
  }
  return { text: parts.join('\n\n'), next: i };
}

/** Converte texto plano extraído em canvas Write com blocos tipados. */
export function parseImportedTextToCanvas(text: string, docTitle: string): StudioCanvasState {
  const lines = String(text || '').split(/\r?\n/);
  const rawBlocks: Array<{ kind: StudioBlockKind; text: string }> = [];

  if (docTitle.trim()) {
    rawBlocks.push({ kind: 'heading', text: docTitle.trim() });
  }

  let i = 0;
  while (i < lines.length) {
    const line = lines[i]?.trim() || '';
    if (!line) {
      i++;
      continue;
    }

    if (isTableStart(lines, i)) {
      const { text: tbl, next } = collectTable(lines, i);
      if (parseMarkdownTable(tbl)) rawBlocks.push({ kind: 'table', text: tbl });
      else rawBlocks.push({ kind: 'paragraph', text: tbl });
      i = next;
      continue;
    }

    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      rawBlocks.push({ kind: 'heading', text: headingMatch[2]!.trim() });
      i++;
      continue;
    }

    if (
      line.length <= 90 &&
      line === line.toUpperCase() &&
      /[A-ZÁÉÍÓÚÀ]/.test(line) &&
      !line.endsWith('.')
    ) {
      rawBlocks.push({ kind: 'heading', text: line });
      i++;
      continue;
    }

    if (/^[-*•]\s+/.test(line) || /^\d+[.)]\s+/.test(line)) {
      const { text: bullets, next } = collectBullets(lines, i);
      rawBlocks.push({ kind: 'bullets', text: bullets });
      i = next;
      continue;
    }

    if (/^>\s+/.test(line)) {
      const callout: string[] = [];
      while (i < lines.length && /^>\s+/.test(lines[i]!.trim())) {
        callout.push(lines[i]!.trim().replace(/^>\s+/, ''));
        i++;
      }
      rawBlocks.push({ kind: 'callout', text: callout.join('\n') });
      continue;
    }

    const { text: para, next } = collectParagraph(lines, i);
    if (para.trim()) rawBlocks.push({ kind: 'paragraph', text: para.trim() });
    i = next;
  }

  if (!rawBlocks.length) {
    rawBlocks.push({ kind: 'paragraph', text: text.slice(0, 80_000) || ' ' });
  }

  const pages: StudioCanvasState['pages'] = [];
  const blocksPerPage = 8;
  for (let p = 0; p < rawBlocks.length; p += blocksPerPage) {
    const chunk = rawBlocks.slice(p, p + blocksPerPage);
    const pageIdx = pages.length;
    pages.push({
      id: newId('page'),
      title: `Página ${pageIdx + 1}`,
      order: pageIdx,
      layoutMode: 'blank',
      moldId: null,
      blocks: chunk.map((b, j) => ({
        id: newId('block'),
        kind: b.kind,
        text: b.text.slice(0, 50_000),
        order: j,
      })),
    });
  }

  const canvas = emptyStudioCanvas('report');
  return {
    ...canvas,
    studioMode: 'write',
    pages,
  };
}

/** Converte blocos importados num único documento (1 página) se preferir compacto. */
export function parseImportedTextToSinglePage(text: string, docTitle: string): StudioCanvasState {
  const multi = parseImportedTextToCanvas(text, docTitle);
  if (multi.pages.length <= 1) return multi;
  const allBlocks: StudioBlock[] = [];
  for (const p of multi.pages) {
    for (const b of p.blocks) {
      allBlocks.push({ ...b, id: newId('block'), order: allBlocks.length });
    }
  }
  return {
    ...multi,
    pages: [
      {
        id: newId('page'),
        title: docTitle || 'Importado',
        order: 0,
        layoutMode: 'blank',
        moldId: null,
        blocks: allBlocks.slice(0, 48),
      },
    ],
  };
}
