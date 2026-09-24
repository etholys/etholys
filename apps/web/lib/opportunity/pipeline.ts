export const PIPELINE_STATUSES = ['decide', 'prepare', 'submitted', 'won', 'lost'] as const;
export type PipelineStatus = (typeof PIPELINE_STATUSES)[number];

export type FundHubMeta = {
  pipelineStatus?: PipelineStatus;
  ownerUserId?: string;
  watchOpen?: boolean;
};

const MARK_RE = /<!--fh:({[\s\S]*?})-->/;

export function isPipelineStatus(value: unknown): value is PipelineStatus {
  return typeof value === 'string' && (PIPELINE_STATUSES as readonly string[]).includes(value);
}

export function parseFundHubMeta(notes?: string | null): FundHubMeta {
  const m = notes?.match(MARK_RE);
  if (!m?.[1]) return {};
  try {
    const raw = JSON.parse(m[1]) as Record<string, unknown>;
    return {
      pipelineStatus: isPipelineStatus(raw.pipelineStatus) ? raw.pipelineStatus : undefined,
      ownerUserId: typeof raw.ownerUserId === 'string' ? raw.ownerUserId : undefined,
      watchOpen: typeof raw.watchOpen === 'boolean' ? raw.watchOpen : undefined,
    };
  } catch {
    return {};
  }
}

export function writeFundHubMeta(notes: string | null | undefined, patch: FundHubMeta): string {
  const current = parseFundHubMeta(notes);
  const next: FundHubMeta = { ...current, ...patch };
  const body = (notes ?? '').replace(MARK_RE, '').trim();
  const mark = `<!--fh:${JSON.stringify(next)}-->`;
  return body ? `${body}\n${mark}` : mark;
}

export function pipelineOf(notes?: string | null): PipelineStatus {
  return parseFundHubMeta(notes).pipelineStatus ?? 'decide';
}

export function isClosedPipeline(status: PipelineStatus): boolean {
  return status === 'won' || status === 'lost';
}

export function pipelineLabel(status: PipelineStatus, locale: string): string {
  const pt = locale === 'pt';
  const es = locale === 'es';
  switch (status) {
    case 'decide':
      return pt ? 'Decidir' : es ? 'Decidir' : 'Decide';
    case 'prepare':
      return pt ? 'Preparar' : es ? 'Preparar' : 'Prepare';
    case 'submitted':
      return pt ? 'Submetido' : es ? 'Enviado' : 'Submitted';
    case 'won':
      return pt ? 'Ganho' : es ? 'Ganado' : 'Won';
    case 'lost':
      return pt ? 'Perdido' : es ? 'Perdido' : 'Lost';
  }
}

export function pipelineFilterMatch(
  status: PipelineStatus,
  filter: 'all' | 'decide' | 'prepare' | 'submitted' | 'closed',
): boolean {
  if (filter === 'all') return true;
  if (filter === 'closed') return isClosedPipeline(status);
  return status === filter;
}
