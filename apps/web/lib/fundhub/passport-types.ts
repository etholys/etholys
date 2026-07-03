export type ExecutionPassportPayload = {
  company: {
    name: string;
    shortName: string | null;
    description: string | null;
    country: string | null;
    currency: string | null;
    sector: string | null;
    website: string | null;
  };
  captureProfile: {
    subscriptionTier: string;
    themes: string[];
    countries: string[];
    crossEtholysOptIn: boolean;
  } | null;
  stats: {
    readinessScore: number;
    signals: Record<string, boolean>;
    activeProjects: number;
    savedFunds: number;
    partners: number;
    complianceChecklists: number;
    proposals: Record<string, number>;
  };
  recentProposals: Array<{
    title: string;
    status: string;
    fund: { name: string; institution: string; deadline?: Date | string | null };
  }>;
  coalition: Array<{ orgName: string; country?: string; role: string }>;
  generatedAt: string;
};
