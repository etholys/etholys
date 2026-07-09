'use client';

import { ForgeConstructionCanvas } from '@/components/forge/ForgeConstructionCanvas';
import { ForgeEcoLedger } from '@/components/forge/ForgeEcoLedger';
import { ForgeCapsulaReader } from '@/components/forge/ForgeCapsulaReader';
import { useExpedicionV2 } from '@/lib/forge/expedicion-v2/useExpedicionV2';
import { useForgeT } from '@/lib/forge/use-forge-t';
import { CAPSULAS_TECNICAS } from '@/lib/forge/expedicion-v2/capsulas-content';
import type { ExpedicionStationSlug } from '@/lib/forge/expedicion-station-decks';
import type { PostItType } from '@/lib/forge/expedicion-v2/types';
import { cn } from '@/lib/utils';

export function ForgeExpedicionV2Workspace({
  courseId,
  readOnly,
  roomId,
  teamPeers,
  myUserId,
  compact,
  dockTab = 'eco',
  observeUserId,
}: {
  courseId: string;
  readOnly?: boolean;
  roomId?: string | null;
  teamPeers?: { userId: string; name: string }[];
  myUserId?: string;
  /** Vista compacta integrada na mesa */
  compact?: boolean;
  dockTab?: 'map' | 'eco';
  /** Facilitador observa jornada individual */
  observeUserId?: string | null;
}) {
  const ft = useForgeT();
  const { v2, patch, loading } = useExpedicionV2(courseId, {
    roomId,
    observeUserId,
  });

  if (loading || !v2) {
    return (
      <div className={cn('rounded-xl bg-white/60 text-sm text-slate-500', compact ? 'p-3' : 'p-6')}>
        {ft('forge.v2.loadingMap')}
      </div>
    );
  }

  if (compact) {
    return (
      <div className="space-y-3">
        {(dockTab === 'eco') && (
          <ForgeEcoLedger
            ledger={v2.ledger}
            peerCredits={v2.peerCredits}
            teamPeers={teamPeers}
            myUserId={myUserId}
            loanDisabled={readOnly}
            compact
            onRequestLoan={
              readOnly
                ? undefined
                : async () => {
                    await patch({ action: 'green_loan' });
                  }
            }
          />
        )}
        {dockTab === 'map' && (
          <ForgeConstructionCanvas
            map={v2.constructionMap}
            readOnly={readOnly}
            compact
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
        )}
      </div>
    );
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
