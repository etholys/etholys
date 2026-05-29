export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { assertSiepProjectAllowed, loadNetworkForTenant, memberCompanyIds } from '@/lib/nexus-network';

const KINDS = new Set(['COOP_HIERARCHY', 'SALES_NETWORK', 'MIXED']);

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await ctx.params;
  const network = await loadNetworkForTenant(id, tenant.companyIds);
  if (!network) return NextResponse.json({ error: 'Rede não encontrada.' }, { status: 404 });
  return NextResponse.json({ network, memberCompanyIds: memberCompanyIds(network) });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await ctx.params;

  const network = await loadNetworkForTenant(id, tenant.companyIds);
  if (!network) return NextResponse.json({ error: 'Rede não encontrada.' }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });
  }

  const ids = memberCompanyIds(network);
  const data: { name?: string; kind?: string; siepProjectId?: string | null; isActive?: boolean } = {};

  if (body.name !== undefined) {
    const name = String(body.name || '').trim();
    if (name.length < 2) return NextResponse.json({ error: 'Nome inválido.' }, { status: 400 });
    data.name = name.slice(0, 200);
  }
  if (body.kind !== undefined) {
    const kind = String(body.kind || '').trim();
    if (!KINDS.has(kind)) return NextResponse.json({ error: 'Tipo inválido.' }, { status: 400 });
    data.kind = kind;
  }
  if (body.isActive !== undefined) {
    data.isActive = Boolean(body.isActive);
  }
  if (body.siepProjectId !== undefined) {
    const sid = body.siepProjectId ? String(body.siepProjectId).trim() : '';
    const v = await assertSiepProjectAllowed(sid || null, ids);
    if (!v.ok) return NextResponse.json({ error: v.message }, { status: 400 });
    data.siepProjectId = sid || null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Nada para atualizar.' }, { status: 400 });
  }

  const updated = await prisma.nexusNetwork.update({
    where: { id },
    data,
    include: {
      anchorCompany: { select: { id: true, name: true, shortName: true } },
      siepProject: { select: { id: true, name: true, companyId: true } },
      members: {
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        include: {
          company: { select: { id: true, name: true, shortName: true } },
          siepProject: { select: { id: true, name: true, companyId: true } },
        },
      },
    },
  });

  return NextResponse.json({ ok: true, network: updated });
}
