import 'server-only';

import { prisma } from '@/lib/prisma';
import { COMPANY_SECTORS, type CompanyContextSetup } from '@/lib/company-context-setup';
import { readCoalition } from '@/lib/fundhub/coalition-memory';
import type { ExecutionPassportPayload } from '@/lib/fundhub/passport-types';

export type { ExecutionPassportPayload } from '@/lib/fundhub/passport-types';

type PassportSignals = {
  orgProfile: boolean;
  captureProfile: boolean;
  activeProjects: boolean;
  savedFunds: boolean;
  proposals: boolean;
  partners: boolean;
  compliance: boolean;
};

function readinessFromSignals(s: PassportSignals): number {
  const hit = Object.values(s).filter(Boolean).length;
  return Math.round((hit / Object.values(s).length) * 100);
}

function parseContextSetup(raw: unknown): CompanyContextSetup | null {
  if (!raw || typeof raw !== 'object') return null;
  const v = (raw as { v?: unknown }).v;
  if (v !== 1) return null;
  return raw as CompanyContextSetup;
}

function sectorLabel(sectorId: string | undefined): string | null {
  if (!sectorId) return null;
  const found = COMPANY_SECTORS.find((s) => s.id === sectorId);
  return found?.label.en ?? sectorId;
}

function mapCompanyProfile(row: {
  name: string;
  shortName: string;
  description: string | null;
  incorporationCountry: string | null;
  currency: string;
  businessActivity: string | null;
  contextSetupJson: unknown;
}): ExecutionPassportPayload['company'] {
  const ctx = parseContextSetup(row.contextSetupJson);
  const sector =
    row.businessActivity?.trim() ||
    sectorLabel(ctx?.sectorId) ||
    null;
  const country = row.incorporationCountry?.trim() || ctx?.countryPrimary?.trim() || null;

  return {
    name: row.name,
    shortName: row.shortName,
    description: row.description,
    country,
    currency: row.currency,
    sector,
    website: null,
  };
}

export async function buildExecutionPassport(
  companyId: string,
  opts?: { publicView?: boolean },
): Promise<ExecutionPassportPayload | null> {
  const [
    company,
    captureProfile,
    proposalGroups,
    savedFundsCount,
    partnersCount,
    complianceCount,
    activeProjectsCount,
    recentProposals,
    coalition,
  ] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      select: {
        name: true,
        shortName: true,
        description: true,
        incorporationCountry: true,
        currency: true,
        businessActivity: true,
        contextSetupJson: true,
      },
    }),
    prisma.fundingCaptureProfile.findUnique({ where: { companyId } }),
    prisma.proposal.groupBy({
      by: ['status'],
      where: { companyId, deletedAt: null },
      _count: { _all: true },
    }),
    prisma.fund.count({
      where: { companyId, userStatus: { some: { status: 'saved' } } },
    }),
    prisma.fundhubPartner.count({ where: { companyId, isActive: true } }),
    prisma.fundhubComplianceChecklist.count({ where: { companyId } }),
    prisma.project.count({
      where: { companyId, isActive: true, status: { not: 'CANCELLED' } },
    }),
    prisma.proposal.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      take: opts?.publicView ? 3 : 5,
      select: {
        title: true,
        status: true,
        fund: { select: { name: true, institution: true, deadline: true } },
      },
    }),
    readCoalition(companyId),
  ]);

  if (!company) return null;

  const companyProfile = mapCompanyProfile(company);

  const proposalsByStatus = Object.fromEntries(
    proposalGroups.map((g) => [g.status, g._count._all]),
  ) as Record<string, number>;

  const signals: PassportSignals = {
    orgProfile: Boolean(
      companyProfile.description?.trim() ||
        companyProfile.sector?.trim() ||
        companyProfile.country?.trim(),
    ),
    captureProfile: Boolean(captureProfile),
    activeProjects: activeProjectsCount > 0,
    savedFunds: savedFundsCount > 0,
    proposals: (proposalsByStatus.draft ?? 0) + (proposalsByStatus.submitted ?? 0) > 0,
    partners: partnersCount > 0,
    compliance: complianceCount > 0,
  };

  const themes = captureProfile?.themesCsv?.split(',').map((s) => s.trim()).filter(Boolean) ?? [];
  const countries = captureProfile?.countriesCsv?.split(',').map((s) => s.trim()).filter(Boolean) ?? [];

  return {
    company: companyProfile,
    captureProfile: captureProfile
      ? {
          subscriptionTier: captureProfile.subscriptionTier,
          themes,
          countries,
          crossEtholysOptIn: captureProfile.crossEtholysOptIn,
        }
      : null,
    stats: {
      readinessScore: readinessFromSignals(signals),
      signals,
      activeProjects: activeProjectsCount,
      savedFunds: savedFundsCount,
      partners: partnersCount,
      complianceChecklists: complianceCount,
      proposals: proposalsByStatus,
    },
    recentProposals,
    coalition: coalition.members.map((m) => ({
      orgName: m.orgName,
      country: m.country,
      role: m.role,
    })),
    generatedAt: new Date().toISOString(),
  };
}
