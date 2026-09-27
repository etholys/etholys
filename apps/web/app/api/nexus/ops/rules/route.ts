export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { canAccessNexusOpsCompany } from '@/lib/nexus-ops';
import { ensureOpsRules, requestAutomationCommand } from '@/lib/nexus-ops-command';
import { isOpsRuleKind } from '@/lib/nexus-whatsapp';

export async function GET(req: NextRequest) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const companyId = String(new URL(req.url).searchParams.get('companyId') || '').trim();
  const engagementId = String(new URL(req.url).searchParams.get('engagementId') || '').trim() || null;
  if (!companyId) return NextResponse.json({ error: 'companyId obrigatório.' }, { status: 400 });
  if (!(await canAccessNexusOpsCompany(tenant.companyIds, companyId, engagementId))) {
    return NextResponse.json({ error: 'Empresa inválida.' }, { status: 403 });
  }
  const rules = await ensureOpsRules(companyId);
  return NextResponse.json({ rules });
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
  const kind = String(body.kind || '').trim();
  if (!companyId || !isOpsRuleKind(kind)) {
    return NextResponse.json({ error: 'Empresa e automação obrigatórias.' }, { status: 400 });
  }
  if (!(await canAccessNexusOpsCompany(tenant.companyIds, companyId, engagementId))) {
    return NextResponse.json({ error: 'Empresa inválida.' }, { status: 403 });
  }

  await ensureOpsRules(companyId);
  const enabled = Boolean(body.enabled);
  const rule = await prisma.nexusOpsRule.update({
    where: { companyId_kind: { companyId, kind } },
    data: {
      enabled,
      lastCommandAt: enabled && kind !== 'whatsapp_alerts' ? new Date() : undefined,
    },
  });

  let command: { sent: boolean; reason?: string } | null = null;
  if (enabled && kind !== 'whatsapp_alerts') {
    command = await requestAutomationCommand(companyId, kind);
  }

  return NextResponse.json({ ok: true, rule, command });
}
