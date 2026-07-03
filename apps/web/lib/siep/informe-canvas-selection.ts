import type { ReportCanvasRegion, ReportCanvasState } from '@/lib/siep/report-canvas-types';
import { buildCanvasSectionsFromRegions } from '@/lib/siep/report-canvas-layout';

/** Elemento focado no canvas para contextualizar o chat com a IA. */
export type InformeCanvasSelection =
  | { kind: 'region'; regionId: string }
  | { kind: 'tableRow'; sectionId: string; tableRow: number }
  | { kind: 'tableColumn'; sectionId: string; tableCol: number }
  | { kind: 'section'; sectionId: string };

export function isResultsLikeColumn(label: string | undefined): boolean {
  if (!label) return false;
  return /result|challenge|lesson|comment|desaf|li[cç][aã]o|coment/i.test(label);
}

export function parseInformeSelection(raw: unknown): InformeCanvasSelection | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const kind = o.kind;
  if (kind === 'region' && typeof o.regionId === 'string') {
    return { kind: 'region', regionId: o.regionId };
  }
  if (kind === 'tableRow' && typeof o.sectionId === 'string' && typeof o.tableRow === 'number') {
    return { kind: 'tableRow', sectionId: o.sectionId, tableRow: o.tableRow };
  }
  if (kind === 'tableColumn' && typeof o.sectionId === 'string' && typeof o.tableCol === 'number') {
    return { kind: 'tableColumn', sectionId: o.sectionId, tableCol: o.tableCol };
  }
  if (kind === 'section' && typeof o.sectionId === 'string') {
    return { kind: 'section', sectionId: o.sectionId };
  }
  return null;
}

export function isSameInformeSelection(
  a: InformeCanvasSelection | null,
  b: InformeCanvasSelection | null,
): boolean {
  if (!a || !b) return false;
  if (a.kind !== b.kind) return false;
  if (a.kind === 'region' && b.kind === 'region') return a.regionId === b.regionId;
  if (a.kind === 'section' && b.kind === 'section') return a.sectionId === b.sectionId;
  if (a.kind === 'tableRow' && b.kind === 'tableRow') {
    return a.sectionId === b.sectionId && a.tableRow === b.tableRow;
  }
  if (a.kind === 'tableColumn' && b.kind === 'tableColumn') {
    return a.sectionId === b.sectionId && a.tableCol === b.tableCol;
  }
  return false;
}

export function toggleInformeSelection(
  current: InformeCanvasSelection | null,
  next: InformeCanvasSelection,
): InformeCanvasSelection | null {
  return isSameInformeSelection(current, next) ? null : next;
}

function findSection(canvas: ReportCanvasState, sectionId: string) {
  const sections = canvas.sections?.length
    ? canvas.sections
    : buildCanvasSectionsFromRegions(canvas.regions);
  return sections.find((s) => s.id === sectionId);
}

function regionsInSection(canvas: ReportCanvasState, sectionId: string): ReportCanvasRegion[] {
  const section = findSection(canvas, sectionId);
  if (!section) return [];
  const byId = new Map(canvas.regions.map((r) => [r.id, r]));
  return section.regionIds.map((id) => byId.get(id)).filter(Boolean) as ReportCanvasRegion[];
}

export function regionIdsForSelection(
  canvas: ReportCanvasState,
  selection: InformeCanvasSelection,
): string[] {
  if (selection.kind === 'region') return [selection.regionId];
  if (selection.kind === 'section') {
    return regionsInSection(canvas, selection.sectionId).map((r) => r.id);
  }
  if (selection.kind === 'tableRow') {
    return regionsInSection(canvas, selection.sectionId)
      .filter((r) => (r.tableRow ?? 0) === selection.tableRow)
      .map((r) => r.id);
  }
  if (selection.kind === 'tableColumn') {
    return regionsInSection(canvas, selection.sectionId)
      .filter((r) => (r.tableCol ?? 0) === selection.tableCol)
      .map((r) => r.id);
  }
  return [];
}

export function describeInformeSelection(
  canvas: ReportCanvasState,
  selection: InformeCanvasSelection,
): string {
  const byId = new Map(canvas.regions.map((r) => [r.id, r]));

  if (selection.kind === 'region') {
    const r = byId.get(selection.regionId);
    if (!r) return 'Campo seleccionado';
    if (r.kind === 'tableCell') {
      return `${r.tableTitle || 'Tabela'} · ${r.columnLabel || 'coluna'} · linha ${r.tableRow ?? '?'}`;
    }
    return r.label || 'Campo';
  }

  const section = findSection(canvas, selection.sectionId);
  const title = section?.title || 'Secção';

  if (selection.kind === 'section') return `Secção «${title}»`;
  if (selection.kind === 'tableRow') {
    const cells = regionsInSection(canvas, selection.sectionId).filter(
      (r) => (r.tableRow ?? 0) === selection.tableRow,
    );
    const activity = cells.find((c) => /activit|actividad/i.test(c.columnLabel || ''))?.text;
    return `Linha ${selection.tableRow} · ${title}${activity ? ` (${activity.slice(0, 40)})` : ''}`;
  }
  if (selection.kind === 'tableColumn') {
    const col =
      section?.columns?.[selection.tableCol] ||
      regionsInSection(canvas, selection.sectionId).find((r) => r.tableCol === selection.tableCol)
        ?.columnLabel ||
      `Coluna ${selection.tableCol + 1}`;
    return `Coluna «${col}» · ${title}`;
  }
  return 'Elemento seleccionado';
}

export function formatSelectionFocusForPrompt(
  canvas: ReportCanvasState,
  selection: InformeCanvasSelection,
): string {
  const label = describeInformeSelection(canvas, selection);
  const ids = regionIdsForSelection(canvas, selection);
  const byId = new Map(canvas.regions.map((r) => [r.id, r]));
  const lines = [`Tipo: ${selection.kind}`, `Rótulo: ${label}`];

  if (selection.kind === 'tableRow') {
    lines.push(`sectionId="${selection.sectionId}"`, `tableRow=${selection.tableRow}`);
  } else if (selection.kind === 'tableColumn') {
    lines.push(`sectionId="${selection.sectionId}"`, `tableCol=${selection.tableCol}`);
  } else if (selection.kind === 'section') {
    lines.push(`sectionId="${selection.sectionId}"`);
  }

  lines.push('Células/campos no âmbito:');
  for (const id of ids.slice(0, 40)) {
    const r = byId.get(id);
    if (!r) continue;
    const preview = r.text.trim() ? r.text.slice(0, 200) : '(vazio)';
    const col = r.columnLabel ? ` col="${r.columnLabel}"` : '';
    lines.push(`  regionId="${id}"${col}: ${preview}`);
  }
  if (ids.length > 40) lines.push(`  … +${ids.length - 40} mais`);

  lines.push(
    'Priorize canvasPatches nestes regionIds. Para reescrever linha inteira use replaceTableRows só se o utilizador pedir reescrita completa da tabela.',
  );
  return lines.join('\n');
}

export function isRegionInSelection(
  selection: InformeCanvasSelection | null | undefined,
  region: ReportCanvasRegion,
  sectionId?: string,
): boolean {
  if (!selection) return false;
  const sid = sectionId || region.sectionId || '';
  if (selection.kind === 'region') return selection.regionId === region.id;
  if (selection.kind === 'section') return selection.sectionId === sid;
  if (selection.kind === 'tableRow') {
    return selection.sectionId === sid && (region.tableRow ?? 0) === selection.tableRow;
  }
  if (selection.kind === 'tableColumn') {
    return selection.sectionId === sid && (region.tableCol ?? 0) === selection.tableCol;
  }
  return false;
}

export function isSectionSelected(
  selection: InformeCanvasSelection | null | undefined,
  sectionId: string,
): boolean {
  if (!selection) return false;
  if (selection.kind === 'section') return selection.sectionId === sectionId;
  return false;
}

export function isTableColumnSelected(
  selection: InformeCanvasSelection | null | undefined,
  sectionId: string,
  tableCol: number,
): boolean {
  return (
    selection?.kind === 'tableColumn' &&
    selection.sectionId === sectionId &&
    selection.tableCol === tableCol
  );
}

export function isTableRowSelected(
  selection: InformeCanvasSelection | null | undefined,
  sectionId: string,
  tableRow: number,
): boolean {
  return (
    selection?.kind === 'tableRow' &&
    selection.sectionId === sectionId &&
    selection.tableRow === tableRow
  );
}

/** Linhas sugeridas para textarea conforme conteúdo. */
export function textareaRowsForRegion(region: ReportCanvasRegion): number {
  const long = isResultsLikeColumn(region.columnLabel) || region.fieldType === 'long';
  const base = long ? 6 : 3;
  const fromLength = Math.ceil(region.text.length / (long ? 50 : 40));
  return Math.min(long ? 12 : 8, Math.max(base, fromLength));
}
