/** Converte eventos do motor do tabuleiro em lançamentos no ledger V2 */

export type LedgerDraft = {
  description: string;
  entryType: 'E' | 'S';
  amount: number;
  meta?: Record<string, unknown>;
};

export function ledgerDraftsFromBoardEvents(
  events: Array<{ type?: string; message?: string }>
): LedgerDraft[] {
  const drafts: LedgerDraft[] = [];
  for (const e of events) {
    const msg = e.message ?? '';
    switch (e.type) {
      case 'validated':
        drafts.push({
          description: 'Premio validación de carta',
          entryType: 'E',
          amount: 100,
          meta: { source: 'board', kind: 'validated' },
        });
        break;
      case 'skip':
        drafts.push({
          description: 'Carta pendiente / consultoría evitada',
          entryType: 'S',
          amount: 50,
          meta: { source: 'board', kind: 'skip' },
        });
        break;
      case 'penalty':
        drafts.push({
          description: 'Multa — carta de desafío',
          entryType: 'S',
          amount: 100,
          meta: { source: 'board', kind: 'penalty' },
        });
        break;
      case 'bonus': {
        const m = msg.match(/\+(\d+)\s*Eco/i);
        const amount = m ? Number(m[1]) : 50;
        drafts.push({
          description: 'Bono del tablero',
          entryType: 'E',
          amount,
          meta: { source: 'board', kind: 'bonus' },
        });
        break;
      }
      case 'v2_action':
        drafts.push({
          description: msg || 'Carta de Acción',
          entryType: 'E',
          amount: Number((e as { amount?: number }).amount) || 0,
          meta: { source: 'board', kind: 'v2_action' },
        });
        break;
      case 'v2_crisis':
        drafts.push({
          description: msg || 'Carta de Desafío',
          entryType: 'S',
          amount: Number((e as { amount?: number }).amount) || 200,
          meta: { source: 'board', kind: 'v2_crisis' },
        });
        break;
      default:
        break;
    }
  }
  return drafts.filter((d) => d.amount > 0);
}

/** Eventos do tabuleiro que concedem Puntos de Impacto (+1 por validación). */
export function impactPointsFromBoardEvents(
  events: Array<{ type?: string }>
): number {
  let pts = 0;
  for (const e of events) {
    if (e.type === 'validated') pts += 1;
  }
  return pts;
}

export async function applyLedgerDrafts(
  courseId: string,
  drafts: LedgerDraft[],
  roomId?: string | null
): Promise<void> {
  for (const d of drafts) {
    await fetch(`/api/forge/courses/${courseId}/expedicion-v2`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'ledger_entry',
        description: d.description,
        entryType: d.entryType,
        amount: d.amount,
        meta: d.meta,
        ...(roomId ? { roomId } : {}),
      }),
    });
  }
}
