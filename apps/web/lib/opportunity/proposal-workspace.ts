/** Client-safe helpers to open a FundHub proposal from a known fund or a manual edital. */

export const PROPOSAL_CANDIDATE_KEY = 'opportunityProposalCandidate';
export const SELECTED_FUND_KEY = 'selectedFund';

export type ProposalFundSeed = {
  id: string;
  name: string;
  institution?: string | null;
  description?: string | null;
  linkOficial?: string | null;
  callUrl?: string | null;
  institutionUrl?: string | null;
  documents?: Array<{ title: string; url: string; kind?: string }>;
  sourceExcerpt?: string | null;
  basesText?: string | null;
  eligibilityCriteria?: string | null;
  whoCanApply?: string | null;
  eligibility?: string | null;
  requirements?: string | null;
  howToApply?: string | null;
  risksCaveats?: string | null;
  deadline?: string | Date | null;
  countries?: string | null;
  amount?: number | null;
  currency?: string | null;
  type?: string | null;
  category?: string | null;
  notes?: string | null;
  summary?: string | null;
  matchJustification?: string | null;
};

export type ProposalIntakeRecord = {
  workspaceId: string;
  fundId: string;
  fundName: string;
  fundInstitution: string;
  editalLink: string;
  intakeNotes: string;
  attachedFiles?: Array<{
    name: string;
    type: string;
    size: number;
    uploadedAt: string;
  }>;
  seedSource?: 'fund' | 'candidate' | 'manual';
  sourceExcerpt?: string;
  basesText?: string;
  documents?: Array<{ title: string; url: string; kind?: string }>;
  stage?: 'understand' | 'write';
};

export type ProposalDraftIndex = {
  workspaceId: string;
  fundId: string;
  title?: string;
  fundName: string;
  fundInstitution: string;
  editalLink: string;
  editalSummary: string;
  createdAt: string;
  updatedAt: string;
  status: 'draft' | 'submitted' | 'archived';
};

export function formatDeadlineLabel(raw: string | Date | null | undefined): string {
  if (!raw) return '';
  const d = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(d.getTime())) return String(raw);
  return d.toLocaleDateString('pt-BR');
}

export function buildEditalSummaryFromSeed(seed: ProposalFundSeed): string {
  const amount =
    seed.amount != null && Number.isFinite(Number(seed.amount))
      ? `${seed.currency || 'USD'} ${Number(seed.amount).toLocaleString('pt-BR')}`
      : '';
  const deadline = formatDeadlineLabel(seed.deadline);
  const blocks: Array<[string, string | null | undefined]> = [
    ['Descrição', seed.description || seed.summary],
    ['Quem pode candidatar', seed.whoCanApply],
    ['Elegibilidade', seed.eligibility || seed.eligibilityCriteria],
    ['Requisitos', seed.requirements],
    ['Como candidatar', seed.howToApply],
    ['Riscos / avisos', seed.risksCaveats],
    ['Prazo', deadline],
    ['Países', seed.countries],
    ['Montante', amount],
    ['Tipo', seed.type],
    ['Categoria', seed.category],
    ['Notas', seed.notes],
    ['Encaixe', seed.matchJustification],
    ['Página da convocatória', seed.callUrl || seed.linkOficial],
    [
      'Documentos oficiais',
      seed.documents?.length
        ? seed.documents.map((d) => `${d.title}: ${d.url}`).join('\n')
        : undefined,
    ],
    ['Texto das bases', seed.basesText || seed.sourceExcerpt],
  ];
  return blocks
    .filter(([, value]) => Boolean(String(value ?? '').trim()))
    .map(([label, value]) => `${label}:\n${String(value).trim()}`)
    .join('\n\n');
}

/** Skip the empty "Cole o link do edital" gate when the fund/candidate already has substance. */
export function shouldSkipProposalIntake(opts: {
  fundId?: string | null;
  fund?: ProposalFundSeed | null;
  candidate?: { name?: string | null; linkOficial?: string | null; description?: string | null } | null;
}): boolean {
  const fundId = String(opts.fundId ?? '').trim();
  if (fundId && !fundId.startsWith('adhoc-')) return true;

  const candidate = opts.candidate;
  if (
    candidate?.name?.trim() &&
    (candidate.linkOficial?.trim() || candidate.description?.trim())
  ) {
    return true;
  }

  const fund = opts.fund;
  if (!fund?.id || fund.id.startsWith('adhoc-')) return false;
  return Boolean(
    fund.description?.trim() ||
      fund.linkOficial?.trim() ||
      fund.eligibilityCriteria?.trim() ||
      fund.eligibility?.trim() ||
      fund.whoCanApply?.trim() ||
      fund.summary?.trim(),
  );
}

export function seedFromCandidate(candidate: ProposalFundSeed & { tempId?: string }): ProposalFundSeed {
  const id = candidate.id?.trim() || (candidate.tempId ? `candidate:${candidate.tempId}` : `candidate:${Date.now()}`);
  return { ...candidate, id };
}

export function findReusableDraft(
  drafts: ProposalDraftIndex[],
  fundId: string,
): ProposalDraftIndex | undefined {
  const id = fundId.trim();
  if (!id || id.startsWith('adhoc-')) return undefined;
  return drafts.find((d) => d.fundId === id && d.status === 'draft');
}

export function createProposalWorkspaceId(fundId: string): string {
  return `workspace:${fundId || 'adhoc'}:${Date.now()}`;
}

export function buildProposalIntake(
  workspaceId: string,
  seed: ProposalFundSeed,
  extras?: { notes?: string; files?: ProposalIntakeRecord['attachedFiles']; source?: ProposalIntakeRecord['seedSource'] },
): ProposalIntakeRecord {
  return {
    workspaceId,
    fundId: seed.id,
    fundName: seed.name,
    fundInstitution: seed.institution || '',
    editalLink: seed.callUrl?.trim() || seed.linkOficial?.trim() || '',
    intakeNotes: extras?.notes?.trim() || buildEditalSummaryFromSeed(seed),
    attachedFiles: extras?.files,
    seedSource: extras?.source ?? (seed.id.startsWith('adhoc-') ? 'manual' : seed.id.startsWith('candidate:') ? 'candidate' : 'fund'),
    sourceExcerpt: seed.sourceExcerpt?.trim()?.slice(0, 8000) || undefined,
    basesText: seed.basesText?.trim()?.slice(0, 12_000) || undefined,
    documents: seed.documents,
    stage: 'understand',
  };
}

export function persistProposalIntake(intake: ProposalIntakeRecord): void {
  localStorage.setItem(`proposalIntake:${intake.workspaceId}`, JSON.stringify(intake));
}

export function editorHref(workspaceId: string, fundId?: string | null): string {
  const qs = new URLSearchParams({ workspace: workspaceId });
  if (fundId) qs.set('fundId', fundId);
  return `/hub/fundhub/proposals/editor?${qs.toString()}`;
}

export function sectionsFromMarkdown(md: string): Array<{ id: string; title: string; content: string }> {
  const text = md.replace(/\r\n/g, '\n').trim();
  if (!text) return [];
  const parts = text.split(/^##\s+/m);
  const sections: Array<{ id: string; title: string; content: string }> = [];
  const lead = (parts[0] ?? '').trim();
  if (lead && !lead.startsWith('# ') && parts.length === 1) {
    return [{ id: 'section-0', title: 'Proposta', content: lead }];
  }
  if (lead.startsWith('# ')) {
    const title = lead.replace(/^#\s+/, '').split('\n')[0]?.trim() || 'Proposta';
    const rest = lead.split('\n').slice(1).join('\n').trim();
    if (rest) sections.push({ id: 'section-title', title, content: rest });
  }
  parts.slice(1).forEach((block, index) => {
    const nl = block.indexOf('\n');
    const title = (nl === -1 ? block : block.slice(0, nl)).trim() || `Secção ${index + 1}`;
    const content = (nl === -1 ? '' : block.slice(nl + 1)).trim();
    sections.push({ id: `section-${index}`, title, content });
  });
  return sections;
}

export function seedUnderstandMarkdown(seed: ProposalFundSeed, briefing?: string): string {
  const title = seed.name?.trim() || 'Proposta';
  const brief = briefing?.trim()
    ? briefing.trim()
    : 'A IA está a ler a convocatória oficial. A postulação começa só depois desta leitura.';
  const eligibility = [seed.whoCanApply, seed.eligibility || seed.eligibilityCriteria, seed.requirements, seed.howToApply]
    .filter((s) => Boolean(String(s ?? '').trim()))
    .join('\n\n');
  const bases = String(seed.basesText || seed.sourceExcerpt || '').trim();
  const parts = [`# ${title}`, `## Leitura do edital\n\n${brief}`];
  if (eligibility) parts.push(`## Elegibilidade e requisitos\n\n${eligibility}`);
  if (bases) {
    const clip = bases.length > 4500 ? `${bases.slice(0, 4500).trim()}…` : bases;
    parts.push(`## Bases oficiais (citar; não inventar)\n\n${clip}`);
  }
  return parts.join('\n\n');
}

export function appendWriteSections(md: string): string {
  const text = md.trim();
  const hasIdea = /^##\s+Ideia geral\b/im.test(text);
  const hasDraft = /^##\s+Rascunho\b/im.test(text);
  const extra = [
    hasIdea ? '' : '## Ideia geral\n\n',
    hasDraft ? '' : '## Rascunho\n\n',
  ]
    .filter(Boolean)
    .join('\n');
  return extra ? `${text}\n\n${extra}` : text;
}

export function seedDocumentMarkdown(seed: ProposalFundSeed, brainstorm?: string): string {
  const title = seed.name?.trim() || 'Proposta';
  const idea = brainstorm?.trim()
    ? brainstorm.trim()
    : 'A IA está a preparar uma ideia geral para este fundo e o perfil da organização.';
  const eligibility = [seed.whoCanApply, seed.eligibility || seed.eligibilityCriteria, seed.requirements, seed.howToApply]
    .filter((s) => Boolean(String(s ?? '').trim()))
    .join('\n\n');
  const bases = String(seed.basesText || seed.sourceExcerpt || '').trim();
  const parts = [`# ${title}`, `## Ideia geral\n\n${idea}`];
  if (eligibility) parts.push(`## Elegibilidade e requisitos\n\n${eligibility}`);
  if (bases) {
    const clip = bases.length > 4500 ? `${bases.slice(0, 4500).trim()}…` : bases;
    parts.push(`## Bases oficiais (citar; não inventar)\n\n${clip}`);
  }
  parts.push('## Rascunho\n\n');
  return parts.join('\n\n');
}
