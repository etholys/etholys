import { prisma } from '@/lib/prisma';
import type { CustomInformeDomain } from '@/lib/siep/informe-domains';
import { getOrCreateTemplatePackage } from '@/lib/siep/informe-template-store';

const INFORME_DOMAIN_CADENCE = 'informe_domain';

function newCustomDomainId(): `custom:${string}` {
  return `custom:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export async function listProjectCustomInformeDomains(projectId: string): Promise<CustomInformeDomain[]> {
  const rows = await prisma.mEReportPackage.findMany({
    where: { projectId, cadence: INFORME_DOMAIN_CADENCE, isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { domain: true, title: true, notes: true },
  });

  return rows
    .filter((r) => r.domain.startsWith('custom:'))
    .map((r) => ({
      id: r.domain as `custom:${string}`,
      label: r.title,
      intro: r.notes || '',
    }));
}

export async function createProjectCustomInformeDomain(
  projectId: string,
  input: { label: string; intro?: string },
): Promise<CustomInformeDomain> {
  const label = input.label.trim();
  if (!label) throw new Error('Nome do tipo de informe obrigatório');

  const domainId = newCustomDomainId();

  await prisma.mEReportPackage.create({
    data: {
      projectId,
      title: label,
      notes: input.intro?.trim() || null,
      cadence: INFORME_DOMAIN_CADENCE,
      domain: domainId,
      status: 'active',
      donorFormat: 'generic',
    },
  });

  await getOrCreateTemplatePackage(projectId, domainId);

  return { id: domainId, label, intro: input.intro?.trim() || '' };
}
