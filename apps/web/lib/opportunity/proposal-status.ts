/** Pipeline de estado da proposta FundHub (expediente de candidatura). */

import { ui } from '@/lib/i18n';

export const PROPOSAL_STATUSES = [
  'draft',
  'submitted',
  'revision_requested',
  'resubmitted',
  'approved',
  'rejected',
  'withdrawn',
] as const;

export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

/** Tabs de filtro na lista — chaves estáveis. */
export const PROPOSAL_STATUS_FILTERS = [
  'all',
  'draft',
  'in_progress',
  'approved',
  'closed',
] as const;

export type ProposalStatusFilter = (typeof PROPOSAL_STATUS_FILTERS)[number];

const NEXT: Record<ProposalStatus, ProposalStatus[]> = {
  draft: ['submitted', 'withdrawn'],
  submitted: ['revision_requested', 'approved', 'rejected', 'withdrawn'],
  revision_requested: ['resubmitted', 'withdrawn'],
  resubmitted: ['revision_requested', 'approved', 'rejected', 'withdrawn'],
  approved: ['withdrawn'],
  rejected: ['draft'],
  withdrawn: ['draft'],
};

export function isProposalStatus(v: unknown): v is ProposalStatus {
  return typeof v === 'string' && (PROPOSAL_STATUSES as readonly string[]).includes(v);
}

/** Aceita valores legados (`archived`, `won`) e normaliza. */
export function parseProposalStatus(raw: unknown): ProposalStatus {
  if (raw === 'archived') return 'withdrawn';
  if (raw === 'won') return 'approved';
  if (isProposalStatus(raw)) return raw;
  return 'draft';
}

export function proposalStatusLabel(status: ProposalStatus, locale: string | null | undefined): string {
  switch (status) {
    case 'draft':
      return ui(locale, 'Borrador', 'Rascunho', 'Draft');
    case 'submitted':
      return ui(locale, 'Enviada', 'Enviada', 'Submitted');
    case 'revision_requested':
      return ui(locale, 'Ajuste solicitado', 'Ajuste solicitado', 'Revision requested');
    case 'resubmitted':
      return ui(locale, 'Reenviada', 'Reenviada', 'Resubmitted');
    case 'approved':
      return ui(locale, 'Aprobada', 'Aprovada', 'Approved');
    case 'rejected':
      return ui(locale, 'Rechazada', 'Rejeitada', 'Rejected');
    case 'withdrawn':
      return ui(locale, 'Retirada', 'Retirada', 'Withdrawn');
    default:
      return ui(locale, 'Borrador', 'Rascunho', 'Draft');
  }
}

export function proposalStatusFilterLabel(
  filter: ProposalStatusFilter,
  locale: string | null | undefined,
): string {
  switch (filter) {
    case 'all':
      return ui(locale, 'Todas', 'Todas', 'All');
    case 'draft':
      return ui(locale, 'Borradores', 'Rascunhos', 'Drafts');
    case 'in_progress':
      return ui(locale, 'En curso', 'Em curso', 'In progress');
    case 'approved':
      return ui(locale, 'Aprobadas', 'Aprovadas', 'Approved');
    case 'closed':
      return ui(locale, 'Cerradas', 'Fechadas', 'Closed');
    default:
      return ui(locale, 'Todas', 'Todas', 'All');
  }
}

export function proposalMatchesStatusFilter(
  status: ProposalStatus,
  filter: ProposalStatusFilter,
): boolean {
  if (filter === 'all') return true;
  if (filter === 'draft') return status === 'draft';
  if (filter === 'approved') return status === 'approved';
  if (filter === 'in_progress') {
    return status === 'submitted' || status === 'revision_requested' || status === 'resubmitted';
  }
  return status === 'rejected' || status === 'withdrawn';
}

/** Classes Tailwind para badge (lista clara / chrome editor). */
export function proposalStatusBadgeClass(status: ProposalStatus, tone: 'light' | 'dark' = 'light'): string {
  if (tone === 'dark') {
    switch (status) {
      case 'draft':
        return 'bg-white/[0.06] text-amber-200/90 ring-1 ring-amber-400/20';
      case 'submitted':
      case 'resubmitted':
        return 'bg-white/[0.06] text-sky-200/85 ring-1 ring-sky-400/20';
      case 'revision_requested':
        return 'bg-white/[0.06] text-orange-200/85 ring-1 ring-orange-400/20';
      case 'approved':
        return 'bg-white/[0.06] text-emerald-200/85 ring-1 ring-emerald-400/20';
      case 'rejected':
        return 'bg-white/[0.06] text-red-200/80 ring-1 ring-red-400/20';
      case 'withdrawn':
        return 'bg-white/[0.04] text-white/50 ring-1 ring-white/10';
      default:
        return 'bg-white/[0.04] text-white/50 ring-1 ring-white/10';
    }
  }
  switch (status) {
    case 'draft':
      return 'bg-amber-50 text-amber-800 ring-1 ring-amber-200/80';
    case 'submitted':
    case 'resubmitted':
      return 'bg-sky-50 text-sky-800 ring-1 ring-sky-200/80';
    case 'revision_requested':
      return 'bg-orange-50 text-orange-800 ring-1 ring-orange-200/80';
    case 'approved':
      return 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/80';
    case 'rejected':
      return 'bg-red-50 text-red-800 ring-1 ring-red-200/80';
    case 'withdrawn':
      return 'bg-gray-50 text-gray-600 ring-1 ring-gray-200';
    default:
      return 'bg-gray-50 text-gray-600 ring-1 ring-gray-200';
  }
}

export function nextProposalStatuses(current: ProposalStatus): ProposalStatus[] {
  return NEXT[current] ?? ['submitted'];
}

/** Mapeamento leve → pipeline Em curso (Fund.pipelineStatus). */
export function proposalStatusToPipeline(
  status: ProposalStatus,
): 'submitted' | 'won' | 'lost' | null {
  if (status === 'submitted' || status === 'resubmitted') return 'submitted';
  if (status === 'approved') return 'won';
  if (status === 'rejected') return 'lost';
  return null;
}

export type ProposalStatusMeta = {
  statusNote?: string;
  statusChangedAt?: string;
};

export function parseStatusMeta(draft: Record<string, unknown> | null | undefined): ProposalStatusMeta {
  if (!draft) return {};
  const statusNote = typeof draft.statusNote === 'string' ? draft.statusNote.slice(0, 500) : undefined;
  const statusChangedAt =
    typeof draft.statusChangedAt === 'string' ? draft.statusChangedAt : undefined;
  return { statusNote, statusChangedAt };
}
