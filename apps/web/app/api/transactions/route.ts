export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';

/** Accepts JSON numbers or locale strings like "655,74" */
function parseAmount(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const s = String(v ?? '').trim().replace(/\s/g, '').replace(',', '.');
  return parseFloat(s);
}

async function syncProjectSpent(projectId: string) {
  // Only EXECUTED transactions count toward project spent (FORECAST should not contaminate SIEP)
  const totals = await prisma.transaction.aggregate({
    where: { projectId, type: { in: ['EXPENSE', 'TRANSFER_OUT'] }, executionStatus: 'EXECUTED' },
    _sum: { amount: true },
  });
  await prisma.project.update({ where: { id: projectId }, data: { spent: totals._sum.amount || 0 } });
}

function buildTxData(body: any) {
  const asExecuted =
    body.executionStatus === 'EXECUTED' ||
    body.registerAsExecuted === true ||
    body.markExecuted === true;
  return {
    companyId: body.companyId,
    projectId: body.projectId || null,
    type: body.type,
    amount: parseAmount(body.amount),
    currency: body.currency || 'USD',
    title: body.title || '',
    description: body.description || '',
    category: body.category || '',
    date: body.date ? new Date(body.date) : new Date(),
    accrualDate: body.accrualDate ? new Date(body.accrualDate) : null,
    isRecurring: body.isRecurring || false,
    recurrenceMonths: body.recurrenceMonths ? parseInt(body.recurrenceMonths) : null,
    executionStatus: asExecuted ? 'EXECUTED' : 'FORECAST',
    executedDate: asExecuted ? (body.executedDate ? new Date(body.executedDate) : new Date()) : null,
    note: body.note || null,
    origin: body.origin || null,
    budgetLineId: body.budgetLineId || null,
    scope: body.scope || 'SHARED',
    companyAmount: body.companyAmount != null ? parseAmount(body.companyAmount) : null,
    companyBudgetItemId: body.companyBudgetItemId || null,
    receiptUrl: body.receiptUrl || null,
  };
}

export async function GET(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const companyId = searchParams.get('companyId');
    const companyBudgetItemId = searchParams.get('companyBudgetItemId');
    const where: any = {};
    if (projectId) where.projectId = projectId;
    if (companyBudgetItemId) {
      const bi = await prisma.companyBudgetItem.findUnique({
        where: { id: companyBudgetItemId },
        select: { companyId: true },
      });
      if (!bi || !tenant.companyIds.includes(bi.companyId)) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
      }
      where.companyBudgetItemId = companyBudgetItemId;
    }
    if (companyId && tenant.companyIds.includes(companyId)) {
      where.companyId = companyId;
    } else {
      where.companyId = { in: tenant.companyIds };
    }
    const transactions = await prisma.transaction.findMany({ where, orderBy: { date: 'desc' }, include: { project: true, company: true } });
    return NextResponse.json({ transactions });
  } catch (error: any) {
    console.error('Transactions error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const body = await req.json();

    // Batch create
    if (Array.isArray(body.items)) {
      const created = [];
      let skipped = 0;
      for (const item of body.items) {
        const amt = parseAmount(item.amount);
        if (!item.companyId || !item.type || item.amount === '' || item.amount === undefined || Number.isNaN(amt) || amt < 0) {
          skipped++;
          continue;
        }
        if (!tenant.companyIds.includes(item.companyId)) { skipped++; continue; }
        const tx = await prisma.transaction.create({ data: buildTxData(item) });
        created.push(tx);
        if (item.projectId && (item.type === 'EXPENSE' || item.type === 'TRANSFER_OUT')) {
          await syncProjectSpent(item.projectId);
        }
      }
      if (created.length === 0 && body.items.length > 0) {
        return NextResponse.json({ error: 'No se pudo crear ninguna transacci\u00f3n. Verifica que la empresa est\u00e9 correcta y los datos completos.', skipped }, { status: 400 });
      }
      return NextResponse.json({ transactions: created, count: created.length, skipped });
    }

    // Single create
    const { companyId, type, amount } = body;
    const amt = parseAmount(amount);
    if (!companyId || !type || amount === '' || amount === undefined || Number.isNaN(amt) || amt < 0) {
      return NextResponse.json({ error: 'Datos incompletos: empresa, tipo y monto válido son obligatorios' }, { status: 400 });
    }
    if (!tenant.companyIds.includes(companyId)) return NextResponse.json({ error: 'No tienes acceso a esta empresa' }, { status: 403 });

    // If recurring with count > 1, create multiple transactions with incremented dates
    const recurrenceCount = body.isRecurring && body.recurrenceCount ? Math.min(parseInt(String(body.recurrenceCount)) || 1, 60) : 1;
    const recurrenceMonths = body.isRecurring && body.recurrenceMonths ? parseInt(String(body.recurrenceMonths)) || 1 : 1;

    // Safe month-increment: avoids JS setMonth overflow (e.g. Jan 31 + 1 month ≠ March 3)
    function addMonthsSafe(base: Date, months: number): Date {
      const y = base.getUTCFullYear();
      const m = base.getUTCMonth() + months;
      const d = base.getUTCDate();
      const targetYear = y + Math.floor(m / 12);
      const targetMonth = ((m % 12) + 12) % 12;
      const daysInTarget = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
      return new Date(Date.UTC(targetYear, targetMonth, Math.min(d, daysInTarget), base.getUTCHours(), base.getUTCMinutes()));
    }

    if (recurrenceCount > 1) {
      const created = [];
      const baseDate = body.date ? new Date(body.date) : new Date();
      const baseAccrualDate = body.accrualDate ? new Date(body.accrualDate) : null;
      const baseTitle = body.title || '';
      for (let i = 0; i < recurrenceCount; i++) {
        const txDate = addMonthsSafe(baseDate, i * recurrenceMonths);
        let txAccrualDate: Date | null = null;
        if (baseAccrualDate) {
          txAccrualDate = addMonthsSafe(baseAccrualDate, i * recurrenceMonths);
        }
        const suffix = ` (${i + 1}/${recurrenceCount})`;
        const txBody = {
          ...body,
          title: baseTitle + suffix,
          date: txDate.toISOString(),
          accrualDate: txAccrualDate ? txAccrualDate.toISOString() : null,
        };
        const tx = await prisma.transaction.create({ data: buildTxData(txBody) });
        created.push(tx);
      }
      if (body.projectId && (type === 'EXPENSE' || type === 'TRANSFER_OUT')) {
        await syncProjectSpent(body.projectId);
      }
      return NextResponse.json({ transactions: created, count: created.length });
    }

    const transaction = await prisma.transaction.create({ data: buildTxData(body) });
    if (body.projectId && (type === 'EXPENSE' || type === 'TRANSFER_OUT')) {
      await syncProjectSpent(body.projectId);
    }
    return NextResponse.json({ transaction });
  } catch (error: any) {
    console.error('Create transaction error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const body = await req.json();

    // Batch update
    if (Array.isArray(body.items)) {
      const updated = [];
      for (const item of body.items) {
        if (!item.id) continue;
        const existing = await prisma.transaction.findUnique({ where: { id: item.id } });
        if (!existing || !tenant.companyIds.includes(existing.companyId)) continue;
        const updateData: any = {};
        if (item.companyId !== undefined && item.companyId && tenant.companyIds.includes(item.companyId)) updateData.companyId = item.companyId;
        if (item.type !== undefined) updateData.type = item.type;
        if (item.amount !== undefined) updateData.amount = parseAmount(item.amount);
        if (item.currency !== undefined) updateData.currency = item.currency;
        if (item.title !== undefined) updateData.title = item.title;
        if (item.description !== undefined) updateData.description = item.description;
        if (item.category !== undefined) updateData.category = item.category;
        if (item.date !== undefined) updateData.date = new Date(item.date);
        if (item.accrualDate !== undefined) updateData.accrualDate = item.accrualDate ? new Date(item.accrualDate) : null;
        if (item.projectId !== undefined) updateData.projectId = item.projectId || null;
        if (item.executionStatus !== undefined) updateData.executionStatus = item.executionStatus;
        if (item.executedDate !== undefined) updateData.executedDate = item.executedDate ? new Date(item.executedDate) : null;
        if (item.isRecurring !== undefined) updateData.isRecurring = item.isRecurring;
        if (item.recurrenceMonths !== undefined) updateData.recurrenceMonths = item.recurrenceMonths ? parseInt(item.recurrenceMonths) : null;
        if (item.note !== undefined) updateData.note = item.note || null;
        if (item.origin !== undefined) updateData.origin = item.origin || null;
        if (item.budgetLineId !== undefined) updateData.budgetLineId = item.budgetLineId || null;
        if (item.scope !== undefined) updateData.scope = item.scope;
        if (item.companyAmount !== undefined) updateData.companyAmount = item.companyAmount != null ? parseFloat(item.companyAmount) : null;
        if (item.companyBudgetItemId !== undefined) updateData.companyBudgetItemId = item.companyBudgetItemId || null;
        if (item.receiptUrl !== undefined) updateData.receiptUrl = item.receiptUrl || null;
        // When marking as EXECUTED, ensure executedDate is set
        if (item.executionStatus === 'EXECUTED' && !updateData.executedDate) {
          updateData.executedDate = new Date();
        }
        // When reverting to FORECAST, clear executedDate
        if (item.executionStatus === 'FORECAST') {
          updateData.executedDate = null;
        }
        const tx = await prisma.transaction.update({ where: { id: item.id }, data: updateData });
        updated.push(tx);
        if (existing.projectId) await syncProjectSpent(existing.projectId);
        if (tx.projectId && tx.projectId !== existing.projectId) await syncProjectSpent(tx.projectId);
      }
      return NextResponse.json({ transactions: updated, count: updated.length });
    }

    // Single update
    if (!body.id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    const existing = await prisma.transaction.findUnique({ where: { id: body.id } });
    if (!existing || !tenant.companyIds.includes(existing.companyId)) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    const updateData: any = {};
    if (body.companyId !== undefined && body.companyId && tenant.companyIds.includes(body.companyId)) updateData.companyId = body.companyId;
    if (body.type !== undefined) updateData.type = body.type;
    if (body.amount !== undefined) updateData.amount = parseAmount(body.amount);
    if (body.currency !== undefined) updateData.currency = body.currency;
    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.category !== undefined) updateData.category = body.category;
    if (body.date !== undefined) updateData.date = new Date(body.date);
    if (body.accrualDate !== undefined) updateData.accrualDate = body.accrualDate ? new Date(body.accrualDate) : null;
    if (body.projectId !== undefined) updateData.projectId = body.projectId || null;
    if (body.executionStatus !== undefined) updateData.executionStatus = body.executionStatus;
    if (body.executedDate !== undefined) updateData.executedDate = body.executedDate ? new Date(body.executedDate) : null;
    if (body.isRecurring !== undefined) updateData.isRecurring = body.isRecurring;
    if (body.recurrenceMonths !== undefined) updateData.recurrenceMonths = body.recurrenceMonths ? parseInt(body.recurrenceMonths) : null;
    if (body.note !== undefined) updateData.note = body.note || null;
    if (body.origin !== undefined) updateData.origin = body.origin || null;
    if (body.scope !== undefined) updateData.scope = body.scope;
    if (body.companyAmount !== undefined) updateData.companyAmount = body.companyAmount != null ? parseFloat(body.companyAmount) : null;
    if (body.companyBudgetItemId !== undefined) updateData.companyBudgetItemId = body.companyBudgetItemId || null;
    if (body.receiptUrl !== undefined) updateData.receiptUrl = body.receiptUrl || null;
    // When marking as EXECUTED, ensure executedDate is set
    if (body.executionStatus === 'EXECUTED' && !updateData.executedDate) {
      updateData.executedDate = new Date();
    }
    // When reverting to FORECAST, clear executedDate
    if (body.executionStatus === 'FORECAST') {
      updateData.executedDate = null;
    }

    const transaction = await prisma.transaction.update({ where: { id: body.id }, data: updateData });
    if (existing.projectId) await syncProjectSpent(existing.projectId);
    if (transaction.projectId && transaction.projectId !== existing.projectId) await syncProjectSpent(transaction.projectId);
    return NextResponse.json({ transaction });
  } catch (error: any) {
    console.error('Update transaction error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const ids = searchParams.get('ids'); // batch: comma-separated

    if (ids) {
      const idList = ids.split(',').filter(Boolean);
      const txs = await prisma.transaction.findMany({ where: { id: { in: idList } } });
      const allowed = txs.filter(tx => tenant.companyIds.includes(tx.companyId));
      const allowedIds = allowed.map(tx => tx.id);
      await prisma.transaction.deleteMany({ where: { id: { in: allowedIds } } });
      const projectIds = [...new Set(allowed.filter(tx => tx.projectId).map(tx => tx.projectId!))];
      for (const pid of projectIds) await syncProjectSpent(pid);
      return NextResponse.json({ success: true, deleted: allowedIds.length });
    }

    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    const tx = await prisma.transaction.findUnique({ where: { id } });
    if (!tx || !tenant.companyIds.includes(tx.companyId)) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    await prisma.transaction.delete({ where: { id } });
    if (tx?.projectId) await syncProjectSpent(tx.projectId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete transaction error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
