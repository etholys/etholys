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
    const status = searchParams.get('status');
    const donorName = searchParams.get('donorName');

    const where: any = { isActive: true, companyId: { in: tenant.companyIds } };
    if (companyId && tenant.companyIds.includes(companyId)) where.companyId = companyId;
    if (status) where.status = status;
    if (donorName) where.donorName = { contains: donorName, mode: 'insensitive' };

    const projects = await prisma.project.findMany({
      where,
      include: {
        company: { select: { id: true, shortName: true, name: true, color: true } },
        tasks: { select: { id: true, status: true } },
        milestones: { select: { id: true, completed: true, dueDate: true } },
        risks: { select: { id: true, level: true, status: true } },
        transactions: { select: { id: true, type: true, amount: true } },
        members: { select: { id: true } },
        objectives: { select: { id: true, status: true, target: true, actual: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Compute portfolio-level KPIs
    let totalBudget = 0;
    let totalSpent = 0;
    let totalProgress = 0;
    let totalTasks = 0;
    let doneTasks = 0;
    let totalMilestones = 0;
    let completedMilestones = 0;
    let totalRisks = 0;
    let highCriticalRisks = 0;
    const statusCounts: Record<string, number> = {};
    const companyCounts: Record<string, { name: string; count: number; budget: number }> = {};
    const donors: Set<string> = new Set();

    const projectKpis = projects.map((p: any) => {
      totalBudget += p.budget || 0;
      const pExpenses = (p.transactions || []).filter((t: any) => t.type === 'EXPENSE' || t.type === 'TRANSFER_OUT').reduce((s: number, t: any) => s + (t.amount || 0), 0);
      totalSpent += pExpenses;
      totalProgress += p.progress || 0;
      const pTasks = p.tasks?.length || 0;
      const pDone = (p.tasks || []).filter((t: any) => t.status === 'DONE').length;
      totalTasks += pTasks;
      doneTasks += pDone;
      const pMs = p.milestones?.length || 0;
      const pMsDone = (p.milestones || []).filter((m: any) => m.completed).length;
      totalMilestones += pMs;
      completedMilestones += pMsDone;
      const pRisks = p.risks?.length || 0;
      const pHighRisks = (p.risks || []).filter((r: any) => (r.level === 'HIGH' || r.level === 'CRITICAL') && r.status === 'open').length;
      totalRisks += pRisks;
      highCriticalRisks += pHighRisks;
      statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
      if (p.donorName) donors.add(p.donorName);
      const compKey = p.companyId;
      if (!companyCounts[compKey]) companyCounts[compKey] = { name: p.company?.shortName || p.company?.name || '', count: 0, budget: 0 };
      companyCounts[compKey].count++;
      companyCounts[compKey].budget += p.budget || 0;

      // Timeline adherence
      let timelineStatus = 'on_track';
      const now = new Date();
      if (p.endDate && new Date(p.endDate) < now && p.status !== 'COMPLETED' && p.status !== 'CANCELLED') {
        timelineStatus = 'overdue';
      } else if (p.endDate) {
        const total = new Date(p.endDate).getTime() - (p.startDate ? new Date(p.startDate).getTime() : now.getTime());
        const elapsed = now.getTime() - (p.startDate ? new Date(p.startDate).getTime() : now.getTime());
        const timePercent = total > 0 ? Math.round((elapsed / total) * 100) : 0;
        if (timePercent > 0 && (p.progress || 0) < timePercent - 20) timelineStatus = 'at_risk';
      }

      const financialExec = p.budget > 0 ? Math.round((pExpenses / p.budget) * 100) : 0;
      const riskScore = pHighRisks > 2 ? 'CRITICAL' : pHighRisks > 0 ? 'HIGH' : pRisks > 3 ? 'MEDIUM' : 'LOW';

      return {
        id: p.id,
        name: p.name,
        code: p.code,
        status: p.status,
        priority: p.priority,
        company: p.company,
        donorName: p.donorName,
        country: p.country,
        region: p.region,
        currency: p.currency,
        color: p.color,
        startDate: p.startDate,
        endDate: p.endDate,
        budget: p.budget,
        spent: pExpenses,
        progress: p.progress || 0,
        financialExec,
        taskCompletion: pTasks > 0 ? Math.round((pDone / pTasks) * 100) : 0,
        milestoneCompletion: pMs > 0 ? Math.round((pMsDone / pMs) * 100) : 0,
        riskScore,
        openHighRisks: pHighRisks,
        totalRisks: pRisks,
        timelineStatus,
        membersCount: p.members?.length || 0,
      };
    });

    const avgProgress = projects.length > 0 ? Math.round(totalProgress / projects.length) : 0;

    return NextResponse.json({
      summary: {
        totalProjects: projects.length,
        totalBudget,
        totalSpent,
        avgProgress,
        totalTasks,
        doneTasks,
        taskCompletion: totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0,
        totalMilestones,
        completedMilestones,
        totalRisks,
        highCriticalRisks,
        statusCounts,
        companyCounts: Object.values(companyCounts),
        donors: Array.from(donors),
      },
      projects: projectKpis,
    });
  } catch (error: any) {
    console.error('Portfolio API error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
