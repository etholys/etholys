export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { fiscalRange } from '@/lib/atlas/tax-workspace';

function csvEscape(v: unknown): string {
  const s = v == null ? '' : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('companyId') || '';
    const taxYear = parseInt(searchParams.get('taxYear') || String(new Date().getUTCFullYear()), 10);
    const fiscalStartMonth = parseInt(searchParams.get('fiscalStartMonth') || '1', 10);
    if (!companyId || !tenant.companyIds.includes(companyId)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { start, end } = fiscalRange(taxYear, fiscalStartMonth);
    const txs = await prisma.transaction.findMany({
      where: { companyId, date: { gte: start, lt: end } },
      orderBy: { date: 'asc' },
      select: {
        date: true,
        type: true,
        scope: true,
        origin: true,
        executionStatus: true,
        title: true,
        category: true,
        amount: true,
        currency: true,
        description: true,
      },
    });

    const header = ['date', 'type', 'scope', 'origin', 'executionStatus', 'title', 'category', 'amount', 'currency', 'description'];
    const lines = [header.join(',')];
    for (const t of txs) {
      lines.push([
        t.date ? new Date(t.date).toISOString().slice(0, 10) : '',
        t.type,
        t.scope || 'SHARED',
        t.origin || '',
        t.executionStatus || '',
        csvEscape(t.title),
        csvEscape(t.category),
        t.amount,
        t.currency || '',
        csvEscape(t.description),
      ].join(','));
    }

    const body = lines.join('\n');
    return new NextResponse(body, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="tax-books-${taxYear}.csv"`,
      },
    });
  } catch (error: any) {
    console.error('Tax workspace export error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
