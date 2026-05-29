export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { assertSiepProjectAllowed, listNetworksForTenant, memberCompanyIds } from '@/lib/nexus-network';

const KINDS = new Set(['COOP_HIERARCHY', 'SALES_NETWORK', 'MIXED']);

export async function GET() {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const networks = await listNetworksForTenant(tenant.companyIds);
  return NextResponse.json({ networks });
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

  const name = String(body.name || '').trim();
  if (name.length < 2) {
    return NextResponse.json({ error: 'Nome da rede inválido.' }, { status: 400 });
  }

  const kind = String(body.kind || 'COOP_HIERARCHY').trim();
  if (!KINDS.has(kind)) {
    return NextResponse.json({ error: 'Tipo de rede inválido.' }, { status: 400 });
  }

  const anchorCompanyId = String(body.anchorCompanyId || '').trim();
  if (!anchorCompanyId || !tenant.companyIds.includes(anchorCompanyId)) {
    return NextResponse.json({ error: 'Âncora inválida ou sem permissão.' }, { status: 403 });
  }

  const extraIds = Array.isArray(body.memberCompanyIds)
    ? (body.memberCompanyIds as unknown[]).map((x) => String(x || '').trim()).filter(Boolean)
    : [];

  const allMemberIds = [...new Set([anchorCompanyId, ...extraIds])];
  for (const cid of allMemberIds) {
    if (!tenant.companyIds.includes(cid)) {
      return NextResponse.json(
        { error: 'Só pode incluir empresas às quais o utilizador pertence (MVP).' },
        { status: 403 }
      );
    }
  }

  const siepProjectId = body.siepProjectId ? String(body.siepProjectId).trim() : null;
  const v = await assertSiepProjectAllowed(siepProjectId || null, allMemberIds);
  if (!v.ok) return NextResponse.json({ error: v.message }, { status: 400 });

  const network = await prisma.nexusNetwork.create({
    data: {
      name: name.slice(0, 200),
      kind,
      anchorCompanyId,
      siepProjectId: siepProjectId || null,
      members: {
        create: allMemberIds.map((companyId, idx) => ({
          companyId,
          memberRole: companyId === anchorCompanyId ? 'anchor' : 'member',
          sortOrder: idx,
        })),
      },
    },
    include: {
      anchorCompany: { select: { id: true, name: true, shortName: true } },
      siepProject: { select: { id: true, name: true, companyId: true } },
      members: {
        include: {
          company: { select: { id: true, name: true, shortName: true } },
          siepProject: { select: { id: true, name: true, companyId: true } },
        },
      },
    },
  });

  return NextResponse.json({ ok: true, network, memberCompanyIds: memberCompanyIds(network) }, { status: 201 });
}
