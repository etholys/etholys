'use client';

import { ChevronLeft, ChevronRight, Video } from 'lucide-react';

export type MeetCalendarSession = {
  id: string;
  title: string;
  status: string;
  scheduledAt: string | null;
  endsAt: string | null;
  projectId?: string | null;
  meetingUrl?: string | null;
  createdById?: string | null;
};

export type MeetCalendarScale = 'day' | 'week' | 'month' | 'year';

type Props = {
  locale: string;
  companyId: string;
  sessions: MeetCalendarSession[];
  anchor: Date;
  scale: MeetCalendarScale;
  onAnchorChange: (date: Date) => void;
  onScaleChange: (scale: MeetCalendarScale) => void;
  onSelectSession: (sessionId: string) => void;
};

const DAY = 86_400_000;

function startDay(value: Date): Date {
  const result = new Date(value);
  result.setHours(0, 0, 0, 0);
  return result;
}

function sameDay(a: Date, b: Date): boolean {
  return startDay(a).getTime() === startDay(b).getTime();
}

function weekStart(value: Date): Date {
  const day = startDay(value);
  const offset = (day.getDay() + 6) % 7;
  return new Date(day.getTime() - offset * DAY);
}

function monthGrid(anchor: Date): Date[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = weekStart(first);
  return Array.from({ length: 42 }, (_, index) => new Date(start.getTime() + index * DAY));
}

function sessionsForDay(sessions: MeetCalendarSession[], day: Date) {
  return sessions
    .filter((session) => session.scheduledAt && sameDay(new Date(session.scheduledAt), day))
    .sort(
      (a, b) =>
        new Date(a.scheduledAt || 0).getTime() - new Date(b.scheduledAt || 0).getTime(),
    );
}

export function MeetCalendarView({
  locale,
  sessions,
  anchor,
  scale,
  onAnchorChange,
  onScaleChange,
  onSelectSession,
}: Props) {
  const t = (pt: string, es: string, en: string) => (locale === 'pt' ? pt : locale === 'es' ? es : en);
  const intl = locale === 'pt' ? 'pt-BR' : locale === 'en' ? 'en-US' : 'es-ES';

  function move(direction: -1 | 1) {
    const next = new Date(anchor);
    if (scale === 'day') next.setDate(next.getDate() + direction);
    if (scale === 'week') next.setDate(next.getDate() + direction * 7);
    if (scale === 'month') next.setMonth(next.getMonth() + direction);
    if (scale === 'year') next.setFullYear(next.getFullYear() + direction);
    onAnchorChange(next);
  }

  const title =
    scale === 'day'
      ? new Intl.DateTimeFormat(intl, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }).format(anchor)
      : scale === 'week'
        ? (() => {
            const start = weekStart(anchor);
            const end = new Date(start.getTime() + 6 * DAY);
            return `${new Intl.DateTimeFormat(intl, { day: 'numeric', month: 'short' }).format(start)} – ${new Intl.DateTimeFormat(intl, { day: 'numeric', month: 'short', year: 'numeric' }).format(end)}`;
          })()
        : scale === 'month'
          ? new Intl.DateTimeFormat(intl, { month: 'long', year: 'numeric' }).format(anchor)
          : String(anchor.getFullYear());

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => move(-1)}
            className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => move(1)}
            className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onAnchorChange(new Date())}
            className="ml-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            {t('Hoje', 'Hoy', 'Today')}
          </button>
          <h2 className="ml-2 capitalize text-base font-semibold text-slate-900 sm:text-lg">{title}</h2>
        </div>
        <div className="flex rounded-lg bg-slate-100 p-1">
          {(
            [
              ['day', t('Dia', 'Día', 'Day')],
              ['week', t('Semana', 'Semana', 'Week')],
              ['month', t('Mês', 'Mes', 'Month')],
              ['year', t('Ano', 'Año', 'Year')],
            ] as [MeetCalendarScale, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => onScaleChange(value)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                scale === value ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {scale === 'day' && (
        <DayAgenda
          sessions={sessionsForDay(sessions, anchor)}
          locale={intl}
          empty={t('Nenhuma reunião neste dia', 'Ninguna reunión este día', 'No meetings on this day')}
          onSelectSession={onSelectSession}
        />
      )}
      {scale === 'week' && (
        <WeekGrid
          anchor={anchor}
          sessions={sessions}
          locale={intl}
          onSelectSession={onSelectSession}
        />
      )}
      {scale === 'month' && (
        <MonthGrid
          anchor={anchor}
          sessions={sessions}
          locale={intl}
          onSelectDay={(day) => {
            onAnchorChange(day);
            onScaleChange('day');
          }}
          onSelectSession={onSelectSession}
        />
      )}
      {scale === 'year' && (
        <YearGrid
          anchor={anchor}
          sessions={sessions}
          locale={intl}
          onSelectMonth={(month) => {
            onAnchorChange(new Date(anchor.getFullYear(), month, 1));
            onScaleChange('month');
          }}
        />
      )}
    </section>
  );
}

function DayAgenda({
  sessions,
  locale,
  empty,
  onSelectSession,
}: {
  sessions: MeetCalendarSession[];
  locale: string;
  empty: string;
  onSelectSession: (sessionId: string) => void;
}) {
  const hour = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' });
  if (!sessions.length) {
    return <div className="py-20 text-center text-sm text-slate-500">{empty}</div>;
  }
  return (
    <div className="divide-y divide-slate-100 p-4 sm:p-6">
      {sessions.map((session) => (
        <button
          key={session.id}
          type="button"
          onClick={() => onSelectSession(session.id)}
          className="grid w-full gap-2 py-4 text-left hover:bg-slate-50 sm:grid-cols-[100px_1fr] sm:px-3"
        >
          <span className="text-sm font-medium text-slate-500">
            {session.scheduledAt ? hour.format(new Date(session.scheduledAt)) : ''}
          </span>
          <span>
            <span className="block font-semibold text-slate-900">{session.title}</span>
            <span className="mt-1 inline-flex items-center gap-1 text-xs text-sky-700">
              <Video className="h-3.5 w-3.5" />
              Etholys Meet
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

function WeekGrid({
  anchor,
  sessions,
  locale,
  onSelectSession,
}: {
  anchor: Date;
  sessions: MeetCalendarSession[];
  locale: string;
  onSelectSession: (sessionId: string) => void;
}) {
  const start = weekStart(anchor);
  const days = Array.from({ length: 7 }, (_, index) => new Date(start.getTime() + index * DAY));
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric' });
  const hour = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' });
  return (
    <div className="grid min-w-[760px] grid-cols-7 overflow-x-auto">
      {days.map((day) => (
        <div key={day.toISOString()} className="min-h-[430px] border-r border-slate-100 p-2 last:border-r-0">
          <p
            className={`mb-3 text-center text-xs font-semibold ${
              sameDay(day, new Date()) ? 'text-sky-700' : 'text-slate-500'
            }`}
          >
            {weekday.format(day)}
          </p>
          <div className="space-y-2">
            {sessionsForDay(sessions, day).map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() => onSelectSession(session.id)}
                className="block w-full rounded-lg border-l-4 border-sky-500 bg-sky-50 px-2 py-2 text-left text-xs hover:bg-sky-100"
              >
                <span className="block font-medium text-sky-900">{session.title}</span>
                <span className="text-sky-700">
                  {session.scheduledAt ? hour.format(new Date(session.scheduledAt)) : ''}
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function MonthGrid({
  anchor,
  sessions,
  locale,
  onSelectDay,
  onSelectSession,
}: {
  anchor: Date;
  sessions: MeetCalendarSession[];
  locale: string;
  onSelectDay: (day: Date) => void;
  onSelectSession: (sessionId: string) => void;
}) {
  const days = monthGrid(anchor);
  const weekdays = Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(2026, 7, 3 + index)),
  );
  const hour = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' });
  return (
    <div>
      <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
        {weekdays.map((weekday) => (
          <div key={weekday} className="px-2 py-2 text-center text-xs font-medium text-slate-500">
            {weekday}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const items = sessionsForDay(sessions, day);
          const muted = day.getMonth() !== anchor.getMonth();
          return (
            <div
              key={day.toISOString()}
              className="min-h-24 border-b border-r border-slate-100 p-1.5 sm:min-h-28 sm:p-2"
            >
              <button
                type="button"
                onClick={() => onSelectDay(day)}
                className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                  sameDay(day, new Date())
                    ? 'bg-sky-600 font-semibold text-white'
                    : muted
                      ? 'text-slate-300'
                      : 'text-slate-600'
                }`}
              >
                {day.getDate()}
              </button>
              <div className="space-y-1">
                {items.slice(0, 3).map((session) => (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => onSelectSession(session.id)}
                    className="block w-full truncate rounded bg-sky-50 px-1.5 py-1 text-left text-[10px] font-medium text-sky-800 hover:bg-sky-100 sm:text-xs"
                  >
                    {session.scheduledAt ? `${hour.format(new Date(session.scheduledAt))} ` : ''}
                    {session.title}
                  </button>
                ))}
                {items.length > 3 && (
                  <p className="text-[10px] text-slate-500">+{items.length - 3}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function YearGrid({
  anchor,
  sessions,
  locale,
  onSelectMonth,
}: {
  anchor: Date;
  sessions: MeetCalendarSession[];
  locale: string;
  onSelectMonth: (month: number) => void;
}) {
  return (
    <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 12 }, (_, month) => {
        const monthDate = new Date(anchor.getFullYear(), month, 1);
        const count = sessions.filter((session) => {
          if (!session.scheduledAt) return false;
          const date = new Date(session.scheduledAt);
          return date.getFullYear() === anchor.getFullYear() && date.getMonth() === month;
        }).length;
        return (
          <button
            key={month}
            type="button"
            onClick={() => onSelectMonth(month)}
            className="rounded-xl border border-slate-200 p-4 text-left hover:border-sky-300 hover:bg-sky-50"
          >
            <span className="block capitalize font-semibold text-slate-900">
              {new Intl.DateTimeFormat(locale, { month: 'long' }).format(monthDate)}
            </span>
            <span className="mt-1 block text-xs text-slate-500">
              {count} {count === 1 ? 'reunião' : 'reuniões'}
            </span>
          </button>
        );
      })}
    </div>
  );
}
