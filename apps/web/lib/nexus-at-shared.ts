/**
 * Constantes e helpers puros de AT — seguro para componentes client.
 * Funções com Prisma ficam em `nexus-at.ts` (só API/server).
 */

export const AT_ENGAGEMENT_KINDS = ['CONTRACT', 'PROJECT', 'PROGRAM'] as const;
export type AtEngagementKind = (typeof AT_ENGAGEMENT_KINDS)[number];

/** Como se presta a AT neste marco legal */
export const AT_DELIVERY_MODELS = ['SINGLE', 'MULTI', 'COLLECTIVE'] as const;
export type AtDeliveryModel = (typeof AT_DELIVERY_MODELS)[number];

export const AT_DELIVERY_MODEL_LABELS: Record<
  AtDeliveryModel,
  { es: string; pt: string; en: string; hint: { es: string; pt: string; en: string } }
> = {
  SINGLE: {
    es: 'Un emprendimiento',
    pt: 'Um empreendimento',
    en: 'Single enterprise',
    hint: {
      es: 'Una sola MIPYME atendida; sector y temática se definen en su ficha.',
      pt: 'Uma só MIPYME atendida; setor e temática definem-se na ficha dela.',
      en: 'One assisted MSME; sector/theme set on its profile.',
    },
  },
  MULTI: {
    es: 'Varios emprendimientos',
    pt: 'Vários empreendimentos',
    en: 'Multiple enterprises',
    hint: {
      es: 'Cada empresa tiene su propio proceso y sector (ej. horta vs gallinas).',
      pt: 'Cada empresa tem o seu processo e setor (ex. horta vs galinhas).',
      en: 'Each firm has its own process and sector (e.g. garden vs poultry).',
    },
  },
  COLLECTIVE: {
    es: 'Proyecto colectivo (red / cooperativa)',
    pt: 'Projeto coletivo (rede / cooperativa)',
    en: 'Collective project (network / co-op)',
    hint: {
      es: 'Empresa principal + filiales. El foco es el producto/red colectiva; no todas reciben el mismo nivel de AT.',
      pt: 'Empresa principal + filhas. O foco é o produto/rede coletiva; nem todas recebem o mesmo nível de AT.',
      en: 'Principal + affiliates. Focus is collective product/network; AT intensity may differ.',
    },
  },
};

export const AT_ATTENDED_MEMBER_ROLES = ['client', 'principal', 'affiliate'] as const;

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

export function isAtDeliveryModel(v: string): v is AtDeliveryModel {
  return (AT_DELIVERY_MODELS as readonly string[]).includes(v);
}

export function isAttendedMemberRole(role: string): boolean {
  return (AT_ATTENDED_MEMBER_ROLES as readonly string[]).includes(role);
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
  return engagement.members.filter((m) => isAttendedMemberRole(m.memberRole)).map((m) => m.companyId);
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
