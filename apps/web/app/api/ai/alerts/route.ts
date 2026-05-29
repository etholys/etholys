import { NextRequest, NextResponse } from 'next/server';
import { getUserCompanyIds } from '@/lib/tenant';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/** Empresa visível: `companyId` na query (se o user pertence) ou a predefinida. */
async function resolveCompanyIdOrQuery(userId: string, companyIds: string[], fromQuery: string | null): Promise<string | null> {
  const q = fromQuery?.trim();
  if (q && companyIds.includes(q)) return q;
  return resolveCompanyId(userId);
}

// ---------------------------------------------------------------------------
// GET — list unread/recent alerts for current company
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const fromQuery = req.nextUrl.searchParams.get('companyId');
  const companyId = await resolveCompanyIdOrQuery(tenant.userId, tenant.companyIds, fromQuery);
  if (!companyId) return NextResponse.json({ error: 'No company' }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const unreadOnly = searchParams.get('unread') === 'true';

  const alerts = await prisma.aiAlert.findMany({
    where: {
      companyId,
      dismissedAt: null,
      ...(unreadOnly ? { read: false } : {}),
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
    take: 50,
  });

  return NextResponse.json(alerts);
}

// ---------------------------------------------------------------------------
// POST — generate fresh alerts for the company (run as cron or on-demand)
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { force?: boolean; companyId?: string };
  const companyId = await resolveCompanyIdOrQuery(
    tenant.userId,
    tenant.companyIds,
    typeof body.companyId === 'string' ? body.companyId : null
  );
  if (!companyId) return NextResponse.json({ error: 'No company' }, { status: 400 });

  const force = body.force === true;

  // Rate-limit: don't regenerate if last run < 30 min ago (unless forced)
  if (!force) {
    const lastAlert = await prisma.aiAlert.findFirst({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    if (lastAlert) {
      const diffMs = Date.now() - lastAlert.createdAt.getTime();
      if (diffMs < 30 * 60 * 1000) {
        return NextResponse.json({ skipped: true, reason: 'generated recently' });
      }
    }
  }

  const alerts = await generateAlerts(companyId);

  if (alerts.length > 0) {
    await prisma.aiAlert.createMany({ data: alerts });
  }

  return NextResponse.json({ generated: alerts.length, alerts });
}

// ---------------------------------------------------------------------------
// PATCH — mark alert as read or dismiss it
// ---------------------------------------------------------------------------
export async function PATCH(req: NextRequest) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    id?: string;
    action?: 'read' | 'dismiss' | 'readAll';
    companyId?: string;
  };
  const { id, action } = body;

  const companyId = await resolveCompanyIdOrQuery(
    tenant.userId,
    tenant.companyIds,
    typeof body.companyId === 'string' ? body.companyId : null
  );
  if (!companyId) return NextResponse.json({ error: 'No company' }, { status: 400 });

  if (action === 'readAll') {
    await prisma.aiAlert.updateMany({ where: { companyId, read: false }, data: { read: true } });
    return NextResponse.json({ ok: true });
  }

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  if (action === 'read') {
    await prisma.aiAlert.updateMany({ where: { id, companyId }, data: { read: true } });
  } else if (action === 'dismiss') {
    await prisma.aiAlert.updateMany({ where: { id, companyId }, data: { dismissedAt: new Date(), read: true } });
  }

  return NextResponse.json({ ok: true });
}

// ---------------------------------------------------------------------------
// Alert Generation Logic
// ---------------------------------------------------------------------------
type AlertInput = {
  companyId: string;
  userId?: string;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  link?: string;
  expiresAt?: Date;
};

async function generateAlerts(companyId: string): Promise<AlertInput[]> {
  const now = new Date();
  const in3d = new Date(now.getTime() + 3 * 86400000);
  const in7d = new Date(now.getTime() + 7 * 86400000);
  const in30d = new Date(now.getTime() + 30 * 86400000);
  const alerts: AlertInput[] = [];

  const [invoices, tasks, products, contracts, proposals, funds] = await Promise.all([
    prisma.invoice.findMany({ where: { companyId, isActive: true, status: { notIn: ['PAID', 'CANCELLED'] } }, select: { id: true, number: true, type: true, total: true, currency: true, dueDate: true, contactName: true } }),
    prisma.task.findMany({ where: { companyId, isActive: true, status: { notIn: ['DONE', 'CANCELLED'] }, dueDate: { lt: now } }, select: { id: true, title: true, priority: true, dueDate: true } }),
    prisma.product.findMany({ where: { companyId, isActive: true, minStock: { not: null } }, select: { id: true, name: true, stockQty: true, minStock: true } }),
    prisma.employeeContract.findMany({ where: { companyId, isActive: true, endDate: { not: null, lte: in30d } }, select: { id: true, position: true, endDate: true, userId: true } }),
    prisma.proposal.findMany({ where: { companyId, deletedAt: null, status: 'draft' }, select: { id: true, title: true, createdAt: true } }),
    prisma.fund.findMany({ where: { companyId, isActive: true, deadline: { not: null, lte: in30d } }, select: { id: true, name: true, deadline: true, amount: true, currency: true } }),
  ]);

  // Overdue invoices
  const overdueInv = invoices.filter((i) => i.dueDate && new Date(i.dueDate) < now);
  if (overdueInv.length > 0) {
    const totalOverdue = overdueInv.reduce((s, i) => s + i.total, 0);
    alerts.push({
      companyId,
      type: 'overdue_invoice',
      severity: 'critical',
      title: `${overdueInv.length} fatura${overdueInv.length > 1 ? 's' : ''} vencida${overdueInv.length > 1 ? 's' : ''}`,
      message: `Você tem ${overdueInv.length} fatura(s) vencida(s) com total de ${totalOverdue.toFixed(2)}. Revise e tome ação.`,
      link: '/invoices',
      expiresAt: new Date(now.getTime() + 7 * 86400000),
    });
  }

  // Invoices due in 3 days
  const dueSoon3 = invoices.filter((i) => i.dueDate && new Date(i.dueDate) >= now && new Date(i.dueDate) <= in3d);
  if (dueSoon3.length > 0) {
    alerts.push({
      companyId,
      type: 'overdue_invoice',
      severity: 'warning',
      title: `${dueSoon3.length} fatura(s) vencem em 3 dias`,
      message: `${dueSoon3.map((i) => `${i.number} (${i.total} - ${i.contactName ?? 'sem nome'})`).join(', ')}`,
      link: '/invoices',
      expiresAt: in3d,
    });
  }

  // Overdue tasks with high priority
  const criticalOverdue = tasks.filter((t) => t.priority === 'CRITICAL' || t.priority === 'HIGH');
  if (criticalOverdue.length > 0) {
    alerts.push({
      companyId,
      type: 'task_due',
      severity: criticalOverdue.some((t) => t.priority === 'CRITICAL') ? 'critical' : 'warning',
      title: `${tasks.length} tarefas em atraso`,
      message: `${criticalOverdue.length} tarefa(s) de alta prioridade estão atrasadas: ${criticalOverdue.slice(0, 3).map((t) => t.title).join(', ')}${criticalOverdue.length > 3 ? ' e mais...' : ''}`,
      link: '/tasks',
      expiresAt: in7d,
    });
  } else if (tasks.length > 0) {
    alerts.push({
      companyId,
      type: 'task_due',
      severity: 'info',
      title: `${tasks.length} tarefa(s) em atraso`,
      message: `Você possui ${tasks.length} tarefa(s) com prazo vencido.`,
      link: '/tasks',
      expiresAt: in7d,
    });
  }

  // Low stock
  const lowStock = products.filter((p) => p.minStock !== null && p.stockQty <= (p.minStock ?? 0));
  if (lowStock.length > 0) {
    alerts.push({
      companyId,
      type: 'low_stock',
      severity: 'warning',
      title: `${lowStock.length} produto(s) com estoque baixo`,
      message: `${lowStock.map((p) => `${p.name} (${p.stockQty}/${p.minStock})`).join(', ')}`,
      link: '/inventory',
      expiresAt: in7d,
    });
  }

  // Expiring contracts
  contracts.forEach((c) => {
    const daysLeft = Math.ceil((new Date(c.endDate!).getTime() - now.getTime()) / 86400000);
    alerts.push({
      companyId,
      userId: c.userId,
      type: 'hr_contract_expiry',
      severity: daysLeft <= 7 ? 'critical' : 'warning',
      title: `Contrato de ${c.position} vence em ${daysLeft} dias`,
      message: `O contrato para "${c.position}" vence em ${c.endDate?.toISOString().slice(0, 10)}. Verifique a renovação.`,
      link: '/hr',
      expiresAt: new Date(c.endDate!),
    });
  });

  // Old draft proposals (> 7 days without submission)
  const staleDrafts = proposals.filter((p) => {
    const created = new Date(p.createdAt);
    return (now.getTime() - created.getTime()) > 7 * 86400000;
  });
  if (staleDrafts.length > 0) {
    alerts.push({
      companyId,
      type: 'proposal_deadline',
      severity: 'info',
      title: `${staleDrafts.length} proposta(s) em rascunho há mais de 7 dias`,
      message: `Propostas pendentes: ${staleDrafts.map((p) => p.title).join(', ')}`,
      link: '/hub/fundhub/proposals',
      expiresAt: in7d,
    });
  }

  // Fund deadlines within 30 days
  funds.forEach((f) => {
    const daysLeft = Math.ceil((new Date(f.deadline!).getTime() - now.getTime()) / 86400000);
    alerts.push({
      companyId,
      type: 'proposal_deadline',
      severity: daysLeft <= 7 ? 'critical' : 'warning',
      title: `Fundo "${f.name}" — prazo em ${daysLeft} dias`,
      message: `O fundo "${f.name}" tem prazo até ${f.deadline?.toISOString().slice(0, 10)}. ${f.amount ? `Valor: ${f.amount} ${f.currency ?? ''}` : ''}`,
      link: '/hub/fundhub',
      expiresAt: new Date(f.deadline!),
    });
  });

  return alerts;
}

async function resolveCompanyId(userId: string): Promise<string | null> {
  const cu = await prisma.companyUser.findFirst({ where: { userId, isDefault: true } });
  if (cu) return cu.companyId;
  const any = await prisma.companyUser.findFirst({ where: { userId } });
  return any?.companyId ?? null;
}
