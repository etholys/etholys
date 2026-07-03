'use client';

import { useMemo } from 'react';
import type { ReportCanvasRegion, ReportCanvasState } from '@/lib/siep/report-canvas-types';
import { buildCanvasLayout } from '@/lib/siep/report-canvas-layout';
import {
  allowCanvasDrop,
  readCanvasRegionDrag,
  readCanvasSectionDrag,
  readCanvasTableRowDrag,
  startCanvasRegionDrag,
  startCanvasSectionDrag,
  startCanvasTableRowDrag,
} from '@/lib/siep/canvas-drag';
import {
  reorderCanvasSections,
  reorderRegionsInSection,
  removeCanvasRegion,
  updateCanvasRegion,
  updateSectionTitle,
  renameTableColumn,
  addTableColumn,
  addTableRow,
  removeTableColumn,
  removeTableRow,
  reorderTableRows,
} from '@/lib/siep/report-canvas-builder';
import { FieldInstructionHint } from '@/components/siep/FieldInstructionHint';
import { TableStructureBar } from '@/components/siep/TableStructureBar';
import {
  InformeStructureToolbar,
  StructureFieldControls,
  StructureSectionChrome,
} from '@/components/siep/InformeStructureToolbar';
import { GripVertical } from 'lucide-react';
import { useSiepT } from '@/lib/siep/use-siep-t';
import { SelectForChatButton, selectionRingClass } from '@/components/siep/SelectForChatButton';
import {
  type InformeCanvasSelection,
  isRegionInSelection,
  isSectionSelected,
  isTableColumnSelected,
  isTableRowSelected,
  textareaRowsForRegion,
  toggleInformeSelection,
} from '@/lib/siep/informe-canvas-selection';

type Props = {
  canvas: ReportCanvasState;
  onChange: (canvas: ReportCanvasState) => void;
  editableStructure?: boolean;
  selection?: InformeCanvasSelection | null;
  onSelectionChange?: (selection: InformeCanvasSelection | null) => void;
};

function FieldInput({
  region,
  onUpdate,
  rows,
}: {
  region: ReportCanvasRegion;
  onUpdate: (text: string) => void;
  rows?: number;
}) {
  const isShort =
    region.fieldType === 'short' || (!region.fieldType && (region.label?.length ?? 0) < 40 && !rows);

  if (isShort) {
    return (
      <input
        value={region.text}
        onChange={(e) => onUpdate(e.target.value)}
        className="w-full text-sm text-slate-800 bg-white/80 border border-slate-200 rounded px-2 py-1.5 focus:ring-1 focus:ring-indigo-300"
        placeholder="…"
      />
    );
  }

  return (
    <textarea
      value={region.text}
      onChange={(e) => onUpdate(e.target.value)}
      rows={rows ?? (region.fieldType === 'long' ? 6 : Math.min(8, Math.max(2, Math.ceil(region.text.length / 60))))}
      className="w-full text-sm text-slate-800 leading-relaxed resize-y min-h-[2.5rem] bg-white/80 border border-slate-200 rounded px-2 py-1 focus:ring-1 focus:ring-indigo-300 whitespace-pre-wrap"
      placeholder="…"
    />
  );
}

function FieldRow({
  region,
  editableStructure,
  sectionId,
  selection,
  onSelectionChange,
  selectTitle,
  onUpdate,
  onMetaChange,
  onRemove,
  onRegionDragStart,
  onRegionDragOver,
  onRegionDrop,
}: {
  region: ReportCanvasRegion;
  editableStructure?: boolean;
  sectionId?: string;
  selection?: InformeCanvasSelection | null;
  onSelectionChange?: (selection: InformeCanvasSelection | null) => void;
  selectTitle?: string;
  onUpdate: (text: string) => void;
  onMetaChange?: (patch: Partial<ReportCanvasRegion>) => void;
  onRemove?: () => void;
  onRegionDragStart?: (e: React.DragEvent) => void;
  onRegionDragOver?: (e: React.DragEvent) => void;
  onRegionDrop?: (e: React.DragEvent) => void;
}) {
  const selected = isRegionInSelection(selection, region, sectionId);
  const canSelect = Boolean(onSelectionChange);

  return (
    <div
      className={`grid grid-cols-[auto_minmax(8rem,38%)_1fr_auto] gap-2 border-b border-slate-100 py-2 last:border-0 ${
        region.missing ? 'bg-amber-50/40' : ''
      } ${selectionRingClass(selected)}`}
      onDragOver={editableStructure ? onRegionDragOver : undefined}
      onDrop={editableStructure ? onRegionDrop : undefined}
      data-region-id={region.id}
    >
      {editableStructure && onRegionDragStart ? (
        <button
          type="button"
          draggable
          onDragStart={onRegionDragStart}
          className="p-0.5 text-slate-300 hover:text-indigo-500 cursor-grab active:cursor-grabbing self-start mt-1"
          title="Arrastar campo"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>
      ) : (
        <span className="w-4" />
      )}
      <div className="text-xs font-medium text-slate-600 leading-snug pr-2 flex items-start gap-0.5">
        {canSelect && (
          <SelectForChatButton
            selected={selected}
            title={selectTitle || 'Seleccionar para o chat'}
            onSelect={() =>
              onSelectionChange?.(
                toggleInformeSelection(selection ?? null, { kind: 'region', regionId: region.id }),
              )
            }
          />
        )}
        {editableStructure && onMetaChange ? (
          <input
            value={region.label || ''}
            onChange={(e) => onMetaChange({ label: e.target.value })}
            className="w-full bg-transparent border-b border-dashed border-slate-300 text-xs focus:border-indigo-400 focus:outline-none"
          />
        ) : (
          <span>{region.label}</span>
        )}
        <FieldInstructionHint instruction={region.instruction} />
      </div>
      <FieldInput region={region} onUpdate={onUpdate} rows={textareaRowsForRegion(region)} />
      <StructureFieldControls
        editableStructure={editableStructure}
        instruction={region.instruction}
        onInstructionChange={onMetaChange ? (instruction) => onMetaChange({ instruction }) : undefined}
        onRemove={onRemove}
      />
    </div>
  );
}

function TablePreview({
  title,
  columns,
  regions,
  editableStructure,
  sectionId,
  st,
  onUpdate,
  onSectionTitle,
  onRemoveRegion,
  onSectionReorder,
  onRemoveSection,
  onRenameColumn,
  onAddColumn,
  onAddRow,
  onRemoveColumn,
  onRemoveRow,
  onReorderRow,
  onRegionMeta,
  selection,
  onSelectionChange,
}: {
  title: string;
  columns: string[];
  regions: ReportCanvasRegion[];
  editableStructure?: boolean;
  sectionId: string;
  st: (k: string) => string;
  onUpdate: (id: string, text: string) => void;
  onSectionTitle?: (title: string) => void;
  onRemoveRegion?: (id: string) => void;
  onSectionReorder?: (draggedId: string, targetId: string) => void;
  onRemoveSection?: () => void;
  onRenameColumn?: (colIndex: number, label: string) => void;
  onAddColumn?: () => void;
  onAddRow?: () => void;
  onRemoveColumn?: (colIndex: number) => void;
  onRemoveRow?: (tableRow: number) => void;
  onReorderRow?: (fromRow: number, toRow: number) => void;
  onRegionMeta?: (id: string, patch: Partial<ReportCanvasRegion>) => void;
  selection?: InformeCanvasSelection | null;
  onSelectionChange?: (selection: InformeCanvasSelection | null) => void;
}) {
  const selectTitle = st('siep.informe.selection.selectForChat');
  const handleSectionDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const from = readCanvasSectionDrag(e);
    if (from && from !== sectionId && onSectionReorder) {
      onSectionReorder(from, sectionId);
    }
  };

  const rows = useMemo(() => {
    const byRow = new Map<number, ReportCanvasRegion[]>();
    for (const r of regions) {
      const ri = r.tableRow ?? 0;
      if (!byRow.has(ri)) byRow.set(ri, []);
      byRow.get(ri)!.push(r);
    }
    return [...byRow.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([rowIdx, cells]) => ({
        rowIdx,
        cells: cells.sort((a, b) => (a.tableCol ?? 0) - (b.tableCol ?? 0)),
      }));
  }, [regions]);

  const cols =
    columns.length > 0
      ? columns
      : ([...new Set(regions.map((r) => r.columnLabel).filter(Boolean))] as string[]);

  return (
    <StructureSectionChrome
      sectionId={sectionId}
      title={title}
      editableStructure={editableStructure}
      sectionSelected={isSectionSelected(selection, sectionId)}
      onSelectSection={
        onSelectionChange
          ? () =>
              onSelectionChange(
                toggleInformeSelection(selection ?? null, { kind: 'section', sectionId }),
              )
          : undefined
      }
      selectTitle={selectTitle}
      onTitleChange={onSectionTitle}
      onRemoveSection={onRemoveSection}
      onDragStart={(e) => startCanvasSectionDrag(e, sectionId)}
      onDragOver={(e) => editableStructure && allowCanvasDrop(e)}
      onDrop={handleSectionDrop}
    >
      <p className="px-3 py-1 text-[10px] text-indigo-600/80 border-b border-slate-100">
        Tabela · {rows.length} linha(s) · {cols.length} coluna(s)
        {!editableStructure && (
          <span className="text-slate-400"> · {st('siep.informe.table.expandHint')}</span>
        )}
      </p>
      {onAddColumn && onAddRow && (
        <TableStructureBar
          columns={cols}
          st={st}
          onAddColumn={onAddColumn}
          onAddRow={onAddRow}
          onRemoveColumn={onRemoveColumn}
        />
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse min-w-[32rem]">
          <thead>
            <tr className="bg-slate-50">
              <th className="w-7 border border-slate-200" aria-label="Ordem" />
              {cols.map((col, i) => {
                const colSelected = isTableColumnSelected(selection, sectionId, i);
                return (
                <th
                  key={i}
                  className={`border border-slate-200 px-2 py-1.5 text-left font-semibold text-slate-600 whitespace-nowrap ${selectionRingClass(colSelected)}`}
                >
                  <div className="flex items-center gap-1">
                    {onSelectionChange && (
                      <SelectForChatButton
                        selected={colSelected}
                        title={selectTitle}
                        onSelect={() =>
                          onSelectionChange(
                            toggleInformeSelection(selection ?? null, {
                              kind: 'tableColumn',
                              sectionId,
                              tableCol: i,
                            }),
                          )
                        }
                      />
                    )}
                    <span className="flex-1 min-w-0">
                  {editableStructure && onRenameColumn ? (
                    <input
                      value={col}
                      onChange={(e) => onRenameColumn(i, e.target.value)}
                      className="w-full min-w-[4rem] bg-transparent border-b border-dashed border-slate-300 text-xs font-semibold focus:border-indigo-400 focus:outline-none"
                    />
                  ) : (
                    col
                  )}
                    </span>
                  </div>
                </th>
              );
              })}
              <th className="w-7 border border-slate-200" aria-label="Ações" />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ rowIdx, cells }) => {
              const rowSelected = isTableRowSelected(selection, sectionId, rowIdx);
              return (
              <tr
                key={rowIdx}
                className={`hover:bg-slate-50/50 ${selectionRingClass(rowSelected)}`}
                onDragOver={(e) => onReorderRow && allowCanvasDrop(e)}
                onDrop={(e) => {
                  if (!onReorderRow) return;
                  const from = readCanvasTableRowDrag(e);
                  if (from && from.sectionId === sectionId && from.tableRow !== rowIdx) {
                    e.preventDefault();
                    onReorderRow(from.tableRow, rowIdx);
                  }
                }}
              >
                <td className="border border-slate-200 p-0 align-middle text-center bg-slate-50/50">
                  <div className="flex flex-col items-center gap-0.5 py-0.5">
                    {onSelectionChange && (
                      <SelectForChatButton
                        selected={rowSelected}
                        title={selectTitle}
                        onSelect={() =>
                          onSelectionChange(
                            toggleInformeSelection(selection ?? null, {
                              kind: 'tableRow',
                              sectionId,
                              tableRow: rowIdx,
                            }),
                          )
                        }
                      />
                    )}
                  {onReorderRow ? (
                    <button
                      type="button"
                      draggable
                      onDragStart={(e) => startCanvasTableRowDrag(e, sectionId, rowIdx)}
                      className="p-1 text-slate-300 hover:text-indigo-500 cursor-grab active:cursor-grabbing"
                      title={st('siep.informe.table.dragRow')}
                    >
                      <GripVertical className="w-3.5 h-3.5" />
                    </button>
                  ) : null}
                  </div>
                </td>
                {cols.map((col, ci) => {
                  const region = cells.find((c) => c.columnLabel === col || c.tableCol === ci);
                  if (!region) {
                    return <td key={ci} className="border border-slate-100 bg-slate-50/30 min-w-[5rem]" />;
                  }
                  const cellSelected = isRegionInSelection(selection, region, sectionId);
                  return (
                    <td
                      key={ci}
                      className={`border border-slate-200 p-0 align-top min-w-[5rem] ${
                        region.missing ? 'bg-amber-50/60' : 'bg-white'
                      } ${selectionRingClass(cellSelected)}`}
                    >
                      <div className="flex items-start gap-0.5 px-1 pt-1">
                        {onSelectionChange && (
                          <SelectForChatButton
                            selected={cellSelected}
                            title={selectTitle}
                            onSelect={() =>
                              onSelectionChange(
                                toggleInformeSelection(selection ?? null, {
                                  kind: 'region',
                                  regionId: region.id,
                                }),
                              )
                            }
                          />
                        )}
                        <FieldInstructionHint instruction={region.instruction} />
                        {editableStructure && onRegionMeta && (
                          <button
                            type="button"
                            title="Instrução"
                            onClick={() => {
                              const next = window.prompt('Instrução (!):', region.instruction || '');
                              if (next != null) onRegionMeta(region.id, { instruction: next });
                            }}
                            className="text-[10px] text-slate-400 hover:text-amber-600"
                          >
                            !
                          </button>
                        )}
                        {editableStructure && onRemoveRegion && (
                          <button
                            type="button"
                            onClick={() => onRemoveRegion(region.id)}
                            className="ml-auto text-slate-300 hover:text-red-500 text-[10px]"
                          >
                            ×
                          </button>
                        )}
                      </div>
                      <textarea
                        value={region.text}
                        onChange={(e) => onUpdate(region.id, e.target.value)}
                        rows={textareaRowsForRegion(region)}
                        className="w-full px-2 py-1.5 bg-transparent text-xs resize-y focus:outline-none focus:ring-1 focus:ring-indigo-300 min-h-[2rem] whitespace-pre-wrap leading-relaxed"
                        placeholder="…"
                      />
                    </td>
                  );
                })}
                <td className="border border-slate-200 p-0 align-middle text-center bg-slate-50/30">
                  {onRemoveRow && rows.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => onRemoveRow(rowIdx)}
                      className="p-1 text-slate-300 hover:text-red-500"
                      title={st('siep.informe.table.removeRow')}
                    >
                      ×
                    </button>
                  ) : null}
                </td>
              </tr>
            );
            })}
          </tbody>
        </table>
      </div>
    </StructureSectionChrome>
  );
}

export function WordReportCanvas({
  canvas,
  onChange,
  editableStructure,
  selection,
  onSelectionChange,
}: Props) {
  const st = useSiepT();
  const selectTitle = st('siep.informe.selection.selectForChat');
  const layout = useMemo(() => buildCanvasLayout(canvas), [canvas]);

  const patch = (next: ReportCanvasState) => onChange(next);

  const updateRegionText = (id: string, text: string) => {
    patch(updateCanvasRegion(canvas, id, { text }));
  };

  const updateRegionMeta = (id: string, meta: Partial<ReportCanvasRegion>) => {
    patch(updateCanvasRegion(canvas, id, meta));
  };

  const removeRegion = (id: string) => patch(removeCanvasRegion(canvas, id));

  const reorderSections = (from: string, to: string) => {
    patch(reorderCanvasSections(canvas, from, to));
  };

  const removeSection = (sectionId: string, regionIds: string[]) => {
    let next = canvas;
    for (const id of regionIds) next = removeCanvasRegion(next, id);
    patch(next);
  };

  const reorderFields = (sectionId: string, from: string, to: string) => {
    patch(reorderRegionsInSection(canvas, sectionId, from, to));
  };

  const fieldDragHandlers = (sectionId: string, regionId: string) => ({
    onRegionDragStart: (e: React.DragEvent) => startCanvasRegionDrag(e, regionId),
    onRegionDragOver: (e: React.DragEvent) => editableStructure && allowCanvasDrop(e),
    onRegionDrop: (e: React.DragEvent) => {
      const from = readCanvasRegionDrag(e);
      if (!from || from === regionId) return;
      e.preventDefault();
      e.stopPropagation();
      reorderFields(sectionId, from, regionId);
    },
  });

  const handleSectionDrop = (targetSectionId: string) => (e: React.DragEvent) => {
    e.preventDefault();
    const from = readCanvasSectionDrag(e);
    if (from && from !== targetSectionId) reorderSections(from, targetSectionId);
  };

  return (
    <div className="space-y-5 p-2">
      {editableStructure && <InformeStructureToolbar canvas={canvas} onChange={patch} />}

      {!editableStructure && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/80 px-3 py-2">
          <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">
            {st('siep.informe.preview.layoutTitle')}
          </p>
          <p className="text-xs text-slate-600 mt-0.5">
            {canvas.templateFileName || st('siep.informe.structure.customFormat')}
          </p>
          {onSelectionChange && (
            <p className="text-[10px] text-indigo-600/90 mt-1">{st('siep.informe.selection.hint')}</p>
          )}
        </div>
      )}

      {layout.length === 0 && editableStructure && (
        <p className="text-center text-sm text-slate-500 py-8">{st('siep.informe.structure.empty')}</p>
      )}

      {layout.map((block, bi) => {
        if (block.type === 'orphan') {
          return (
            <div key={`orphan-${bi}`} className="rounded-xl border border-slate-200 bg-white p-3">
              {block.regions.map((r) => (
                <FieldRow
                  key={r.id}
                  region={r}
                  editableStructure={editableStructure}
                  selection={selection}
                  onSelectionChange={onSelectionChange}
                  selectTitle={selectTitle}
                  onUpdate={(t) => updateRegionText(r.id, t)}
                  onMetaChange={(m) => updateRegionMeta(r.id, m)}
                  onRemove={() => removeRegion(r.id)}
                />
              ))}
            </div>
          );
        }

        const { section, regions } = block;

        if (section.kind === 'table') {
          return (
            <TablePreview
              key={section.id}
              sectionId={section.id}
              title={section.title}
              columns={section.columns || []}
              regions={regions}
              editableStructure={editableStructure}
              st={st}
              onUpdate={updateRegionText}
              onSectionTitle={(title) => patch(updateSectionTitle(canvas, section.id, title))}
              onRemoveRegion={removeRegion}
              onSectionReorder={reorderSections}
              onRemoveSection={() => removeSection(section.id, section.regionIds)}
              onRenameColumn={(ci, label) => patch(renameTableColumn(canvas, section.id, ci, label))}
              onAddColumn={() => patch(addTableColumn(canvas, section.id))}
              onAddRow={() => patch(addTableRow(canvas, section.id))}
              onRemoveColumn={(colIndex) => patch(removeTableColumn(canvas, section.id, colIndex))}
              onRemoveRow={(tableRow) => patch(removeTableRow(canvas, section.id, tableRow))}
              onReorderRow={(from, to) => patch(reorderTableRows(canvas, section.id, from, to))}
              onRegionMeta={updateRegionMeta}
              selection={selection}
              onSelectionChange={onSelectionChange}
            />
          );
        }

        return (
          <StructureSectionChrome
            key={section.id}
            sectionId={section.id}
            title={section.title}
            editableStructure={editableStructure}
            sectionSelected={isSectionSelected(selection, section.id)}
            onSelectSection={
              onSelectionChange
                ? () =>
                    onSelectionChange(
                      toggleInformeSelection(selection ?? null, { kind: 'section', sectionId: section.id }),
                    )
                : undefined
            }
            selectTitle={selectTitle}
            onTitleChange={(title) => patch(updateSectionTitle(canvas, section.id, title))}
            onRemoveSection={() => removeSection(section.id, section.regionIds)}
            onDragStart={(e) => startCanvasSectionDrag(e, section.id)}
            onDragOver={(e) => editableStructure && allowCanvasDrop(e)}
            onDrop={handleSectionDrop(section.id)}
          >
            {section.kind === 'narrative' && (
              <p className="px-3 pt-2 text-[10px] text-slate-500">{st('siep.informe.structure.longField')}</p>
            )}
            <div className="px-3 py-1">
              {regions.map((r) =>
                section.kind === 'narrative' && !editableStructure ? (
                  <div
                    key={r.id}
                    className={selectionRingClass(isRegionInSelection(selection, r, section.id))}
                  >
                    <div className="flex items-center gap-1 py-1">
                      {onSelectionChange && (
                        <SelectForChatButton
                          selected={isRegionInSelection(selection, r, section.id)}
                          title={selectTitle}
                          onSelect={() =>
                            onSelectionChange(
                              toggleInformeSelection(selection ?? null, { kind: 'region', regionId: r.id }),
                            )
                          }
                        />
                      )}
                      <span className="text-xs font-medium text-slate-600">{r.label}</span>
                      <FieldInstructionHint instruction={r.instruction} />
                    </div>
                    <textarea
                      value={r.text}
                      onChange={(e) => updateRegionText(r.id, e.target.value)}
                      rows={textareaRowsForRegion(r)}
                      className="w-full text-sm text-slate-800 leading-relaxed resize-y min-h-[6rem] bg-transparent border-0 focus:ring-0 py-2 whitespace-pre-wrap"
                      placeholder="(vazio)"
                    />
                  </div>
                ) : (
                  <FieldRow
                    key={r.id}
                    region={r}
                    sectionId={section.id}
                    editableStructure={editableStructure}
                    selection={selection}
                    onSelectionChange={onSelectionChange}
                    selectTitle={selectTitle}
                    onUpdate={(t) => updateRegionText(r.id, t)}
                    onMetaChange={(m) => updateRegionMeta(r.id, m)}
                    onRemove={() => removeRegion(r.id)}
                    {...(editableStructure && regions.length > 1
                      ? fieldDragHandlers(section.id, r.id)
                      : {})}
                  />
                ),
              )}
            </div>
          </StructureSectionChrome>
        );
      })}
    </div>
  );
}
