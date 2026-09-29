export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { canAccessNexusOpsCompany } from '@/lib/nexus-ops';
import { isRadarOrgRole, radarHomePath } from '@/lib/radar/org-role';
import { ensureProducerBootstrap } from '@/lib/radar/bootstrap';

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

  const company = await prisma.company.findFirst({
    where: { id: companyId, isActive: true },
    select: { id: true, name: true, radarOrgRole: true },
  });
  if (!company) return NextResponse.json({ error: 'Empresa inválida.' }, { status: 404 });

  const role = isRadarOrgRole(company.radarOrgRole) ? company.radarOrgRole : null;
  if (role === 'producer') {
    await ensureProducerBootstrap(companyId);
  }

  const [clientCount, propertyCount] = await Promise.all([
    role === 'provider' ? prisma.radarClient.count({ where: { providerCompanyId: companyId } }) : Promise.resolve(0),
    prisma.radarProperty.count({ where: { companyId } }),
  ]);

  return NextResponse.json({
    companyId,
    companyName: company.name,
    radarOrgRole: role,
    homePath: role ? radarHomePath(role) : null,
    clientCount,
    propertyCount,
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

  if (!isRadarOrgRole(body.radarOrgRole)) {
    return NextResponse.json({ error: 'Escolhe produtor ou prestador.' }, { status: 400 });
  }
  const role = body.radarOrgRole;

  const company = await prisma.company.update({
    where: { id: companyId },
    data: { radarOrgRole: role },
    select: { id: true, radarOrgRole: true, name: true },
  });

  if (role === 'producer') {
    await ensureProducerBootstrap(companyId);
  }

  return NextResponse.json({
    ok: true,
    companyId: company.id,
    companyName: company.name,
    radarOrgRole: role,
    homePath: radarHomePath(role),
  });
}
