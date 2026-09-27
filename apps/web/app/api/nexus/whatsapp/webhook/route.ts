export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  extractInboundMessages,
  normalizeWhatsappPhone,
  parseInboundWhatsapp,
  sendWhatsappText,
} from '@/lib/nexus-whatsapp';

function verifyToken(): string {
  return process.env.WHATSAPP_VERIFY_TOKEN || '';
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');
  if (mode === 'subscribe' && token && token === verifyToken() && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const messages = extractInboundMessages(body);
  for (const msg of messages) {
    const phone = normalizeWhatsappPhone(msg.phone);
    if (!phone) continue;
    const link = await prisma.nexusWhatsappLink.findUnique({ where: { phoneE164: phone } });
    if (!link) continue;

    await prisma.nexusWhatsappLink.update({
      where: { id: link.id },
      data: { lastInboundAt: new Date(), displayName: msg.name || link.displayName },
    });

    const parsed = parseInboundWhatsapp(msg.text);

    if (parsed.type === 'ack' || parsed.type === 'reject') {
      const kind = link.pendingCommandKind;
      if (!kind) continue;
      await prisma.nexusWhatsappLink.update({
        where: { id: link.id },
        data: { pendingCommandKind: null, pendingCommandAt: null },
      });
      if (parsed.type === 'ack') {
        await prisma.nexusOpsRule.updateMany({
          where: { companyId: link.companyId, kind },
          data: { enabled: true, lastCommandAt: new Date() },
        });
        await prisma.nexusFieldEntry.create({
          data: {
            companyId: link.companyId,
            kind: 'note',
            occurredAt: new Date(),
            channel: 'whatsapp',
            fromPhone: phone,
            payloadJson: { note: msg.text, source: 'whatsapp', commandAck: kind },
          },
        });
        await sendWhatsappText(phone, `Comando confirmado: ${kind}.`);
      } else {
        await sendWhatsappText(phone, 'Pedido de comando cancelado.');
      }
      continue;
    }

    const entry = await prisma.nexusFieldEntry.create({
      data: {
        companyId: link.companyId,
        kind: parsed.kind,
        occurredAt: new Date(),
        channel: 'whatsapp',
        fromPhone: phone,
        payloadJson: parsed.payload,
      },
    });

    if (parsed.metric && parsed.value != null && Number.isFinite(parsed.value)) {
      await prisma.nexusReading.create({
        data: {
          companyId: link.companyId,
          metric: parsed.metric,
          value: parsed.value,
          unit: parsed.unit || 'u',
          source: 'whatsapp',
          recordedAt: entry.occurredAt,
        },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
