export const OPPORTUNITY_KINDS = ['grant', 'credit', 'alliance', 'local_expert'] as const;
export type OpportunityKind = (typeof OPPORTUNITY_KINDS)[number];

export const SCAN_FOCUS_VALUES = ['open_now', 'reference'] as const;
export type ScanFocus = (typeof SCAN_FOCUS_VALUES)[number];

export const AVAILABILITY_STATUSES = ['open_now', 'rolling', 'seasonal', 'closed', 'reference'] as const;
export type AvailabilityStatus = (typeof AVAILABILITY_STATUSES)[number];

/** Como a organização usa a oportunidade. */
export const OPPORTUNITY_CLASSIFICATIONS = ['direct', 'client_bridge', 'joint'] as const;
export type OpportunityClassification = (typeof OPPORTUNITY_CLASSIFICATIONS)[number];

export type OpportunityBriefing = {
  themes: string[];
  countries: string[];
  kinds: OpportunityKind[];
  amountMin?: number;
  amountMax?: number;
  notes?: string;
  /** Instruções persistentes / orientação profunda para a IA. */
  searchFeedback?: string;
  /** Nome da varredura / perfil activo. */
  scanName?: string;
  /** Classificações a procurar nesta varredura. */
  classifications?: OpportunityClassification[];
  /** Empresas privadas elegíveis. */
  privateEligible?: boolean;
  /** Preferir não reembolsável (grant). */
  reimbursable?: boolean;
};

export type ScanProfile = {
  id: string;
  name: string;
  briefing: OpportunityBriefing;
  classifications: OpportunityClassification[];
  updatedAt: string;
};

export type CallDocument = {
  title: string;
  url: string;
  kind?: 'pdf' | 'doc' | 'sheet' | 'zip' | 'other';
};

export type ScanCandidate = {
  tempId: string;
  name: string;
  institution: string;
  type: string;
  category?: string;
  /** Resumo substantivo (2–4 parágrafos) — o que financia e contexto operacional. */
  description?: string;
  /** Quem pode candidatar (tipo de org, privado/público, consórcios…). */
  whoCanApply?: string;
  /** Critérios de elegibilidade-chave (geografia, porte, cofinanciamento…). */
  eligibility?: string;
  /** Requisitos operacionais (documentos, match %, idioma, regras). */
  requirements?: string;
  /** Como candidatar / próximos passos se conhecidos. */
  howToApply?: string;
  /** Riscos, contrapartidas ou incertezas — sem inventar. */
  risksCaveats?: string;
  /** Site da instituição (homepage). */
  linkOficial?: string;
  /** Página da convocatória / edital — preferir este ao homepage. */
  callUrl?: string;
  /** Homepage da instituição se distinta da convocatória. */
  institutionUrl?: string;
  /** Anexos oficiais (PDF, Word, Excel) extraídos da página da convocatória. */
  documents?: CallDocument[];
  /** Texto extraído da página oficial — contexto para a IA. */
  sourceExcerpt?: string;
  amount?: number;
  currency?: string;
  deadline?: string | null;
  countries?: string;
  sectors?: string;
  matchScore?: number;
  matchJustification?: string;
  sourceUrl?: string;
  availabilityStatus?: AvailabilityStatus;
  opensAt?: string | null;
  closesAt?: string | null;
  applicationWindow?: string;
  eligibleCountries?: string;
  availabilityNote?: string;
  scanFocus?: ScanFocus;
  /** Classificação sugerida pela IA. */
  classification?: OpportunityClassification;
  classificationNote?: string;
  /** Varredura de origem — necessário para validar depois de juntar o inbox. */
  runId?: string;
};

export type ScanResultsPayload = {
  runId: string;
  candidates: ScanCandidate[];
  savedTempIds: string[];
  discardedTempIds: string[];
  laterTempIds: string[];
  discoveryMode?: 'web' | 'knowledge';
  searchQueries?: string[];
  scanFocus?: ScanFocus;
  scanProfileId?: string;
  scanProfileName?: string;
};

export type FundingSourceRef = {
  name: string;
  url: string;
  country?: string;
  tags?: string;
};
