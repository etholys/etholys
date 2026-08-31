export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getUserCompanyIds } from '@/lib/tenant';
import {
  getMeetSessionForCompany,
  isMeetSessionOwner,
  meetSeriesMasterId,
} from '@/lib/meet/create-session';
import { sendMeetSessionInvites } from '@/lib/meet/send-session-invites';
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
    if (!isMeetSessionOwner(session, tenant.userId)) {
      return NextResponse.json({ error: 'Só o organizador pode enviar convites' }, { status: 403 });
    }

    const emails = (body.emails ?? [])
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.includes('@'));
    if (emails.length === 0) {
      return NextResponse.json({ error: 'emails requeridos' }, { status: 400 });
    }

    const masterId = meetSeriesMasterId(session);
    for (const email of emails) {
      const existing = session.participants.find(
        (p) => (p.email || p.user?.email || '').toLowerCase() === email,
      );
      if (!existing) {
        await prisma.meetParticipant.create({
          data: { sessionId: masterId, email, role: 'guest' },
        });
      }
    }

    const refreshed = await getMeetSessionForCompany(id, companyId);
    const meetingUrl = refreshed?.meetingUrl || session.meetingUrl;
    const results = await sendMeetSessionInvites({
      session: {
        id: masterId,
        title: session.title,
        meetingUrl,
        scheduledAt: session.scheduledAt,
        endsAt: session.endsAt,
      },
      emails,
      locale: body.locale,
      hostName: session.createdBy?.name || session.createdBy?.email || null,
    });

    return NextResponse.json({ results, session: refreshed });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
