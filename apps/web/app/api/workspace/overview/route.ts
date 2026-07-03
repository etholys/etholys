export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import {
  ensureWorkspaceAccessBootstrapForCompanyAdmin,
  getWorkspaceAccessForUser,
  hasSystem,
  type WorkspaceSystemKey,
} from '@/lib/integrated-workspace';
import { listNetworksForTenant } from '@/lib/nexus-network';

export async function GET(req: NextRequest) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const companyId = req.nextUrl.searchParams.get('companyId')?.trim() || tenant.companyIds[0] || '';
  if (!companyId || !tenant.companyIds.includes(companyId)) {
    return NextResponse.json({ error: 'Empresa inválida' }, { status: 400 });
  }

  try {
    await ensureWorkspaceAccessBootstrapForCompanyAdmin(tenant.userId, companyId);
  } catch (e) {
    console.error('[workspace/overview] bootstrap', e);
  }

  const access = await getWorkspaceAccessForUser(tenant.userId, companyId);
  if (!access.ok) {
    return NextResponse.json(
      {
        error: 'Sem acesso ao centro integrado para esta empresa.',
        reason: access.reason,
        code: 'WORKSPACE_FORBIDDEN',
      },
      { status: 403 }
    );
  }

  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { name: true, shortName: true, currency: true } });

  const [
    incomeAgg,
    expenseAgg,
    tasksOpen,
    invoicesOverdue,
    projectsActive,
    proposalsOpen,
    notif,
    purchaseOrdersInFlight,
    productsLowStock,
    fundhubDiscoveryLatest,
    advisorAlerts,
  ] = await Promise.all([
    prisma.transaction.aggregate({ where: { companyId, type: 'INCOME' }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { companyId, type: 'EXPENSE' }, _sum: { amount: true } }),
    hasSystem(access, 'ATLAS')
      ? prisma.task.findMany({
          where: {
            isActive: true,
            companyId,
            status: { notIn: ['DONE', 'CANCELLED'] },
          },
          orderBy: [{ dueDate: 'asc' }, { updatedAt: 'desc' }],
          take: 8,
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            dueDate: true,
            projectId: true,
            project: { select: { id: true, name: true } },
          },
        })
      : Promise.resolve([]),
    hasSystem(access, 'ATLAS')
      ? prisma.invoice.count({
          where: {
            companyId,
            isActive: true,
            status: { notIn: ['PAID', 'CANCELLED'] },
            dueDate: { lt: new Date() },
          },
        })
      : Promise.resolve(0),
    hasSystem(access, 'SIEP')
      ? prisma.project.findMany({
          where: { companyId, isActive: true, status: { in: ['PLANNING', 'IN_PROGRESS', 'ON_HOLD'] } },
          take: 6,
          orderBy: { updatedAt: 'desc' },
          select: { id: true, name: true, status: true, progress: true, endDate: true },
        })
      : Promise.resolve([]),
    hasSystem(access, 'FUNDHUB')
      ? prisma.proposal.findMany({
          where: { companyId, deletedAt: null },
          take: 5,
          orderBy: { updatedAt: 'desc' },
          select: { id: true, title: true, status: true, fundId: true, updatedAt: true, workspaceId: true },
        })
      : Promise.resolve([]),
    prisma.notification.findMany({
      where: { userId: tenant.userId },
      take: 6,
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, message: true, read: true, createdAt: true, link: true, type: true },
    }),
    hasSystem(access, 'ATLAS')
      ? prisma.purchaseOrder.count({
          where: { companyId, isActive: true, receivedDate: null },
        })
      : Promise.resolve(0),
    hasSystem(access, 'ATLAS')
      ? prisma
          .$queryRaw<[{ c: bigint }]>(
            Prisma.sql`
            SELECT COUNT(*)::bigint AS c
            FROM "Product"
            WHERE "companyId" = ${companyId}
              AND "isActive" = true
              AND "minStock" IS NOT NULL
              AND "stockQty" < "minStock"
          `
          )
          .then((r) => Number(r[0]?.c ?? 0))
      : Promise.resolve(0),
    hasSystem(access, 'FUNDHUB')
      ? prisma.fundhubDiscoveryRun.findFirst({
          where: { companyId },
          orderBy: { startedAt: 'desc' },
          select: {
            id: true,
            status: true,
            startedAt: true,
            finishedAt: true,
            scanned: true,
            created: true,
            updated: true,
            errorCount: true,
          },
        })
      : Promise.resolve(null),
    /** Inbox do Etholys Advisor (transversal; não depende de “sistema” no grant) */
    prisma.aiAlert.findMany({
      where: {
        companyId,
        dismissedAt: null,
        read: false,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
      take: 6,
      select: { id: true, type: true, severity: true, title: true, message: true, read: true, link: true, createdAt: true },
    }),
  ]);

  const balance = (incomeAgg._sum.amount ?? 0) - (expenseAgg._sum.amount ?? 0);

  let nexus: { networkCount: number; pendingRoadmap: number } | null = null;
  if (hasSystem(access, 'NEXUS')) {
    const networks = await listNetworksForTenant(tenant.companyIds);
    const companyNetworks = networks.filter((n) => n.members.some((m) => m.companyId === companyId) || n.anchorCompanyId === companyId);
    const ids: string[] = [];
    for (const n of companyNetworks) {
      for (const m of n.members) {
        if (!ids.includes(m.companyId)) ids.push(m.companyId);
      }
    }
    if (ids.length === 0) ids.push(companyId);
    const pendingRoadmap = await prisma.task.count({
      where: {
        companyId: { in: ids },
        isActive: true,
        tags: { contains: 'nexus:roadmap' },
        status: { in: ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW'] },
      },
    });
    nexus = { networkCount: companyNetworks.length, pendingRoadmap };
  }

  const now = new Date();
  const futureHorizon = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000);
  const projList = hasSystem(access, 'SIEP')
    ? (projectsActive as { id: string; name: string; status: string; progress: number; endDate: Date | null }[])
    : [];
  const siepDeadlines = projList
    .filter((p) => {
      if (!p.endDate) return false;
      if (p.endDate.getTime() > futureHorizon.getTime()) return false;
      if (p.endDate.getTime() < now.getTime()) {
        return ['PLANNING', 'IN_PROGRESS', 'ON_HOLD'].includes(p.status);
      }
      return true;
    })
    .sort((a, b) => a.endDate!.getTime() - b.endDate!.getTime())
    .slice(0, 6);

  const systems = access.systems;
  return NextResponse.json({
    meta: { freshAt: new Date().toISOString() },
    company,
    access: { systems: systems as WorkspaceSystemKey[] },
    /** Etholys AI Advisor — inbox no cockpit (Fase 1) */
    advisor: {
      alerts: advisorAlerts.map((a) => ({
        id: a.id,
        type: a.type,
        severity: a.severity,
        title: a.title,
        message: a.message,
        read: a.read,
        link: a.link,
        createdAt: a.createdAt.toISOString(),
      })),
    },
    blocks: {
      ATLAS: hasSystem(access, 'ATLAS')
        ? {
            balance,
            currency: company?.currency ?? 'USD',
            incomeTotal: incomeAgg._sum.amount ?? 0,
            expenseTotal: expenseAgg._sum.amount ?? 0,
            tasksOpen: tasksOpen as object[],
            invoicesOverdue,
            purchaseOrdersInFlight,
            productsLowStock,
            links: {
              dashboard: '/dashboard',
              invoices: '/invoices',
              inventory: '/inventory',
              suppliers: '/suppliers',
            },
          }
        : null,
      SIEP: hasSystem(access, 'SIEP')
        ? {
            projects: (projectsActive as { id: string; name: string; status: string; progress: number }[]).map((p) => ({
              id: p.id,
              name: p.name,
              status: p.status,
              progress: p.progress,
              href: `/siep/projects/${p.id}`,
            })),
            siepDeadlines: siepDeadlines.map((p) => ({
              id: p.id,
              name: p.name,
              endDate: p.endDate!.toISOString(),
              href: `/siep/projects/${p.id}`,
              overdue: p.endDate! < now,
            })),
            link: '/siep',
          }
        : null,
      FUNDHUB: hasSystem(access, 'FUNDHUB')
        ? {
            proposals: (proposalsOpen as { id: string; title: string; status: string; workspaceId: string }[]).map(
              (p) => ({
                id: p.id,
                title: p.title,
                status: p.status,
                editorHref: `/hub/fundhub/proposals/editor?workspace=${encodeURIComponent(p.workspaceId)}`,
              })
            ),
            link: '/hub/fundhub',
            proposalsList: '/hub/fundhub/proposals',
            discovery:
              fundhubDiscoveryLatest != null
                ? {
                    id: fundhubDiscoveryLatest.id,
                    status: fundhubDiscoveryLatest.status,
                    startedAt: fundhubDiscoveryLatest.startedAt.toISOString(),
                    finishedAt: fundhubDiscoveryLatest.finishedAt?.toISOString() ?? null,
                    scanned: fundhubDiscoveryLatest.scanned,
                    created: fundhubDiscoveryLatest.created,
                    updated: fundhubDiscoveryLatest.updated,
                    errorCount: fundhubDiscoveryLatest.errorCount,
                    link: '/hub/fundhub/discover',
                  }
                : null,
          }
        : null,
      NEXUS: hasSystem(access, 'NEXUS')
        ? nexus
          ? {
              ...nexus,
              link: '/hub/nexus',
              networksLink: '/hub/nexus/networks',
              roadmapLink: '/hub/nexus/roadmap',
            }
          : {
              networkCount: 0,
              pendingRoadmap: 0,
              link: '/hub/nexus',
              networksLink: '/hub/nexus/networks',
              roadmapLink: '/hub/nexus/roadmap',
            }
        : null,
      FORGE: hasSystem(access, 'FORGE') ? { link: '/hub/forge' } : null,
      PRISM: hasSystem(access, 'PRISM') ? { link: '/hub/prism' } : null,
    },
    notifications: notif,
  });
}
