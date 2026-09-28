export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { canAccessNexusOpsCompany } from '@/lib/nexus-ops';
import { claimAuroraBusiness } from '@/lib/aurora-turn';
import { loadDossier } from '@/lib/business-dossier';
import { readAuroraTech } from '@/lib/aurora-interview';

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
  if (!companyId || !(await canAccessNexusOpsCompany(tenant.companyIds, companyId, engagementId))) {
    return NextResponse.json({ error: 'Empresa inválida.' }, { status: 403 });
  }
  const user = await prisma.user.findUnique({
    where: { id: tenant.userId },
    select: { name: true, email: true },
  });
  const tech = await claimAuroraBusiness({
    companyId,
    userId: tenant.userId,
    userName: user?.name || user?.email || tenant.userId,
  });
  const data = await loadDossier(companyId);
  return NextResponse.json({ ok: true, tech, current: readAuroraTech(data.dossier?.interviewJson) });
}
