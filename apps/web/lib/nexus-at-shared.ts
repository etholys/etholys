/**
 * Constantes e helpers puros de AT — seguro para componentes client.
 * Funções com Prisma ficam em `nexus-at.ts` (só API/server).
 */

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

export function engagementCompanyIds(engagement: {
  operatorCompanyId: string;
  sponsorCompanyId?: string | null;
  members: { companyId: string }[];
}): string[] {
  return [
    ...new Set(
      [
        engagement.operatorCompanyId,
        engagement.sponsorCompanyId || null,
        ...engagement.members.map((m) => m.companyId),
      ].filter(Boolean) as string[]
    ),
  ];
}

/** Empresas beneficiárias (trabalho AT) — não inclui operador nem contratante. */
export function clientCompanyIds(engagement: { members: { companyId: string; memberRole: string }[] }): string[] {
  return engagement.members.filter((m) => m.memberRole === 'client').map((m) => m.companyId);
}

export function userIsOperator(engagement: { operatorCompanyId: string }, tenantCompanyIds: string[]): boolean {
  return tenantCompanyIds.includes(engagement.operatorCompanyId);
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
