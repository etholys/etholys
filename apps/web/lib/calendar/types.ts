export const CALENDAR_SOURCES = ['personal', 'etask', 'chorus', 'forge', 'fundhub', 'aurora'] as const;
export type CalendarSource = (typeof CALENDAR_SOURCES)[number];

export type CalendarLayer = {
  id: string;
  label: string;
  color: string;
  group: 'mine' | 'systems' | 'projects';
};

export type CalendarFeedEvent = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
  /** Camada de sistema (personal, etask, chorus, …). */
  calendarId: string;
  source: CalendarSource | 'project';
  color: string;
  href: string | null;
  projectId: string | null;
  editable: boolean;
  description?: string | null;
};

export const SOURCE_COLORS: Record<CalendarSource, string> = {
  personal: '#1a73e8',
  etask: '#0d9488',
  chorus: '#4f46e5',
  forge: '#7c3aed',
  fundhub: '#d97706',
  aurora: '#ea580c',
};
