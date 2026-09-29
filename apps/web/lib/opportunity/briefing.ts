import 'server-only';

import { prisma } from '@/lib/prisma';
import type {
  OpportunityBriefing,
  OpportunityKind,
  OrgKindForFunding,
  RevenueYear,
} from '@/lib/opportunity/scan-types';
import { OPPORTUNITY_KINDS } from '@/lib/opportunity/scan-types';

type PreferencesJson = {
  briefingNotes?: string;
  amountMin?: number;
  amountMax?: number;
  opportunityKinds?: string[];
  searchFeedback?: string;
  scanName?: string;
  classifications?: string[];
  privateEligible?: boolean;
  reimbursable?: boolean;
  orgKind?: string;
  legalCountries?: string[];
  yearsOperating?: number;
  maturityLevel?: string;
  hasAuditLast5Years?: boolean;
  auditYears?: number[];
  revenueByYear?: RevenueYear[];
};

const ORG_KINDS = new Set<OrgKindForFunding>([
  'ngo',
  'osc',
  'private',
  'public',
  'coop',
  'foundation',
  'other',
]);

function parseKinds(raw: string[] | undefined): OpportunityKind[] {
  if (!raw?.length) return ['grant', 'credit', 'alliance'];
  const set = new Set(OPPORTUNITY_KINDS);
  return raw.filter((k): k is OpportunityKind => set.has(k as OpportunityKind));
}

function splitCsv(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

function parseOrgKind(raw: unknown): OrgKindForFunding | undefined {
  if (typeof raw !== 'string') return undefined;
  const k = raw.trim().toLowerCase() as OrgKindForFunding;
  return ORG_KINDS.has(k) ? k : undefined;
}

function parseRevenue(raw: unknown): RevenueYear[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: RevenueYear[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const year = Number((row as RevenueYear).year);
    const amountUsd = Number((row as RevenueYear).amountUsd);
    if (!Number.isFinite(year) || year < 1990 || year > 2100) continue;
    if (!Number.isFinite(amountUsd) || amountUsd < 0) continue;
    out.push({ year: Math.round(year), amountUsd });
  }
  return out.slice(0, 5);
}

function inferOrgKind(entityType?: string | null): OrgKindForFunding | undefined {
  if (!entityType?.trim()) return undefined;
  const t = entityType.toLowerCase();
  if (/ong|ngo|nonprofit|sociedad civil|osc\b/.test(t)) return /osc/.test(t) ? 'osc' : 'ngo';
  if (/minister|public|gobierno|governo|municipal/.test(t)) return 'public';
  if (/coop/.test(t)) return 'coop';
  if (/fundac|foundation/.test(t)) return 'foundation';
  if (/empresa|private|srl|sa\b|ltd|pyme|sme/.test(t)) return 'private';
  return 'other';
}

export async function readOpportunityBriefing(companyId: string): Promise<OpportunityBriefing> {
  const [profile, company] = await Promise.all([
    prisma.fundingCaptureProfile.findUnique({ where: { companyId } }),
    prisma.company.findUnique({
      where: { id: companyId },
      select: { businessActivity: true, incorporationCountry: true, description: true, entityType: true },
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

  const legalCountries =
    Array.isArray(prefs.legalCountries) && prefs.legalCountries.length
      ? prefs.legalCountries.map(String).map((s) => s.trim()).filter(Boolean).slice(0, 20)
      : company?.incorporationCountry
        ? [company.incorporationCountry]
        : [];

  return {
    themes,
    countries,
    kinds: parseKinds(prefs.opportunityKinds),
    amountMin: prefs.amountMin,
    amountMax: prefs.amountMax,
    notes: prefs.briefingNotes || company?.description?.slice(0, 500) || undefined,
    searchFeedback: prefs.searchFeedback?.trim() || undefined,
    scanName: prefs.scanName?.trim() || undefined,
    classifications: Array.isArray(prefs.classifications)
      ? (prefs.classifications as OpportunityBriefing['classifications'])
      : undefined,
    privateEligible: prefs.privateEligible,
    reimbursable: prefs.reimbursable,
    entityType: company?.entityType ?? undefined,
    orgKind: parseOrgKind(prefs.orgKind) ?? inferOrgKind(company?.entityType),
    legalCountries,
    yearsOperating:
      typeof prefs.yearsOperating === 'number' && Number.isFinite(prefs.yearsOperating)
        ? Math.max(0, Math.min(200, Math.round(prefs.yearsOperating)))
        : undefined,
    maturityLevel:
      prefs.maturityLevel === 'early' ||
      prefs.maturityLevel === 'growing' ||
      prefs.maturityLevel === 'established'
        ? prefs.maturityLevel
        : undefined,
    hasAuditLast5Years:
      typeof prefs.hasAuditLast5Years === 'boolean' ? prefs.hasAuditLast5Years : undefined,
    auditYears: Array.isArray(prefs.auditYears)
      ? prefs.auditYears.map(Number).filter((y) => Number.isFinite(y)).slice(0, 5)
      : undefined,
    revenueByYear: parseRevenue(prefs.revenueByYear),
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
    scanName: briefing.scanName?.trim() || undefined,
    classifications: briefing.classifications,
    privateEligible: briefing.privateEligible,
    reimbursable: briefing.reimbursable,
    orgKind: briefing.orgKind,
    legalCountries: briefing.legalCountries?.slice(0, 20),
    yearsOperating: briefing.yearsOperating,
    maturityLevel: briefing.maturityLevel,
    hasAuditLast5Years: briefing.hasAuditLast5Years,
    auditYears: briefing.auditYears?.slice(0, 5),
    revenueByYear: briefing.revenueByYear?.slice(0, 5),
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

  if (briefing.entityType?.trim()) {
    await prisma.company
      .update({
        where: { id: companyId },
        data: { entityType: briefing.entityType.trim().slice(0, 120) },
      })
      .catch(() => {});
  }

  return readOpportunityBriefing(companyId);
}
