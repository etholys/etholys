export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { canAccessNexusOpsCompany } from '@/lib/nexus-ops';
import { normalizeWhatsappPhone, sendWhatsappText, whatsappConfigured } from '@/lib/nexus-whatsapp';

export async function GET(req: NextRequest) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const companyId = String(new URL(req.url).searchParams.get('companyId') || '').trim();
  const engagementId = String(new URL(req.url).searchParams.get('engagementId') || '').trim() || null;
  if (!companyId) return NextResponse.json({ error: 'companyId obrigatório.' }, { status: 400 });
  if (!(await canAccessNexusOpsCompany(tenant.companyIds, companyId, engagementId))) {
    return NextResponse.json({ error: 'Empresa inválida.' }, { status: 403 });
  }
  const link = await prisma.nexusWhatsappLink.findFirst({ where: { companyId } });
  return NextResponse.json({
    configured: whatsappConfigured(),
    link: link
      ? {
          phoneE164: link.phoneE164,
          displayName: link.displayName,
          alertsEnabled: link.alertsEnabled,
          lastInboundAt: link.lastInboundAt,
          lastOutboundAt: link.lastOutboundAt,
          pendingCommandKind: link.pendingCommandKind,
        }
      : null,
  });
}

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
  if (!companyId) return NextResponse.json({ error: 'companyId obrigatório.' }, { status: 400 });
  if (!(await canAccessNexusOpsCompany(tenant.companyIds, companyId, engagementId))) {
    return NextResponse.json({ error: 'Empresa inválida.' }, { status: 403 });
  }

  if (body.unlink === true) {
    await prisma.nexusWhatsappLink.deleteMany({ where: { companyId } });
    return NextResponse.json({ ok: true, link: null });
  }

  const phone = normalizeWhatsappPhone(String(body.phone || ''));
  if (!phone) return NextResponse.json({ error: 'Número de WhatsApp inválido.' }, { status: 400 });

  const taken = await prisma.nexusWhatsappLink.findUnique({ where: { phoneE164: phone } });
  if (taken && taken.companyId !== companyId) {
    return NextResponse.json({ error: 'Este número já está ligado a outro negócio.' }, { status: 409 });
  }

  await prisma.nexusWhatsappLink.deleteMany({
    where: { companyId, phoneE164: { not: phone } },
  });

  const link = await prisma.nexusWhatsappLink.upsert({
    where: { phoneE164: phone },
    create: {
      companyId,
      phoneE164: phone,
      displayName: String(body.displayName || '').trim() || null,
      alertsEnabled: body.alertsEnabled !== false,
    },
    update: {
      companyId,
      displayName: String(body.displayName || '').trim() || undefined,
      alertsEnabled: typeof body.alertsEnabled === 'boolean' ? body.alertsEnabled : undefined,
    },
  });

  if (body.welcome !== false && whatsappConfigured()) {
    await sendWhatsappText(
      phone,
      'NEXUS ligado. Envie dados de produção por aqui (ex.: "15 mm irrigação", "120 ovos") e receberá alertas neste WhatsApp.'
    );
    await prisma.nexusWhatsappLink.update({
      where: { id: link.id },
      data: { lastOutboundAt: new Date() },
    });
  }

  return NextResponse.json({
    ok: true,
    configured: whatsappConfigured(),
    link: {
      phoneE164: link.phoneE164,
      displayName: link.displayName,
      alertsEnabled: link.alertsEnabled,
    },
  });
}
