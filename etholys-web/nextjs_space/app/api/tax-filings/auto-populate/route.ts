export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

/**
 * Auto-populate tax form fields from system data.
 * POST body: { companyId, formType, taxYear }
 * Returns: { autoData } with mapped fields
 */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { companyId, formType, taxYear } = await req.json();
    if (!companyId || !formType || !taxYear) {
      return NextResponse.json({ error: 'Parámetros requeridos' }, { status: 400 });
    }

    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 404 });

    // Fetch transactions for the tax year
    const yearStart = new Date(`${taxYear}-01-01`);
    const yearEnd = new Date(`${parseInt(taxYear) + 1}-01-01`);
    const transactions = await prisma.transaction.findMany({
      where: {
        companyId,
        date: { gte: yearStart, lt: yearEnd },
      },
      orderBy: { date: 'asc' },
    });

    // Calculate totals
    const income = transactions.filter(t => t.type === 'INCOME').reduce((s, t) => s + (t.amount || 0), 0);
    const expenses = transactions.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + (t.amount || 0), 0);
    const salaries = transactions.filter(t => t.type === 'EXPENSE' && (t.category || '').toLowerCase().includes('salar')).reduce((s, t) => s + (t.amount || 0), 0);
    const rent = transactions.filter(t => t.type === 'EXPENSE' && (t.category || '').toLowerCase().includes('rent')).reduce((s, t) => s + (t.amount || 0), 0);
    const taxes = transactions.filter(t => t.type === 'EXPENSE' && (t.category || '').toLowerCase().includes('tax')).reduce((s, t) => s + (t.amount || 0), 0);
    const interest = transactions.filter(t => t.type === 'EXPENSE' && (t.category || '').toLowerCase().includes('inter')).reduce((s, t) => s + (t.amount || 0), 0);

    // Fetch foreign owner info (company users with role ADMIN from outside US)
    const companyUsers = await prisma.companyUser.findMany({
      where: { companyId },
      include: { user: true },
    });
    const owners = companyUsers.filter(cu => cu.role === 'ADMIN');

    let autoData: any = {};

    if (formType === '1120') {
      autoData = {
        // Header
        corporationName: company.name,
        ein: company.ein || '',
        address: company.taxAddress || '',
        dateIncorporated: company.incorporationDate ? new Date(company.incorporationDate).toISOString().slice(0, 10) : '',
        totalAssets: 0,
        businessActivityCode: company.businessActivityCode || '',
        businessActivity: company.businessActivity || '',
        // Income
        grossReceipts: income,
        totalIncome: income,
        // Deductions
        salariesAndWages: salaries,
        rents: rent,
        taxesAndLicenses: taxes,
        interestExpense: interest,
        otherDeductions: expenses - salaries - rent - taxes - interest,
        totalDeductions: expenses,
        // Computed
        taxableIncome: income - expenses,
        // Schedule K question 7
        foreignOwnership: owners.length > 0 ? 'Yes' : 'No',
        // Data source info
        _transactionCount: transactions.length,
        _incomeTransactions: transactions.filter(t => t.type === 'INCOME').length,
        _expenseTransactions: transactions.filter(t => t.type === 'EXPENSE').length,
      };
    } else if (formType === '5472') {
      const owner = owners[0];
      autoData = {
        // Part I - Reporting Corporation
        reportingCorpName: company.name,
        reportingCorpEIN: company.ein || '',
        reportingCorpAddress: company.taxAddress || '',
        totalAssets: 0,
        principalBusinessActivity: company.businessActivity || '',
        principalBusinessActivityCode: company.businessActivityCode || '',
        countryOfIncorporation: company.incorporationCountry || 'US',
        dateOfIncorporation: company.incorporationDate ? new Date(company.incorporationDate).toISOString().slice(0, 10) : '',
        // Part II - 25% Foreign Shareholder
        foreignShareholderName: owner?.user?.name || '',
        foreignShareholderAddress: '',
        // Part IV - Monetary Transactions (summary)
        totalAmountsReceived: income,
        totalAmountsPaid: expenses,
        // Data source
        _transactionCount: transactions.length,
      };
    }

    return NextResponse.json({ autoData });
  } catch (error: any) {
    console.error('Auto-populate error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
