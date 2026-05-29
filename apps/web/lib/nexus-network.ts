import { prisma } from './prisma';

export type NexusNetworkWithMembers = NonNullable<Awaited<ReturnType<typeof loadNetworkForTenant>>>;
export type NexusNetworkMemberRow = NexusNetworkWithMembers['members'][number];

/** Redes onde o utilizador tem pelo menos uma empresa membro. */
export async function listNetworksForTenant(companyIds: string[]) {
  if (companyIds.length === 0) return [];
  return prisma.nexusNetwork.findMany({
    where: {
      isActive: true,
      members: { some: { companyId: { in: companyIds } } },
    },
    orderBy: { updatedAt: 'desc' },
    include: {
      anchorCompany: { select: { id: true, name: true, shortName: true } },
      siepProject: { select: { id: true, name: true, companyId: true } },
      members: {
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        include: {
          company: { select: { id: true, name: true, shortName: true } },
          siepProject: { select: { id: true, name: true, companyId: true } },
        },
      },
    },
  });
}

export async function loadNetworkForTenant(networkId: string, tenantCompanyIds: string[]) {
  const network = await prisma.nexusNetwork.findFirst({
    where: {
      id: networkId,
      isActive: true,
      members: { some: { companyId: { in: tenantCompanyIds } } },
    },
    include: {
      anchorCompany: { select: { id: true, name: true, shortName: true } },
      siepProject: { select: { id: true, name: true, companyId: true } },
      members: {
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        include: {
          company: { select: { id: true, name: true, shortName: true } },
          siepProject: { select: { id: true, name: true, companyId: true } },
        },
      },
    },
  });
  return network;
}

export function memberCompanyIds(network: { members: { companyId: string }[] }): string[] {
  return [...new Set(network.members.map((m) => m.companyId))];
}

/** Projeto SIEP da rede ou override do membro — `companyId` deve ser o da empresa membro. */
export function effectiveSiepProjectId(
  network: NexusNetworkWithMembers,
  memberCompanyId: string
): string | null {
  const row = network.members.find((m: NexusNetworkMemberRow) => m.companyId === memberCompanyId);
  if (row?.siepProjectId) return row.siepProjectId;
  return network.siepProjectId ?? null;
}

export async function assertSiepProjectAllowed(
  projectId: string | null | undefined,
  allowedCompanyIds: string[]
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!projectId?.trim()) return { ok: true };
  const p = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, companyId: true, isActive: true },
  });
  if (!p || !p.isActive) return { ok: false, message: 'Projeto SIEP não encontrado ou inativo.' };
  if (!allowedCompanyIds.includes(p.companyId)) {
    return { ok: false, message: 'O projeto SIEP deve pertencer à âncora ou a uma empresa membro da rede.' };
  }
  return { ok: true };
}
