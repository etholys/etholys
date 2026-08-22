import { prisma } from './prisma';
import { assertSiepProjectAllowed } from './nexus-network';

export const AT_ENGAGEMENT_KINDS = ['CONTRACT', 'PROJECT', 'PROGRAM'] as const;
export type AtEngagementKind = (typeof AT_ENGAGEMENT_KINDS)[number];

export const AT_ENGAGEMENT_STATUSES = ['OPEN', 'ACTIVE', 'ON_HOLD', 'CLOSED'] as const;
export type AtEngagementStatus = (typeof AT_ENGAGEMENT_STATUSES)[number];

export const AT_PROJECT_STATUSES = ['ACTIVE', 'ON_HOLD', 'DONE'] as const;
export type AtProjectStatus = (typeof AT_PROJECT_STATUSES)[number];

export const AT_CASE_KINDS = ['visit', 'call', 'followup', 'diagnosis', 'other'] as const;
export type AtCaseKind = (typeof AT_CASE_KINDS)[number];

export const AT_CASE_STATUSES = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED'] as const;

export const AT_TAG_PREFIX = 'nexus:at';
export const AT_ENGAGEMENT_TAG = (engagementId: string) => `nexus:at-engagement:${engagementId}`;
export const AT_PROJECT_TAG = (projectId: string) => `nexus:at-project:${projectId}`;
export const AT_KIND_TAG = (kind: AtCaseKind) => `at-kind:${kind}`;

export const AT_OPEN_STATUSES = ['TODO', 'IN_PROGRESS', 'IN_REVIEW'] as const;

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

export function isAtEngagementKind(v: string): v is AtEngagementKind {
  return (AT_ENGAGEMENT_KINDS as readonly string[]).includes(v);
}

export function isAtEngagementStatus(v: string): v is AtEngagementStatus {
  return (AT_ENGAGEMENT_STATUSES as readonly string[]).includes(v);
}

export function isAtProjectStatus(v: string): v is AtProjectStatus {
  return (AT_PROJECT_STATUSES as readonly string[]).includes(v);
}

export function isAtCaseKind(v: string): v is AtCaseKind {
  return (AT_CASE_KINDS as readonly string[]).includes(v);
}

export function isAtOpenStatus(status: string): boolean {
  return (AT_OPEN_STATUSES as readonly string[]).includes(status);
}

export function parseAtCaseKindFromTags(tags: string | null | undefined): AtCaseKind {
  const raw = String(tags || '');
  for (const k of AT_CASE_KINDS) {
    if (raw.includes(AT_KIND_TAG(k))) return k;
  }
  return 'other';
}

export function parseAtProjectIdFromTags(tags: string | null | undefined): string | null {
  const m = String(tags || '').match(/nexus:at-project:([a-zA-Z0-9_-]+)/);
  return m?.[1] || null;
}

export function parseAtEngagementIdFromTags(tags: string | null | undefined): string | null {
  const m = String(tags || '').match(/nexus:at-engagement:([a-zA-Z0-9_-]+)/);
  return m?.[1] || null;
}

export function enrichAtCase<T extends { tags: string | null; status: string }>(c: T) {
  return {
    ...c,
    caseKind: parseAtCaseKindFromTags(c.tags),
    projectId: parseAtProjectIdFromTags(c.tags),
    engagementId: parseAtEngagementIdFromTags(c.tags),
    isOpen: isAtOpenStatus(c.status),
  };
}

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

export function engagementCompanyIds(engagement: {
  operatorCompanyId: string;
  members: { companyId: string }[];
}): string[] {
  return [...new Set([engagement.operatorCompanyId, ...engagement.members.map((m) => m.companyId)])];
}

export function clientCompanyIds(engagement: { members: { companyId: string; memberRole: string }[] }): string[] {
  return engagement.members.filter((m) => m.memberRole !== 'operator').map((m) => m.companyId);
}

export function userIsOperator(engagement: { operatorCompanyId: string }, tenantCompanyIds: string[]): boolean {
  return tenantCompanyIds.includes(engagement.operatorCompanyId);
}

export async function validateEngagementSiep(
  siepProjectId: string | null | undefined,
  allowedCompanyIds: string[]
) {
  return assertSiepProjectAllowed(siepProjectId, allowedCompanyIds);
}

export function buildAtCaseTags(
  engagementId: string,
  projectId: string,
  kind: AtCaseKind,
  extra?: string
): string {
  const parts = [
    AT_TAG_PREFIX,
    AT_ENGAGEMENT_TAG(engagementId),
    AT_PROJECT_TAG(projectId),
    AT_KIND_TAG(kind),
  ];
  if (extra?.trim()) parts.push(extra.trim());
  return parts.join(',');
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

export const AT_CASE_KIND_LABELS: Record<AtCaseKind, { pt: string; es: string; en: string }> = {
  visit: { pt: 'Visita de campo', es: 'Visita de campo', en: 'Field visit' },
  call: { pt: 'Chamada / Meet', es: 'Llamada / Meet', en: 'Call / Meet' },
  followup: { pt: 'Follow-up', es: 'Seguimiento', en: 'Follow-up' },
  diagnosis: { pt: 'Diagnóstico AT', es: 'Diagnóstico AT', en: 'AT diagnosis' },
  other: { pt: 'Outro', es: 'Otro', en: 'Other' },
};

export const AT_STATUS_LABELS: Record<string, string> = {
  TODO: 'Por fazer',
  IN_PROGRESS: 'Em curso',
  IN_REVIEW: 'Em revisão',
  DONE: 'Concluído',
  CANCELLED: 'Cancelado',
  BACKLOG: 'Backlog',
};
