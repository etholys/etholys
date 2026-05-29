export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import {
  emptyContextSetup,
  isContextSetupMeaningful,
  type CompanyContextSetup,
} from '@/lib/company-context-setup';

function pickCompanyFields(row: {
  id: string;
  name: string;
  currency: string | null;
  contextSetupJson: unknown;
  contextSetupAt: Date | null;
}) {
  return {
    id: row.id,
    name: row.name,
    currency: row.currency,
    contextSetupJson: row.contextSetupJson,
    contextSetupAt: row.contextSetupAt?.toISOString() ?? null,
  };
}

export async function GET(req: NextRequest) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const companyId = req.nextUrl.searchParams.get('companyId')?.trim();
    if (!companyId || !tenant.companyIds.includes(companyId)) {
      return NextResponse.json({ error: 'Empresa inválida' }, { status: 403 });
    }

    const company = await prisma.company.findFirst({
      where: { id: companyId, isActive: true },
      select: {
        id: true,
        name: true,
        currency: true,
        contextSetupJson: true,
        contextSetupAt: true,
      },
    });
    if (!company) return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 });

    return NextResponse.json({ company: pickCompanyFields(company) });
  } catch (e) {
    console.error('[GET /api/companies/setup]', e);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const body = (await req.json()) as { companyId?: string; context?: CompanyContextSetup };
    const companyId = typeof body.companyId === 'string' ? body.companyId.trim() : '';
    if (!companyId || !tenant.companyIds.includes(companyId)) {
      return NextResponse.json({ error: 'Empresa inválida' }, { status: 403 });
    }

    const context =
      body.context && typeof body.context === 'object' && body.context.v === 1
        ? body.context
        : emptyContextSetup();

    const meaningful = isContextSetupMeaningful(context);
    const done = Boolean(context.legalDisclaimerAcceptedAt);

    const company = await prisma.company.update({
      where: { id: companyId },
      data: {
        contextSetupJson: context,
        contextSetupAt: done || meaningful ? new Date() : undefined,
      },
      select: {
        id: true,
        name: true,
        currency: true,
        contextSetupJson: true,
        contextSetupAt: true,
      },
    });

    return NextResponse.json({ company: pickCompanyFields(company) });
  } catch (e) {
    console.error('[PUT /api/companies/setup]', e);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
