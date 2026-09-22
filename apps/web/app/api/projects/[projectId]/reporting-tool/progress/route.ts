export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireProjectPermission } from '@/lib/siep/permissions';
import { getUserCompanyIds } from '@/lib/tenant';

const STATUSES = ['Not started', 'On track', 'Slightly off track', 'Severely off track'] as const;

export async function GET(req: Request, { params }: { params: { projectId: string } }) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const gate = await requireProjectPermission(tenant.userId, params.projectId, [
      'siep.logframe.view',
      'siep.project.view',
    ]);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const { searchParams } = new URL(req.url);
    const lineId = searchParams.get('lineId');
    if (!lineId) return NextResponse.json({ error: 'lineId requerido' }, { status: 400 });

    const line = await prisma.projectReportingToolLine.findFirst({
      where: { id: lineId, projectId: params.projectId, isActive: true },
    });
    if (!line) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    const entries = await prisma.projectReportingToolProgress.findMany({
      where: { lineId, projectId: params.projectId },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ line, entries });
  } catch (error: unknown) {
    console.error('[SIEP] reporting-tool progress GET:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: { projectId: string } }) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const gate = await requireProjectPermission(tenant.userId, params.projectId, [
      'siep.logframe.edit',
      'siep.project.edit',
      'siep.reports.edit',
    ]);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const body = await req.json();
    const lineId = String(body.lineId || '');
    if (!lineId) return NextResponse.json({ error: 'lineId requerido' }, { status: 400 });

    const line = await prisma.projectReportingToolLine.findFirst({
      where: { id: lineId, projectId: params.projectId, isActive: true },
    });
    if (!line) return NextResponse.json({ error: 'Línea no encontrada' }, { status: 404 });

    const periodLabel = String(body.periodLabel || '').trim();
    if (!periodLabel) {
      return NextResponse.json({ error: 'periodLabel requerido (ej. 2026-Q3)' }, { status: 400 });
    }

    const status = String(body.status || 'Not started');
    if (!STATUSES.includes(status as (typeof STATUSES)[number])) {
      return NextResponse.json({ error: 'status inválido' }, { status: 400 });
    }

    const entry = await prisma.projectReportingToolProgress.create({
      data: {
        lineId,
        projectId: params.projectId,
        periodLabel,
        periodStart: body.periodStart ? new Date(body.periodStart) : null,
        periodEnd: body.periodEnd ? new Date(body.periodEnd) : null,
        cumulativeBefore: body.cumulativeBefore != null ? String(body.cumulativeBefore) : null,
        progressDuring: body.progressDuring != null ? String(body.progressDuring) : null,
        totalCumulative: body.totalCumulative != null ? String(body.totalCumulative) : null,
        status,
        comments: body.comments != null ? String(body.comments) : null,
        createdById: tenant.userId,
      },
    });

    return NextResponse.json({ entry });
  } catch (error: unknown) {
    console.error('[SIEP] reporting-tool progress POST:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
