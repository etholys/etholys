export const PIPELINE_STATUSES = ['decide', 'prepare', 'submitted', 'won', 'lost'] as const;
export type PipelineStatus = (typeof PIPELINE_STATUSES)[number];

export type FundHubDossier = {
  callUrl?: string;
  institutionUrl?: string;
  documents?: Array<{ title: string; url: string; kind?: string }>;
  sourceExcerpt?: string;
  basesText?: string;
  evidence?: { status?: string; verifiedAt?: string; documentCount?: number };
  fit?: { verdict?: string };
};

export type FundHubMeta = {
  pipelineStatus?: PipelineStatus;
  ownerUserId?: string;
  watchOpen?: boolean;
  dossier?: FundHubDossier;
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
      dossier: parseDossier(raw.dossier),
    };
  } catch {
    return {};
  }
}

function parseDossier(raw: unknown): FundHubDossier | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const documents = Array.isArray(o.documents)
    ? o.documents
        .filter((d): d is Record<string, unknown> => Boolean(d) && typeof d === 'object')
        .map((d) => ({
          title: String(d.title ?? 'Documento').slice(0, 160),
          url: String(d.url ?? '').slice(0, 800),
          kind: typeof d.kind === 'string' ? d.kind : undefined,
        }))
        .filter((d) => d.url)
        .slice(0, 12)
    : undefined;
  const evidence =
    o.evidence && typeof o.evidence === 'object'
      ? (o.evidence as FundHubDossier['evidence'])
      : undefined;
  const fit =
    o.fit && typeof o.fit === 'object' && typeof (o.fit as { verdict?: unknown }).verdict === 'string'
      ? { verdict: String((o.fit as { verdict: string }).verdict) }
      : undefined;
  return {
    callUrl: typeof o.callUrl === 'string' ? o.callUrl.slice(0, 800) : undefined,
    institutionUrl: typeof o.institutionUrl === 'string' ? o.institutionUrl.slice(0, 800) : undefined,
    documents,
    sourceExcerpt: typeof o.sourceExcerpt === 'string' ? o.sourceExcerpt.slice(0, 8000) : undefined,
    basesText: typeof o.basesText === 'string' ? o.basesText.slice(0, 16000) : undefined,
    evidence,
    fit,
  };
}

export function writeFundHubMeta(notes: string | null | undefined, patch: FundHubMeta): string {
  const current = parseFundHubMeta(notes);
  const next: FundHubMeta = { ...current };
  if (patch.pipelineStatus !== undefined) next.pipelineStatus = patch.pipelineStatus;
  if (patch.ownerUserId !== undefined) next.ownerUserId = patch.ownerUserId || undefined;
  if (patch.watchOpen !== undefined) next.watchOpen = patch.watchOpen;
  if (patch.dossier) next.dossier = { ...current.dossier, ...patch.dossier };
  const body = (notes ?? '').replace(MARK_RE, '').trim();
  const mark = `<!--fh:${JSON.stringify(next)}-->`;
  return body ? `${body}\n${mark}` : mark;
}

export function dossierFromCandidate(c: {
  callUrl?: string;
  institutionUrl?: string;
  documents?: FundHubDossier['documents'];
  sourceExcerpt?: string;
  basesText?: string;
  evidence?: FundHubDossier['evidence'];
  fit?: FundHubDossier['fit'];
}): FundHubDossier {
  return parseDossier({
    callUrl: c.callUrl,
    institutionUrl: c.institutionUrl,
    documents: c.documents,
    sourceExcerpt: c.sourceExcerpt,
    basesText: c.basesText,
    evidence: c.evidence,
    fit: c.fit ? { verdict: c.fit.verdict } : undefined,
  }) ?? {};
}

export function hydrateFundFromNotes<T extends { notes?: string | null }>(fund: T) {
  const meta = parseFundHubMeta(fund.notes);
  return {
    ...fund,
    pipelineStatus: meta.pipelineStatus ?? 'decide',
    watchOpen: Boolean(meta.watchOpen),
    ownerUserId: meta.ownerUserId ?? null,
    callUrl: meta.dossier?.callUrl,
    institutionUrl: meta.dossier?.institutionUrl,
    documents: meta.dossier?.documents,
    sourceExcerpt: meta.dossier?.sourceExcerpt,
    basesText: meta.dossier?.basesText,
    evidence: meta.dossier?.evidence,
    fit: meta.dossier?.fit,
  };
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
