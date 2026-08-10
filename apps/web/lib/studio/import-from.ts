/** Conversores one-shot → canvas Studio (F3). Spec: docs/architecture/etholys-studio.md */

import type { ReportCanvasState } from '@/lib/siep/report-canvas-types';
import {
  emptyStudioCanvas,
  type StudioBlock,
  type StudioCanvasState,
  type StudioFormat,
} from '@/lib/studio/types';

function uid(prefix: string, i: number) {
  return `${prefix}-${i}-${Math.random().toString(36).slice(2, 8)}`;
}

function blocksToCanvas(format: StudioFormat, title: string, blocks: StudioBlock[]): StudioCanvasState {
  const base = emptyStudioCanvas(format);
  const bodyBlocks: StudioBlock[] = [
    {
      id: 'block-title',
      kind: 'heading',
      title: 'Título',
      text: title,
      order: 0,
    },
    ...blocks.map((b, i) => ({ ...b, order: i + 1 })),
  ];
  return {
    ...base,
    format,
    pages: [
      {
        ...base.pages[0],
        blocks: bodyBlocks,
      },
    ],
  };
}

/** SIEP informe (regions/sections) → Studio report canvas. */
export function siepInformeToStudioCanvas(
  title: string,
  canvas: ReportCanvasState | null | undefined,
): StudioCanvasState {
  const blocks: StudioBlock[] = [];
  let n = 0;

  if (canvas?.sections?.length) {
    for (const section of canvas.sections) {
      blocks.push({
        id: uid('sec', n++),
        kind: 'heading',
        title: section.title,
        text: section.title,
        order: n,
      });
      const regionIds = new Set(section.regionIds || []);
      const regions = (canvas.regions || []).filter((r) => regionIds.has(r.id));
      if (section.kind === 'table' && section.columns?.length) {
        const rows = regions
          .filter((r) => r.text.trim())
          .map((r) => `${r.columnLabel || r.label || ''}: ${r.text}`.trim());
        blocks.push({
          id: uid('tbl', n++),
          kind: 'table',
          title: section.title,
          text: [section.columns.join(' | '), ...rows].join('\n'),
          order: n,
        });
      } else {
        for (const r of regions) {
          if (!r.text.trim() && !r.label) continue;
          blocks.push({
            id: uid('reg', n++),
            kind: r.fieldType === 'short' ? 'callout' : 'paragraph',
            title: r.label || undefined,
            text: r.label && r.text ? `**${r.label}**\n${r.text}` : r.text || r.label || '',
            order: n,
          });
        }
      }
    }
  } else if (canvas?.regions?.length) {
    for (const r of canvas.regions) {
      if (!r.text.trim() && !r.label) continue;
      if (r.label) {
        blocks.push({
          id: uid('h', n++),
          kind: 'heading',
          title: r.label,
          text: r.label,
          order: n,
        });
      }
      if (r.text.trim()) {
        blocks.push({
          id: uid('p', n++),
          kind: 'paragraph',
          title: r.label,
          text: r.text,
          order: n,
        });
      }
    }
  }

  if (!blocks.length) {
    blocks.push({
      id: 'block-body',
      kind: 'paragraph',
      title: 'Corpo',
      text: '',
      order: 1,
    });
  }

  return blocksToCanvas('report', title, blocks);
}

/** FUNDHUB proposal sections → Studio proposal canvas. */
export function fundhubProposalToStudioCanvas(
  title: string,
  sections: Array<{ title: string; content: string }>,
): StudioCanvasState {
  const blocks: StudioBlock[] = [];
  let n = 0;
  for (const s of sections) {
    const heading = (s.title || '').trim();
    const content = (s.content || '').trim();
    if (!heading && !content) continue;
    if (heading) {
      blocks.push({
        id: uid('fh', n++),
        kind: 'heading',
        title: heading,
        text: heading,
        order: n,
      });
    }
    if (content) {
      blocks.push({
        id: uid('fc', n++),
        kind: 'paragraph',
        title: heading || undefined,
        text: content,
        order: n,
      });
    }
  }
  if (!blocks.length) {
    blocks.push({
      id: 'block-body',
      kind: 'paragraph',
      title: 'Corpo',
      text: '',
      order: 1,
    });
  }
  return blocksToCanvas('proposal', title, blocks);
}

/** Meet post-meeting summary/notes/actions → Studio brief. */
export function meetSummaryToStudioCanvas(input: {
  title: string;
  summaryText?: string | null;
  notes?: string | null;
  transcriptText?: string | null;
  actionItems?: Array<{ title: string; notes?: string | null; assigneeHint?: string | null }>;
}): StudioCanvasState {
  const blocks: StudioBlock[] = [];
  let n = 0;
  const summary = (input.summaryText || '').trim();
  if (summary) {
    blocks.push({
      id: uid('ms', n++),
      kind: 'heading',
      title: 'Resumo',
      text: 'Resumo',
      order: n,
    });
    blocks.push({
      id: uid('msp', n++),
      kind: 'paragraph',
      title: 'Resumo',
      text: summary,
      order: n,
    });
  }

  const actions = input.actionItems || [];
  if (actions.length) {
    blocks.push({
      id: uid('ma', n++),
      kind: 'heading',
      title: 'Tarefas',
      text: 'Tarefas / próximos passos',
      order: n,
    });
    const lines = actions.map((a) => {
      const who = a.assigneeHint ? ` (${a.assigneeHint})` : '';
      const note = a.notes ? ` — ${a.notes}` : '';
      return `• ${a.title}${who}${note}`;
    });
    blocks.push({
      id: uid('mabul', n++),
      kind: 'bullets',
      title: 'Tarefas',
      text: lines.join('\n'),
      order: n,
    });
  }

  const notes = (input.notes || input.transcriptText || '').trim();
  if (notes && notes !== summary) {
    blocks.push({
      id: uid('mn', n++),
      kind: 'heading',
      title: 'Notas',
      text: 'Notas / transcrição',
      order: n,
    });
    blocks.push({
      id: uid('mnp', n++),
      kind: 'paragraph',
      title: 'Notas',
      text: notes.slice(0, 50_000),
      order: n,
    });
  }

  if (!blocks.length) {
    blocks.push({
      id: 'block-body',
      kind: 'paragraph',
      title: 'Corpo',
      text: '',
      order: 1,
    });
  }

  return blocksToCanvas('brief', input.title, blocks);
}
