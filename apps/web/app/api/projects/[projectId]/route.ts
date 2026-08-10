export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { permissionsToApi, resolveProjectAccess } from '@/lib/siep/permissions';
import { canViewInformeDomain } from '@/lib/siep/permissions-shared';
import { getUserCompanyIds } from '@/lib/tenant';

export async function GET(_req: Request, { params }: { params: { projectId: string } }) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const access = await resolveProjectAccess(tenant.userId, params.projectId);
    if (!access.ok) {
      return NextResponse.json(
        { error: access.reason === 'not_found' ? 'No encontrado' : 'No autorizado' },
        { status: access.reason === 'not_found' ? 404 : 403 },
      );
    }

    const project = await prisma.project.findUnique({
      where: { id: params.projectId },
      include: {
        company: true,
        members: { include: { user: true } },
        tasks: { include: { assignee: true }, orderBy: { order: 'asc' } },
        milestones: { orderBy: { order: 'asc' } },
        risks: { orderBy: { createdAt: 'desc' } },
        transactions: { orderBy: { date: 'desc' } },
        sowSections: { where: { isActive: true }, orderBy: { order: 'asc' } },
        budgetLines: { where: { isActive: true }, orderBy: [{ category: 'asc' }, { order: 'asc' }] },
        meReports: { where: { isActive: true }, orderBy: { reportDate: 'desc' } },
        indicatorMeasurements: { orderBy: [{ period: 'asc' }, { createdAt: 'asc' }], include: { objective: { select: { id: true, title: true, code: true, type: true, indicator: true, baseline: true, target: true, actual: true } } } },
      },
    });
    if (!project) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    const allObjectives = await prisma.objective.findMany({
      where: { projectId: params.projectId, isActive: true },
      orderBy: { order: 'asc' },
    });
    const objMap = new Map<string | null, any[]>();
    for (const obj of allObjectives) {
      const pid = obj.parentId || null;
      if (!objMap.has(pid)) objMap.set(pid, []);
      objMap.get(pid)!.push(obj);
    }
    function buildTree(parentId: string | null): any[] {
      const items = objMap.get(parentId) || [];
      return items.map(item => ({ ...item, children: buildTree(item.id) }));
    }
    (project as any).objectives = buildTree(null);
    (project as any).accessMode = access.mode;
    (project as { siepPermissions?: ReturnType<typeof permissionsToApi> }).siepPermissions =
      permissionsToApi(access.permissions);

    // Redactar campos segundo permissões granulares (convidados e staff com override)
    const p = access.permissions;
    const out: any = { ...project };

    if (!p.has('siep.tasks.view') && !p.has('siep.tasks.edit') && !p.has('siep.activities.report')) {
      out.tasks = [];
      out.milestones = [];
    }
    if (!p.has('siep.logframe.view') && !p.has('siep.logframe.edit')) {
      out.objectives = [];
      out.indicatorMeasurements = [];
    }
    if (!p.has('siep.budget.view_lines') && !p.has('siep.budget.edit')) {
      out.budgetLines = [];
    }
    if (!p.has('siep.budget.view_amounts') && !p.has('siep.budget.edit') && !p.has('siep.budget.view_project_total')) {
      out.budget = null;
    }
    if (!p.has('siep.transactions.view') && !p.has('siep.transactions.edit')) {
      out.transactions = [];
    } else if (!p.has('siep.transactions.view_amounts') && !p.has('siep.transactions.edit')) {
      out.transactions = (out.transactions || []).map((t: any) => ({ ...t, amount: null }));
    }
    if (
      !p.has('siep.reports.view') &&
      !p.has('siep.reports.edit') &&
      !p.has('siep.reports.view_narrative') &&
      !p.has('siep.reports.view_me') &&
      !p.has('siep.reports.view_budget') &&
      !p.has('siep.reports.view_field')
    ) {
      out.meReports = [];
    } else if (Array.isArray(out.meReports)) {
      out.meReports = out.meReports.filter((r: any) => {
        const domain =
          r.package?.domain ||
          (r.component === 'financial'
            ? 'budget'
            : r.component === 'narrative'
              ? 'narrative'
              : r.component === 'field'
                ? 'field'
                : 'me');
        return canViewInformeDomain(p, domain);
      });
    }
    if (!p.has('siep.team.view') && !p.has('siep.team.manage_members')) {
      out.members = (out.members || []).map((m: any) => ({
        id: m.id,
        role: m.role,
        accessMode: m.accessMode,
        user: m.user ? { id: m.user.id, name: m.user.name } : null,
      }));
    }
    if (!p.has('siep.budget.view_amounts') && Array.isArray(out.budgetLines)) {
      out.budgetLines = out.budgetLines.map((l: any) => ({
        ...l,
        unitCost: null,
        total: null,
      }));
    }

    return NextResponse.json({ project: out });
  } catch (error: any) {
    console.error('Project detail error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: { projectId: string } }) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const access = await resolveProjectAccess(tenant.userId, params.projectId);
    if (!access.ok || !access.permissions.has('siep.project.edit')) {
      return NextResponse.json({ error: 'Sin permiso para editar' }, { status: 403 });
    }
    const body = await req.json();
    const project = await prisma.project.update({ where: { id: params.projectId }, data: body });
    return NextResponse.json({ project });
  } catch (error: any) {
    console.error('Update project error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { projectId: string } }) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const access = await resolveProjectAccess(tenant.userId, params.projectId);
    if (!access.ok || access.mode === 'project_guest') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
    await prisma.project.update({ where: { id: params.projectId }, data: { isActive: false } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete project error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
