export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { TaskStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { loadNetworkForTenant, memberCompanyIds } from '@/lib/nexus-network';

function statusWhere(statusParam: string | null): { status: TaskStatus } | Record<string, never> {
  if (!statusParam) return {};
  const allowed = Object.values(TaskStatus) as string[];
  if (!allowed.includes(statusParam)) return {};
  return { status: statusParam as TaskStatus };
}

const SERVICE_TYPES = ['website', 'branding', 'social-media', 'automation', 'sales-assets'] as const;
type ServiceType = (typeof SERVICE_TYPES)[number];

function normalizeServiceType(raw: unknown): ServiceType {
  const value = String(raw || '').trim() as ServiceType;
  if (!SERVICE_TYPES.includes(value)) {
    throw new Error('Tipo de serviço inválido.');
  }
  return value;
}

function titleFromService(type: ServiceType): string {
  const names: Record<ServiceType, string> = {
    website: 'Criação/ajuste de página web',
    branding: 'Pacote de identidade visual',
    'social-media': 'Plano de conteúdo para redes sociais',
    automation: 'Automação operacional com IA',
    'sales-assets': 'Materiais comerciais (apresentação, catálogo, proposta)',
  };
  return names[type];
}

export async function GET(req: NextRequest) {
  const tenant = await getUserCompanyIds();
  if (!tenant) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const networkIdParam = req.nextUrl.searchParams.get('networkId');
  const companyIdParam = req.nextUrl.searchParams.get('companyId');
  const statusParam = req.nextUrl.searchParams.get('status');

  if (networkIdParam) {
    const network = await loadNetworkForTenant(networkIdParam, tenant.companyIds);
    if (!network) return NextResponse.json({ error: 'Rede não encontrada.' }, { status: 404 });
    const companyIds = memberCompanyIds(network);
    const tickets = await prisma.task.findMany({
      where: {
        companyId: { in: companyIds },
        isActive: true,
        tags: { contains: 'nexus:service' },
        ...statusWhere(statusParam),
      },
      orderBy: { createdAt: 'desc' },
      take: 80,
      select: {
        id: true,
        title: true,
        description: true,
        priority: true,
        status: true,
        dueDate: true,
        createdAt: true,
        updatedAt: true,
        tags: true,
        companyId: true,
        assignee: { select: { id: true, name: true, email: true } },
      },
    });
    return NextResponse.json({ tickets, networkId: network.id, companyIds });
  }

  const companyId =
    companyIdParam && tenant.companyIds.includes(companyIdParam)
      ? companyIdParam
      : tenant.companyIds[0] || null;

  if (!companyId) {
    return NextResponse.json({ error: 'Sem empresa associada.' }, { status: 400 });
  }

  const tickets = await prisma.task.findMany({
    where: {
      companyId,
      isActive: true,
      tags: { contains: 'nexus:service' },
      ...statusWhere(statusParam),
    },
    orderBy: { createdAt: 'desc' },
    take: 80,
    select: {
      id: true,
      title: true,
      description: true,
      priority: true,
      status: true,
      dueDate: true,
      createdAt: true,
      updatedAt: true,
      tags: true,
      companyId: true,
      assignee: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({ tickets, companyId });
}

export async function POST(req: NextRequest) {
  const tenant = await getUserCompanyIds();
  if (!tenant) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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

  const brief = String(body.brief || '').trim();
  if (brief.length < 10) {
    return NextResponse.json({ error: 'Descreva melhor a necessidade (mínimo 10 caracteres).' }, { status: 400 });
  }

  let serviceType: ServiceType;
  try {
    serviceType = normalizeServiceType(body.serviceType);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Tipo de serviço inválido.' }, { status: 400 });
  }

  const title = String(body.title || '').trim() || `[NEXUS] ${titleFromService(serviceType)}`;
  const priority = String(body.priority || 'MEDIUM').trim().toUpperCase();
  const normalizedPriority = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(priority) ? priority : 'MEDIUM';

  const ticket = await prisma.task.create({
    data: {
      companyId,
      creatorId: tenant.userId,
      title: title.slice(0, 180),
      description: brief.slice(0, 8000),
      priority: normalizedPriority as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
      status: 'TODO',
      tags: `nexus:service,service:${serviceType}${tagSuffix}`,
      isActive: true,
    },
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      createdAt: true,
      companyId: true,
    },
  });

  return NextResponse.json({ ok: true, ticket }, { status: 201 });
}
