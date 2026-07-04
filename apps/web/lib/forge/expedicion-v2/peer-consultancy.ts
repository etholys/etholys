import { getForgeDb } from '@/lib/forge/db';
import { ensureLearnerJourney } from '@/lib/forge/learner-journey';
import { appendLedgerEntry } from '@/lib/forge/expedicion-v2/ledger';
import {
  mergeV2IntoMapState,
  v2FromJourneyMapState,
} from '@/lib/forge/expedicion-v2/player-state';

/** Acredita Eco ao colega que ajudou (modo individual). */
export async function creditPeerConsultancy(
  courseId: string,
  peerUserId: string,
  amount: number,
  payerName?: string
): Promise<void> {
  const journey = await ensureLearnerJourney(courseId, peerUserId);
  const mapState = (journey.mapState ?? {}) as Record<string, unknown>;
  let v2 = v2FromJourneyMapState(mapState);
  v2 = {
    ...v2,
    ledger: appendLedgerEntry(
      v2.ledger,
      payerName ? `Ayuda de consultoría (${payerName})` : 'Ayuda de consultoría — colega',
      'E',
      amount,
      { kind: 'consultancy_peer_in', from: payerName }
    ),
  };
  await getForgeDb().forgeLearnerJourney.update({
    where: { id: journey.id },
    data: { mapState: mergeV2IntoMapState(mapState, v2) as object },
  });
}
