'use client';

import { useMemo } from 'react';
import type { ReportCanvasState } from '@/lib/siep/report-canvas-types';
import { updateCanvasRegion } from '@/lib/siep/report-canvas-builder';
import { FieldInstructionHint } from '@/components/siep/FieldInstructionHint';
import { InformeStructureToolbar } from '@/components/siep/InformeStructureToolbar';
import { useSiepT } from '@/lib/siep/use-siep-t';

type Props = {
  canvas: ReportCanvasState;
  onChange: (canvas: ReportCanvasState) => void;
  editableStructure?: boolean;
};

function colLabel(c: number): string {
  let n = c;
  let s = '';
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

export function ExcelReportCanvas({ canvas, onChange, editableStructure }: Props) {
  const st = useSiepT();
  const sheets = useMemo(() => {
    const map = new Map<string, typeof canvas.regions>();
    for (const r of canvas.regions) {
      const sn = r.sheet || 'Sheet1';
      if (!map.has(sn)) map.set(sn, []);
      map.get(sn)!.push(r);
    }
    return [...map.entries()];
  }, [canvas.regions]);

  const patch = (next: ReportCanvasState) => onChange(next);

  const updateCell = (id: string, text: string) => {
    patch(updateCanvasRegion(canvas, id, { text }));
  };

  const updateMeta = (id: string, meta: { label?: string; instruction?: string }) => {
    patch(updateCanvasRegion(canvas, id, meta));
  };

  return (
    <div className="p-4 space-y-6">
      {editableStructure && <InformeStructureToolbar canvas={canvas} onChange={patch} />}

      {sheets.map(([sheetName, regions]) => {
        const maxRow = Math.max(...regions.map((r) => r.row ?? 0), 0);
        const maxCol = Math.max(...regions.map((r) => r.col ?? 0), 0);
        const byKey = new Map(regions.map((r) => [`${r.row}-${r.col}`, r]));

        return (
          <div key={sheetName}>
            <p className="text-xs font-semibold text-indigo-700 mb-2">{sheetName}</p>
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="text-xs border-collapse min-w-full">
                <thead>
                  <tr>
                    <th className="w-8 bg-slate-50 border border-slate-200" />
                    {Array.from({ length: maxCol + 1 }, (_, c) => (
                      <th key={c} className="px-2 py-1 bg-slate-50 border border-slate-200 font-medium text-slate-500">
                        {colLabel(c)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: maxRow + 1 }, (_, row) => (
                    <tr key={row}>
                      <td className="px-1 py-0.5 bg-slate-50 border border-slate-200 text-center text-slate-400">
                        {row + 1}
                      </td>
                      {Array.from({ length: maxCol + 1 }, (_, col) => {
                        const region = byKey.get(`${row}-${col}`);
                        if (!region) {
                          return <td key={col} className="border border-slate-100 bg-slate-50/30 min-w-[4rem]" />;
                        }
                        return (
                          <td
                            key={col}
                            className={`border border-slate-200 p-0 min-w-[6rem] align-top ${
                              region.missing ? 'bg-amber-50' : 'bg-white'
                            }`}
                          >
                            {editableStructure ? (
                              <>
                                <input
                                  value={region.label || ''}
                                  onChange={(e) => updateMeta(region.id, { label: e.target.value })}
                                  className="w-full px-1.5 pt-1 text-[9px] text-slate-500 border-b border-dashed border-slate-200 bg-transparent"
                                  placeholder={st('siep.informe.structure.cellLabel')}
                                />
                                <div className="px-1 flex items-center gap-1">
                                  <FieldInstructionHint instruction={region.instruction} />
                                  <button
                                    type="button"
                                    className="text-[9px] text-slate-400 hover:text-amber-600"
                                    onClick={() => {
                                      const next = window.prompt('Instrução (!):', region.instruction || '');
                                      if (next != null) updateMeta(region.id, { instruction: next });
                                    }}
                                  >
                                    +!
                                  </button>
                                </div>
                              </>
                            ) : (
                              region.label && (
                                <div className="px-1.5 pt-1 text-[9px] text-slate-500 leading-tight line-clamp-2 flex items-start gap-0.5">
                                  <span>{region.label}</span>
                                  <FieldInstructionHint instruction={region.instruction} />
                                </div>
                              )
                            )}
                            <input
                              value={region.text}
                              onChange={(e) => updateCell(region.id, e.target.value)}
                              className="w-full px-1.5 py-1 bg-transparent text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300"
                              placeholder="…"
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
