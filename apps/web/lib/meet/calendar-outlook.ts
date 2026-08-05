import 'server-only';

import { prisma } from '@/lib/prisma';
import type { MeetCalendarEventInput } from '@/lib/meet/calendar-google';

const MS_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
const MS_EVENTS = 'https://graph.microsoft.com/v1.0/me/events';

function hasOutlookCalendarScope(scope: string | null | undefined): boolean {
  if (!scope) return false;
  return (
    scope.includes('Calendars.ReadWrite') ||
    scope.includes('Calendars.Read') ||
    scope.includes('https://graph.microsoft.com/Calendars')
  );
}

async function refreshMicrosoftToken(refreshToken: string): Promise<{
  access_token: string;
  expires_at?: number;
}> {
  const clientId = process.env.AZURE_AD_CLIENT_ID?.trim() || process.env.AZURE_AD_CLIENTID?.trim();
  const clientSecret =
    process.env.AZURE_AD_CLIENT_SECRET?.trim() || process.env.AZURE_AD_CLIENTSECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error('AZURE_AD_CLIENT_ID / AZURE_AD_CLIENT_SECRET em falta');
  }
  const res = await fetch(MS_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      scope: 'openid email profile offline_access Calendars.ReadWrite',
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Microsoft token refresh falhou (${res.status}): ${t.slice(0, 200)}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in?: number };
  return {
    access_token: data.access_token,
    expires_at: data.expires_in ? Math.floor(Date.now() / 1000) + data.expires_in : undefined,
  };
}

export async function getOutlookCalendarAccessToken(userId: string): Promise<{
  accessToken: string;
  connected: boolean;
  needsReconnect: boolean;
}> {
  const account = await prisma.account.findFirst({
    where: {
      userId,
      provider: { in: ['azure-ad', 'azuread', 'microsoft'] },
    },
  });
  if (!account?.access_token && !account?.refresh_token) {
    return { accessToken: '', connected: false, needsReconnect: true };
  }
  if (!hasOutlookCalendarScope(account.scope)) {
    return { accessToken: '', connected: true, needsReconnect: true };
  }

  const expiresAt = account.expires_at ?? 0;
  const soon = Math.floor(Date.now() / 1000) + 60;
  if (account.access_token && expiresAt > soon) {
    return { accessToken: account.access_token, connected: true, needsReconnect: false };
  }
  if (!account.refresh_token) {
    return { accessToken: '', connected: true, needsReconnect: true };
  }

  const refreshed = await refreshMicrosoftToken(account.refresh_token);
  await prisma.account.update({
    where: { id: account.id },
    data: {
      access_token: refreshed.access_token,
      expires_at: refreshed.expires_at ?? account.expires_at,
    },
  });
  return { accessToken: refreshed.access_token, connected: true, needsReconnect: false };
}

export async function createOutlookCalendarEvent(
  userId: string,
  event: MeetCalendarEventInput,
): Promise<{ htmlLink: string; id: string }> {
  const { accessToken, needsReconnect, connected } = await getOutlookCalendarAccessToken(userId);
  if (!connected || needsReconnect || !accessToken) {
    throw new Error(
      'Outlook Calendar não ligado. Configure Azure AD (AZURE_AD_*) e faça login com Microsoft com Calendars.ReadWrite.',
    );
  }

  const body = {
    subject: event.title,
    body: {
      contentType: 'HTML',
      content: [
        event.description || '',
        event.locationUrl ? `<p><a href="${event.locationUrl}">${event.locationUrl}</a></p>` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    },
    start: { dateTime: event.startsAt.toISOString().replace(/\.\d{3}Z$/, ''), timeZone: 'UTC' },
    end: { dateTime: event.endsAt.toISOString().replace(/\.\d{3}Z$/, ''), timeZone: 'UTC' },
    location: event.locationUrl ? { displayName: event.locationUrl } : undefined,
    attendees: event.attendeeEmails?.map((email) => ({
      emailAddress: { address: email },
      type: 'required',
    })),
  };

  const res = await fetch(MS_EVENTS, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Microsoft Graph Calendar (${res.status}): ${t.slice(0, 300)}`);
  }

  const data = (await res.json()) as { id: string; webLink?: string };
  return { id: data.id, htmlLink: data.webLink || '' };
}
