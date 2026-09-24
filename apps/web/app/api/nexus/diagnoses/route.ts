export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { canAccessNexusOpsCompany } from '@/lib/nexus-ops';
import { persistNexusDiagnosis } from '@/lib/nexus-diagnosis-persist';

async function resolveCompany(
  req: NextRequest,
  tenant: { companyIds: string[] }
): Promise<{ companyId: string; engagementId: string | null } | NextResponse> {
  const url = new URL(req.url);
  const companyId = String(url.searchParams.get('companyId') || '').trim();
  const engagementId = String(url.searchParams.get('engagementId') || '').trim() || null;
  if (!companyId) return NextResponse.json({ error: 'companyId obrigatório.' }, { status: 400 });
  const ok = await canAccessNexusOpsCompany(tenant.companyIds, companyId, engagementId);
  if (!ok) return NextResponse.json({ error: 'Empresa inválida.' }, { status: 403 });
  return { companyId, engagementId };
}

export async function GET(req: NextRequest) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const scope = await resolveCompany(req, tenant);
  if (scope instanceof NextResponse) return scope;

  const rows = await prisma.nexusDiagnosis.findMany({
    where: { companyId: scope.companyId },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      id: true,
      companyId: true,
      engagementId: true,
      sectorIds: true,
      overall: true,
      scoresJson: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ diagnoses: rows, latest: rows[0] || null });
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
  if (!companyId) return NextResponse.json({ error: 'companyId obrigatório.' }, { status: 400 });
  const ok = await canAccessNexusOpsCompany(tenant.companyIds, companyId, engagementId);
  if (!ok) return NextResponse.json({ error: 'Empresa inválida.' }, { status: 403 });

  const row = await persistNexusDiagnosis({
    companyId,
    createdByUserId: tenant.userId,
    engagementId,
    sectorIds: body.sectorIds,
    sectorId: body.sectorId,
    overall: Number(body.overall),
    scoresJson: body.scoresJson ?? body.scores,
    answersJson: body.answersJson ?? body.answers,
  });
  return NextResponse.json({ ok: true, diagnosis: row });
}
