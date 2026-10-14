import type { SiepProjectSignal } from '@/lib/opportunity/siep-atlas-summary';

export type CompanyIdentityPayload = {
  company: {
    id: string;
    name: string;
    shortName: string;
    description: string;
    mission: string;
    vision: string;
    entityType: string | null;
    businessActivity: string | null;
    incorporationCountry: string | null;
    sector: string | null;
  };
  siep: {
    activeCount: number;
    projects: Array<SiepProjectSignal & { id: string }>;
  };
  atlas: {
    activity: string | null;
    sector: string | null;
    entityType: string | null;
    country: string | null;
  };
  siepAtlasSummary: string;
};
