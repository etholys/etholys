export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import {
  clientCompanyIds,
  countOpenAtCasesByEngagement,
  listAtInboxForTenant,
  listEngagementsForTenant,
} from '@/lib/nexus-at';
import { parseCompanySectorId, parseEngagementSectorIds } from '@/lib/nexus-economic-sectors';

/** Inbox AT + serviços com contagem de casos abertos. */
export async function GET() {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [engagements, inbox] = await Promise.all([
    listEngagementsForTenant(tenant.companyIds),
    listAtInboxForTenant(tenant.companyIds, 30),
  ]);

  const allClientIds = [
    ...new Set(engagements.flatMap((e) => clientCompanyIds(e))),
  ];
  const companyRows =
    allClientIds.length > 0
      ? await prisma.company.findMany({
          where: { id: { in: allClientIds }, isActive: true },
          select: { id: true, contextSetupJson: true },
        })
      : [];
  const sectorByCompany = new Map(
    companyRows.map((c) => [c.id, parseCompanySectorId(c.contextSetupJson)])
  );

  const clientMap = new Map<string, string[]>();
  for (const e of engagements) {
    clientMap.set(e.id, clientCompanyIds(e));
  }
  const openCounts = await countOpenAtCasesByEngagement(
    engagements.map((e) => e.id),
    clientMap
  );

  const sectorPortfolio = new Map<string, { companies: number; contracts: number; openCases: number }>();

  const services = engagements.map((e) => {
    const clients = clientCompanyIds(e);
    const storedSectors = parseEngagementSectorIds(e.sectorIds);
    const clientSectors = clients
      .map((cid) => sectorByCompany.get(cid))
      .filter(Boolean) as string[];
    const sectorMix = [...new Set([...storedSectors, ...clientSectors])];
    const programSector = e.primarySectorId || storedSectors[0] || sectorMix[0] || null;

    for (const sid of storedSectors.length > 0 ? storedSectors : programSector ? [programSector] : []) {
      const row = sectorPortfolio.get(sid) || { companies: 0, contracts: 0, openCases: 0 };
      row.contracts += 1;
      row.companies += clients.length;
      row.openCases += openCounts.get(e.id) || 0;
      sectorPortfolio.set(sid, row);
    }

    return {
      ...e,
      openCaseCount: openCounts.get(e.id) || 0,
      clientCount: clients.length,
      projectCount: e.projects.length,
      primarySectorId: e.primarySectorId || programSector,
      sectorIds: storedSectors,
      sectorMix,
      members: e.members.map((m) => ({
        ...m,
        sectorId: m.memberRole === 'client' ? sectorByCompany.get(m.companyId) || null : null,
      })),
    };
  });

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);
  const endOfWeek = new Date(startOfToday);
  endOfWeek.setDate(endOfWeek.getDate() + 7);

  const overdueItems = inbox.filter((c) => c.dueDate && new Date(c.dueDate).getTime() < startOfToday.getTime());
  const todayItems = inbox.filter((c) => {
    if (!c.dueDate) return false;
    const t = new Date(c.dueDate).getTime();
    return t >= startOfToday.getTime() && t < endOfToday.getTime();
  });
  const weekItems = inbox.filter((c) => {
    if (!c.dueDate) return false;
    const t = new Date(c.dueDate).getTime();
    return t >= endOfToday.getTime() && t < endOfWeek.getTime();
  });
  const noDateItems = inbox.filter((c) => !c.dueDate);

  return NextResponse.json({
    services,
    inbox,
    sectorPortfolio: [...sectorPortfolio.entries()].map(([sectorId, stats]) => ({
      sectorId,
      ...stats,
    })),
    agenda: {
      overdue: overdueItems,
      today: todayItems,
      week: weekItems,
      noDate: noDateItems,
    },
    summary: {
      services: services.length,
      openCases: inbox.length,
      overdue: overdueItems.length,
      dueToday: todayItems.length,
      dueThisWeek: weekItems.length,
    },
  });
}
