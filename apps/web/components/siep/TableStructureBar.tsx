'use client';

import { useState } from 'react';
import { Columns, Rows3, Trash2 } from 'lucide-react';

export function TableStructureBar({
  columns,
  onAddColumn,
  onAddRow,
  onRemoveColumn,
  st,
}: {
  columns: string[];
  onAddColumn: () => void;
  onAddRow: () => void;
  onRemoveColumn?: (colIndex: number) => void;
  st: (k: string) => string;
}) {
  const [removeColIndex, setRemoveColIndex] = useState(0);
  const canRemove = Boolean(onRemoveColumn) && columns.length > 1;
  const safeIndex = Math.min(removeColIndex, Math.max(0, columns.length - 1));

  return (
    <div className="px-3 py-1.5 border-b border-slate-100 flex flex-wrap items-center gap-1.5 bg-slate-50/80">
      <button
        type="button"
        onClick={onAddColumn}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border border-slate-200 bg-white hover:bg-indigo-50"
      >
        <Columns className="w-3 h-3" /> {st('siep.informe.structure.addColumn')}
      </button>
      <button
        type="button"
        onClick={onAddRow}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border border-slate-200 bg-white hover:bg-indigo-50"
      >
        <Rows3 className="w-3 h-3" /> {st('siep.informe.structure.addRow')}
      </button>
      {canRemove && (
        <>
          <select
            value={safeIndex}
            onChange={(e) => setRemoveColIndex(Number(e.target.value))}
            className="text-[10px] border border-slate-200 rounded px-1.5 py-0.5 bg-white max-w-[8rem] truncate"
            title={st('siep.informe.structure.removeColumnPick')}
          >
            {columns.map((col, i) => (
              <option key={i} value={i}>
                {col || `${st('siep.informe.structure.column')} ${i + 1}`}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => onRemoveColumn!(safeIndex)}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border border-red-100 text-red-600 bg-white hover:bg-red-50"
          >
            <Trash2 className="w-3 h-3" /> {st('siep.informe.structure.removeColumn')}
          </button>
        </>
      )}
    </div>
  );
}
