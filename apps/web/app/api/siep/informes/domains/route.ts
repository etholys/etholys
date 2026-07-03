export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import {
  createProjectCustomInformeDomain,
  listProjectCustomInformeDomains,
} from '@/lib/siep/informe-custom-domains-store';

async function assertProjectAccess(projectId: string) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) };

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { companyId: true },
  });
  if (!project || !tenant.companyIds.includes(project.companyId)) {
    return { error: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) };
  }

  return { tenant, project };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    if (!projectId) return NextResponse.json({ error: 'projectId requerido' }, { status: 400 });

    const access = await assertProjectAccess(projectId);
    if (access.error) return access.error;

    const domains = await listProjectCustomInformeDomains(projectId);
    return NextResponse.json({ domains });
  } catch (error: unknown) {
    console.error('[siep/informes/domains GET]', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const projectId = String(body.projectId || '');
    const label = String(body.label || '');
    const intro = body.intro != null ? String(body.intro) : undefined;

    if (!projectId) return NextResponse.json({ error: 'projectId requerido' }, { status: 400 });

    const access = await assertProjectAccess(projectId);
    if (access.error) return access.error;

    const domain = await createProjectCustomInformeDomain(projectId, { label, intro });
    return NextResponse.json({ domain });
  } catch (error: unknown) {
    console.error('[siep/informes/domains POST]', error);
    const msg = error instanceof Error ? error.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
