import { prisma } from '@/lib/prisma';
import type { StudioConsentSource } from '@/lib/studio/types';
import { STUDIO_ECOSYSTEM_CATALOG } from '@/lib/studio/agent';

/** Resolve companyId do pedido se o utilizador for membro. */
export async function resolveStudioCompanyId(
  userId: string,
  requestedCompanyId?: string | null,
): Promise<string | null> {
  const memberships = await prisma.companyUser.findMany({
    where: { userId },
    select: { companyId: true, isDefault: true },
  });
  if (memberships.length === 0) return null;
  const ids = new Set(memberships.map((m) => m.companyId));
  if (requestedCompanyId && ids.has(requestedCompanyId)) return requestedCompanyId;
  const def = memberships.find((m) => m.isDefault);
  return def?.companyId ?? memberships[0].companyId;
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
