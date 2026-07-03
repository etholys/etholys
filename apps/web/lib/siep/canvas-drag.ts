import type { DragEvent } from 'react';

/** Tipos MIME para drag-and-drop no editor de estrutura (HTML5 DnD). */
export const CANVAS_DRAG_SECTION = 'application/x-etholys-siep-section';
export const CANVAS_DRAG_REGION = 'application/x-etholys-siep-region';
export const CANVAS_DRAG_TABLE_ROW = 'application/x-etholys-siep-table-row';

export function startCanvasTableRowDrag(e: DragEvent, sectionId: string, tableRow: number) {
  e.dataTransfer.setData(CANVAS_DRAG_TABLE_ROW, `${sectionId}:${tableRow}`);
  e.dataTransfer.setData('text/plain', `trow:${sectionId}:${tableRow}`);
  e.dataTransfer.effectAllowed = 'move';
}

export function readCanvasTableRowDrag(e: DragEvent): { sectionId: string; tableRow: number } | null {
  const typed = e.dataTransfer.getData(CANVAS_DRAG_TABLE_ROW);
  const raw = typed || e.dataTransfer.getData('text/plain');
  const m = raw.match(/^(?:trow:)?([^:]+):(\d+)$/);
  if (!m) return null;
  return { sectionId: m[1], tableRow: Number(m[2]) };
}

export function startCanvasSectionDrag(e: DragEvent, sectionId: string) {
  e.dataTransfer.setData(CANVAS_DRAG_SECTION, sectionId);
  e.dataTransfer.setData('text/plain', `section:${sectionId}`);
  e.dataTransfer.effectAllowed = 'move';
}

export function startCanvasRegionDrag(e: DragEvent, regionId: string) {
  e.dataTransfer.setData(CANVAS_DRAG_REGION, regionId);
  e.dataTransfer.setData('text/plain', `region:${regionId}`);
  e.dataTransfer.effectAllowed = 'move';
}

export function readCanvasSectionDrag(e: DragEvent): string {
  const typed = e.dataTransfer.getData(CANVAS_DRAG_SECTION);
  if (typed) return typed;
  const plain = e.dataTransfer.getData('text/plain');
  return plain.startsWith('section:') ? plain.slice(8) : '';
}

export function readCanvasRegionDrag(e: DragEvent): string {
  const typed = e.dataTransfer.getData(CANVAS_DRAG_REGION);
  if (typed) return typed;
  const plain = e.dataTransfer.getData('text/plain');
  return plain.startsWith('region:') ? plain.slice(7) : '';
}

export function allowCanvasDrop(e: DragEvent) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}
