export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getUserCompanyIds } from '@/lib/tenant';
import { createMeetSession, listMeetSessions } from '@/lib/meet/create-session';
import { isMeetMirror } from '@/lib/meet/types';
import { isMeetRecurrenceFrequency } from '@/lib/meet/recurrence';
import { sendMeetInviteEmail } from '@/lib/meet/send-meet-email';
import { pushMeetSessionToGoogle } from '@/lib/meet/calendar-google-sync';
import { getGoogleCalendarAccessToken } from '@/lib/meet/calendar-google';

export async function GET(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('companyId')?.trim();
    if (!companyId || !tenant.companyIds.includes(companyId)) {
      return NextResponse.json({ error: 'companyId inválido' }, { status: 400 });
    }

    const limit = Number(searchParams.get('limit') || '250');
    const projectId = searchParams.get('projectId')?.trim() || undefined;
    const fromRaw = searchParams.get('from')?.trim();
    const toRaw = searchParams.get('to')?.trim();
    const unbounded = searchParams.get('unbounded') === '1';
    const from = fromRaw ? new Date(fromRaw) : undefined;
    const to = toRaw ? new Date(toRaw) : undefined;
    const sessions = await listMeetSessions(companyId, {
      limit: Number.isFinite(limit) ? limit : 250,
      projectId,
      unbounded,
      from: from && Number.isFinite(from.getTime()) ? from : undefined,
      to: to && Number.isFinite(to.getTime()) ? to : undefined,
    });
    return NextResponse.json({ sessions });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error interno';
    console.error('[meet/sessions] GET', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const body = (await req.json()) as {
      companyId?: string;
      title?: string;
      description?: string;
      mirror?: string;
      scheduledAt?: string;
      endsAt?: string;
      projectId?: string;
      forgeLiveSessionId?: string;
      inviteEmails?: string[];
      sendInvites?: boolean;
      locale?: string;
      unscheduled?: boolean;
      isPermanent?: boolean;
      recurrence?: string;
      recurrenceUntil?: string | null;
    };

    const companyId = body.companyId?.trim();
    if (!companyId || !tenant.companyIds.includes(companyId)) {
      return NextResponse.json({ error: 'companyId inválido' }, { status: 400 });
    }
    if (!body.title?.trim()) {
      return NextResponse.json({ error: 'title requerido' }, { status: 400 });
    }

    const isPermanent = Boolean(body.isPermanent) || Boolean(body.unscheduled);
    const recurrence =
      body.recurrence && isMeetRecurrenceFrequency(body.recurrence) ? body.recurrence : 'none';

    const session = await createMeetSession({
      companyId,
      createdById: tenant.userId,
      title: body.title,
      description: body.description,
      mirror: body.mirror && isMeetMirror(body.mirror) ? body.mirror : 'loose',
      scheduledAt: isPermanent
        ? null
        : body.scheduledAt
          ? new Date(body.scheduledAt)
          : new Date(),
      endsAt: isPermanent ? null : body.endsAt ? new Date(body.endsAt) : null,
      projectId: body.projectId || null,
      forgeLiveSessionId: body.forgeLiveSessionId || null,
      inviteEmails: body.inviteEmails,
      isPermanent,
      recurrence: isPermanent ? 'none' : recurrence,
      recurrenceUntil:
        !isPermanent && body.recurrenceUntil ? new Date(body.recurrenceUntil) : null,
    });

    const inviteResults: { email: string; sent: boolean; error?: string }[] = [];
    if (body.sendInvites && body.inviteEmails?.length && session.meetingUrl) {
      for (const raw of body.inviteEmails) {
        const email = raw.trim().toLowerCase();
        if (!email.includes('@')) continue;
        const r = await sendMeetInviteEmail({
          to: email,
          title: session.title,
          meetingUrl: session.meetingUrl,
          sessionId: session.id,
          scheduledAt: session.scheduledAt,
          endsAt: session.endsAt,
          locale: body.locale,
        });
        inviteResults.push({ email, ...r });
      }
    }

    // CHORUS → Google (automático se calendário ligado)
    const gcal = await getGoogleCalendarAccessToken(tenant.userId);
    if (gcal.connected && !gcal.needsReconnect && gcal.accessToken) {
      await pushMeetSessionToGoogle({
        userId: tenant.userId,
        sessionId: session.id,
        timeZone: (body as { timeZone?: string }).timeZone || 'UTC',
      }).catch((err) => console.warn('[meet/sessions] gcal push', err));
    }

    return NextResponse.json({ session, inviteResults });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error interno';
    console.error('[meet/sessions] POST', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
