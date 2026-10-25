export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { canAccessNexusOpsCompany } from '@/lib/nexus-ops';
import { archiveRadarClient } from '@/lib/radar/archive';

async function authorize(companyId: string, engagementId: string | null) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!companyId || !(await canAccessNexusOpsCompany(tenant.companyIds, companyId, engagementId))) {
    return { error: NextResponse.json({ error: 'Empresa inválida.' }, { status: 403 }) };
  }
  return { tenant };
}

type Ctx = { params: Promise<{ id: string }> };

/** Soft-archive client (+ its places). Prefer archive over hard delete. */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });
  }

  const companyId = String(body.companyId || '').trim();
  const engagementId = String(body.engagementId || '').trim() || null;
  const auth = await authorize(companyId, engagementId);
  if ('error' in auth && auth.error) return auth.error;

  const action = String(body.action || '').trim();
  if (action !== 'archive' && action !== 'delete') {
    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 });
  }

  const existing = await prisma.radarClient.findFirst({
    where: { id, providerCompanyId: companyId },
    select: { id: true, archivedAt: true },
  });
  if (!existing) return NextResponse.json({ error: 'Cliente inválido.' }, { status: 404 });
  if (existing.archivedAt) return NextResponse.json({ ok: true, alreadyArchived: true, soft: true });

  const result = await archiveRadarClient(companyId, id);
  if (!result) return NextResponse.json({ error: 'Não foi possível arquivar.' }, { status: 400 });
  return NextResponse.json({ ok: true, soft: true, ...result });
}

/** DELETE = soft-archive (same as archive). Hard cascade would wipe places — never do that here. */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  let companyId = String(url.searchParams.get('companyId') || '').trim();
  let engagementId = String(url.searchParams.get('engagementId') || '').trim() || null;

  if (!companyId) {
    try {
      const body = (await req.json()) as Record<string, unknown>;
      companyId = String(body.companyId || '').trim();
      engagementId = String(body.engagementId || '').trim() || null;
    } catch {
      /* query only */
    }
  }

  const auth = await authorize(companyId, engagementId);
  if ('error' in auth && auth.error) return auth.error;

  const existing = await prisma.radarClient.findFirst({
    where: { id, providerCompanyId: companyId },
    select: { id: true, archivedAt: true },
  });
  if (!existing) return NextResponse.json({ error: 'Cliente inválido.' }, { status: 404 });
  if (existing.archivedAt) return NextResponse.json({ ok: true, alreadyArchived: true, soft: true });

  const result = await archiveRadarClient(companyId, id);
  if (!result) return NextResponse.json({ error: 'Não foi possível arquivar.' }, { status: 400 });
  return NextResponse.json({ ok: true, soft: true, ...result });
}
