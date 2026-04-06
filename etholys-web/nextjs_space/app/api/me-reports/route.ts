export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';

export async function GET(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const companyId = searchParams.get('companyId');

    /* If projectId given, return reports for that project */
    if (projectId) {
      const project = await prisma.project.findUnique({ where: { id: projectId }, select: { companyId: true } });
      if (!project || !tenant.companyIds.includes(project.companyId)) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
      }
      const reports = await prisma.mEReport.findMany({
        where: { projectId, isActive: true },
        orderBy: { reportDate: 'desc' },
      });
      return NextResponse.json({ reports });
    }

    /* Otherwise return all reports for the company (or all tenant companies) */
    const targetCompanies = companyId && tenant.companyIds.includes(companyId)
      ? [companyId]
      : tenant.companyIds;
    const reports = await prisma.mEReport.findMany({
      where: {
        isActive: true,
        project: { companyId: { in: targetCompanies } },
      },
      orderBy: { reportDate: 'desc' },
      take: 200,
    });
    return NextResponse.json({ reports });
  } catch (error: any) {
    console.error('MEReport GET error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const body = await req.json();
    const { projectId, title, type, period, content, findings, recommendations, reportDate } = body;
    if (!projectId || !title) {
      return NextResponse.json({ error: 'projectId y title requeridos' }, { status: 400 });
    }
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { companyId: true } });
    if (!project || !tenant.companyIds.includes(project.companyId)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
    const report = await prisma.mEReport.create({
      data: {
        projectId,
        title,
        type: type || 'progress',
        period: period || null,
        content: content || '',
        findings: findings || null,
        recommendations: recommendations || null,
        reportDate: reportDate ? new Date(reportDate) : new Date(),
      },
    });
    return NextResponse.json({ report });
  } catch (error: any) {
    console.error('MEReport POST error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const body = await req.json();
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });
    const existing = await prisma.mEReport.findUnique({
      where: { id },
      include: { project: { select: { companyId: true } } },
    });
    if (!existing || !tenant.companyIds.includes(existing.project.companyId)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
    const data: any = {};
    if (updates.title !== undefined) data.title = updates.title;
    if (updates.type !== undefined) data.type = updates.type;
    if (updates.period !== undefined) data.period = updates.period || null;
    if (updates.content !== undefined) data.content = updates.content;
    if (updates.findings !== undefined) data.findings = updates.findings || null;
    if (updates.recommendations !== undefined) data.recommendations = updates.recommendations || null;
    if (updates.status !== undefined) data.status = updates.status;
    if (updates.reportDate !== undefined) data.reportDate = new Date(updates.reportDate);
    const report = await prisma.mEReport.update({ where: { id }, data });
    return NextResponse.json({ report });
  } catch (error: any) {
    console.error('MEReport PUT error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });
    const existing = await prisma.mEReport.findUnique({
      where: { id },
      include: { project: { select: { companyId: true } } },
    });
    if (!existing || !tenant.companyIds.includes(existing.project.companyId)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
    await prisma.mEReport.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('MEReport DELETE error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
