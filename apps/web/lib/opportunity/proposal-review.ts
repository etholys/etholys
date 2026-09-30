/** Estado de revisão formal da proposta (R3). */

export type ProposalReviewStatus =
  | 'draft'
  | 'in_review'
  | 'approved'
  | 'changes_requested';

export const PROPOSAL_REVIEW_STATUSES: ProposalReviewStatus[] = [
  'draft',
  'in_review',
  'approved',
  'changes_requested',
];

export function isProposalReviewStatus(v: unknown): v is ProposalReviewStatus {
  return typeof v === 'string' && (PROPOSAL_REVIEW_STATUSES as string[]).includes(v);
}

export function reviewStatusLabel(status: ProposalReviewStatus, locale: string): string {
  const map: Record<ProposalReviewStatus, { pt: string; es: string; en: string }> = {
    draft: { pt: 'Rascunho', es: 'Borrador', en: 'Draft' },
    in_review: { pt: 'Em revisão', es: 'En revisión', en: 'In review' },
    approved: { pt: 'Aprovada', es: 'Aprobada', en: 'Approved' },
    changes_requested: { pt: 'Alterações pedidas', es: 'Cambios pedidos', en: 'Changes requested' },
  };
  const row = map[status];
  if (locale === 'pt') return row.pt;
  if (locale === 'en') return row.en;
  return row.es;
}

export function parseReviewStatus(raw: unknown): ProposalReviewStatus {
  if (isProposalReviewStatus(raw)) return raw;
  return 'draft';
}
