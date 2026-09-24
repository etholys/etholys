export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { emptyContextSetup, type CompanyContextSetup } from '@/lib/company-context-setup';
import {
  normalizeSectorIdList,
  parseCompanySectorId,
  parseCompanySectorIds,
} from '@/lib/nexus-economic-sectors';

type Ctx = { params: Promise<{ id: string }> };

/** Operador AT pode definir uma ou várias temáticas da ficha empresa-cliente. */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });
  }

  const sectorIds = normalizeSectorIdList({
    sectorIds: body.sectorIds,
    sectorId: body.sectorId,
  });
  if (Array.isArray(body.sectorIds) && body.sectorIds.length > 0 && sectorIds.length === 0) {
    return NextResponse.json({ error: 'Setor económico inválido.' }, { status: 400 });
  }
  if (body.sectorId != null && String(body.sectorId).trim() && sectorIds.length === 0) {
    return NextResponse.json({ error: 'Setor económico inválido.' }, { status: 400 });
  }

  const company = await prisma.company.findFirst({
    where: { id, isActive: true },
    select: { id: true, contextSetupJson: true },
  });
  if (!company) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 });

  const prev =
    company.contextSetupJson && typeof company.contextSetupJson === 'object'
      ? (company.contextSetupJson as CompanyContextSetup)
      : emptyContextSetup();
  const context: CompanyContextSetup = {
    ...prev,
    v: 1,
    sectorIds: sectorIds.length > 0 ? sectorIds : undefined,
    sectorId: sectorIds[0] || undefined,
  };

  const updated = await prisma.company.update({
    where: { id },
    data: { contextSetupJson: context },
    select: { id: true, name: true, shortName: true, contextSetupJson: true },
  });

  return NextResponse.json({
    ok: true,
    company: {
      id: updated.id,
      name: updated.name,
      shortName: updated.shortName,
      sectorId: parseCompanySectorId(updated.contextSetupJson),
      sectorIds: parseCompanySectorIds(updated.contextSetupJson),
    },
  });
}
