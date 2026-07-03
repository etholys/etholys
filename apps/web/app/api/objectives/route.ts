export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import {
  canReparentTo,
  describeReparentError,
  wouldCreateCycle,
} from '@/lib/siep/objective-hierarchy';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    if (!projectId) return NextResponse.json({ error: 'projectId requerido' }, { status: 400 });
    const objectives = await prisma.objective.findMany({
      where: { projectId, isActive: true },
      include: { children: { where: { isActive: true }, include: { children: { where: { isActive: true }, orderBy: { order: 'asc' } } }, orderBy: { order: 'asc' } } },
      orderBy: { order: 'asc' },
    });
    // Return only top-level (no parent)
    const tree = objectives.filter(o => !o.parentId);
    return NextResponse.json({ objectives: tree });
  } catch (error: any) {
    console.error('Objectives error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const body = await req.json();
    const count = await prisma.objective.count({ where: { projectId: body.projectId, parentId: body.parentId || null, isActive: true } });
    const obj = await prisma.objective.create({
      data: {
        projectId: body.projectId, parentId: body.parentId || null, type: body.type || 'objective',
        code: body.code || null, title: body.title, description: body.description || null,
        indicator: body.indicator || null, indicatorType: body.indicatorType || null,
        unitOfMeasure: body.unitOfMeasure || null, dataSource: body.dataSource || null,
        disaggregation: body.disaggregation || null, reportingFreq: body.reportingFreq || null,
        responsibility: body.responsibility || null, dataLimitations: body.dataLimitations || null,
        baseline: body.baseline || null, target: body.target || null, actual: body.actual || null,
        status: body.status || 'not_started', order: count,
      },
    });
    return NextResponse.json({ objective: obj });
  } catch (error: any) {
    console.error('Create objective error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const body = await req.json();
    const { id, ...data } = body;
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    if ('parentId' in data) {
      const current = await prisma.objective.findUnique({
        where: { id },
        select: { id: true, type: true, projectId: true, parentId: true },
      });
      if (!current) return NextResponse.json({ error: 'Objetivo no encontrado' }, { status: 404 });

      const newParentId = data.parentId || null;
      if (newParentId) {
        const parent = await prisma.objective.findFirst({
          where: { id: newParentId, projectId: current.projectId, isActive: true },
          select: { id: true, type: true, parentId: true },
        });
        if (!parent) {
          return NextResponse.json({ error: 'Elemento pai no encontrado' }, { status: 400 });
        }
        const flat = await prisma.objective.findMany({
          where: { projectId: current.projectId, isActive: true },
          select: { id: true, parentId: true, type: true },
        });
        const err = describeReparentError(
          { id: current.id, type: current.type, parentId: current.parentId },
          { id: parent.id, type: parent.type, parentId: parent.parentId },
          flat,
        );
        if (err) return NextResponse.json({ error: err }, { status: 400 });
        if (wouldCreateCycle(flat, current.id, newParentId)) {
          return NextResponse.json({ error: 'Esta ligação criaria um ciclo na árvore' }, { status: 400 });
        }
        if (!canReparentTo(current.type, parent.type)) {
          return NextResponse.json({ error: 'Tipo de pai inválido para este elemento' }, { status: 400 });
        }
      }
    }

    const obj = await prisma.objective.update({ where: { id }, data });
    return NextResponse.json({ objective: obj });
  } catch (error: any) {
    console.error('Update objective error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    await prisma.objective.update({ where: { id }, data: { isActive: false } });
    // Also deactivate children
    await prisma.objective.updateMany({ where: { parentId: id }, data: { isActive: false } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete objective error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
