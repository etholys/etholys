export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { hasSiepPermission, resolveSiepPermissions } from '@/lib/siep/permissions';
import {
  calcDistanceKm,
  calcReimbursementUsd,
  estimateFuelPriceUsd,
} from '@/lib/siep/mileage-estimate';

const reportInclude = {
  task: { select: { id: true, title: true, status: true } },
  author: { select: { id: true, name: true, email: true } },
  reviewer: { select: { id: true, name: true } },
  budgetLine: { select: { id: true, description: true, category: true } },
  mileage: true,
  project: { select: { id: true, companyId: true, currency: true } },
};

async function loadReport(reportId: string) {
  return prisma.taskActivityReport.findFirst({
    where: { id: reportId, isActive: true },
    include: reportInclude,
  });
}

export async function GET(_req: Request, { params }: { params: { reportId: string } }) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const report = await loadReport(params.reportId);
    if (!report || !tenant.companyIds.includes(report.project.companyId)) {
      return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    }

    const perms = await resolveSiepPermissions(tenant.userId, report.project.companyId);
    const canViewAll = hasSiepPermission(perms, 'siep.activities.view_all_reports');
    if (!canViewAll && report.authorId !== tenant.userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    return NextResponse.json({ report });
  } catch (error: unknown) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: { reportId: string } }) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const existing = await loadReport(params.reportId);
    if (!existing || !tenant.companyIds.includes(existing.project.companyId)) {
      return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    }

    const perms = await resolveSiepPermissions(tenant.userId, existing.project.companyId);
    const isAuthor = existing.authorId === tenant.userId;
    const canApprove = hasSiepPermission(perms, 'siep.activities.approve_reports');

    if (!isAuthor && !canApprove) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const body = await req.json();

    if (body.action === 'approve' && canApprove) {
      let transactionId: string | null = existing.transactionId;

      if (existing.mileage && existing.mileage.reimbursementUsd && existing.mileage.reimbursementUsd > 0) {
        const tx = await prisma.transaction.create({
          data: {
            companyId: existing.project.companyId,
            projectId: existing.projectId,
            type: 'EXPENSE',
            amount: existing.mileage.reimbursementUsd,
            currency: existing.project.currency || 'USD',
            title: `Combustível — ${existing.task.title}`.slice(0, 120),
            description: `${existing.mileage.fromPlace} → ${existing.mileage.toPlace} (${existing.mileage.distanceKm} km)`,
            category: 'travel',
            budgetLineId: existing.budgetLineId,
            executionStatus: 'FORECAST',
            date: existing.reportDate,
          },
        });
        transactionId = tx.id;
        await prisma.taskMileageClaim.update({
          where: { reportId: existing.id },
          data: { status: 'approved' },
        });
      }

      const report = await prisma.taskActivityReport.update({
        where: { id: params.reportId },
        data: {
          status: 'approved',
          reviewedById: tenant.userId,
          reviewedAt: new Date(),
          reviewNotes: body.reviewNotes || null,
          transactionId,
        },
        include: reportInclude,
      });
      return NextResponse.json({ report });
    }

    if (existing.status !== 'draft' && !canApprove) {
      return NextResponse.json({ error: 'Reporte já submetido — não editável' }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (body.narrative !== undefined) data.narrative = String(body.narrative);
    if (body.progressPct !== undefined) data.progressPct = body.progressPct != null ? parseInt(String(body.progressPct), 10) : null;
    if (body.reportDate !== undefined) data.reportDate = new Date(body.reportDate);
    if (body.budgetLineId !== undefined) data.budgetLineId = body.budgetLineId || null;
    if (body.photoUrls !== undefined) data.photoUrls = body.photoUrls;
    if (body.deliverableUrls !== undefined) data.deliverableUrls = body.deliverableUrls;
    if (body.includesTravel !== undefined) data.includesTravel = Boolean(body.includesTravel);

    const report = await prisma.taskActivityReport.update({
      where: { id: params.reportId },
      data,
      include: reportInclude,
    });

    if (body.mileage && report.includesTravel) {
      const m = body.mileage;
      const odometerStart = parseFloat(String(m.odometerStart));
      const odometerEnd = parseFloat(String(m.odometerEnd));
      const distanceKm = calcDistanceKm(odometerStart, odometerEnd);
      let fuelPriceUsdPerLiter = m.fuelPriceUsdPerLiter ? parseFloat(String(m.fuelPriceUsdPerLiter)) : null;
      let aiEstimateNotes: string | null = null;

      if (!fuelPriceUsdPerLiter && m.city && m.country) {
        const est = await estimateFuelPriceUsd({ city: m.city, country: m.country, distanceKm });
        fuelPriceUsdPerLiter = est.fuelPriceUsdPerLiter;
        aiEstimateNotes = est.notes;
      }

      const { fuelLiters, reimbursementUsd } = fuelPriceUsdPerLiter
        ? calcReimbursementUsd(distanceKm, fuelPriceUsdPerLiter)
        : { fuelLiters: 0, reimbursementUsd: 0 };

      await prisma.taskMileageClaim.upsert({
        where: { reportId: report.id },
        create: {
          reportId: report.id,
          odometerStart,
          odometerEnd,
          distanceKm,
          fromPlace: String(m.fromPlace || ''),
          toPlace: String(m.toPlace || ''),
          city: String(m.city || ''),
          country: String(m.country || ''),
          odometerStartPhoto: m.odometerStartPhoto || null,
          odometerEndPhoto: m.odometerEndPhoto || null,
          receiptUrls: m.receiptUrls ?? [],
          fuelPriceUsdPerLiter,
          fuelLitersEstimated: fuelLiters,
          reimbursementUsd,
          aiEstimateNotes,
        },
        update: {
          odometerStart,
          odometerEnd,
          distanceKm,
          fromPlace: String(m.fromPlace || ''),
          toPlace: String(m.toPlace || ''),
          city: String(m.city || ''),
          country: String(m.country || ''),
          odometerStartPhoto: m.odometerStartPhoto || null,
          odometerEndPhoto: m.odometerEndPhoto || null,
          receiptUrls: m.receiptUrls ?? [],
          fuelPriceUsdPerLiter,
          fuelLitersEstimated: fuelLiters,
          reimbursementUsd,
          aiEstimateNotes,
        },
      });
    }

    const full = await loadReport(params.reportId);
    return NextResponse.json({ report: full });
  } catch (error: unknown) {
    console.error('[SIEP] activity-report PUT:', error);
    const msg = error instanceof Error ? error.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { reportId: string } }) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const existing = await loadReport(params.reportId);
    if (!existing || !tenant.companyIds.includes(existing.project.companyId)) {
      return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    }
    if (existing.authorId !== tenant.userId || existing.status !== 'draft') {
      return NextResponse.json({ error: 'Só rascunhos próprios podem ser apagados' }, { status: 403 });
    }

    await prisma.taskActivityReport.update({
      where: { id: params.reportId },
      data: { isActive: false },
    });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
