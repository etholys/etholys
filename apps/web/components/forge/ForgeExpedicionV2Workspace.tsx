'use client';

import { ForgeConstructionCanvas } from '@/components/forge/ForgeConstructionCanvas';
import { ForgeEcoLedger } from '@/components/forge/ForgeEcoLedger';
import { ForgeCapsulaReader } from '@/components/forge/ForgeCapsulaReader';
import { useExpedicionV2 } from '@/lib/forge/expedicion-v2/useExpedicionV2';
import { useForgeT } from '@/lib/forge/use-forge-t';
import { CAPSULAS_TECNICAS } from '@/lib/forge/expedicion-v2/capsulas-content';
import type { ExpedicionStationSlug } from '@/lib/forge/expedicion-station-decks';
import type { PostItType } from '@/lib/forge/expedicion-v2/types';

export function ForgeExpedicionV2Workspace({
  courseId,
  readOnly,
  roomId,
  teamPeers,
  myUserId,
}: {
  courseId: string;
  readOnly?: boolean;
  roomId?: string | null;
  teamPeers?: { userId: string; name: string }[];
  myUserId?: string;
}) {
  const ft = useForgeT();
  const { v2, patch, loading } = useExpedicionV2(courseId, { roomId });

  if (loading || !v2) {
    return <div className="rounded-xl bg-white/60 p-6 text-sm text-slate-500">{ft('forge.v2.loadingMap')}</div>;
  }

  return (
    <div className="space-y-4">
      <ForgeEcoLedger
        ledger={v2.ledger}
        peerCredits={v2.peerCredits}
        teamPeers={teamPeers}
        myUserId={myUserId}
        loanDisabled={readOnly}
        onRequestLoan={
          readOnly
            ? undefined
            : async () => {
                await patch({ action: 'green_loan' });
              }
        }
      />
      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase text-[#5B3E8C]">{ft('forge.v2.capsulasTitle')}</p>
        {CAPSULAS_TECNICAS.map((c) => (
          <ForgeCapsulaReader key={c.station} capsula={c} />
        ))}
      </div>
      <ForgeConstructionCanvas
        map={v2.constructionMap}
        readOnly={readOnly}
        onAddPostIt={async (station, type, text) => {
          await patch({ action: 'add_postit', station, type, text });
        }}
        onUpdatePostIt={async (id, patchBody) => {
          await patch({ action: 'update_postit', id, ...patchBody });
        }}
        onRemovePostIt={async (id) => {
          await patch({ action: 'remove_postit', id });
        }}
        onAddConnection={async (fromPostItId, toPostItId) => {
          await patch({ action: 'add_connection', fromPostItId, toPostItId });
        }}
      />
    </div>
  );
}

/** Registra movimiento Eco desde tablero / eventos */
export async function recordEcoMovement(
  courseId: string,
  description: string,
  entryType: 'E' | 'S',
  amount: number,
  meta?: Record<string, unknown>
) {
  await fetch(`/api/forge/courses/${courseId}/expedicion-v2`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'ledger_entry', description, entryType, amount, meta }),
  });
}

export type { ExpedicionStationSlug, PostItType };
