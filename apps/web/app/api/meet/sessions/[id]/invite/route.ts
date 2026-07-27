export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getUserCompanyIds } from '@/lib/tenant';
import { getMeetSessionForCompany } from '@/lib/meet/create-session';
import { sendMeetInviteEmail } from '@/lib/meet/send-meet-email';
import { prisma } from '@/lib/prisma';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { id } = await ctx.params;
    const body = (await req.json()) as {
      companyId?: string;
      emails?: string[];
      locale?: string;
    };
    const companyId = body.companyId?.trim();
    if (!companyId || !tenant.companyIds.includes(companyId)) {
      return NextResponse.json({ error: 'companyId inválido' }, { status: 400 });
    }

    const session = await getMeetSessionForCompany(id, companyId);
    if (!session || !session.meetingUrl) {
      return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    }

    const emails = (body.emails ?? [])
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.includes('@'));
    if (emails.length === 0) {
      return NextResponse.json({ error: 'emails requeridos' }, { status: 400 });
    }

    const results: { email: string; sent: boolean; error?: string }[] = [];
    for (const email of emails) {
      const existing = session.participants.find((p) => p.email === email);
      if (!existing) {
        await prisma.meetParticipant.create({
          data: { sessionId: session.id, email, role: 'guest' },
        });
      }
      const r = await sendMeetInviteEmail({
        to: email,
        title: session.title,
        meetingUrl: session.meetingUrl,
        sessionId: session.id,
        scheduledAt: session.scheduledAt,
        endsAt: session.endsAt,
        locale: body.locale,
      });
      results.push({ email, ...r });
    }

    return NextResponse.json({ results });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
