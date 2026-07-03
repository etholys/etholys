export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';

async function assertProjectAccess(projectId: string, tenant: { companyIds: string[] }) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { companyId: true },
  });
  if (!project || !tenant.companyIds.includes(project.companyId)) {
    return null;
  }
  return project;
}

export async function GET(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    if (!projectId) return NextResponse.json({ error: 'projectId requerido' }, { status: 400 });

    if (!(await assertProjectAccess(projectId, tenant))) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const domain = searchParams.get('domain')?.trim();
    const where: { projectId: string; isActive: boolean; domain?: string } = {
      projectId,
      isActive: true,
    };
    if (domain) where.domain = domain;

    const packages = await prisma.mEReportPackage.findMany({
      where,
      include: {
        files: { where: { isActive: true }, orderBy: { order: 'asc' } },
        reports: { where: { isActive: true }, orderBy: { updatedAt: 'desc' }, take: 5 },
        childPackages: { where: { isActive: true }, select: { id: true, title: true, cadence: true, period: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ packages });
  } catch (error: unknown) {
    console.error('MEReportPackage GET error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const body = await req.json();
    const { projectId, title, cadence, period, donorFormat, parentPackageId, notes, domain } = body;
    if (!projectId || !title) {
      return NextResponse.json({ error: 'projectId y title requeridos' }, { status: 400 });
    }

    if (!(await assertProjectAccess(projectId, tenant))) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const pkg = await prisma.mEReportPackage.create({
      data: {
        projectId,
        title,
        cadence: cadence || 'quarterly',
        period: period || null,
        donorFormat: donorFormat || 'usaid',
        domain: domain === 'budget' ? 'budget' : 'me',
        parentPackageId: parentPackageId || null,
        notes: notes || null,
      },
      include: { files: true },
    });

    return NextResponse.json({ package: pkg });
  } catch (error: unknown) {
    console.error('MEReportPackage POST error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
