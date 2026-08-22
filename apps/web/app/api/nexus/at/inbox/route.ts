export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getUserCompanyIds } from '@/lib/tenant';
import {
  clientCompanyIds,
  countOpenAtCasesByEngagement,
  listAtInboxForTenant,
  listEngagementsForTenant,
} from '@/lib/nexus-at';

/** Inbox AT + serviços com contagem de casos abertos. */
export async function GET() {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [engagements, inbox] = await Promise.all([
    listEngagementsForTenant(tenant.companyIds),
    listAtInboxForTenant(tenant.companyIds, 30),
  ]);

  const clientMap = new Map<string, string[]>();
  for (const e of engagements) {
    clientMap.set(e.id, clientCompanyIds(e));
  }
  const openCounts = await countOpenAtCasesByEngagement(
    engagements.map((e) => e.id),
    clientMap
  );

  const services = engagements.map((e) => ({
    ...e,
    openCaseCount: openCounts.get(e.id) || 0,
    clientCount: clientCompanyIds(e).length,
    projectCount: e.projects.length,
  }));

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
