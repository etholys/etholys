import { prisma } from './prisma';
import { assertSiepProjectAllowed } from './nexus-network';
import {
  AT_ENGAGEMENT_TAG,
  AT_OPEN_STATUSES,
  AT_PROJECT_TAG,
  AT_TAG_PREFIX,
  enrichAtCase,
  parseAtEngagementIdFromTags,
} from './nexus-at-shared';

export * from './nexus-at-shared';

const engagementInclude = {
  operatorCompany: { select: { id: true, name: true, shortName: true } },
  network: { select: { id: true, name: true } },
  siepProject: { select: { id: true, name: true, companyId: true } },
  members: {
    orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }],
    include: {
      company: { select: { id: true, name: true, shortName: true } },
    },
  },
  projects: {
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }],
    include: {
      siepProject: { select: { id: true, name: true, companyId: true } },
    },
  },
} as const;

export const atCaseSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  dueDate: true,
  createdAt: true,
  updatedAt: true,
  tags: true,
  companyId: true,
  assigneeId: true,
  assignee: { select: { id: true, name: true, email: true } },
} as const;

export type NexusAtEngagementRow = NonNullable<Awaited<ReturnType<typeof loadEngagementForTenant>>>;

/** Serviços onde o utilizador é operador ou empresa-cliente membro. */
export async function listEngagementsForTenant(companyIds: string[]) {
  if (companyIds.length === 0) return [];
  return prisma.nexusAtEngagement.findMany({
    where: {
      isActive: true,
      OR: [
        { operatorCompanyId: { in: companyIds } },
        { members: { some: { companyId: { in: companyIds } } } },
      ],
    },
    orderBy: { updatedAt: 'desc' },
    include: engagementInclude,
  });
}

export async function loadEngagementForTenant(engagementId: string, tenantCompanyIds: string[]) {
  const engagement = await prisma.nexusAtEngagement.findFirst({
    where: {
      id: engagementId,
      isActive: true,
      OR: [
        { operatorCompanyId: { in: tenantCompanyIds } },
        { members: { some: { companyId: { in: tenantCompanyIds } } } },
      ],
    },
    include: engagementInclude,
  });
  return engagement;
}

export async function validateEngagementSiep(
  siepProjectId: string | null | undefined,
  allowedCompanyIds: string[]
) {
  return assertSiepProjectAllowed(siepProjectId, allowedCompanyIds);
}

export async function listAtCasesForEngagement(
  engagementId: string,
  clientIds: string[],
  opts?: { projectId?: string; companyId?: string; openOnly?: boolean }
) {
  if (clientIds.length === 0) return [];
  const companyFilter = opts?.companyId
    ? clientIds.includes(opts.companyId)
      ? [opts.companyId]
      : []
    : clientIds;
  if (companyFilter.length === 0) return [];

  return prisma.task.findMany({
    where: {
      isActive: true,
      companyId: { in: companyFilter },
      AND: [
        { tags: { contains: AT_ENGAGEMENT_TAG(engagementId) } },
        ...(opts?.projectId ? [{ tags: { contains: AT_PROJECT_TAG(opts.projectId) } }] : []),
        ...(opts?.openOnly ? [{ status: { in: [...AT_OPEN_STATUSES] } }] : []),
      ],
    },
    orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { updatedAt: 'desc' }],
    take: 200,
    select: atCaseSelect,
  });
}

/** Inbox transversal: casos AT abertos nos serviços do tenant. */
export async function listAtInboxForTenant(companyIds: string[], take = 40) {
  if (companyIds.length === 0) return [];
  const engagements = await prisma.nexusAtEngagement.findMany({
    where: {
      isActive: true,
      OR: [
        { operatorCompanyId: { in: companyIds } },
        { members: { some: { companyId: { in: companyIds } } } },
      ],
    },
    select: {
      id: true,
      title: true,
      members: { select: { companyId: true, memberRole: true } },
      projects: { where: { isActive: true }, select: { id: true, name: true } },
    },
  });
  if (engagements.length === 0) return [];

  const engagementIds = engagements.map((e) => e.id);
  const allClientIds = [
    ...new Set(
      engagements.flatMap((e) =>
        e.members.filter((m) => m.memberRole !== 'operator').map((m) => m.companyId)
      )
    ),
  ];
  if (allClientIds.length === 0) return [];

  const tasks = await prisma.task.findMany({
    where: {
      isActive: true,
      companyId: { in: allClientIds },
      status: { in: [...AT_OPEN_STATUSES] },
      tags: { contains: AT_TAG_PREFIX },
      OR: engagementIds.map((eid) => ({ tags: { contains: AT_ENGAGEMENT_TAG(eid) } })),
    },
    orderBy: [{ dueDate: 'asc' }, { updatedAt: 'desc' }],
    take,
    select: atCaseSelect,
  });

  const byId = new Map(engagements.map((e) => [e.id, e]));
  const projectName = new Map<string, string>();
  for (const e of engagements) {
    for (const p of e.projects) projectName.set(p.id, p.name);
  }

  return tasks.map((t) => {
    const enriched = enrichAtCase(t);
    const eng = enriched.engagementId ? byId.get(enriched.engagementId) : null;
    return {
      ...enriched,
      serviceTitle: eng?.title || null,
      projectName: enriched.projectId ? projectName.get(enriched.projectId) || null : null,
    };
  });
}

export async function countOpenAtCasesByEngagement(
  engagementIds: string[],
  clientIdsByEngagement: Map<string, string[]>
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (engagementIds.length === 0) return result;

  await Promise.all(
    engagementIds.map(async (eid) => {
      const clients = clientIdsByEngagement.get(eid) || [];
      if (clients.length === 0) {
        result.set(eid, 0);
        return;
      }
      const n = await prisma.task.count({
        where: {
          isActive: true,
          companyId: { in: clients },
          status: { in: [...AT_OPEN_STATUSES] },
          tags: { contains: AT_ENGAGEMENT_TAG(eid) },
        },
      });
      result.set(eid, n);
    })
  );
  return result;
}

export async function loadAtCaseForTenant(taskId: string, tenantCompanyIds: string[]) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, isActive: true, tags: { contains: AT_TAG_PREFIX } },
    select: atCaseSelect,
  });
  if (!task) return null;
  const engagementId = parseAtEngagementIdFromTags(task.tags);
  if (!engagementId) return null;
  const engagement = await loadEngagementForTenant(engagementId, tenantCompanyIds);
  if (!engagement) return null;
  return { task, engagement, enriched: enrichAtCase(task) };
}
