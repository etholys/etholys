export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';

const DEFAULT_SECTIONS = [
  { sectionKey: 'background', title: 'Antecedentes / Background', order: 0 },
  { sectionKey: 'objectives', title: 'Objetivos / Objectives', order: 1 },
  { sectionKey: 'methodology', title: 'Metodolog\u00eda / Approach', order: 2 },
  { sectionKey: 'deliverables', title: 'Entregables / Deliverables', order: 3 },
  { sectionKey: 'scope', title: 'Alcance Geogr\u00e1fico / Geographic Scope', order: 4 },
  { sectionKey: 'target', title: 'Poblaci\u00f3n Meta / Target Population', order: 5 },
  { sectionKey: 'partners', title: 'Socios / Implementation Partners', order: 6 },
  { sectionKey: 'assumptions', title: 'Supuestos y Condiciones / Assumptions', order: 7 },
];

export async function GET(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    if (!projectId) return NextResponse.json({ error: 'projectId requerido' }, { status: 400 });
    // Verify project ownership
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { companyId: true } });
    if (!project || !tenant.companyIds.includes(project.companyId)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
    let sections = await prisma.sOWSection.findMany({
      where: { projectId, isActive: true },
      orderBy: { order: 'asc' },
    });
    // Auto-create default sections if empty
    if (sections.length === 0) {
      await prisma.sOWSection.createMany({
        data: DEFAULT_SECTIONS.map(s => ({ ...s, projectId, content: '' })),
      });
      sections = await prisma.sOWSection.findMany({
        where: { projectId, isActive: true },
        orderBy: { order: 'asc' },
      });
    }
    return NextResponse.json({ sections });
  } catch (error: any) {
    console.error('SOW GET error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const body = await req.json();
    const { id, content, title } = body;
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });
    const existing = await prisma.sOWSection.findUnique({
      where: { id },
      include: { project: { select: { companyId: true } } },
    });
    if (!existing || !tenant.companyIds.includes(existing.project.companyId)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
    const data: any = {};
    if (content !== undefined) data.content = content;
    if (title !== undefined) data.title = title;
    const section = await prisma.sOWSection.update({ where: { id }, data });
    return NextResponse.json({ section });
  } catch (error: any) {
    console.error('SOW PUT error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const body = await req.json();
    const { projectId, sectionKey, title, content } = body;
    if (!projectId || !sectionKey || !title) {
      return NextResponse.json({ error: 'Campos requeridos: projectId, sectionKey, title' }, { status: 400 });
    }
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { companyId: true } });
    if (!project || !tenant.companyIds.includes(project.companyId)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
    const maxOrder = await prisma.sOWSection.aggregate({ where: { projectId }, _max: { order: true } });
    const section = await prisma.sOWSection.create({
      data: { projectId, sectionKey, title, content: content || '', order: (maxOrder._max.order ?? -1) + 1 },
    });
    return NextResponse.json({ section });
  } catch (error: any) {
    console.error('SOW POST error:', error);
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
    const existing = await prisma.sOWSection.findUnique({
      where: { id },
      include: { project: { select: { companyId: true } } },
    });
    if (!existing || !tenant.companyIds.includes(existing.project.companyId)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
    await prisma.sOWSection.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('SOW DELETE error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
