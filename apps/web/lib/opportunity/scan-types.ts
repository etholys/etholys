export const OPPORTUNITY_KINDS = ['grant', 'credit', 'alliance', 'local_expert'] as const;
export type OpportunityKind = (typeof OPPORTUNITY_KINDS)[number];

export const SCAN_FOCUS_VALUES = ['open_now', 'reference'] as const;
export type ScanFocus = (typeof SCAN_FOCUS_VALUES)[number];

export const AVAILABILITY_STATUSES = ['open_now', 'rolling', 'seasonal', 'closed', 'reference'] as const;
export type AvailabilityStatus = (typeof AVAILABILITY_STATUSES)[number];

export type OpportunityBriefing = {
  themes: string[];
  countries: string[];
  kinds: OpportunityKind[];
  amountMin?: number;
  amountMax?: number;
  notes?: string;
  /** Instruções persistentes para afinar varreduras futuras. */
  searchFeedback?: string;
};

export type ScanCandidate = {
  tempId: string;
  name: string;
  institution: string;
  type: string;
  category?: string;
  description?: string;
  linkOficial?: string;
  amount?: number;
  currency?: string;
  deadline?: string | null;
  countries?: string;
  sectors?: string;
  matchScore?: number;
  matchJustification?: string;
  sourceUrl?: string;
  /** open_now | rolling | seasonal | closed | reference */
  availabilityStatus?: AvailabilityStatus;
  opensAt?: string | null;
  closesAt?: string | null;
  /** Ex.: "Mar–Mai anualmente", "Rolling — candidaturas contínuas" */
  applicationWindow?: string;
  eligibleCountries?: string;
  availabilityNote?: string;
  scanFocus?: ScanFocus;
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
};

export type FundingSourceRef = {
  name: string;
  url: string;
  country?: string;
  tags?: string;
};
