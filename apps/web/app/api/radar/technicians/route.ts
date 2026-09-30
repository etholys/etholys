export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { canAccessNexusOpsCompany } from '@/lib/nexus-ops';

async function authorize(companyId: string, engagementId: string | null) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!companyId || !(await canAccessNexusOpsCompany(tenant.companyIds, companyId, engagementId))) {
    return { error: NextResponse.json({ error: 'Empresa inválida.' }, { status: 403 }) };
  }
  return { tenant };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const companyId = String(url.searchParams.get('companyId') || '').trim();
  const engagementId = String(url.searchParams.get('engagementId') || '').trim() || null;
  const auth = await authorize(companyId, engagementId);
  if ('error' in auth && auth.error) return auth.error;

  const [technicians, employees] = await Promise.all([
    prisma.radarTechnician.findMany({
      where: { companyId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        scopes: {
          include: {
            client: { select: { id: true, name: true } },
            property: { select: { id: true, name: true, clientId: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.companyUser.findMany({
      where: { companyId },
      include: { user: { select: { id: true, name: true, email: true, isActive: true } } },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  return NextResponse.json({
    technicians: technicians.map((t) => ({
      id: t.id,
      userId: t.userId,
      name: t.user.name,
      email: t.user.email,
      canSeeAll: t.canSeeAll,
      canCreateClients: t.canCreateClients,
      scopes: t.scopes.map((s) => ({
        id: s.id,
        clientId: s.clientId,
        clientName: s.client?.name || null,
        propertyId: s.propertyId,
        propertyName: s.property?.name || null,
      })),
    })),
    employees: employees
      .filter((e) => e.user.isActive !== false)
      .map((e) => ({
        userId: e.userId,
        name: e.user.name,
        email: e.user.email,
        jobTitle: e.jobTitle,
        alreadyTechnician: technicians.some((t) => t.userId === e.userId),
      })),
  });
}

export async function POST(req: NextRequest) {
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

  const action = String(body.action || 'add').trim();

  if (action === 'add') {
    const userId = String(body.userId || '').trim();
    if (!userId) return NextResponse.json({ error: 'Utilizador obrigatório.' }, { status: 400 });
    const membership = await prisma.companyUser.findFirst({
      where: { companyId, userId },
      select: { id: true },
    });
    if (!membership) {
      return NextResponse.json({ error: 'A pessoa tem de estar na lista de funcionários da empresa.' }, { status: 400 });
    }
    const tech = await prisma.radarTechnician.upsert({
      where: { companyId_userId: { companyId, userId } },
      create: {
        companyId,
        userId,
        canSeeAll: Boolean(body.canSeeAll),
        canCreateClients: Boolean(body.canCreateClients),
      },
      update: {
        canSeeAll: body.canSeeAll != null ? Boolean(body.canSeeAll) : undefined,
        canCreateClients: body.canCreateClients != null ? Boolean(body.canCreateClients) : undefined,
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    const clientIds = Array.isArray(body.clientIds)
      ? (body.clientIds as unknown[]).map((x) => String(x)).filter(Boolean)
      : [];
    const propertyIds = Array.isArray(body.propertyIds)
      ? (body.propertyIds as unknown[]).map((x) => String(x)).filter(Boolean)
      : [];

    if (clientIds.length || propertyIds.length) {
      await prisma.radarTechnicianScope.deleteMany({ where: { technicianId: tech.id } });
      const rows: { technicianId: string; clientId?: string; propertyId?: string }[] = [];
      for (const clientId of clientIds) {
        const ok = await prisma.radarClient.findFirst({
          where: { id: clientId, providerCompanyId: companyId },
          select: { id: true },
        });
        if (ok) rows.push({ technicianId: tech.id, clientId });
      }
      for (const propertyId of propertyIds) {
        const ok = await prisma.radarProperty.findFirst({
          where: { id: propertyId, companyId },
          select: { id: true },
        });
        if (ok) rows.push({ technicianId: tech.id, propertyId });
      }
      if (rows.length) await prisma.radarTechnicianScope.createMany({ data: rows });
    }

    return NextResponse.json({ ok: true, technicianId: tech.id });
  }

  if (action === 'update') {
    const technicianId = String(body.technicianId || '').trim();
    if (!technicianId) return NextResponse.json({ error: 'Técnico inválido.' }, { status: 400 });
    const tech = await prisma.radarTechnician.findFirst({ where: { id: technicianId, companyId } });
    if (!tech) return NextResponse.json({ error: 'Técnico não encontrado.' }, { status: 404 });

    await prisma.radarTechnician.update({
      where: { id: technicianId },
      data: {
        canSeeAll: body.canSeeAll != null ? Boolean(body.canSeeAll) : undefined,
        canCreateClients: body.canCreateClients != null ? Boolean(body.canCreateClients) : undefined,
      },
    });

    if (Array.isArray(body.clientIds) || Array.isArray(body.propertyIds)) {
      await prisma.radarTechnicianScope.deleteMany({ where: { technicianId } });
      const clientIds = Array.isArray(body.clientIds)
        ? (body.clientIds as unknown[]).map((x) => String(x)).filter(Boolean)
        : [];
      const propertyIds = Array.isArray(body.propertyIds)
        ? (body.propertyIds as unknown[]).map((x) => String(x)).filter(Boolean)
        : [];
      const rows: { technicianId: string; clientId?: string; propertyId?: string }[] = [];
      for (const clientId of clientIds) {
        const ok = await prisma.radarClient.findFirst({
          where: { id: clientId, providerCompanyId: companyId },
          select: { id: true },
        });
        if (ok) rows.push({ technicianId, clientId });
      }
      for (const propertyId of propertyIds) {
        const ok = await prisma.radarProperty.findFirst({
          where: { id: propertyId, companyId },
          select: { id: true },
        });
        if (ok) rows.push({ technicianId, propertyId });
      }
      if (rows.length) await prisma.radarTechnicianScope.createMany({ data: rows });
    }

    return NextResponse.json({ ok: true });
  }

  if (action === 'remove') {
    const technicianId = String(body.technicianId || '').trim();
    if (!technicianId) return NextResponse.json({ error: 'Técnico inválido.' }, { status: 400 });
    await prisma.radarTechnician.deleteMany({ where: { id: technicianId, companyId } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 });
}
