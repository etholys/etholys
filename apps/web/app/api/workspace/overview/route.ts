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
import { companyHasHubTool } from '@/lib/hub-tool-addons';
import { getCompanyEntitlements } from '@/lib/billing/company-entitlements';

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

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true, shortName: true, currency: true },
  });
  const entitlements = await getCompanyEntitlements(companyId);
  const toolOpts = {
    billingEnforced: entitlements.billingEnforced,
    addOnCodes: entitlements.addOnCodes,
  };
  const tools = {
    work: companyHasHubTool('WORK', toolOpts),
    meet: true,
    studio: companyHasHubTool('STUDIO', toolOpts),
  };

  const now = new Date();
  const [
    incomeAgg,
    expenseAgg,
    tasksOpen,
    workTasks,
    invoicesOverdue,
    projectsActive,
    proposalsOpen,
    notif,
    purchaseOrdersInFlight,
    productsLowStock,
    fundhubDiscoveryLatest,
    advisorAlerts,
    forgeCourses,
    meetUpcoming,
    studioDocs,
    auroraEngagements,
    polarisBaseline,
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
    tools.work
      ? prisma.task.findMany({
          where: {
            isActive: true,
            companyId,
            projectId: null,
            status: { notIn: ['DONE', 'CANCELLED'] },
            OR: [{ assigneeId: tenant.userId }, { creatorId: tenant.userId }],
          },
          orderBy: [{ dueDate: 'asc' }, { updatedAt: 'desc' }],
          take: 6,
          select: {
            id: true,
            title: true,
            status: true,
            dueDate: true,
            assigneeId: true,
          },
        })
      : Promise.resolve([]),
    hasSystem(access, 'ATLAS')
      ? prisma.invoice.count({
          where: {
            companyId,
            isActive: true,
            status: { notIn: ['PAID', 'CANCELLED'] },
            dueDate: { lt: now },
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
      take: 8,
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
    prisma.aiAlert.findMany({
      where: {
        companyId,
        dismissedAt: null,
        read: false,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
      take: 6,
      select: {
        id: true,
        type: true,
        severity: true,
        title: true,
        message: true,
        read: true,
        link: true,
        createdAt: true,
      },
    }),
    hasSystem(access, 'FORGE')
      ? prisma.forgeCourse.findMany({
          where: { companyId },
          take: 5,
          orderBy: { updatedAt: 'desc' },
          select: { id: true, title: true, status: true, updatedAt: true },
        })
      : Promise.resolve([]),
    tools.meet
      ? prisma.meetSession.findMany({
          where: {
            companyId,
            status: { in: ['scheduled', 'live'] },
            OR: [{ scheduledAt: { gte: now } }, { status: 'live' }, { isPermanent: true }],
          },
          take: 5,
          orderBy: [{ status: 'asc' }, { scheduledAt: 'asc' }],
          select: {
            id: true,
            title: true,
            status: true,
            scheduledAt: true,
            roomSlug: true,
            meetingUrl: true,
            isPermanent: true,
          },
        })
      : Promise.resolve([]),
    tools.studio
      ? prisma.studioDocument.findMany({
          where: { companyId },
          take: 5,
          orderBy: { updatedAt: 'desc' },
          select: { id: true, title: true, status: true, updatedAt: true, format: true },
        })
      : Promise.resolve([]),
    hasSystem(access, 'NEXUS')
      ? prisma.nexusAtEngagement.findMany({
          where: {
            operatorCompanyId: companyId,
            isActive: true,
            status: { notIn: ['CLOSED'] },
          },
          take: 4,
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            title: true,
            status: true,
            updatedAt: true,
            members: {
              where: { memberRole: { in: ['client', 'principal'] } },
              take: 1,
              select: { company: { select: { id: true, shortName: true, name: true } } },
            },
          },
        })
      : Promise.resolve([]),
    hasSystem(access, 'NEXUS')
      ? prisma.businessDossier
          .findFirst({
            where: { companyId },
            select: { id: true, updatedAt: true },
            orderBy: { updatedAt: 'desc' },
          })
          .catch(() => null)
      : Promise.resolve(null),
  ]);

  const balance = (incomeAgg._sum.amount ?? 0) - (expenseAgg._sum.amount ?? 0);

  let nexus: { networkCount: number; pendingRoadmap: number } | null = null;
  if (hasSystem(access, 'NEXUS')) {
    const networks = await listNetworksForTenant(tenant.companyIds);
    const companyNetworks = networks.filter(
      (n) => n.members.some((m) => m.companyId === companyId) || n.anchorCompanyId === companyId
    );
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

  const futureHorizon = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000);
  const projList = hasSystem(access, 'SIEP')
    ? (projectsActive as {
        id: string;
        name: string;
        status: string;
        progress: number;
        endDate: Date | null;
      }[])
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

  // Project tasks for SIEP stage (first project)
  let siepProjectTasks: Array<{
    id: string;
    title: string;
    status: string;
    projectId: string;
  }> = [];
  if (hasSystem(access, 'SIEP') && projList.length > 0) {
    siepProjectTasks = await prisma.task.findMany({
      where: {
        isActive: true,
        projectId: { in: projList.slice(0, 2).map((p) => p.id) },
        status: { notIn: ['DONE', 'CANCELLED'] },
      },
      take: 4,
      orderBy: [{ dueDate: 'asc' }, { updatedAt: 'desc' }],
      select: { id: true, title: true, status: true, projectId: true },
    });
  }

  let radarModules: Array<{ id: string; label: string; href: string }> | null = null;
  if (hasSystem(access, 'NEXUS')) {
    radarModules = [
      { id: 'agriculture', label: 'Agricultura', href: '/hub/radar' },
      { id: 'agroindustry', label: 'Agroindústria', href: '/hub/radar' },
      { id: 'livestock', label: 'Pecuária', href: '/hub/radar' },
      { id: 'carbon', label: 'Carbono', href: '/hub/radar' },
    ];
  }

  const systems = access.systems;
  return NextResponse.json({
    meta: { freshAt: new Date().toISOString() },
    company,
    access: { systems: systems as WorkspaceSystemKey[] },
    tools,
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
            projects: projList.map((p) => ({
              id: p.id,
              name: p.name,
              status: p.status,
              progress: p.progress,
              href: `/siep/projects/${p.id}`,
            })),
            projectTasks: siepProjectTasks,
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
            proposals: (
              proposalsOpen as { id: string; title: string; status: string; workspaceId: string }[]
            ).map((p) => ({
              id: p.id,
              title: p.title,
              status: p.status,
              editorHref: `/hub/fundhub/proposals/editor?workspace=${encodeURIComponent(p.workspaceId)}`,
            })),
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
        ? {
            ...(nexus ?? { networkCount: 0, pendingRoadmap: 0 }),
            link: '/hub/nexus',
            networksLink: '/hub/nexus/networks',
            roadmapLink: '/hub/nexus/roadmap',
            AURORA: {
              engagements: (
                auroraEngagements as Array<{
                  id: string;
                  title: string;
                  status: string;
                  members: Array<{
                    company: { id: string; shortName: string; name: string };
                  }>;
                }>
              ).map((e) => {
                const attended = e.members[0]?.company;
                return {
                  id: e.id,
                  status: e.status,
                  name: attended?.shortName || attended?.name || e.title || e.id,
                  href: `/hub/aurora?engagement=${encodeURIComponent(e.id)}`,
                };
              }),
              link: '/hub/aurora',
            },
            POLARIS: {
              hasBaseline: Boolean(polarisBaseline),
              updatedAt:
                polarisBaseline && typeof polarisBaseline === 'object' && 'updatedAt' in polarisBaseline
                  ? (polarisBaseline as { updatedAt: Date }).updatedAt.toISOString()
                  : null,
              link: '/hub/polaris',
              diagnosisLink: '/hub/polaris/diagnosis',
            },
            RADAR: {
              modules: radarModules,
              link: '/hub/radar',
            },
          }
        : null,
      FORGE: hasSystem(access, 'FORGE')
        ? {
            courses: (
              forgeCourses as Array<{ id: string; title: string; status: string; updatedAt: Date }>
            ).map((c) => ({
              id: c.id,
              title: c.title,
              status: c.status,
              href: `/hub/forge/cursos/${c.id}`,
            })),
            link: '/hub/forge',
          }
        : null,
      PRISM: hasSystem(access, 'PRISM')
        ? {
            link: '/hub/prism',
            note: 'impact_snapshot_pending',
          }
        : null,
      WORK: tools.work
        ? {
            tasks: (
              workTasks as Array<{
                id: string;
                title: string;
                status: string;
                dueDate: Date | null;
                assigneeId: string | null;
              }>
            ).map((t) => ({
              id: t.id,
              title: t.title,
              status: t.status,
              dueDate: t.dueDate?.toISOString() ?? null,
              mine: t.assigneeId === tenant.userId,
            })),
            link: '/hub/work',
          }
        : null,
      MEET: tools.meet
        ? {
            sessions: (
              meetUpcoming as Array<{
                id: string;
                title: string;
                status: string;
                scheduledAt: Date | null;
                roomSlug: string;
                meetingUrl: string | null;
                isPermanent: boolean;
              }>
            ).map((s) => ({
              id: s.id,
              title: s.title,
              status: s.status,
              scheduledAt: s.scheduledAt?.toISOString() ?? null,
              href: s.meetingUrl || `/hub/meet/${s.id}`,
              isPermanent: s.isPermanent,
            })),
            link: '/hub/meet',
          }
        : null,
      STUDIO: tools.studio
        ? {
            documents: (
              studioDocs as Array<{
                id: string;
                title: string;
                status: string;
                updatedAt: Date;
                format: string;
              }>
            ).map((d) => ({
              id: d.id,
              title: d.title,
              status: d.status,
              format: d.format,
              href: `/hub/studio/${d.id}`,
            })),
            link: '/hub/studio',
          }
        : null,
    },
    notifications: notif,
  });
}
