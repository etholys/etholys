import { prisma } from '@/lib/prisma';
import type { StudioConsentSource } from '@/lib/studio/types';
import { STUDIO_ECOSYSTEM_CATALOG } from '@/lib/studio/agent';

/** Resolve companyId do pedido se o utilizador for membro — ou via partilha Studio activa. */
export async function resolveStudioCompanyId(
  userId: string,
  requestedCompanyId?: string | null,
): Promise<string | null> {
  const memberships = await prisma.companyUser.findMany({
    where: { userId },
    select: { companyId: true, isDefault: true },
  });
  if (memberships.length > 0) {
    const ids = new Set(memberships.map((m) => m.companyId));
    if (requestedCompanyId && ids.has(requestedCompanyId)) return requestedCompanyId;
    const def = memberships.find((m) => m.isDefault);
    return def?.companyId ?? memberships[0].companyId;
  }

  // Convidado externo: empresa vem das partilhas activas
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  const email = user?.email?.toLowerCase();
  const shares = await prisma.studioShare.findMany({
    where: {
      status: 'active',
      OR: [{ userId }, ...(email ? [{ email }] : [])],
    },
    select: { companyId: true, expiresAt: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  const now = Date.now();
  const companyIds = [
    ...new Set(
      shares
        .filter((s) => !s.expiresAt || s.expiresAt.getTime() > now)
        .map((s) => s.companyId),
    ),
  ];
  if (!companyIds.length) return null;
  if (requestedCompanyId && companyIds.includes(requestedCompanyId)) return requestedCompanyId;
  return companyIds[0];
}

export function studioCatalogForCompany(): StudioConsentSource[] {
  return STUDIO_ECOSYSTEM_CATALOG;
}

/**
 * Carrega dados reais só para fontes aprovadas.
 * Mantém payloads curtos — o agente pede mais se precisar.
 */
export async function loadApprovedStudioContext(
  companyId: string,
  approvedSourceIds: string[],
): Promise<string> {
  if (!approvedSourceIds.length) return '';
  const parts: string[] = [];
  const set = new Set(approvedSourceIds);

  if (set.has('company.profile')) {
    const c = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        name: true,
        shortName: true,
        currency: true,
        description: true,
        businessActivity: true,
        incorporationCountry: true,
        contextSetupJson: true,
      },
    });
    if (c) {
      parts.push(
        `company.profile: ${JSON.stringify({
          name: c.name,
          shortName: c.shortName,
          currency: c.currency,
          description: c.description,
          businessActivity: c.businessActivity,
          country: c.incorporationCountry,
          contextSetup: c.contextSetupJson,
        })}`,
      );
    }
  }

  if (set.has('siep.projects')) {
    try {
      const projects = await prisma.project.findMany({
        where: { companyId },
        orderBy: { updatedAt: 'desc' },
        take: 12,
        select: { id: true, name: true, status: true, description: true },
      });
      parts.push(`siep.projects: ${JSON.stringify(projects)}`);
    } catch {
      parts.push('siep.projects: (indisponível neste ambiente)');
    }
  }

  if (set.has('fundhub.proposals')) {
    try {
      const proposals = await prisma.proposal.findMany({
        where: { companyId },
        orderBy: { updatedAt: 'desc' },
        take: 8,
        select: { id: true, title: true, status: true },
      });
      parts.push(`fundhub.proposals: ${JSON.stringify(proposals)}`);
    } catch {
      parts.push('fundhub.proposals: (indisponível)');
    }
  }

  if (set.has('forge.courses')) {
    try {
      const courses = await prisma.forgeCourse.findMany({
        where: { companyId },
        orderBy: { updatedAt: 'desc' },
        take: 8,
        select: { id: true, title: true, status: true },
      });
      parts.push(`forge.courses: ${JSON.stringify(courses)}`);
    } catch {
      parts.push('forge.courses: (indisponível)');
    }
  }

  if (set.has('meet.recent')) {
    try {
      const meets = await prisma.meetSession.findMany({
        where: { companyId },
        orderBy: { updatedAt: 'desc' },
        take: 6,
        select: { id: true, title: true, status: true, summaryText: true },
      });
      parts.push(
        `meet.recent: ${JSON.stringify(
          meets.map((m) => ({
            id: m.id,
            title: m.title,
            status: m.status,
            summary: m.summaryText ? String(m.summaryText).slice(0, 400) : null,
          })),
        )}`,
      );
    } catch {
      parts.push('meet.recent: (indisponível)');
    }
  }

  if (set.has('nexus.at_engagements')) {
    try {
      const engagements = await prisma.nexusAtEngagement.findMany({
        where: {
          isActive: true,
          OR: [
            { operatorCompanyId: companyId },
            { members: { some: { companyId } } },
          ],
        },
        orderBy: { updatedAt: 'desc' },
        take: 10,
        select: {
          id: true,
          title: true,
          kind: true,
          status: true,
          contractRef: true,
        },
      });
      parts.push(`nexus.at_engagements: ${JSON.stringify(engagements)}`);
    } catch {
      parts.push('nexus.at_engagements: (indisponível)');
    }
  }

  if (set.has('atlas.finance_summary')) {
    try {
      const since = new Date();
      since.setDate(since.getDate() - 90);
      const txs = await prisma.transaction.findMany({
        where: { companyId, date: { gte: since } },
        select: { amount: true, type: true },
        take: 500,
      });
      let income = 0;
      let expense = 0;
      for (const t of txs) {
        const a = Number(t.amount) || 0;
        if (t.type === 'INCOME' || t.type === 'TRANSFER_IN') income += a;
        else expense += Math.abs(a);
      }
      parts.push(
        `atlas.finance_summary: ${JSON.stringify({
          windowDays: 90,
          transactionCount: txs.length,
          incomeApprox: income,
          expenseApprox: expense,
        })}`,
      );
    } catch {
      parts.push('atlas.finance_summary: (indisponível)');
    }
  }

  return parts.join('\n\n');
}
