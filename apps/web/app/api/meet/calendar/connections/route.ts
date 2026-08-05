export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getUserCompanyIds } from '@/lib/tenant';
import { getGoogleCalendarAccessToken } from '@/lib/meet/calendar-google';
import { getOutlookCalendarAccessToken } from '@/lib/meet/calendar-outlook';

/** Ligações OAuth persistentes do utilizador atual. */
export async function GET() {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const [google, outlook] = await Promise.all([
      getGoogleCalendarAccessToken(tenant.userId),
      getOutlookCalendarAccessToken(tenant.userId),
    ]);

    return NextResponse.json({
      google: {
        configured:
          process.env.GOOGLE_CALENDAR_ENABLED === '1' &&
          Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
        connected: google.connected,
        ready: google.connected && !google.needsReconnect,
        needsReconnect: google.needsReconnect,
      },
      outlook: {
        configured: Boolean(
          (process.env.AZURE_AD_CLIENT_ID || process.env.AZURE_AD_CLIENTID) &&
            (process.env.AZURE_AD_CLIENT_SECRET || process.env.AZURE_AD_CLIENTSECRET),
        ),
        connected: outlook.connected,
        ready: outlook.connected && !outlook.needsReconnect,
        needsReconnect: outlook.needsReconnect,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
