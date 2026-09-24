export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { canAccessNexusOpsCompany, loadCompanySectors } from '@/lib/nexus-ops';
import { getSectorModule, resolveSectorModule } from '@/lib/nexus-sector-modules';
import { normalizeEconomicSectorId } from '@/lib/nexus-economic-sectors';

export async function GET(req: NextRequest) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const companyId = String(new URL(req.url).searchParams.get('companyId') || '').trim();
  const engagementId = String(new URL(req.url).searchParams.get('engagementId') || '').trim() || null;
  if (!companyId) return NextResponse.json({ error: 'companyId obrigatório.' }, { status: 400 });
  if (!(await canAccessNexusOpsCompany(tenant.companyIds, companyId, engagementId))) {
    return NextResponse.json({ error: 'Empresa inválida.' }, { status: 403 });
  }
  const units = await prisma.nexusOpsUnit.findMany({
    where: { companyId, isActive: true },
    orderBy: { createdAt: 'asc' },
  });
  return NextResponse.json({ units });
}

export async function POST(req: NextRequest) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });
  }
  const companyId = String(body.companyId || '').trim();
  const engagementId = String(body.engagementId || '').trim() || null;
  const name = String(body.name || '').trim();
  if (!companyId || name.length < 2) {
    return NextResponse.json({ error: 'Empresa e nome obrigatórios.' }, { status: 400 });
  }
  if (!(await canAccessNexusOpsCompany(tenant.companyIds, companyId, engagementId))) {
    return NextResponse.json({ error: 'Empresa inválida.' }, { status: 403 });
  }
  const sectors = await loadCompanySectors(companyId);
  const sectorId = normalizeEconomicSectorId(String(body.sectorId || '')) || sectors[0] || 'other';
  const mod = body.sectorId ? getSectorModule(sectorId) : resolveSectorModule(sectors);
  const areaHa = body.areaHa == null || body.areaHa === '' ? null : Number(body.areaHa);
  const qty = body.qty == null || body.qty === '' ? null : Number(body.qty);
  const unit = await prisma.nexusOpsUnit.create({
    data: {
      companyId,
      sectorId,
      kind: mod.unitKind,
      name: name.slice(0, 120),
      areaHa: Number.isFinite(areaHa as number) ? (areaHa as number) : null,
      qty: Number.isFinite(qty as number) ? (qty as number) : null,
      crop: String(body.crop || '').trim().slice(0, 80) || null,
      notes: String(body.notes || '').trim().slice(0, 2000) || null,
    },
  });
  return NextResponse.json({ ok: true, unit });
}
