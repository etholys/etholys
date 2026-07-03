import type {
  ReportCanvasRegion,
  ReportCanvasSection,
  ReportCanvasSectionKind,
  ReportCanvasState,
} from '@/lib/siep/report-canvas-types';

function sectionKindForRegions(regions: ReportCanvasRegion[]): ReportCanvasSectionKind {
  if (regions.every((r) => r.kind === 'tableCell' && r.tableId)) return 'table';
  if (regions.length === 1 && regions[0].kind === 'paragraph' && (regions[0].text.length > 0 || !regions[0].label)) {
    return 'narrative';
  }
  return 'fields';
}

function isGridTableGroup(regions: ReportCanvasRegion[]): boolean {
  const colLabels = new Set(regions.map((r) => r.columnLabel).filter(Boolean));
  return colLabels.size >= 2;
}

/** Reconstrói secções a partir das regiões (ordem de inserção). */
export function buildCanvasSectionsFromRegions(regions: ReportCanvasRegion[]): ReportCanvasSection[] {
  const sections: ReportCanvasSection[] = [];
  const pendingRegions = new Map<string, ReportCanvasRegion[]>();
  const sectionOrder: string[] = [];

  for (const r of regions) {
    const tableKey = r.tableId && r.tableTitle ? `table:${r.tableId}` : null;
    const sectionKey = tableKey || (r.sectionId ? `sec:${r.sectionId}` : null) || `field:${r.id}`;

    if (!pendingRegions.has(sectionKey)) {
      pendingRegions.set(sectionKey, []);
      sectionOrder.push(sectionKey);
    }
    pendingRegions.get(sectionKey)!.push(r);
  }

  for (const sectionKey of sectionOrder) {
    const regs = pendingRegions.get(sectionKey)!;
    const r0 = regs[0];
    const isGrid = tableKeyIsGrid(sectionKey) && isGridTableGroup(regs);
    const kind: ReportCanvasSectionKind = isGrid
      ? 'table'
      : sectionKey.startsWith('table:')
        ? 'fields'
        : sectionKindForRegions(regs);

    const title =
      r0?.tableTitle ||
      (kind === 'fields' && r0?.label ? r0.label.split(' / ')[0]?.trim() : '') ||
      (kind === 'narrative' ? r0?.label || 'Texto livre' : 'Campos');

    const section: ReportCanvasSection = {
      id: sectionKey.replace(/[^a-zA-Z0-9_-]/g, '-'),
      kind,
      title: title.slice(0, 200) || 'Secção',
      regionIds: regs.map((r) => r.id),
      columns: isGrid ? [] : undefined,
    };

    if (isGrid) {
      const colMap = new Map<number, string>();
      for (const r of regs) {
        if (r.columnLabel != null && r.tableCol != null) {
          colMap.set(r.tableCol, r.columnLabel);
        }
      }
      section.columns = [...colMap.entries()].sort((a, b) => a[0] - b[0]).map(([, label]) => label);
    }

    sections.push(section);
  }

  return sections;
}

function tableKeyIsGrid(sectionKey: string): boolean {
  return sectionKey.startsWith('table:');
}

/** Ordena regiões conforme regionIds das secções (preserva drag-and-drop). */
export function sortRegionsBySectionOrder(
  regions: ReportCanvasRegion[],
  sections: ReportCanvasSection[],
): ReportCanvasRegion[] {
  const byId = new Map(regions.map((r) => [r.id, r]));
  const used = new Set<string>();
  const ordered: ReportCanvasRegion[] = [];
  for (const s of sections) {
    for (const id of s.regionIds) {
      const r = byId.get(id);
      if (r) {
        ordered.push(r);
        used.add(id);
      }
    }
  }
  for (const r of regions) {
    if (!used.has(r.id)) ordered.push(r);
  }
  return ordered;
}

export function syncCanvasSections(state: ReportCanvasState): ReportCanvasState {
  if (state.sections?.length) {
    const byId = new Map(state.regions.map((r) => [r.id, r]));
    const sections = state.sections
      .map((s) => ({
        ...s,
        regionIds: s.regionIds.filter((id) => byId.has(id)),
      }))
      .filter((s) => s.regionIds.length > 0);

    const usedInSections = new Set(sections.flatMap((s) => s.regionIds));
    const orphanRegions = state.regions.filter((r) => !usedInSections.has(r.id));
    if (orphanRegions.length) {
      sections.push(...buildCanvasSectionsFromRegions(orphanRegions));
    }

    return {
      ...state,
      regions: sortRegionsBySectionOrder(state.regions, sections),
      sections,
    };
  }

  const sections = buildCanvasSectionsFromRegions(state.regions);
  return {
    ...state,
    regions: sortRegionsBySectionOrder(state.regions, sections),
    sections,
  };
}

export type CanvasLayoutBlock =
  | { type: 'section'; section: ReportCanvasSection; regions: ReportCanvasRegion[] }
  | { type: 'orphan'; regions: ReportCanvasRegion[] };

export function buildCanvasLayout(state: ReportCanvasState): CanvasLayoutBlock[] {
  const byId = new Map(state.regions.map((r) => [r.id, r]));
  const used = new Set<string>();
  const blocks: CanvasLayoutBlock[] = [];

  const sections = state.sections?.length
    ? state.sections
    : buildCanvasSectionsFromRegions(state.regions);

  for (const section of sections) {
    const regions = section.regionIds.map((id) => byId.get(id)).filter(Boolean) as ReportCanvasRegion[];
    regions.forEach((r) => used.add(r.id));
    if (regions.length) blocks.push({ type: 'section', section, regions });
  }

  const orphans = state.regions.filter((r) => !used.has(r.id));
  if (orphans.length) blocks.push({ type: 'orphan', regions: orphans });

  return blocks;
}
