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
    if (!projectId) return NextResponse.json({ error: 'projectId requerido' }, { status: 400 });
    const deps = await prisma.taskDependency.findMany({
      where: { task: { projectId } },
      include: {
        task: { select: { id: true, title: true, status: true } },
        dependsOn: { select: { id: true, title: true, status: true } },
      },
    });
    return NextResponse.json({ dependencies: deps });
  } catch (error: any) {
    console.error('Task deps GET error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const body = await req.json();
    const { taskId, dependsOnTaskId, type, lagDays } = body;
    if (!taskId || !dependsOnTaskId) return NextResponse.json({ error: 'taskId y dependsOnTaskId requeridos' }, { status: 400 });
    if (taskId === dependsOnTaskId) return NextResponse.json({ error: 'Una tarea no puede depender de sí misma' }, { status: 400 });
    const dep = await prisma.taskDependency.create({
      data: { taskId, dependsOnTaskId, type: type || 'finish_to_start', lagDays: lagDays || 0 },
      include: { task: { select: { id: true, title: true } }, dependsOn: { select: { id: true, title: true } } },
    });
    return NextResponse.json({ dependency: dep });
  } catch (error: any) {
    console.error('Task deps POST error:', error);
    return NextResponse.json({ error: error?.code === 'P2002' ? 'Dependencia ya existe' : 'Error interno' }, { status: error?.code === 'P2002' ? 400 : 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    await prisma.taskDependency.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Task deps DELETE error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
