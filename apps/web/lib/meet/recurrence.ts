/**
 * Regras simples de recorrência Meet (materialização de ocorrências).
 */

export const MEET_RECURRENCE_FREQUENCIES = [
  'none',
  'daily',
  'weekly',
  'weekdays',
  'monthly',
] as const;

export type MeetRecurrenceFrequency = (typeof MEET_RECURRENCE_FREQUENCIES)[number];

export function isMeetRecurrenceFrequency(v: unknown): v is MeetRecurrenceFrequency {
  return (
    typeof v === 'string' &&
    (MEET_RECURRENCE_FREQUENCIES as readonly string[]).includes(v)
  );
}

export type OccurrenceSlot = {
  startsAt: Date;
  endsAt: Date;
};

const MAX_OCCURRENCES = 52;

function addDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

function addMonthsKeepDay(date: Date, months: number): Date {
  const next = new Date(date.getTime());
  const day = next.getDate();
  next.setMonth(next.getMonth() + months);
  // Evita saltar meses curtos (31 → 2/3)
  if (next.getDate() < day) next.setDate(0);
  return next;
}

function isWeekday(date: Date): boolean {
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

/** Gera slots [início, fim] a partir da primeira ocorrência. Inclui a primeira. */
export function expandMeetOccurrences(input: {
  startsAt: Date;
  endsAt: Date;
  frequency: MeetRecurrenceFrequency;
  until?: Date | null;
  max?: number;
}): OccurrenceSlot[] {
  const durationMs = Math.max(15 * 60_000, input.endsAt.getTime() - input.startsAt.getTime());
  const max = Math.min(MAX_OCCURRENCES, Math.max(1, input.max ?? MAX_OCCURRENCES));
  const until = input.until && Number.isFinite(input.until.getTime()) ? input.until : null;

  if (input.frequency === 'none') {
    return [{ startsAt: input.startsAt, endsAt: new Date(input.startsAt.getTime() + durationMs) }];
  }

  const slots: OccurrenceSlot[] = [];
  let cursor = new Date(input.startsAt.getTime());

  while (slots.length < max) {
    if (until && cursor.getTime() > until.getTime()) break;

    if (input.frequency === 'weekdays' && !isWeekday(cursor)) {
      cursor = addDays(cursor, 1);
      continue;
    }

    slots.push({
      startsAt: new Date(cursor.getTime()),
      endsAt: new Date(cursor.getTime() + durationMs),
    });

    if (input.frequency === 'daily') {
      cursor = addDays(cursor, 1);
    } else if (input.frequency === 'weekly') {
      cursor = addDays(cursor, 7);
    } else if (input.frequency === 'weekdays') {
      cursor = addDays(cursor, 1);
    } else if (input.frequency === 'monthly') {
      cursor = addMonthsKeepDay(cursor, 1);
    } else {
      break;
    }
  }

  return slots;
}

/** RRULE mínimo para .ics / Google Calendar. */
export function meetRecurrenceToRrule(
  frequency: MeetRecurrenceFrequency,
  until?: Date | null,
): string | null {
  if (frequency === 'none') return null;
  const parts: string[] = [];
  if (frequency === 'daily') parts.push('FREQ=DAILY');
  else if (frequency === 'weekly') parts.push('FREQ=WEEKLY');
  else if (frequency === 'weekdays') parts.push('FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR');
  else if (frequency === 'monthly') parts.push('FREQ=MONTHLY');
  else return null;

  if (until && Number.isFinite(until.getTime())) {
    const y = until.getUTCFullYear();
    const m = String(until.getUTCMonth() + 1).padStart(2, '0');
    const d = String(until.getUTCDate()).padStart(2, '0');
    parts.push(`UNTIL=${y}${m}${d}T235959Z`);
  } else {
    parts.push(`COUNT=${MAX_OCCURRENCES}`);
  }
  return parts.join(';');
}
