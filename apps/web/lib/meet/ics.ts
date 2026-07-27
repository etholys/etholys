/**
 * Gera ficheiro .ics mínimo para convite de calendário (Google / Outlook).
 * OAuth nativo fica para fase posterior (docs/architecture/etholys-meet.md F6).
 */

export type MeetIcsInput = {
  uid: string;
  title: string;
  description?: string;
  locationUrl?: string;
  startsAt: Date;
  endsAt: Date;
  organizerEmail?: string;
};

function pad(n: number) {
  return String(n).padStart(2, '0');
}

/** Formato UTC básico: YYYYMMDDTHHMMSSZ */
export function toIcsUtc(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

function escapeIcsText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

export function buildMeetIcs(input: MeetIcsInput): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Etholys//Meet//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${escapeIcsText(input.uid)}`,
    `DTSTAMP:${toIcsUtc(new Date())}`,
    `DTSTART:${toIcsUtc(input.startsAt)}`,
    `DTEND:${toIcsUtc(input.endsAt)}`,
    `SUMMARY:${escapeIcsText(input.title)}`,
  ];
  if (input.description) lines.push(`DESCRIPTION:${escapeIcsText(input.description)}`);
  if (input.locationUrl) lines.push(`LOCATION:${escapeIcsText(input.locationUrl)}`);
  if (input.organizerEmail) {
    lines.push(`ORGANIZER:mailto:${escapeIcsText(input.organizerEmail)}`);
  }
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
}
