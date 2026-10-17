/**
 * Links de calendário para quem reservou, sem conta Etholys.
 */

function compactUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

export function bookingCalendarLinks(input: {
  title: string;
  details: string;
  location: string;
  startsAt: Date;
  endsAt: Date;
  icsPath: string;
}): { googleUrl: string; outlookUrl: string; icsPath: string } {
  const google = new URL('https://calendar.google.com/calendar/render');
  google.searchParams.set('action', 'TEMPLATE');
  google.searchParams.set('text', input.title);
  google.searchParams.set('dates', `${compactUtc(input.startsAt)}/${compactUtc(input.endsAt)}`);
  google.searchParams.set('details', input.details);
  google.searchParams.set('location', input.location);

  const outlook = new URL('https://outlook.live.com/calendar/0/deeplink/compose');
  outlook.searchParams.set('subject', input.title);
  outlook.searchParams.set('startdt', input.startsAt.toISOString());
  outlook.searchParams.set('enddt', input.endsAt.toISOString());
  outlook.searchParams.set('body', input.details);
  outlook.searchParams.set('location', input.location);

  return {
    googleUrl: google.toString(),
    outlookUrl: outlook.toString(),
    icsPath: input.icsPath,
  };
}
