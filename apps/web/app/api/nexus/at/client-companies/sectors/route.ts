export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { emptyContextSetup, type CompanyContextSetup } from '@/lib/company-context-setup';
import { normalizeSectorIdList } from '@/lib/nexus-economic-sectors';
import { loadEngagementForTenant, userIsOperator, clientCompanyIds } from '@/lib/nexus-at';

/** Atualiza temática(s) de várias empresas-cliente de uma vez (operador AT). */
export async function PATCH(req: NextRequest) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });
  }

  const engagementId = body.engagementId ? String(body.engagementId).trim() : '';
  const rawIds = Array.isArray(body.companyIds) ? (body.companyIds as unknown[]) : [];
  const companyIds = [...new Set(rawIds.map((x) => String(x || '').trim()).filter(Boolean))];
  if (companyIds.length === 0) {
    return NextResponse.json({ error: 'companyIds obrigatório.' }, { status: 400 });
  }
  if (companyIds.length > 200) {
    return NextResponse.json({ error: 'Máximo 200 empresas por pedido.' }, { status: 400 });
  }

  const sectorIds = normalizeSectorIdList({
    sectorIds: body.sectorIds,
    sectorId: body.sectorId,
  });
  if (sectorIds.length === 0) {
    return NextResponse.json({ error: 'Temática / setor obrigatório (podes marcar vários).' }, { status: 400 });
  }

  if (engagementId) {
    const engagement = await loadEngagementForTenant(engagementId, tenant.companyIds);
    if (!engagement) return NextResponse.json({ error: 'Contrato não encontrado.' }, { status: 404 });
    if (!userIsOperator(engagement, tenant.companyIds)) {
      return NextResponse.json({ error: 'Só o operador pode alterar temáticas.' }, { status: 403 });
    }
    const allowed = new Set(clientCompanyIds(engagement));
    if (companyIds.some((id) => !allowed.has(id))) {
      return NextResponse.json({ error: 'Uma ou mais empresas não pertencem a este contrato.' }, { status: 400 });
    }
  }

  const companies = await prisma.company.findMany({
    where: { id: { in: companyIds }, isActive: true },
    select: { id: true, contextSetupJson: true },
  });
  if (companies.length !== companyIds.length) {
    return NextResponse.json({ error: 'Uma ou mais empresas não foram encontradas.' }, { status: 404 });
  }

  await prisma.$transaction(
    companies.map((company) => {
      const prev =
        company.contextSetupJson && typeof company.contextSetupJson === 'object'
          ? (company.contextSetupJson as CompanyContextSetup)
          : emptyContextSetup();
      const context: CompanyContextSetup = {
        ...prev,
        v: 1,
        sectorIds,
        sectorId: sectorIds[0],
      };
      return prisma.company.update({
        where: { id: company.id },
        data: { contextSetupJson: context },
      });
    })
  );

  return NextResponse.json({ ok: true, updated: companies.length, sectorIds, sectorId: sectorIds[0] });
}
