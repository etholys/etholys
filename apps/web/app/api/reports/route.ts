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
    const allowedIds = companyId && tenant.companyIds.includes(companyId)
      ? [companyId]
      : tenant.companyIds;
    const companyFilter = { companyId: { in: allowedIds } };

    const [projects, tasks, companies] = await Promise.all([
      prisma.project.findMany({ where: { isActive: true, ...companyFilter }, include: { company: true, transactions: true } }),
      prisma.task.findMany({ where: { isActive: true, OR: [{ project: companyFilter }, { ...companyFilter }] } }),
      prisma.company.findMany({ where: { isActive: true, id: { in: allowedIds } } }),
    ]);

    const projectSummary = (projects ?? []).map((p: any) => ({
      id: p?.id, name: p?.name, status: p?.status, budget: p?.budget ?? 0, spent: p?.spent ?? 0,
      progress: p?.progress ?? 0, company: p?.company,
      income: (p?.transactions ?? []).filter((t: any) => t?.type === 'INCOME').reduce((s: number, t: any) => s + (t?.amount ?? 0), 0),
      expenses: (p?.transactions ?? []).filter((t: any) => t?.type === 'EXPENSE').reduce((s: number, t: any) => s + (t?.amount ?? 0), 0),
    }));

    const companyBudgets = (companies ?? []).map((c: any) => {
      const cProjects = (projects ?? []).filter((p: any) => p?.companyId === c?.id);
      return { name: c?.shortName ?? '', budget: cProjects.reduce((s: number, p: any) => s + (p?.budget ?? 0), 0), spent: cProjects.reduce((s: number, p: any) => s + (p?.spent ?? 0), 0) };
    });

    const taskCompletion = [
      { name: 'Completadas', value: (tasks ?? []).filter((t: any) => t?.status === 'DONE')?.length ?? 0 },
      { name: 'En Progreso', value: (tasks ?? []).filter((t: any) => t?.status === 'IN_PROGRESS')?.length ?? 0 },
      { name: 'Pendientes', value: (tasks ?? []).filter((t: any) => ['BACKLOG', 'TODO'].includes(t?.status))?.length ?? 0 },
    ];

    return NextResponse.json({ projectSummary, companyBudgets, taskCompletion });
  } catch (error: any) {
    console.error('Reports error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
