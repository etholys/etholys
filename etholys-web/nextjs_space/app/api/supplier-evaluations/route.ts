export const dynamic = 'force-dynamic';

import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';

export async function GET(req: NextRequest) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const supplierId = searchParams.get('supplierId');
    if (!supplierId) return NextResponse.json({ error: 'Missing supplierId' }, { status: 400 });

    // Verify supplier belongs to tenant
    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier || !tenant.companyIds.includes(supplier.companyId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const evaluations = await prisma.supplierEvaluation.findMany({
      where: { supplierId },
      orderBy: { evaluationDate: 'desc' },
    });

    // Calculate averages
    const count = evaluations.length;
    const avg = count > 0 ? {
      quality: evaluations.reduce((s, e) => s + e.quality, 0) / count,
      delivery: evaluations.reduce((s, e) => s + e.delivery, 0) / count,
      price: evaluations.reduce((s, e) => s + e.price, 0) / count,
      communication: evaluations.reduce((s, e) => s + e.communication, 0) / count,
      compliance: evaluations.reduce((s, e) => s + e.compliance, 0) / count,
      overall: evaluations.reduce((s, e) => s + (e.quality + e.delivery + e.price + e.communication + e.compliance) / 5, 0) / count,
    } : null;

    return NextResponse.json({ evaluations, averages: avg, count });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const body = await req.json();
    if (!body.supplierId) return NextResponse.json({ error: 'Missing supplierId' }, { status: 400 });

    const supplier = await prisma.supplier.findUnique({ where: { id: body.supplierId } });
    if (!supplier || !tenant.companyIds.includes(supplier.companyId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const evaluation = await prisma.supplierEvaluation.create({
      data: {
        supplierId: body.supplierId,
        quality: Math.min(5, Math.max(1, parseInt(body.quality) || 3)),
        delivery: Math.min(5, Math.max(1, parseInt(body.delivery) || 3)),
        price: Math.min(5, Math.max(1, parseInt(body.price) || 3)),
        communication: Math.min(5, Math.max(1, parseInt(body.communication) || 3)),
        compliance: Math.min(5, Math.max(1, parseInt(body.compliance) || 3)),
        comment: body.comment || null,
        evaluationDate: body.evaluationDate ? new Date(body.evaluationDate) : new Date(),
      },
    });

    // Update supplier overall rating (average of all evaluations)
    const allEvals = await prisma.supplierEvaluation.findMany({ where: { supplierId: body.supplierId } });
    const overallAvg = allEvals.reduce((s, e) => s + (e.quality + e.delivery + e.price + e.communication + e.compliance) / 5, 0) / allEvals.length;
    await prisma.supplier.update({
      where: { id: body.supplierId },
      data: { rating: Math.round(overallAvg) },
    });

    return NextResponse.json({ evaluation });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const evaluation = await prisma.supplierEvaluation.findUnique({ where: { id }, include: { supplier: true } });
    if (!evaluation || !tenant.companyIds.includes(evaluation.supplier.companyId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.supplierEvaluation.delete({ where: { id } });

    // Recalculate supplier rating
    const allEvals = await prisma.supplierEvaluation.findMany({ where: { supplierId: evaluation.supplierId } });
    const overallAvg = allEvals.length > 0
      ? allEvals.reduce((s, e) => s + (e.quality + e.delivery + e.price + e.communication + e.compliance) / 5, 0) / allEvals.length
      : null;
    await prisma.supplier.update({
      where: { id: evaluation.supplierId },
      data: { rating: overallAvg !== null ? Math.round(overallAvg) : null },
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
