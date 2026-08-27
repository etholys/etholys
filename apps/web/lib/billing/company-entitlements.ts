import 'server-only';

import { prisma } from '@/lib/prisma';
import {
  WORKSPACE_SYSTEM_KEYS,
  normalizeSystemsInput,
  parseSystemsJson,
  type WorkspaceSystemKey,
} from '@/lib/integrated-workspace-shared';
import { getSku } from '@/lib/billing/catalog';

export type CompanyEntitlementState = {
  /** null = sem subscrição registada (legado: todos os sistemas permitidos ao nível empresa). */
  licensedSystems: WorkspaceSystemKey[] | null;
  subscriptionStatus: string | null;
  planCode: string | null;
  maxSeats: number | null;
  billingEnforced: boolean;
  interval: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  addOnCodes: string[];
  commissionCodes: string[];
  licenseCodes: string[];
};

const ACTIVE_SUB_STATUSES = new Set(['ACTIVE', 'TRIALING']);

function emptyState(): CompanyEntitlementState {
  return {
    licensedSystems: null,
    subscriptionStatus: null,
    planCode: null,
    maxSeats: null,
    billingEnforced: false,
    interval: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    addOnCodes: [],
    commissionCodes: [],
    licenseCodes: [],
  };
}

export async function getCompanyEntitlements(companyId: string): Promise<CompanyEntitlementState> {
  try {
    const sub = await prisma.companySubscription.findFirst({
      where: { companyId, status: { in: [...ACTIVE_SUB_STATUSES] } },
      orderBy: { updatedAt: 'desc' },
      include: { plan: { select: { code: true, systems: true, maxSeats: true } } },
    });

    let extras: { skuCode: string; kind: string; status: string; metadata: unknown }[] = [];
    try {
      extras = await prisma.companyEntitlement.findMany({
        where: { companyId, status: 'ACTIVE' },
        select: { skuCode: true, kind: true, status: true, metadata: true },
      });
    } catch {
      extras = [];
    }

    const addOnCodes = extras.filter((e) => e.kind === 'addon').map((e) => e.skuCode);
    const commissionCodes = extras.filter((e) => e.kind === 'commission').map((e) => e.skuCode);
    const licenseCodes = extras.filter((e) => e.kind === 'license').map((e) => e.skuCode);

    const extraSystems: WorkspaceSystemKey[] = [];
    for (const e of extras) {
      const sku = getSku(e.skuCode);
      if (sku?.systems.length) extraSystems.push(...sku.systems);
      const meta = e.metadata as { systems?: unknown } | null;
      if (meta?.systems) extraSystems.push(...normalizeSystemsInput(meta.systems));
    }

    if (!sub) {
      if (extras.length === 0) return emptyState();
      const licensed = [...new Set(extraSystems)];
      return {
        ...emptyState(),
        licensedSystems: licensed.length ? licensed : null,
        billingEnforced: licensed.length > 0,
        addOnCodes,
        commissionCodes,
        licenseCodes,
      };
    }

    const fromSub = normalizeSystemsInput(parseSystemsJson(sub.licensedSystems));
    const fromPlan = sub.plan ? normalizeSystemsInput(parseSystemsJson(sub.plan.systems)) : [];
    const licensedSystems = [...new Set([...fromSub, ...fromPlan, ...extraSystems])];

    return {
      licensedSystems: licensedSystems.length > 0 ? licensedSystems : null,
      subscriptionStatus: sub.status,
      planCode: sub.plan?.code ?? null,
      maxSeats: sub.maxSeats ?? sub.plan?.maxSeats ?? null,
      billingEnforced: true,
      interval: sub.interval ?? 'MONTH',
      currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      addOnCodes,
      commissionCodes,
      licenseCodes,
    };
  } catch (e) {
    console.error('[billing] getCompanyEntitlements', e);
    return emptyState();
  }
}

/** Intersect user/invite systems with o que a empresa contratou. */
export function clampSystemsToCompanyEntitlements(
  systems: WorkspaceSystemKey[],
  entitlements: CompanyEntitlementState,
): WorkspaceSystemKey[] {
  if (!entitlements.billingEnforced || entitlements.licensedSystems === null) {
    return systems;
  }
  const allowed = new Set(entitlements.licensedSystems);
  return systems.filter((s) => allowed.has(s));
}

export async function assertSystemsAllowedForCompany(
  companyId: string,
  systems: WorkspaceSystemKey[],
): Promise<{ ok: true; systems: WorkspaceSystemKey[] } | { ok: false; error: string }> {
  const ent = await getCompanyEntitlements(companyId);
  const clamped = clampSystemsToCompanyEntitlements(systems, ent);
  if (systems.length > 0 && clamped.length === 0) {
    return {
      ok: false,
      error: 'Esta empresa não tem licença para os sistemas selecionados.',
    };
  }
  if (clamped.length < systems.length) {
    return {
      ok: false,
      error: 'Um ou mais sistemas excedem a licença contratada pela empresa.',
    };
  }
  return { ok: true, systems: clamped };
}

export async function countCompanySeats(companyId: string): Promise<number> {
  return prisma.companyUser.count({ where: { companyId } });
}

export async function assertSeatAvailable(companyId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const ent = await getCompanyEntitlements(companyId);
  if (!ent.maxSeats) return { ok: true };
  const used = await countCompanySeats(companyId);
  if (used >= ent.maxSeats) {
    return { ok: false, error: `Limite de utilizadores (${ent.maxSeats}) atingido.` };
  }
  return { ok: true };
}

/** Sistemas que admins podem atribuir / ver no Hub quando billing existe. */
export function effectiveCompanyCatalog(entitlements: CompanyEntitlementState): WorkspaceSystemKey[] {
  if (entitlements.licensedSystems?.length) return entitlements.licensedSystems;
  return [...WORKSPACE_SYSTEM_KEYS];
}

export function companyHasAddon(entitlements: CompanyEntitlementState, skuCode: string): boolean {
  return entitlements.addOnCodes.includes(skuCode);
}
