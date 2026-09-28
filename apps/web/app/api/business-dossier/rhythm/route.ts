export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { canAccessNexusOpsCompany } from '@/lib/nexus-ops';

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
  const note = await prisma.businessRhythmNote.create({
    data: {
      companyId,
      happened: String(body.happened || '').slice(0, 2000),
      blocked: String(body.blocked || '').slice(0, 2000),
      nextStep: String(body.nextStep || '').slice(0, 2000),
      source: String(body.source || 'app').slice(0, 20),
    },
  });
  return NextResponse.json({ ok: true, note });
}
