'use client';

import { useState } from 'react';
import { RotateCcw, Flag, Download } from 'lucide-react';
import { useForgeT } from '@/lib/forge/use-forge-t';
import { EXPEDICION_FAC_TOOLBAR } from '@/lib/forge/expedicion-v2/theme';
import { cn } from '@/lib/utils';

export function ForgeFacilitatorV2Controls({
  courseId,
  roomId,
  onAction,
  busy,
}: {
  courseId: string;
  roomId?: string | null;
  onAction: (action: string) => Promise<void>;
  busy?: boolean;
}) {
  const ft = useForgeT();
  const [confirmReset, setConfirmReset] = useState(false);

  const exportScores = () => {
    void fetch(`/api/forge/courses/${courseId}/expedicion-v2/overview`)
      .then((r) => r.json())
      .then((d) => {
        const rows = [
          ['tipo', 'nombre', 'fase', 'ciclos', 'eco', 'impacto', 'post-its', 'score'],
          ...(d.teams ?? []).map((t: Record<string, unknown>) =>
            [
              'equipo',
              t.name,
              t.phase,
              t.cyclesCompleted,
              t.balance,
              t.impactPoints ?? 0,
              t.postItCount,
              '',
            ].join(',')
          ),
          ...(d.learners ?? []).map((l: Record<string, unknown>) =>
            [
              'individual',
              l.name,
              l.phase,
              '',
              l.balance,
              l.impactPoints ?? 0,
              l.postItCount,
              l.finalScore ?? '',
            ].join(',')
          ),
        ];
        const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `expedicion-v2-${courseId.slice(0, 8)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      });
  };

  return (
    <div className={cn('flex flex-wrap gap-1.5 px-2 py-1.5', EXPEDICION_FAC_TOOLBAR)}>
      <button
        type="button"
        disabled={busy}
        onClick={() => void onAction('end_cycle')}
        className="inline-flex items-center gap-1 rounded bg-[#3D8B8B] px-2 py-1 text-[10px] font-bold text-white hover:bg-[#2D7070] disabled:opacity-50"
      >
        <Flag className="h-3 w-3" /> {ft('forge.v2.closeCycle')}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => void onAction('force_post_quiz')}
        className="inline-flex items-center gap-1 rounded bg-[#2E5C9A] px-2 py-1 text-[10px] font-bold text-white hover:bg-[#254D85] disabled:opacity-50"
      >
        {ft('forge.v2.forcePostQuiz')}
      </button>
      {!confirmReset ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => setConfirmReset(true)}
          className="inline-flex items-center gap-1 rounded border border-rose-300 bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-800 hover:bg-rose-100 disabled:opacity-50"
        >
          <RotateCcw className="h-3 w-3" /> {ft('forge.v2.reset')}
        </button>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            void onAction('reset_v2');
            setConfirmReset(false);
          }}
          className="inline-flex items-center gap-1 rounded bg-rose-700 px-2 py-1 text-[10px] font-bold text-white disabled:opacity-50"
        >
          {ft('forge.v2.confirmReset')}
        </button>
      )}
      <button
        type="button"
        onClick={exportScores}
        className="inline-flex items-center gap-1 rounded border border-[#145A45]/25 bg-[#F5F2EA] px-2 py-1 text-[10px] font-bold text-[#145A45] ml-auto hover:bg-[#E8E4D8]"
      >
        <Download className="h-3 w-3" /> {ft('forge.v2.exportCsv')}
      </button>
      {roomId && (
        <span className="w-full text-[9px] text-[#145A45]/60 truncate">
          {ft('forge.v2.tableLabel', { id: roomId.slice(0, 12) })}
        </span>
      )}
    </div>
  );
}
