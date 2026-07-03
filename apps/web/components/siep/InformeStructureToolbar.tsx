'use client';

import { GripVertical, Plus, Trash2, MessageSquarePlus, Columns, Rows3 } from 'lucide-react';
import { SelectForChatButton } from '@/components/siep/SelectForChatButton';
import type { ReportCanvasFieldType } from '@/lib/siep/report-canvas-types';
import {
  addLongField,
  addOtherField,
  addShortField,
  addTableBlock,
} from '@/lib/siep/report-canvas-builder';
import type { ReportCanvasState } from '@/lib/siep/report-canvas-types';
import { useSiepT } from '@/lib/siep/use-siep-t';

type Props = {
  canvas: ReportCanvasState;
  onChange: (canvas: ReportCanvasState) => void;
};

const ADD_ACTIONS: { type: ReportCanvasFieldType; labelKey: string; fn: typeof addShortField }[] = [
  { type: 'short', labelKey: 'siep.informe.structure.addShort', fn: addShortField },
  { type: 'long', labelKey: 'siep.informe.structure.addLong', fn: addLongField },
  { type: 'table', labelKey: 'siep.informe.structure.addTable', fn: (s) => addTableBlock(s) },
  { type: 'other', labelKey: 'siep.informe.structure.addOther', fn: addOtherField },
];

export function InformeStructureToolbar({ canvas, onChange }: Props) {
  const st = useSiepT();

  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50/60 px-3 py-2 space-y-2">
      <p className="text-[10px] font-semibold text-indigo-800 uppercase tracking-wide">
        {st('siep.informe.structure.toolbar')}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {ADD_ACTIONS.map(({ type, labelKey, fn }) => (
          <button
            key={type}
            type="button"
            onClick={() => onChange(fn(canvas, st(labelKey)))}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-white border border-indigo-200 text-indigo-800 hover:bg-indigo-100"
          >
            <Plus className="w-3 h-3" />
            {st(labelKey)}
          </button>
        ))}
      </div>
      <p className="text-[10px] text-indigo-700/80">{st('siep.informe.structure.dragHint')}</p>
      <p className="text-[10px] text-indigo-600/70">{st('siep.informe.structure.fieldDragHint')}</p>
    </div>
  );
}

export function StructureSectionChrome({
  sectionId,
  title,
  editableStructure,
  sectionSelected,
  onSelectSection,
  selectTitle,
  onTitleChange,
  onRemoveSection,
  onDragStart,
  onDragOver,
  onDrop,
  children,
}: {
  sectionId: string;
  title: string;
  editableStructure?: boolean;
  sectionSelected?: boolean;
  onSelectSection?: () => void;
  selectTitle?: string;
  onTitleChange?: (title: string) => void;
  onRemoveSection?: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-xl border bg-white overflow-hidden shadow-sm ${
        editableStructure ? 'border-indigo-200 ring-1 ring-indigo-100' : 'border-slate-200'
      } ${sectionSelected ? 'ring-2 ring-indigo-400' : ''}`}
      onDragOver={editableStructure ? onDragOver : undefined}
      onDrop={editableStructure ? onDrop : undefined}
      data-section-id={sectionId}
    >
      <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
        {onSelectSection && (
          <SelectForChatButton
            selected={Boolean(sectionSelected)}
            title={selectTitle || 'Seleccionar secção'}
            onSelect={onSelectSection}
          />
        )}
        {editableStructure && (
          <button
            type="button"
            draggable
            onDragStart={onDragStart}
            className="p-0.5 text-slate-400 hover:text-indigo-600 cursor-grab active:cursor-grabbing"
            title="Arrastar secção"
          >
            <GripVertical className="w-4 h-4" />
          </button>
        )}
        {editableStructure && onTitleChange ? (
          <input
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            className="flex-1 text-xs font-semibold text-slate-800 bg-transparent border-b border-transparent focus:border-indigo-300 focus:outline-none"
          />
        ) : (
          <p className="text-xs font-semibold text-slate-800 flex-1">{title}</p>
        )}
        {editableStructure && onRemoveSection && (
          <button type="button" onClick={onRemoveSection} className="p-1 text-slate-400 hover:text-red-500">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

export function StructureFieldControls({
  editableStructure,
  instruction,
  onInstructionChange,
  onRemove,
}: {
  editableStructure?: boolean;
  instruction?: string;
  onInstructionChange?: (v: string) => void;
  onRemove?: () => void;
}) {
  if (!editableStructure) return null;

  return (
    <div className="flex items-center gap-1 shrink-0">
      {onInstructionChange && (
        <button
          type="button"
          title="Instrução (!)"
          onClick={() => {
            const next = window.prompt('Instrução para o utilizador (aparece no !):', instruction || '');
            if (next != null) onInstructionChange(next);
          }}
          className="p-1 text-slate-400 hover:text-amber-600"
        >
          <MessageSquarePlus className="w-3.5 h-3.5" />
        </button>
      )}
      {onRemove && (
        <button type="button" onClick={onRemove} className="p-1 text-slate-400 hover:text-red-500">
          <Trash2 className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
