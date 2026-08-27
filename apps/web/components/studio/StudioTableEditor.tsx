'use client';

import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  defaultTableMarkdown,
  parseMarkdownTable,
  serializeMarkdownTable,
  type StudioTableGrid,
} from '@/lib/studio/table-markdown';
import {
  displayTableCellValue,
  isTableFormula,
  tableCellRef,
} from '@/lib/studio/table-formulas';

type Props = {
  text: string;
  disabled?: boolean;
  onChange: (text: string) => void;
  labels?: {
    addRow: string;
    addCol: string;
    removeRow: string;
    source: string;
    formulaHint: string;
  };
};

export function StudioTableEditor({ text, disabled, onChange, labels }: Props) {
  const l = labels || {
    addRow: 'Linha',
    addCol: 'Coluna',
    removeRow: 'Apagar linha',
    source: 'Markdown',
    formulaHint: '=SUM(A2:A5)',
  };

  const grid = useMemo(() => parseMarkdownTable(text) || parseMarkdownTable(defaultTableMarkdown())!, [text]);
  const [showSource, setShowSource] = useState(false);

  function commit(next: StudioTableGrid) {
    onChange(serializeMarkdownTable(next));
  }

  function updateCell(r: number, c: number, value: string) {
    const rows = grid.rows.map((row, ri) =>
      ri === r ? row.map((cell, ci) => (ci === c ? value : cell)) : row,
    );
    commit({ ...grid, rows });
  }

  function updateHeader(c: number, value: string) {
    const headers = grid.headers.map((h, i) => (i === c ? value : h));
    commit({ ...grid, headers });
  }

  function addRow() {
    commit({
      ...grid,
      rows: [...grid.rows, grid.headers.map(() => '')],
    });
  }

  function addCol() {
    commit({
      headers: [...grid.headers, `Col ${grid.headers.length + 1}`],
      rows: grid.rows.map((r) => [...r, '']),
    });
  }

  function removeRow(r: number) {
    if (grid.rows.length <= 1) return;
    commit({ ...grid, rows: grid.rows.filter((_, i) => i !== r) });
  }

  if (showSource) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{l.source}</span>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setShowSource(false)}
            className="text-[10px] font-semibold text-orange-700 hover:underline"
          >
            Grid
          </button>
        </div>
        <textarea
          value={text}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 font-mono text-xs text-slate-800"
          rows={6}
        />
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[280px] border-collapse text-sm">
        <thead>
          <tr className="bg-slate-50">
            {grid.headers.map((h, ci) => (
              <th key={ci} className="border-b border-slate-200 p-0">
                <input
                  type="text"
                  disabled={disabled}
                  value={h}
                  onChange={(e) => updateHeader(ci, e.target.value)}
                  className="w-full bg-transparent px-2 py-1.5 text-left text-xs font-bold text-slate-800 outline-none focus:bg-orange-50/50"
                />
              </th>
            ))}
            <th className="w-8 border-b border-slate-200" />
          </tr>
        </thead>
        <tbody>
          {grid.rows.map((row, ri) => (
            <tr key={ri} className="group/row hover:bg-slate-50/80">
              {grid.headers.map((_, ci) => (
                <td key={ci} className="border-b border-slate-100 p-0">
                  <input
                    type="text"
                    disabled={disabled}
                    value={row[ci] ?? ''}
                    title={
                      isTableFormula(row[ci] ?? '')
                        ? `${row[ci]} → ${displayTableCellValue(row[ci] ?? '', grid)}`
                        : tableCellRef(ri, ci)
                    }
                    onChange={(e) => updateCell(ri, ci, e.target.value)}
                    className={`w-full bg-transparent px-2 py-1.5 text-slate-800 outline-none focus:bg-orange-50/40 ${
                      isTableFormula(row[ci] ?? '') ? 'font-semibold text-emerald-800' : ''
                    }`}
                  />
                </td>
              ))}
              <td className="border-b border-slate-100 px-1">
                <button
                  type="button"
                  disabled={disabled || grid.rows.length <= 1}
                  title={l.removeRow}
                  onClick={() => removeRow(ri)}
                  className="rounded p-1 text-slate-300 opacity-0 hover:bg-red-50 hover:text-red-600 group-hover/row:opacity-100 disabled:opacity-30"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-2 py-1.5">
        <button
          type="button"
          disabled={disabled}
          onClick={addRow}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-orange-50 hover:text-orange-800"
        >
          <Plus className="h-3 w-3" /> {l.addRow}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={addCol}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-orange-50 hover:text-orange-800"
        >
          <Plus className="h-3 w-3" /> {l.addCol}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setShowSource(true)}
          className="ml-auto text-[10px] font-semibold text-slate-400 hover:text-slate-600"
        >
          {l.source}
        </button>
        <span className="text-[10px] text-slate-400">{l.formulaHint}</span>
      </div>
    </div>
  );
}
