export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import {
  TAX_COUNTRY_PACKS,
  countryPack,
  fiscalRange,
  seedObligationState,
  summarizeTaxYear,
} from '@/lib/atlas/tax-workspace';

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

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        shortName: true,
        currency: true,
        ein: true,
        taxAddress: true,
        incorporationCountry: true,
        incorporationDate: true,
        entityType: true,
        businessActivity: true,
        businessActivityCode: true,
      },
    });
    if (!company) return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 404 });

    const { start, end } = fiscalRange(taxYear, fiscalStartMonth);
    const [transactions, invoices] = await Promise.all([
      prisma.transaction.findMany({
        where: { companyId, date: { gte: start, lt: end } },
        select: {
          type: true,
          amount: true,
          currency: true,
          category: true,
          title: true,
          date: true,
          executionStatus: true,
          scope: true,
          origin: true,
        },
      }),
      prisma.invoice.findMany({
        where: { companyId, isActive: true, issueDate: { gte: start, lt: end } },
        select: { type: true, status: true, taxAmount: true, total: true, subtotal: true, issueDate: true },
      }),
    ]);

    const summary = summarizeTaxYear(transactions, invoices, {
      taxYear,
      currency: company.currency || 'USD',
      fiscalStartMonth,
    });
    const pack = countryPack(company.incorporationCountry);

    return NextResponse.json({
      company,
      pack: {
        code: pack.code,
        taxIdLabel: pack.taxIdLabel,
        vatName: pack.vatName,
        entityHints: pack.entityHints,
        obligations: pack.obligations,
        defaultStatuses: seedObligationState(pack),
      },
      countries: TAX_COUNTRY_PACKS.map((p) => ({
        code: p.code,
        region: p.region,
        nameEn: p.nameEn,
        nameEs: p.nameEs,
        namePt: p.namePt,
        taxIdLabel: p.taxIdLabel,
        vatName: p.vatName,
        entityHints: p.entityHints,
      })),
      summary,
    });
  } catch (error: any) {
    console.error('Tax workspace summary error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
