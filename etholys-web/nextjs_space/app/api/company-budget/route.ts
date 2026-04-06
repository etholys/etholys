export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { DEFAULT_BUDGET_LINES } from '@/lib/company-budget-defaults';

type BudgetFlow = 'INCOME' | 'EXPENSE';

/** DB column exists even when generated Prisma Client is stale (Docker volume) and rejects `budgetFlow` in create/update. */
async function setBudgetFlowSql(itemId: string, flow: BudgetFlow) {
  await prisma.$executeRaw`
    UPDATE "CompanyBudgetItem"
    SET "budgetFlow" = ${flow}
    WHERE "id" = ${itemId}
  `;
}

// Ensure predefined lines exist for a company
async function ensureDefaults(companyId: string) {
  const existing = await prisma.companyBudgetLine.findMany({ where: { companyId } });
  if (existing.length > 0) return; // already initialized

  for (const line of DEFAULT_BUDGET_LINES) {
    const created = await prisma.companyBudgetLine.create({
      data: {
        companyId,
        name: line.name,
        nameEs: line.nameEs,
        namePt: line.namePt,
        icon: line.icon,
        color: line.color,
        order: line.order,
        isSystem: true,
      },
    });
    for (const sub of line.subcategories) {
      await prisma.companyBudgetSubcategory.create({
        data: {
          budgetLineId: created.id,
          name: sub.name,
          nameEs: sub.nameEs,
          namePt: sub.namePt,
          isSystem: true,
        },
      });
    }
  }
}

// GET: Fetch budget lines + subcategories + items for a company
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get('companyId');
  if (!companyId) return NextResponse.json({ error: 'companyId required' }, { status: 400 });

  const tenant = await getUserCompanyIds();
  if (!tenant || !tenant.companyIds.includes(companyId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await ensureDefaults(companyId);

  const lines = await prisma.companyBudgetLine.findMany({
    where: { companyId, isActive: true },
    include: {
      subcategories: { where: { isActive: true }, orderBy: { name: 'asc' } },
      items: {
        where: { isActive: true },
        include: { subcategory: true, project: { select: { id: true, name: true } }, fundingSplits: { include: { project: { select: { id: true, name: true } } }, orderBy: { periodStart: 'asc' } } },
        orderBy: { order: 'asc' },
      },
    },
    orderBy: { order: 'asc' },
  });

  const allItemIds = lines.flatMap((l) => l.items.map((i) => i.id));

  const flowById = new Map<string, BudgetFlow>();
  if (allItemIds.length > 0) {
    try {
      const rows = await prisma.$queryRaw<Array<{ id: string; budgetFlow: string }>>(
        Prisma.sql`SELECT id, "budgetFlow" FROM "CompanyBudgetItem" WHERE id IN (${Prisma.join(allItemIds)})`
      );
      for (const r of rows) {
        if (r.budgetFlow === 'INCOME' || r.budgetFlow === 'EXPENSE') flowById.set(r.id, r.budgetFlow);
      }
    } catch {
      /* coluna em falta ou cliente antigo — segue com defaults */
    }
  }

  const executedByItem = new Map<string, { amount: number; count: number }>();
  if (allItemIds.length > 0) {
    const itemMeta = new Map<string, string>();
    for (const line of lines) {
      for (const it of line.items) {
        const bf = flowById.get(it.id) ?? (it as { budgetFlow?: string }).budgetFlow ?? 'EXPENSE';
        itemMeta.set(it.id, bf);
      }
    }
    const txs = await prisma.transaction.findMany({
      where: { companyBudgetItemId: { in: allItemIds }, executionStatus: 'EXECUTED' },
      select: { companyBudgetItemId: true, type: true, amount: true },
    });
    for (const tx of txs) {
      const bid = tx.companyBudgetItemId;
      if (!bid) continue;
      const flow = itemMeta.get(bid) || 'EXPENSE';
      const expenseTypes = ['EXPENSE', 'TRANSFER_OUT'];
      const incomeTypes = ['INCOME', 'TRANSFER_IN'];
      if (flow === 'EXPENSE' && !expenseTypes.includes(tx.type)) continue;
      if (flow === 'INCOME' && !incomeTypes.includes(tx.type)) continue;
      if (!executedByItem.has(bid)) executedByItem.set(bid, { amount: 0, count: 0 });
      const agg = executedByItem.get(bid)!;
      agg.count += 1;
      agg.amount += tx.amount ?? 0;
    }
  }

  const linesOut = lines.map((line) => ({
    ...line,
    items: line.items.map((item) => {
      const ex = executedByItem.get(item.id);
      const budgetFlow = flowById.get(item.id) ?? (item as { budgetFlow?: string }).budgetFlow ?? 'EXPENSE';
      return {
        ...item,
        budgetFlow,
        executedAmount: ex?.amount ?? 0,
        executedTxCount: ex?.count ?? 0,
      };
    }),
  }));

  return NextResponse.json(linesOut);
}

// POST: Create or update budget line / subcategory / item
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { action, companyId } = body;
  if (!companyId) return NextResponse.json({ error: 'companyId required' }, { status: 400 });

  const tenant = await getUserCompanyIds();
  if (!tenant || !tenant.companyIds.includes(companyId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Create a new budget line
  if (action === 'createLine') {
    const { name, nameEs, namePt, icon, color } = body;
    const maxOrder = await prisma.companyBudgetLine.aggregate({ where: { companyId }, _max: { order: true } });
    const line = await prisma.companyBudgetLine.create({
      data: { companyId, name, nameEs, namePt, icon, color, order: (maxOrder._max.order || 0) + 1 },
    });
    return NextResponse.json(line);
  }

  // Create a subcategory
  if (action === 'createSubcategory') {
    const { budgetLineId, name, nameEs, namePt } = body;
    const sub = await prisma.companyBudgetSubcategory.create({
      data: { budgetLineId, name, nameEs, namePt },
    });
    return NextResponse.json(sub);
  }

  // Create a budget item (planning)
  if (action === 'createItem') {
    try {
      const { budgetLineId, subcategoryId, description, unit, quantity, unitCost, currency, periodStart, periodEnd, note, origin, projectId, allocationPct, budgetFlow } = body;
      if (!budgetLineId) {
        return NextResponse.json({ error: 'budgetLineId is required' }, { status: 400 });
      }
      const flow = budgetFlow === 'INCOME' ? 'INCOME' : 'EXPENSE';
      const total = (quantity || 1) * (unitCost || 0);
      const maxOrder = await prisma.companyBudgetItem.aggregate({ where: { budgetLineId }, _max: { order: true } });
      const item = await prisma.companyBudgetItem.create({
        data: {
          companyId,
          budgetLineId,
          subcategoryId: subcategoryId || null,
          description,
          unit: unit || 'month',
          quantity: quantity || 1,
          unitCost: unitCost || 0,
          total,
          currency: currency || 'USD',
          periodStart: periodStart ? new Date(periodStart) : null,
          periodEnd: periodEnd ? new Date(periodEnd) : null,
          note: note || null,
          origin: origin || 'INTERNAL',
          projectId: projectId || null,
          allocationPct: allocationPct ?? 100,
          order: (maxOrder._max.order || 0) + 1,
        },
        include: { subcategory: true, project: { select: { id: true, name: true } } },
      });
      try {
        await setBudgetFlowSql(item.id, flow);
      } catch (sqlErr) {
        await prisma.companyBudgetItem.delete({ where: { id: item.id } }).catch(() => {});
        const hint =
          'Não foi possível gravar budgetFlow. Rode na pasta nextjs_space: npx prisma db push';
        console.error('setBudgetFlowSql createItem', sqlErr);
        return NextResponse.json({ error: hint }, { status: 500 });
      }
      return NextResponse.json({ ...item, budgetFlow: flow });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not create budget item';
      console.error('createItem', e);
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

// PUT: Update budget item / line / subcategory
export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { action, id } = body;

  if (action === 'updateItem') {
    try {
      if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
      const { description, unit, quantity, unitCost, currency, periodStart, periodEnd, note, origin, projectId, allocationPct, subcategoryId, budgetLineId, budgetFlow } = body;
      const total = (quantity || 1) * (unitCost || 0);
      const flow: BudgetFlow | undefined =
        budgetFlow !== undefined ? (budgetFlow === 'INCOME' ? 'INCOME' : 'EXPENSE') : undefined;
      const item = await prisma.companyBudgetItem.update({
        where: { id },
        data: {
          ...(description !== undefined && { description }),
          ...(unit !== undefined && { unit }),
          ...(quantity !== undefined && { quantity, total }),
          ...(unitCost !== undefined && { unitCost, total }),
          ...(currency !== undefined && { currency }),
          ...(periodStart !== undefined && { periodStart: periodStart ? new Date(periodStart) : null }),
          ...(periodEnd !== undefined && { periodEnd: periodEnd ? new Date(periodEnd) : null }),
          ...(note !== undefined && { note }),
          ...(origin !== undefined && { origin }),
          ...(projectId !== undefined && { projectId: projectId || null }),
          ...(allocationPct !== undefined && { allocationPct }),
          ...(subcategoryId !== undefined && { subcategoryId: subcategoryId || null }),
          ...(budgetLineId !== undefined && { budgetLineId }),
        },
        include: { subcategory: true, project: { select: { id: true, name: true } } },
      });
      if (flow) {
        try {
          await setBudgetFlowSql(id, flow);
        } catch (sqlErr) {
          console.error('setBudgetFlowSql updateItem', sqlErr);
          return NextResponse.json(
            { error: 'Não foi possível atualizar budgetFlow. Rode: npx prisma db push' },
            { status: 500 }
          );
        }
      }
      return NextResponse.json({ ...item, ...(flow && { budgetFlow: flow }) });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not update budget item';
      console.error('updateItem', e);
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  if (action === 'updateLine') {
    const { name, nameEs, namePt, icon, color } = body;
    const line = await prisma.companyBudgetLine.update({
      where: { id },
      data: { ...(name && { name }), ...(nameEs !== undefined && { nameEs }), ...(namePt !== undefined && { namePt }), ...(icon !== undefined && { icon }), ...(color !== undefined && { color }) },
    });
    return NextResponse.json(line);
  }

  if (action === 'updateSubcategory') {
    const { name, nameEs, namePt } = body;
    const sub = await prisma.companyBudgetSubcategory.update({
      where: { id },
      data: { ...(name && { name }), ...(nameEs !== undefined && { nameEs }), ...(namePt !== undefined && { namePt }) },
    });
    return NextResponse.json(sub);
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

// DELETE: Soft delete items, lines, subcategories
export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const type = searchParams.get('type'); // item | line | subcategory
  if (!id || !type) return NextResponse.json({ error: 'id and type required' }, { status: 400 });

  if (type === 'item') {
    await prisma.companyBudgetItem.update({ where: { id }, data: { isActive: false } });
  } else if (type === 'line') {
    await prisma.companyBudgetLine.update({ where: { id }, data: { isActive: false } });
  } else if (type === 'subcategory') {
    await prisma.companyBudgetSubcategory.update({ where: { id }, data: { isActive: false } });
  }

  return NextResponse.json({ ok: true });
}
