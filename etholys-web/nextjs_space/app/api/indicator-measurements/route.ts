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
    const objectiveId = searchParams.get('objectiveId');
    if (!projectId) return NextResponse.json({ error: 'projectId requerido' }, { status: 400 });
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { companyId: true } });
    if (!project || !tenant.companyIds.includes(project.companyId)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
    const where: any = { projectId };
    if (objectiveId) where.objectiveId = objectiveId;
    const measurements = await prisma.indicatorMeasurement.findMany({
      where,
      include: { objective: { select: { id: true, title: true, code: true, type: true, indicator: true, baseline: true, target: true, actual: true } } },
      orderBy: [{ period: 'asc' }, { createdAt: 'asc' }],
    });
    return NextResponse.json({ measurements });
  } catch (error: any) {
    console.error('IndicatorMeasurement GET error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const body = await req.json();
    const { projectId, objectiveId, period, value, notes, source, collectedBy } = body;
    if (!projectId || !objectiveId || !period || value === undefined) {
      return NextResponse.json({ error: 'projectId, objectiveId, period, value requeridos' }, { status: 400 });
    }
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { companyId: true } });
    if (!project || !tenant.companyIds.includes(project.companyId)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
    const measurement = await prisma.indicatorMeasurement.create({
      data: {
        projectId,
        objectiveId,
        period,
        value: String(value),
        notes: notes || null,
        source: source || null,
        collectedBy: collectedBy || null,
      },
    });
    // Also update the objective's 'actual' field to latest value
    await prisma.objective.update({ where: { id: objectiveId }, data: { actual: String(value) } });
    return NextResponse.json({ measurement });
  } catch (error: any) {
    console.error('IndicatorMeasurement POST error:', error);
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
    const existing = await prisma.indicatorMeasurement.findUnique({
      where: { id },
      include: { project: { select: { companyId: true } } },
    });
    if (!existing || !tenant.companyIds.includes(existing.project.companyId)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
    const data: any = {};
    if (updates.value !== undefined) data.value = String(updates.value);
    if (updates.notes !== undefined) data.notes = updates.notes || null;
    if (updates.source !== undefined) data.source = updates.source || null;
    if (updates.status !== undefined) data.status = updates.status;
    if (updates.period !== undefined) data.period = updates.period;
    const measurement = await prisma.indicatorMeasurement.update({ where: { id }, data });
    return NextResponse.json({ measurement });
  } catch (error: any) {
    console.error('IndicatorMeasurement PUT error:', error);
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
    const existing = await prisma.indicatorMeasurement.findUnique({
      where: { id },
      include: { project: { select: { companyId: true } } },
    });
    if (!existing || !tenant.companyIds.includes(existing.project.companyId)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
    await prisma.indicatorMeasurement.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('IndicatorMeasurement DELETE error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
