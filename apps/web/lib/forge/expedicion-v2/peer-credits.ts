import type { ExpedicionV2PlayerState } from '@/lib/forge/expedicion-v2/types';

/** Registra crédito interno de mesa para o colega (ledger único da equipa). */
export function addTeamPeerCredit(
  v2: ExpedicionV2PlayerState,
  peerUserId: string,
  amount: number
): ExpedicionV2PlayerState {
  const peerCredits = { ...(v2.peerCredits ?? {}) };
  peerCredits[peerUserId] = (peerCredits[peerUserId] ?? 0) + amount;
  return { ...v2, peerCredits };
}
