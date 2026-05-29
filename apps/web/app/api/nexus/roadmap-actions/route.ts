export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { loadNetworkForTenant, memberCompanyIds } from '@/lib/nexus-network';

export async function GET(req: NextRequest) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const networkIdParam = req.nextUrl.searchParams.get('networkId');
  const companyIdParam = req.nextUrl.searchParams.get('companyId');

  if (networkIdParam) {
    const network = await loadNetworkForTenant(networkIdParam, tenant.companyIds);
    if (!network) return NextResponse.json({ error: 'Rede não encontrada.' }, { status: 404 });
    const ids = memberCompanyIds(network);
    const actions = await prisma.task.findMany({
      where: {
        companyId: { in: ids },
        isActive: true,
        tags: { contains: 'nexus:roadmap' },
      },
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
      take: 120,
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        dueDate: true,
        createdAt: true,
        tags: true,
        companyId: true,
      },
    });
    return NextResponse.json({ actions, networkId: network.id, companyIds: ids });
  }

  const companyId =
    companyIdParam && tenant.companyIds.includes(companyIdParam)
      ? companyIdParam
      : tenant.companyIds[0] || null;

  if (!companyId) {
    return NextResponse.json({ error: 'Sem empresa associada.' }, { status: 400 });
  }

  const actions = await prisma.task.findMany({
    where: {
      companyId,
      isActive: true,
      tags: { contains: 'nexus:roadmap' },
    },
    orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
    take: 120,
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      dueDate: true,
      createdAt: true,
      tags: true,
      companyId: true,
    },
  });

  return NextResponse.json({ actions, companyId });
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

  const networkIdRaw = String(body.networkId || '').trim();
  let companyId = String(body.companyId || '').trim() || tenant.companyIds[0] || '';
  let tagSuffix = '';

  if (networkIdRaw) {
    const network = await loadNetworkForTenant(networkIdRaw, tenant.companyIds);
    if (!network) return NextResponse.json({ error: 'Rede não encontrada.' }, { status: 404 });
    const ids = memberCompanyIds(network);
    const target = String(body.targetCompanyId || '').trim() || network.anchorCompanyId;
    if (!ids.includes(target)) {
      return NextResponse.json({ error: 'Empresa alvo tem de pertencer à rede.' }, { status: 403 });
    }
    companyId = target;
    tagSuffix = `,nexus:network:${networkIdRaw}`;
  } else {
    if (!companyId || !tenant.companyIds.includes(companyId)) {
      return NextResponse.json({ error: 'Empresa inválida.' }, { status: 403 });
    }
  }

  const title = String(body.title || '').trim();
  if (title.length < 4) {
    return NextResponse.json({ error: 'Título da ação muito curto.' }, { status: 400 });
  }

  const description = String(body.description || '').trim();
  const priority = String(body.priority || 'MEDIUM').trim().toUpperCase();
  const normalizedPriority = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(priority) ? priority : 'MEDIUM';
  const pillar = String(body.pillar || '').trim().toLowerCase();

  const action = await prisma.task.create({
    data: {
      companyId,
      creatorId: tenant.userId,
      title: title.slice(0, 180),
      description: description.slice(0, 8000) || null,
      priority: normalizedPriority as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
      status: 'TODO',
      tags: `nexus:roadmap${pillar ? `,pillar:${pillar}` : ''}${tagSuffix}`,
      isActive: true,
    },
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      createdAt: true,
      tags: true,
      companyId: true,
    },
  });

  return NextResponse.json({ ok: true, action }, { status: 201 });
}
