import {
  parseStructureProposalSections,
  type StructureSection,
} from '@/lib/studio/structure-apply';
import type { StudioCanvasPatch, StudioCanvasState } from '@/lib/studio/types';
import { studioCanvasTextLength } from '@/lib/studio/paginate';

function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sectionKeywords(title: string): string[] {
  return normalizeForMatch(title)
    .split(' ')
    .filter((w) => w.length > 3 && !/^(parte|part|secao|seccion|section|plan|modelo)$/.test(w));
}

export function scoreSegmentForSection(segmentText: string, sectionTitle: string): number {
  const keywords = sectionKeywords(sectionTitle);
  if (!keywords.length) return 0;
  const norm = normalizeForMatch(segmentText);
  return keywords.filter((k) => norm.includes(k)).length;
}

type ContentSegment = { blockId: string; text: string };

/** Extrai segmentos de texto migráveis (ordem do documento). */
export function collectMigratableSegments(canvas: StudioCanvasState): ContentSegment[] {
  const out: ContentSegment[] = [];
  for (const page of canvas.pages) {
    for (const block of page.blocks) {
      const text = (block.text || '').trim();
      if (text.length < 24) continue;
      if (block.kind === 'image') continue;
      out.push({ blockId: block.id, text });
    }
  }
  return out;
}

/** Atribui segmentos existentes às secções da proposta (keywords + distribuição). */
export function assignSegmentsToSections(
  sections: StructureSection[],
  segments: ContentSegment[],
): string[][] {
  const assigned: string[][] = sections.map(() => []);
  const unassigned: string[] = [];

  for (const seg of segments) {
    let bestIdx = -1;
    let bestScore = 0;
    for (let i = 0; i < sections.length; i++) {
      const score = scoreSegmentForSection(seg.text, sections[i].title);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    if (bestScore >= 1 && bestIdx >= 0) {
      assigned[bestIdx].push(seg.text);
    } else {
      unassigned.push(seg.text);
    }
  }

  if (unassigned.length) {
    let u = 0;
    const per = Math.max(1, Math.ceil(unassigned.length / Math.max(1, sections.length)));
    for (let i = 0; i < sections.length && u < unassigned.length; i++) {
      for (let j = 0; j < per && u < unassigned.length; j++) {
        assigned[i].push(unassigned[u++]);
      }
    }
  }

  return assigned;
}

function sectionBodyText(section: StructureSection, migratedChunks: string[]): string {
  if (migratedChunks.length) {
    const merged = migratedChunks.join('\n\n').trim();
    const cap = 14000;
    if (section.bullets.length) {
      const bullets = section.bullets.map((b) => `- ${b}`).join('\n');
      const room = cap - bullets.length - 4;
      const body = merged.length > room ? `${merged.slice(0, room)}…` : merged;
      return `${bullets}\n\n${body}`.trim();
    }
    return merged.length > cap ? `${merged.slice(0, cap)}…` : merged;
  }
  if (section.bullets.length) {
    return section.bullets.map((b) => `- ${b}`).join('\n');
  }
  return '(Contenido pendiente de desarrollar.)';
}

/**
 * Aplica estrutura aprovada e migra conteúdo existente para cada secção.
 */
export function buildStructureMigrationPatches(
  canvas: StudioCanvasState,
  proposalText: string,
): StudioCanvasPatch[] {
  const sections = parseStructureProposalSections(proposalText);
  if (!sections.length) return [];

  const blocks = canvas.pages.flatMap((p) => p.blocks);
  if (!blocks.length) return [];

  const segments = collectMigratableSegments(canvas);
  const assigned = assignSegmentsToSections(sections, segments);

  const patches: StudioCanvasPatch[] = [];
  let blockIdx = 0;

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    if (blockIdx >= blocks.length) break;

    patches.push({
      blockId: blocks[blockIdx].id,
      kind: 'heading',
      title: section.title.slice(0, 120),
      text: section.title,
    });
    blockIdx++;

    if (blockIdx >= blocks.length) break;

    const bodyText = sectionBodyText(section, assigned[i]);
    patches.push({
      blockId: blocks[blockIdx].id,
      kind: bodyText.includes('\n- ') ? 'bullets' : 'paragraph',
      title: section.title.slice(0, 80),
      text: bodyText,
    });
    blockIdx++;
  }

  return patches;
}

/** Documento tem conteúdo suficiente para valer migração (não só placeholders). */
export function canvasWarrantsStructureMigration(canvas: StudioCanvasState): boolean {
  return studioCanvasTextLength(canvas) >= 400;
}

export function structureMigrationStats(
  canvas: StudioCanvasState,
  proposalText: string,
): { sections: number; segments: number; totalChars: number } {
  const sections = parseStructureProposalSections(proposalText).length;
  const segments = collectMigratableSegments(canvas);
  const totalChars = segments.reduce((n, s) => n + s.text.length, 0);
  return { sections, segments: segments.length, totalChars };
}
