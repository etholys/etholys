import 'server-only';

import { prisma } from '@/lib/prisma';
import { COMPANY_SECTORS, type CompanyContextSetup } from '@/lib/company-context-setup';
import { formatSiepAtlasSummary } from '@/lib/opportunity/siep-atlas-summary';
import type { CompanyIdentityPayload } from '@/lib/fundhub/company-identity-types';

const ACTIVE_PROJECT_STATUSES = ['DRAFT', 'PLANNING', 'IN_PROGRESS', 'ON_HOLD'] as const;

export type { CompanyIdentityPayload };

function sectorFromContext(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object' || (raw as { v?: unknown }).v !== 1) return null;
  const ctx = raw as CompanyContextSetup;
  const ids = [...(ctx.sectorIds ?? []), ...(ctx.sectorId ? [ctx.sectorId] : [])];
  const labels: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    const found = COMPANY_SECTORS.find((s) => s.id === id);
    labels.push(found?.label.pt ?? id);
  }
  return labels.length ? labels.join(', ') : null;
}

export async function loadCompanyIdentity(companyId: string): Promise<CompanyIdentityPayload | null> {
  const [company, projects, activeCount] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        shortName: true,
        description: true,
        mission: true,
        vision: true,
        entityType: true,
        businessActivity: true,
        incorporationCountry: true,
        contextSetupJson: true,
      },
    }),
    prisma.project.findMany({
      where: {
        companyId,
        isActive: true,
        status: { in: [...ACTIVE_PROJECT_STATUSES] },
      },
      orderBy: { updatedAt: 'desc' },
      take: 8,
      select: { id: true, name: true, country: true, status: true },
    }),
    prisma.project.count({
      where: {
        companyId,
        isActive: true,
        status: { in: [...ACTIVE_PROJECT_STATUSES] },
      },
    }),
  ]);

  if (!company) return null;

  const sector = sectorFromContext(company.contextSetupJson);
  const atlas = {
    activity: company.businessActivity?.trim() || null,
    sector,
    entityType: company.entityType?.trim() || null,
    country: company.incorporationCountry?.trim() || null,
  };
  const siepProjects = projects.map((p) => ({
    id: p.id,
    name: p.name,
    country: p.country,
    status: p.status,
  }));

  return {
    company: {
      id: company.id,
      name: company.name,
      shortName: company.shortName,
      description: company.description ?? '',
      mission: company.mission ?? '',
      vision: company.vision ?? '',
      entityType: atlas.entityType,
      businessActivity: atlas.activity,
      incorporationCountry: atlas.country,
      sector,
    },
    siep: { activeCount, projects: siepProjects },
    atlas,
    siepAtlasSummary: formatSiepAtlasSummary({
      projects: siepProjects,
      activity: atlas.activity,
      sector: atlas.sector,
      entityType: atlas.entityType,
      country: atlas.country,
    }),
  };
}
