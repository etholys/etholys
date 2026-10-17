import type { CalendarFeedEvent } from '@/lib/calendar/types';

/** Um evento aparece se a camada de origem está ligada e, quando tem projeto, esse projeto também. */
export function calendarEventVisible(event: CalendarFeedEvent, enabled: ReadonlySet<string>): boolean {
  if (!enabled.has(event.calendarId)) return false;
  if (event.projectId && !enabled.has(`project:${event.projectId}`)) return false;
  return true;
}
