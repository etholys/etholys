import 'server-only';

import { prisma } from '@/lib/prisma';
import type { OpportunityBriefing, OpportunityKind } from '@/lib/opportunity/scan-types';
import { OPPORTUNITY_KINDS } from '@/lib/opportunity/scan-types';

type PreferencesJson = {
  briefingNotes?: string;
  amountMin?: number;
  amountMax?: number;
  opportunityKinds?: string[];
  searchFeedback?: string;
};

function parseKinds(raw: string[] | undefined): OpportunityKind[] {
  if (!raw?.length) return ['grant', 'credit', 'alliance'];
  const set = new Set(OPPORTUNITY_KINDS);
  return raw.filter((k): k is OpportunityKind => set.has(k as OpportunityKind));
}

function splitCsv(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

export async function readOpportunityBriefing(companyId: string): Promise<OpportunityBriefing> {
  const [profile, company] = await Promise.all([
    prisma.fundingCaptureProfile.findUnique({ where: { companyId } }),
    prisma.company.findUnique({
      where: { id: companyId },
      select: { businessActivity: true, incorporationCountry: true, description: true },
    }),
  ]);

  let prefs: PreferencesJson = {};
  if (profile?.preferencesJson) {
    try {
      prefs = JSON.parse(profile.preferencesJson) as PreferencesJson;
    } catch {
      prefs = {};
    }
  }

  const themes = splitCsv(profile?.themesCsv);
  const countries = splitCsv(profile?.countriesCsv);
  if (!countries.length && company?.incorporationCountry) {
    countries.push(company.incorporationCountry);
  }
  if (!themes.length && company?.businessActivity) {
    themes.push(company.businessActivity);
  }

  return {
    themes,
    countries,
    kinds: parseKinds(prefs.opportunityKinds),
    amountMin: prefs.amountMin,
    amountMax: prefs.amountMax,
    notes: prefs.briefingNotes || company?.description?.slice(0, 500) || undefined,
    searchFeedback: prefs.searchFeedback?.trim() || undefined,
  };
}

export async function writeOpportunityBriefing(
  companyId: string,
  briefing: OpportunityBriefing,
): Promise<OpportunityBriefing> {
  const existing = await prisma.fundingCaptureProfile.findUnique({ where: { companyId } });
  const prefs: PreferencesJson = {
    briefingNotes: briefing.notes?.trim() || undefined,
    amountMin: briefing.amountMin,
    amountMax: briefing.amountMax,
    opportunityKinds: briefing.kinds,
    searchFeedback: briefing.searchFeedback?.trim() || undefined,
  };

  const data = {
    themesCsv: briefing.themes.join(', '),
    countriesCsv: briefing.countries.join(', '),
    fundTypesCsv: briefing.kinds.join(', '),
    preferencesJson: JSON.stringify(prefs),
  };

  if (existing) {
    await prisma.fundingCaptureProfile.update({ where: { companyId }, data });
  } else {
    await prisma.fundingCaptureProfile.create({
      data: { companyId, ...data },
    });
  }

  return briefing;
}
