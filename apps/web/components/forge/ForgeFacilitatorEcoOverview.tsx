'use client';

import { useCallback, useEffect, useState } from 'react';
import { Eye, Wallet } from 'lucide-react';
import { useForgeT } from '@/lib/forge/use-forge-t';
import type { FacilitatorLens } from '@/components/forge/ForgeFacilitatorLensBar';
import { cn } from '@/lib/utils';

type OverviewRow = {
  id: string;
  kind: 'team' | 'learner';
  name: string;
  phase: string;
  balance: number;
  postItCount: number;
  lastEntry?: { description: string; amount: number; type: 'E' | 'S' } | null;
  roomId?: string;
  userId?: string;
};

export function ForgeFacilitatorEcoOverview({
  courseId,
  lens,
  onLensChange,
  onGoToMesa,
  onDockTab,
}: {
  courseId: string;
  lens: FacilitatorLens;
  onLensChange: (lens: FacilitatorLens) => void;
  onGoToMesa?: () => void;
  onDockTab?: (tab: 'map' | 'eco') => void;
}) {
  const ft = useForgeT();
  const [rows, setRows] = useState<OverviewRow[]>([]);

  const load = useCallback(() => {
    fetch(`/api/forge/courses/${courseId}/expedicion-v2/overview`)
      .then((r) => r.json())
      .then((d) => {
        const teamRows: OverviewRow[] = (d.teams ?? []).map(
          (t: {
            roomId: string;
            name: string;
            phase?: string;
            balance?: number;
            postItCount?: number;
            lastEntry?: OverviewRow['lastEntry'];
          }) => ({
            id: t.roomId,
            kind: 'team' as const,
            name: t.name,
            phase: String(t.phase ?? 'lobby'),
            balance: Number(t.balance ?? 0),
            postItCount: Number(t.postItCount ?? 0),
            lastEntry: t.lastEntry ?? null,
            roomId: t.roomId,
          })
        );
        const learnerRows: OverviewRow[] = (d.learners ?? []).map(
          (l: {
            userId: string;
            name?: string;
            phase?: string;
            balance?: number;
            postItCount?: number;
            lastEntry?: OverviewRow['lastEntry'];
          }) => ({
            id: l.userId,
            kind: 'learner' as const,
            name: String(l.name ?? 'Jugador'),
            phase: String(l.phase ?? 'lobby'),
            balance: Number(l.balance ?? 0),
            postItCount: Number(l.postItCount ?? 0),
            lastEntry: l.lastEntry ?? null,
            userId: l.userId,
          })
        );
        setRows([...teamRows, ...learnerRows]);
      })
      .catch(() => setRows([]));
  }, [courseId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [load]);

  const selectRow = (row: OverviewRow, tab: 'map' | 'eco') => {
    if (row.kind === 'team' && row.roomId) {
      onLensChange({ kind: 'team', roomId: row.roomId, name: row.name });
    } else if (row.kind === 'learner' && row.userId) {
      onLensChange({ kind: 'learner', userId: row.userId, name: row.name });
    }
    onGoToMesa?.();
    onDockTab?.(tab);
  };

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-[#145A45]/15 bg-white px-3 py-2 text-[10px] text-[#145A45]/70">
        {ft('forge.v2.facEcoOverviewEmpty')}
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-[#145A45]/15 bg-white overflow-hidden">
      <div className="flex items-center gap-2 border-b border-[#145A45]/10 bg-[#F5F2EA] px-3 py-2">
        <Wallet className="h-3.5 w-3.5 text-[#2E5C9A]" />
        <span className="text-[10px] font-bold text-[#145A45]">{ft('forge.v2.facEcoOverviewTitle')}</span>
      </div>
      <div className="max-h-52 overflow-auto">
        <table className="w-full text-[10px]">
          <thead className="sticky top-0 bg-[#FAFAF7] text-[#145A45]/70">
            <tr>
              <th className="px-2 py-1.5 text-left font-bold">{ft('forge.v2.facEcoOverviewName')}</th>
              <th className="px-2 py-1.5 text-right font-bold">Eco</th>
              <th className="px-2 py-1.5 text-left font-bold hidden sm:table-cell">
                {ft('forge.v2.facEcoOverviewLast')}
              </th>
              <th className="px-2 py-1.5 text-right font-bold">{ft('forge.v2.facEcoOverviewActions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const active =
                (row.kind === 'team' && lens.kind === 'team' && lens.roomId === row.roomId) ||
                (row.kind === 'learner' && lens.kind === 'learner' && lens.userId === row.userId);
              return (
                <tr
                  key={`${row.kind}-${row.id}`}
                  className={cn('border-t border-[#145A45]/8', active && 'bg-[#E8F0FA]/60')}
                >
                  <td className="px-2 py-1.5">
                    <p className="font-bold text-[#1A3D5C] truncate max-w-[88px]">{row.name}</p>
                    <p className="text-[9px] text-[#145A45]/60">
                      {row.postItCount} post-its · {row.phase}
                    </p>
                  </td>
                  <td className="px-2 py-1.5 text-right font-black tabular-nums text-[#2E5C9A]">
                    {row.balance}
                  </td>
                  <td className="px-2 py-1.5 text-[#145A45]/80 hidden sm:table-cell max-w-[120px] truncate">
                    {row.lastEntry
                      ? `${row.lastEntry.type === 'S' ? '-' : '+'}${row.lastEntry.amount} ${row.lastEntry.description}`
                      : '—'}
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => selectRow(row, 'map')}
                        className="rounded border border-[#145A45]/20 px-1.5 py-0.5 font-bold text-[#145A45] hover:bg-[#F5F2EA]"
                        title={ft('forge.v2.facReviewMap')}
                      >
                        <Eye className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => selectRow(row, 'eco')}
                        className="rounded border border-[#2E5C9A]/25 px-1.5 py-0.5 font-bold text-[#2E5C9A] hover:bg-[#E8F0FA]"
                        title={ft('forge.v2.facReviewLedger')}
                      >
                        <Wallet className="h-3 w-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
