export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getUserCompanyIds } from '@/lib/tenant';
import { getMeetSessionForCompany } from '@/lib/meet/create-session';
import { createGoogleCalendarEvent, getGoogleCalendarAccessToken } from '@/lib/meet/calendar-google';
import { createOutlookCalendarEvent, getOutlookCalendarAccessToken } from '@/lib/meet/calendar-outlook';
import { meetRecurrenceToRrule, isMeetRecurrenceFrequency } from '@/lib/meet/recurrence';

type Ctx = { params: Promise<{ id: string }> };

/** Estado das ligações de calendário do utilizador actual. */
export async function GET(_req: Request, _ctx: Ctx) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const [google, outlook] = await Promise.all([
      getGoogleCalendarAccessToken(tenant.userId),
      getOutlookCalendarAccessToken(tenant.userId),
    ]);

    return NextResponse.json({
      google: {
        connected: google.connected,
        ready: google.connected && !google.needsReconnect,
        needsReconnect: google.needsReconnect,
      },
      outlook: {
        connected: outlook.connected,
        ready: outlook.connected && !outlook.needsReconnect,
        needsReconnect: outlook.needsReconnect,
      },
      googleCalendarEnabled: process.env.GOOGLE_CALENDAR_ENABLED === '1',
      azureConfigured: Boolean(
        process.env.AZURE_AD_CLIENT_ID || process.env.AZURE_AD_CLIENTID,
      ),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * POST — cria evento no Google ou Outlook Calendar (F6).
 * body: { companyId, provider: 'google' | 'outlook' }
 */
export async function POST(req: Request, ctx: Ctx) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { id } = await ctx.params;
    const body = (await req.json()) as {
      companyId?: string;
      provider?: 'google' | 'outlook';
      /** Se false, cria o evento sem e-mail de convite do Google/Outlook. Default: true. */
      notifyAttendees?: boolean;
      /** IANA timezone do organizador / UI (ex. America/Sao_Paulo). */
      timeZone?: string;
    };

    const companyId = body.companyId?.trim();
    if (!companyId || !tenant.companyIds.includes(companyId)) {
      return NextResponse.json({ error: 'companyId inválido' }, { status: 400 });
    }

    const provider = body.provider;
    if (provider !== 'google' && provider !== 'outlook') {
      return NextResponse.json({ error: 'provider deve ser google ou outlook' }, { status: 400 });
    }

    const session = await getMeetSessionForCompany(id, companyId);
    if (!session) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    // Séries: sincronizar sempre o mestre (tem RRULE). Filhos têm recurrence=none.
    const masterId = session.seriesParentId || session.id;
    const syncSession =
      masterId === session.id
        ? session
        : (await getMeetSessionForCompany(masterId, companyId)) || session;

    const startsAt = syncSession.scheduledAt ?? new Date();
    const endsAt =
      syncSession.endsAt ??
      new Date(startsAt.getTime() + 60 * 60 * 1000);

    const recurrence =
      syncSession.recurrence && isMeetRecurrenceFrequency(syncSession.recurrence)
        ? syncSession.recurrence
        : 'none';
    const recurrenceRule = meetRecurrenceToRrule(recurrence, syncSession.recurrenceUntil);

    const organizerEmail = (syncSession.createdBy?.email || '').trim().toLowerCase();
    const notifyAttendees = body.notifyAttendees !== false;
    const attendeeEmails = syncSession.participants
      .filter((participant) => participant.role !== 'host' && participant.email)
      .map((participant) => participant.email!.trim().toLowerCase())
      .filter((email) => email.includes('@') && email !== organizerEmail);

    const event = {
      title: syncSession.title,
      description: [syncSession.description, syncSession.meetingUrl].filter(Boolean).join('\n\n'),
      locationUrl: syncSession.meetingUrl || undefined,
      startsAt,
      endsAt,
      timeZone: body.timeZone?.trim() || 'UTC',
      attendeeEmails: notifyAttendees ? attendeeEmails : [],
      notifyAttendees,
      recurrenceRule: provider === 'google' ? recurrenceRule : null,
    };

    const created =
      provider === 'google'
        ? await createGoogleCalendarEvent(tenant.userId, event)
        : await createOutlookCalendarEvent(tenant.userId, event);

    return NextResponse.json({ ok: true, provider, event: created });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error interno';
    console.error('[meet/calendar]', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
