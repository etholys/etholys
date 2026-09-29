export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { countryPack, fiscalRange, summarizeTaxYear } from '@/lib/atlas/tax-workspace';

/**
 * Auto-populate tax workspace / official form fields from ATLAS books.
 * POST body: { companyId, formType, taxYear, fiscalStartMonth? }
 */
export async function POST(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { companyId, formType, taxYear, fiscalStartMonth } = await req.json();
    if (!companyId || !formType || !taxYear) {
      return NextResponse.json({ error: 'Parámetros requeridos' }, { status: 400 });
    }
    if (!tenant.companyIds.includes(companyId)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 404 });

    const startMonth = parseInt(String(fiscalStartMonth || 1), 10) || 1;
    const { start, end } = fiscalRange(parseInt(String(taxYear), 10), startMonth);
    const [transactions, invoices] = await Promise.all([
      prisma.transaction.findMany({
        where: { companyId, date: { gte: start, lt: end } },
        orderBy: { date: 'asc' },
      }),
      prisma.invoice.findMany({
        where: { companyId, isActive: true, issueDate: { gte: start, lt: end } },
        select: { type: true, status: true, taxAmount: true, total: true, subtotal: true, issueDate: true },
      }),
    ]);

    const summary = summarizeTaxYear(transactions, invoices, {
      taxYear: parseInt(String(taxYear), 10),
      currency: company.currency || 'USD',
      fiscalStartMonth: startMonth,
    });
    const pack = countryPack(company.incorporationCountry);

    const catOf = (needle: string) =>
      summary.byCategory
        .filter((c) => c.category.toLowerCase().includes(needle))
        .reduce((s, c) => s + c.expense, 0);

    const salaries = catOf('salar');
    const rent = catOf('rent') + catOf('alquil') + catOf('alug');
    const taxes = catOf('tax') + catOf('impuest') + catOf('impost');
    const interest = catOf('inter') + catOf('juro');

    const companyUsers = await prisma.companyUser.findMany({
      where: { companyId },
      include: { user: true },
    });
    const owners = companyUsers.filter((cu) => cu.role === 'ADMIN');

    let autoData: Record<string, unknown> = {
      legalName: company.name,
      taxCountry: company.incorporationCountry || pack.code,
      entityType: company.entityType || '',
      taxId: company.ein || '',
      taxIdLabel: pack.taxIdLabel,
      address: company.taxAddress || '',
      cashIncome: summary.cashIncome,
      cashExpense: summary.cashExpense,
      cashResult: summary.cashResult,
      invoiceOutputTax: summary.invoiceOutputTax,
      invoiceInputTax: summary.invoiceInputTax,
      vatName: pack.vatName,
      _transactionCount: summary.executedCount,
      _incomeTransactions: transactions.filter((t) => t.type === 'INCOME').length,
      _expenseTransactions: transactions.filter((t) => t.type === 'EXPENSE').length,
      _byCategory: summary.byCategory,
      _summary: summary,
    };

    if (formType === 'YEAR') {
      autoData = {
        ...autoData,
        dateIncorporated: company.incorporationDate ? new Date(company.incorporationDate).toISOString().slice(0, 10) : '',
        businessActivity: company.businessActivity || '',
      };
    } else if (formType === '1120') {
      autoData = {
        ...autoData,
        corporationName: company.name,
        ein: company.ein || '',
        address: company.taxAddress || '',
        dateIncorporated: company.incorporationDate ? new Date(company.incorporationDate).toISOString().slice(0, 10) : '',
        totalAssets: 0,
        businessActivityCode: company.businessActivityCode || '',
        businessActivity: company.businessActivity || '',
        grossReceipts: summary.cashIncome,
        totalIncome: summary.cashIncome,
        salariesAndWages: salaries,
        rents: rent,
        taxesAndLicenses: taxes,
        interestExpense: interest,
        otherDeductions: Math.max(0, summary.cashExpense - salaries - rent - taxes - interest),
        totalDeductions: summary.cashExpense,
        taxableIncome: summary.cashResult,
        foreignOwnership: owners.length > 0 ? 'Yes' : 'No',
      };
    } else if (formType === '5472') {
      const owner = owners[0];
      autoData = {
        ...autoData,
        reportingCorpName: company.name,
        reportingCorpEIN: company.ein || '',
        reportingCorpAddress: company.taxAddress || '',
        totalAssets: 0,
        principalBusinessActivity: company.businessActivity || '',
        principalBusinessActivityCode: company.businessActivityCode || '',
        countryOfIncorporation: company.incorporationCountry || 'US',
        dateOfIncorporation: company.incorporationDate ? new Date(company.incorporationDate).toISOString().slice(0, 10) : '',
        foreignShareholderName: owner?.user?.name || '',
        foreignShareholderAddress: '',
        totalAmountsReceived: summary.cashIncome,
        totalAmountsPaid: summary.cashExpense,
      };
    }

    return NextResponse.json({ autoData, summary, pack: { code: pack.code, taxIdLabel: pack.taxIdLabel, vatName: pack.vatName } });
  } catch (error: any) {
    console.error('Auto-populate error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
