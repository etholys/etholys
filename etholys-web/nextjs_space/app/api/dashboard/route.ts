export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';

export async function GET(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('companyId');
    // Tenant isolation: restrict to user's companies
    const allowedIds = companyId && tenant.companyIds.includes(companyId)
      ? [companyId]
      : tenant.companyIds;
    const companyFilter = { companyId: { in: allowedIds } };

    // Split queries into batches to avoid connection limit
    const [projects, tasks, users] = await Promise.all([
      prisma.project.findMany({ where: { isActive: true, ...companyFilter }, include: { company: true } }),
      prisma.task.findMany({ where: { isActive: true, OR: [{ project: companyFilter }, { ...companyFilter }] }, include: { project: { include: { company: true } }, assignee: true } }),
      prisma.companyUser.findMany({ where: { companyId: { in: allowedIds } }, select: { userId: true }, distinct: ['userId'] }),
    ]);
    const [transactions, recentActivities, products] = await Promise.all([
      prisma.transaction.findMany({ where: companyFilter, orderBy: { date: 'desc' } }),
      prisma.activity.findMany({ where: { OR: [{ project: companyFilter }, { projectId: null }] }, include: { user: true, project: true }, orderBy: { createdAt: 'desc' }, take: 10 }),
      prisma.product.findMany({ where: { isActive: true, ...companyFilter } }),
    ]);
    const [clients, invoices, leaveRequests] = await Promise.all([
      prisma.client.findMany({ where: { isActive: true, ...companyFilter } }),
      prisma.invoice.findMany({ where: { isActive: true, ...companyFilter } }),
      prisma.leaveRequest.findMany({ where: companyFilter }),
    ]);

    const totalBudget = (projects ?? []).reduce((sum: number, p: any) => sum + (p?.budget ?? 0), 0);
    const totalSpent = (projects ?? []).reduce((sum: number, p: any) => sum + (p?.spent ?? 0), 0);
    const tasksByStatus = {
      BACKLOG: (tasks ?? []).filter((t: any) => t?.status === 'BACKLOG')?.length ?? 0,
      TODO: (tasks ?? []).filter((t: any) => t?.status === 'TODO')?.length ?? 0,
      IN_PROGRESS: (tasks ?? []).filter((t: any) => t?.status === 'IN_PROGRESS')?.length ?? 0,
      IN_REVIEW: (tasks ?? []).filter((t: any) => t?.status === 'IN_REVIEW')?.length ?? 0,
      DONE: (tasks ?? []).filter((t: any) => t?.status === 'DONE')?.length ?? 0,
    };
    const totalIncome = (transactions ?? []).filter((t: any) => t?.type === 'INCOME').reduce((s: number, t: any) => s + (t?.amount ?? 0), 0);
    const totalExpense = (transactions ?? []).filter((t: any) => t?.type === 'EXPENSE').reduce((s: number, t: any) => s + (t?.amount ?? 0), 0);

    const upcoming = (tasks ?? []).filter((t: any) => t?.dueDate && t?.status !== 'DONE' && t?.status !== 'CANCELLED')
      .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 5);

    // Inventory stats
    const totalProducts = products?.length ?? 0;
    const stockValue = (products ?? []).reduce((s: number, p: any) => s + (p?.costPrice ?? 0) * (p?.stockQty ?? 0), 0);
    const lowStockProducts = (products ?? []).filter((p: any) => p?.minStock && p.stockQty <= p.minStock).length;

    // Client stats
    const totalClients = clients?.length ?? 0;
    const clientsByType = {
      company: (clients ?? []).filter((c: any) => c?.type === 'company').length,
      individual: (clients ?? []).filter((c: any) => c?.type === 'individual').length,
      government: (clients ?? []).filter((c: any) => c?.type === 'government').length,
      ngo: (clients ?? []).filter((c: any) => c?.type === 'ngo').length,
    };

    // Invoice stats
    const totalReceivable = (invoices ?? []).filter((i: any) => i?.type === 'RECEIVABLE' && i?.status !== 'CANCELLED').reduce((s: number, i: any) => s + (i?.total ?? 0), 0);
    const totalPayable = (invoices ?? []).filter((i: any) => i?.type === 'PAYABLE' && i?.status !== 'CANCELLED').reduce((s: number, i: any) => s + (i?.total ?? 0), 0);
    const overdueInvoices = (invoices ?? []).filter((i: any) => i?.status === 'OVERDUE').length;

    // Leave stats
    const pendingLeaves = (leaveRequests ?? []).filter((l: any) => l?.status === 'pending').length;

    return NextResponse.json({
      stats: {
        totalProjects: projects?.length ?? 0,
        activeTasks: (tasks ?? []).filter((t: any) => t?.status !== 'DONE' && t?.status !== 'CANCELLED')?.length ?? 0,
        teamMembers: users?.length ?? 0,
        totalBudget,
        totalSpent,
        totalIncome,
        totalExpense,
        totalProducts,
        stockValue,
        lowStockProducts,
        totalClients,
        clientsByType,
        totalReceivable,
        totalPayable,
        overdueInvoices,
        pendingLeaves,
      },
      tasksByStatus,
      projects: (projects ?? []).map((p: any) => ({ id: p?.id, name: p?.name, progress: p?.progress ?? 0, status: p?.status, budget: p?.budget ?? 0, spent: p?.spent ?? 0, company: p?.company })),
      upcomingDeadlines: upcoming,
      recentActivities,
    });
  } catch (error: any) {
    console.error('Dashboard error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
