export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { canAccessNexusOpsCompany } from '@/lib/nexus-ops';

export async function POST(req: NextRequest) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });
  }
  const companyId = String(body.companyId || '').trim();
  const engagementId = String(body.engagementId || '').trim() || null;
  if (!companyId || !(await canAccessNexusOpsCompany(tenant.companyIds, companyId, engagementId))) {
    return NextResponse.json({ error: 'Empresa inválida.' }, { status: 403 });
  }

  if (body.deleteId) {
    await prisma.businessBet.deleteMany({ where: { id: String(body.deleteId), companyId } });
    return NextResponse.json({ ok: true });
  }

  if (body.id) {
    const dueAt =
      body.dueAt === 'week' || body.dueAt === 'this-week'
        ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        : body.dueAt === null
          ? null
          : typeof body.dueAt === 'string' && body.dueAt
            ? new Date(String(body.dueAt))
            : undefined;
    const bet = await prisma.businessBet.updateMany({
      where: { id: String(body.id), companyId },
      data: {
        title: body.title != null ? String(body.title).slice(0, 200) : undefined,
        why: body.why != null ? String(body.why).slice(0, 800) : undefined,
        indicator: body.indicator != null ? String(body.indicator).slice(0, 200) : undefined,
        status: body.status != null ? String(body.status).slice(0, 20) : undefined,
        ownerLabel: body.ownerLabel != null ? String(body.ownerLabel).slice(0, 80) : undefined,
        dueAt: dueAt !== undefined && dueAt instanceof Date && Number.isNaN(dueAt.getTime()) ? undefined : dueAt,
      },
    });
    return NextResponse.json({ ok: true, bet });
  }

  const title = String(body.title || '').trim();
  if (title.length < 3) return NextResponse.json({ error: 'Aposta precisa de título.' }, { status: 400 });
  const dossier = await prisma.businessDossier.findUnique({
    where: { companyId },
    select: { hypothesisAccepted: true },
  });
  if (!dossier?.hypothesisAccepted) {
    return NextResponse.json({ error: 'Aceita a hipótese antes de abrir apostas.' }, { status: 400 });
  }
  const count = await prisma.businessBet.count({
    where: { companyId, status: { notIn: ['done', 'dropped'] } },
  });
  if (count >= 4) return NextResponse.json({ error: 'No máximo 4 apostas ativas.' }, { status: 400 });

  const bet = await prisma.businessBet.create({
    data: {
      companyId,
      title: title.slice(0, 200),
      why: String(body.why || '').slice(0, 800),
      indicator: String(body.indicator || '').slice(0, 200) || null,
      ownerLabel: String(body.ownerLabel || '').slice(0, 80) || null,
      dueAt:
        body.dueAt === 'week' || body.dueAt === 'this-week'
          ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          : typeof body.dueAt === 'string' && body.dueAt
            ? Number.isNaN(new Date(String(body.dueAt)).getTime())
              ? null
              : new Date(String(body.dueAt))
            : null,
      status: 'proposed',
    },
  });
  return NextResponse.json({ ok: true, bet });
}
