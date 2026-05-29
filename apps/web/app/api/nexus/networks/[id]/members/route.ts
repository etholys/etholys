export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import {
  assertSiepProjectAllowed,
  loadNetworkForTenant,
  memberCompanyIds,
  type NexusNetworkMemberRow,
} from '@/lib/nexus-network';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id: networkId } = await ctx.params;

  const network = await loadNetworkForTenant(networkId, tenant.companyIds);
  if (!network) return NextResponse.json({ error: 'Rede não encontrada.' }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });
  }

  const companyId = String(body.companyId || '').trim();
  if (!companyId || !tenant.companyIds.includes(companyId)) {
    return NextResponse.json({ error: 'Empresa inválida ou sem permissão.' }, { status: 403 });
  }

  const existing = network.members.some((m: NexusNetworkMemberRow) => m.companyId === companyId);
  if (existing) {
    return NextResponse.json({ error: 'Esta empresa já está na rede.' }, { status: 400 });
  }

  const siepProjectId = body.siepProjectId ? String(body.siepProjectId).trim() : '';
  const v = await assertSiepProjectAllowed(siepProjectId || null, [companyId]);
  if (!v.ok) return NextResponse.json({ error: v.message }, { status: 400 });

  const maxOrder = Math.max(0, ...network.members.map((m: NexusNetworkMemberRow) => m.sortOrder));

  const row = await prisma.nexusNetworkMember.create({
    data: {
      networkId,
      companyId,
      memberRole: 'member',
      siepProjectId: siepProjectId || null,
      sortOrder: maxOrder + 1,
    },
    include: {
      company: { select: { id: true, name: true, shortName: true } },
      siepProject: { select: { id: true, name: true, companyId: true } },
    },
  });

  const refreshed = await loadNetworkForTenant(networkId, tenant.companyIds);
  return NextResponse.json({ ok: true, member: row, memberCompanyIds: refreshed ? memberCompanyIds(refreshed) : [] }, { status: 201 });
}

/** Atualiza projeto SIEP opcional de um membro (override por empresa). */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id: networkId } = await ctx.params;

  const network = await loadNetworkForTenant(networkId, tenant.companyIds);
  if (!network) return NextResponse.json({ error: 'Rede não encontrada.' }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });
  }

  const companyId = String(body.companyId || '').trim();
  const row = network.members.find((m: NexusNetworkMemberRow) => m.companyId === companyId);
  if (!row) return NextResponse.json({ error: 'Membro não encontrado.' }, { status: 404 });

  if (body.siepProjectId === undefined) {
    return NextResponse.json({ error: 'Nada para atualizar. Envie siepProjectId (string ou null).' }, { status: 400 });
  }

  const sid = body.siepProjectId ? String(body.siepProjectId).trim() : '';
  const v = await assertSiepProjectAllowed(sid || null, [companyId]);
  if (!v.ok) return NextResponse.json({ error: v.message }, { status: 400 });

  const updated = await prisma.nexusNetworkMember.update({
    where: { id: row.id },
    data: { siepProjectId: sid || null },
    include: {
      company: { select: { id: true, name: true, shortName: true } },
      siepProject: { select: { id: true, name: true, companyId: true } },
    },
  });

  return NextResponse.json({ ok: true, member: updated });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id: networkId } = await ctx.params;

  const network = await loadNetworkForTenant(networkId, tenant.companyIds);
  if (!network) return NextResponse.json({ error: 'Rede não encontrada.' }, { status: 404 });

  const companyId = req.nextUrl.searchParams.get('companyId')?.trim();
  if (!companyId) return NextResponse.json({ error: 'companyId obrigatório.' }, { status: 400 });

  const row = network.members.find((m: NexusNetworkMemberRow) => m.companyId === companyId);
  if (!row) return NextResponse.json({ error: 'Membro não encontrado.' }, { status: 404 });
  if (row.memberRole === 'anchor') {
    return NextResponse.json({ error: 'Não é possível remover a empresa âncora da rede.' }, { status: 400 });
  }

  await prisma.nexusNetworkMember.delete({ where: { id: row.id } });

  const refreshed = await loadNetworkForTenant(networkId, tenant.companyIds);
  return NextResponse.json({ ok: true, memberCompanyIds: refreshed ? memberCompanyIds(refreshed) : [] });
}
