export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getUserCompanyIds } from '@/lib/tenant';
import { getMeetSessionForCompany } from '@/lib/meet/create-session';
import { createGoogleCalendarEvent, getGoogleCalendarAccessToken } from '@/lib/meet/calendar-google';
import { createOutlookCalendarEvent, getOutlookCalendarAccessToken } from '@/lib/meet/calendar-outlook';

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

    const startsAt = session.scheduledAt ?? new Date();
    const endsAt =
      session.endsAt ??
      new Date(startsAt.getTime() + 60 * 60 * 1000);

    const event = {
      title: session.title,
      description: [session.description, session.meetingUrl].filter(Boolean).join('\n\n'),
      locationUrl: session.meetingUrl || undefined,
      startsAt,
      endsAt,
      attendeeEmails: session.participants
        .filter((participant) => participant.role !== 'host' && participant.email)
        .map((participant) => participant.email!),
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
