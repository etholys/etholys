export const dynamic = 'force-dynamic';

import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { DEFAULT_BUDGET_LINES } from '@/lib/company-budget-defaults';

/**
 * SIEP → ATLAS Budget Sync
 *
 * Reads a project's BudgetLines + ProjectMembers (with HR contracts)
 * and creates/updates CompanyBudgetItems in the company budget.
 *
 * For PERSONNEL lines: uses HR salary × dedicationPct from ProjectMember
 * For other lines: maps directly from project BudgetLine → CompanyBudgetItem
 *
 * If a member is 100% project-funded across all projects,
 * the "freed" internal salary appears as available revenue.
 */

// Map SIEP budget categories → ATLAS company budget line names
const CATEGORY_TO_COMPANY_LINE: Record<string, string> = {
  personnel: 'Personal / Personnel',
  fringe: 'Insurance & Taxes',      // fringe → insurance/taxes line
  travel: 'Travel',
  equipment: 'Supplies & Equipment',
  supplies: 'Supplies & Equipment',
  contractual: 'Contractual / Services',
  other_direct: 'Other',
  indirect: 'Other',
};

async function ensureCompanyBudgetLines(companyId: string) {
  const existing = await prisma.companyBudgetLine.findMany({ where: { companyId } });
  if (existing.length > 0) return;
  for (const line of DEFAULT_BUDGET_LINES) {
    const created = await prisma.companyBudgetLine.create({
      data: {
        companyId, name: line.name, nameEs: line.nameEs, namePt: line.namePt,
        icon: line.icon, color: line.color, order: line.order, isSystem: true,
      },
    });
    for (const sub of line.subcategories) {
      await prisma.companyBudgetSubcategory.create({
        data: { budgetLineId: created.id, name: sub.name, nameEs: sub.nameEs, namePt: sub.namePt, isSystem: true },
      });
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const body = await req.json();
    const { projectId } = body;
    if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });

    // Fetch project with all needed relations
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        company: true,
        budgetLines: { where: { isActive: true }, orderBy: { order: 'asc' } },
        members: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    if (!project || !project.companyId) {
      return NextResponse.json({ error: 'Proyecto no encontrado o sin empresa vinculada' }, { status: 404 });
    }

    if (!tenant.companyIds.includes(project.companyId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const companyId = project.companyId;
    await ensureCompanyBudgetLines(companyId);

    // Get company budget lines map (name → id)
    const companyLines = await prisma.companyBudgetLine.findMany({
      where: { companyId, isActive: true },
    });
    const lineMap = new Map(companyLines.map(l => [l.name, l.id]));

    // Get HR contracts for all project members
    const memberUserIds = project.members.map(m => m.userId);
    const contracts = memberUserIds.length > 0
      ? await prisma.employeeContract.findMany({
          where: { companyId, userId: { in: memberUserIds }, isActive: true },
          orderBy: { startDate: 'desc' },
        })
      : [];
    // Latest contract per user
    const contractByUser = new Map<string, any>();
    for (const c of contracts) {
      if (!contractByUser.has(c.userId)) contractByUser.set(c.userId, c);
    }

    const created: any[] = [];
    const updated: any[] = [];
    const skipped: string[] = [];
    const revenueItems: any[] = [];

    // ─── 1. Sync NON-personnel budget lines ───
    for (const bl of project.budgetLines) {
      if (bl.category === 'personnel') continue; // handled separately

      const companyLineName = CATEGORY_TO_COMPANY_LINE[bl.category] || 'Other';
      const companyLineId = lineMap.get(companyLineName);
      if (!companyLineId) { skipped.push(`No company line for category: ${bl.category}`); continue; }

      // Check if already synced (look for existing item with same projectId + description)
      const existing = await prisma.companyBudgetItem.findFirst({
        where: {
          companyId, projectId, budgetLineId: companyLineId,
          description: bl.description, isActive: true,
        },
      });

      if (existing) {
        // Update
        const upd = await prisma.companyBudgetItem.update({
          where: { id: existing.id },
          data: {
            unit: bl.unit || 'month',
            quantity: bl.quantity,
            unitCost: bl.unitCost,
            total: bl.total,
            periodStart: bl.periodStart,
            periodEnd: bl.periodEnd,
            origin: 'PROJECT',
            allocationPct: 100,
          },
        });
        updated.push(upd);
      } else {
        const maxOrder = await prisma.companyBudgetItem.aggregate({ where: { budgetLineId: companyLineId }, _max: { order: true } });
        const item = await prisma.companyBudgetItem.create({
          data: {
            companyId, budgetLineId: companyLineId,
            description: `[${project.name}] ${bl.description}`,
            unit: bl.unit || 'month',
            quantity: bl.quantity,
            unitCost: bl.unitCost,
            total: bl.total,
            periodStart: bl.periodStart,
            periodEnd: bl.periodEnd,
            origin: 'PROJECT',
            projectId,
            allocationPct: 100,
            order: (maxOrder._max.order || 0) + 1,
          },
        });
        created.push(item);
      }
    }

    // ─── 2. Sync PERSONNEL from project members + HR contracts ───
    const personnelLineId = lineMap.get('Personal / Personnel');
    if (personnelLineId && project.members.length > 0) {
      for (const member of project.members) {
        const contract = contractByUser.get(member.userId);
        const userName = member.user?.name || member.user?.email || 'Funcionário';
        const dedicationPct = (member as any).dedicationPct ?? 100;

        // Calculate cost: use monthlyCost override, or HR salary × dedicationPct
        let monthlyCost = (member as any).monthlyCost;
        let baseSalary = contract?.salary || 0;
        if (!monthlyCost && baseSalary > 0) {
          monthlyCost = baseSalary * (dedicationPct / 100);
        }

        if (!monthlyCost || monthlyCost <= 0) {
          skipped.push(`${userName}: sem salário no RH e sem custo manual definido`);
          continue;
        }

        // Calculate quantity (months) from project dates
        const pStart = project.startDate || bl_periodStart(project.budgetLines);
        const pEnd = project.endDate || bl_periodEnd(project.budgetLines);
        let months = 12; // default
        if (pStart && pEnd) {
          const diffMs = new Date(pEnd).getTime() - new Date(pStart).getTime();
          months = Math.max(1, Math.ceil(diffMs / (30.44 * 24 * 3600 * 1000)));
        }

        const description = `[${project.name}] ${userName} (${dedicationPct}%)`;

        const existing = await prisma.companyBudgetItem.findFirst({
          where: { companyId, projectId, budgetLineId: personnelLineId, description: { contains: userName }, isActive: true },
        });

        if (existing) {
          const upd = await prisma.companyBudgetItem.update({
            where: { id: existing.id },
            data: {
              description,
              unit: 'month',
              quantity: months,
              unitCost: monthlyCost,
              total: months * monthlyCost,
              periodStart: pStart ? new Date(pStart) : null,
              periodEnd: pEnd ? new Date(pEnd) : null,
              origin: 'PROJECT',
              allocationPct: dedicationPct,
            },
          });
          updated.push(upd);
        } else {
          const maxOrder = await prisma.companyBudgetItem.aggregate({ where: { budgetLineId: personnelLineId }, _max: { order: true } });
          const item = await prisma.companyBudgetItem.create({
            data: {
              companyId, budgetLineId: personnelLineId,
              description,
              unit: 'month',
              quantity: months,
              unitCost: monthlyCost,
              total: months * monthlyCost,
              periodStart: pStart ? new Date(pStart) : null,
              periodEnd: pEnd ? new Date(pEnd) : null,
              origin: 'PROJECT',
              projectId,
              allocationPct: dedicationPct,
              order: (maxOrder._max.order || 0) + 1,
            },
          });
          created.push(item);
        }

        // ─── 3. Revenue detection: check if employee is 100% project-funded ───
        if (baseSalary > 0) {
          // Get all project allocations for this user
          const allAllocations = await prisma.projectMember.findMany({
            where: { userId: member.userId },
            include: { project: { select: { id: true, name: true, status: true } } },
          });
          const totalDedication = allAllocations
            .filter(a => a.project.status !== 'COMPLETED' && a.project.status !== 'CANCELLED')
            .reduce((sum, a) => sum + ((a as any).dedicationPct ?? 100), 0);

          if (totalDedication >= 100) {
            // This employee is fully project-funded!
            // The internal salary freed = baseSalary × min(totalDedication, 100) / 100
            // This becomes "available revenue" from projects
            revenueItems.push({
              employee: userName,
              baseSalary,
              totalDedication: Math.min(totalDedication, 100),
              freedAmount: baseSalary, // full salary covered by projects
              projects: allAllocations.map(a => ({ name: a.project.name, pct: (a as any).dedicationPct ?? 100 })),
            });
          }
        }
      }
    }

    // ─── 4. Create BudgetItemFunding splits for multi-project items ───
    // (For items linked to this project, ensure funding record exists)
    const allProjectItems = await prisma.companyBudgetItem.findMany({
      where: { companyId, projectId, isActive: true },
    });
    for (const item of allProjectItems) {
      const existingFunding = await prisma.budgetItemFunding.findFirst({
        where: { budgetItemId: item.id, projectId },
      });
      if (!existingFunding) {
        await prisma.budgetItemFunding.create({
          data: {
            budgetItemId: item.id,
            projectId,
            percentage: item.allocationPct,
            periodStart: item.periodStart,
            periodEnd: item.periodEnd,
            note: `Auto-synced from project: ${project.name}`,
          },
        });
      } else {
        await prisma.budgetItemFunding.update({
          where: { id: existingFunding.id },
          data: {
            percentage: item.allocationPct,
            periodStart: item.periodStart,
            periodEnd: item.periodEnd,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        created: created.length,
        updated: updated.length,
        skipped,
        revenueItems,
        totalSynced: created.length + updated.length,
      },
    });
  } catch (e: any) {
    console.error('sync-project-budget error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// Helper: get earliest periodStart from budget lines
function bl_periodStart(lines: any[]): Date | null {
  const dates = lines.filter(l => l.periodStart).map(l => new Date(l.periodStart));
  return dates.length > 0 ? new Date(Math.min(...dates.map(d => d.getTime()))) : null;
}

// Helper: get latest periodEnd from budget lines
function bl_periodEnd(lines: any[]): Date | null {
  const dates = lines.filter(l => l.periodEnd).map(l => new Date(l.periodEnd));
  return dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : null;
}

// GET: Get allocation summary for all employees in a company
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('companyId');
    if (!companyId || !tenant.companyIds.includes(companyId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get all active contracts
    const contracts = await prisma.employeeContract.findMany({
      where: { companyId, isActive: true },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    // Get all project allocations for these employees
    const userIds = contracts.map(c => c.userId);
    const allocations = userIds.length > 0
      ? await prisma.projectMember.findMany({
          where: { userId: { in: userIds } },
          include: { project: { select: { id: true, name: true, status: true, startDate: true, endDate: true } } },
        })
      : [];

    // Build allocation summary per employee
    const summary = contracts.map(contract => {
      const userAllocs = allocations.filter(a => a.userId === contract.userId);
      const activeAllocs = userAllocs.filter(a => 
        a.project.status !== 'COMPLETED' && a.project.status !== 'CANCELLED'
      );
      const totalDedication = activeAllocs.reduce((sum, a) => sum + ((a as any).dedicationPct ?? 100), 0);
      const baseSalary = contract.salary || 0;
      const projectFundedAmount = baseSalary * Math.min(totalDedication, 100) / 100;
      const internalCost = baseSalary - projectFundedAmount;
      const isFullyFunded = totalDedication >= 100;

      return {
        userId: contract.userId,
        userName: (contract as any).user?.name || (contract as any).user?.email || '?',
        position: contract.position,
        baseSalary,
        currency: contract.currency,
        totalDedication: Math.min(totalDedication, 150), // cap display
        projectFundedAmount,
        internalCost,
        isFullyFunded,
        freedAsRevenue: isFullyFunded ? projectFundedAmount - baseSalary + baseSalary : 0,
        projects: activeAllocs.map(a => ({
          id: a.project.id,
          name: a.project.name,
          dedicationPct: (a as any).dedicationPct ?? 100,
          monthlyCost: (a as any).monthlyCost || (baseSalary * ((a as any).dedicationPct ?? 100) / 100),
        })),
      };
    });

    return NextResponse.json({ summary });
  } catch (e: any) {
    console.error('sync-project-budget GET error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
