'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addDaysYmd, addMonthsYmd, startOfWeekMonday, weekdayOfYmd, ymdInTimeZone } from '@/lib/meet/booking-slots';

export type AgendaView = 'day' | 'week' | 'month' | 'year';

export type AgendaCalEvent = {
  id: string;
  kind: 'request' | 'block';
  source?: string;
  status?: string;
  title: string;
  startsAt: string;
  endsAt: string;
};

type Point = { ymd: string; min: number };

const WEEKDAY_HEAD: Record<string, string[]> = {
  pt: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'],
  es: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
  en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
};

function tr(locale: string, pt: string, es: string, en: string) {
  return locale === 'pt' ? pt : locale === 'es' ? es : en;
}

function intlTag(locale: string) {
  return locale === 'pt' ? 'pt-BR' : locale === 'en' ? 'en-US' : 'es-ES';
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function wall(ymd: string, min: number): string {
  let day = ymd;
  let minutes = min;
  while (minutes >= 24 * 60) {
    day = addDaysYmd(day, 1);
    minutes -= 24 * 60;
  }
  return `${day}T${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

function zonedParts(iso: string, timeZone: string): Point {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timeZone || 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || '00';
  const hour = Number(get('hour'));
  return {
    ymd: `${get('year')}-${get('month')}-${get('day')}`,
    min: (hour === 24 ? 0 : hour) * 60 + Number(get('minute')),
  };
}

function spanOnDay(startsAt: string, endsAt: string, ymd: string, timeZone: string): { start: number; end: number } | null {
  const start = zonedParts(startsAt, timeZone);
  const end = zonedParts(endsAt, timeZone);
  if (end.ymd < ymd || start.ymd > ymd) return null;
  if (end.ymd === ymd && end.min === 0 && start.ymd < ymd) return null;
  const startMin = start.ymd < ymd ? 0 : start.min;
  const endMin = end.ymd > ymd ? 24 * 60 : end.min;
  if (endMin <= startMin) return null;
  return { start: startMin, end: endMin };
}

function earlier(a: Point, b: Point): Point {
  return `${a.ymd}T${pad(a.min)}` <= `${b.ymd}T${pad(b.min)}` ? a : b;
}

function exclusiveEnd(point: Point, grain: number): Point {
  let min = point.min + grain;
  let ymd = point.ymd;
  while (min >= 24 * 60) {
    ymd = addDaysYmd(ymd, 1);
    min -= 24 * 60;
  }
  return { ymd, min };
}

function monthCells(ymd: string): string[] {
  const first = `${ymd.slice(0, 7)}-01`;
  const start = startOfWeekMonday(first);
  return Array.from({ length: 42 }, (_, index) => addDaysYmd(start, index));
}

function eventTone(event: AgendaCalEvent): string {
  if (event.kind === 'block' && event.source === 'holiday') {
    return 'border-amber-700 bg-amber-100 text-amber-950';
  }
  if (event.kind === 'block' && event.source === 'chorus') {
    return 'border-teal-800 bg-teal-50 text-teal-950';
  }
  if (event.kind === 'block' && event.source === 'google') {
    return 'border-blue-800 bg-blue-100 text-blue-950';
  }
  if (event.kind === 'block') return 'border-slate-500 bg-slate-200 text-slate-900';
  if (event.status === 'accepted') return 'border-teal-900 bg-teal-800 text-white';
  if (event.status === 'counter_proposed') return 'border-sky-800 bg-sky-100 text-sky-950';
  return 'border-amber-800 bg-amber-50 text-amber-950';
}

export default function ChorusAgendaCalendar({
  timeZone,
  locale,
  events,
  cursorYmd,
  view,
  stepMin,
  closeMode,
  onCursorYmd,
  onView,
  onCommitRange,
  onOpenRequest,
  onReopenBlock,
  hideViewSwitch,
}: {
  timeZone: string;
  locale: string;
  events: AgendaCalEvent[];
  cursorYmd: string;
  view: AgendaView;
  stepMin: number;
  closeMode: boolean;
  onCursorYmd: (ymd: string) => void;
  onView: (view: AgendaView) => void;
  onCommitRange: (startWall: string, endWall: string) => void;
  onOpenRequest: (id: string) => void;
  onReopenBlock: (id: string) => void;
  hideViewSwitch?: boolean;
}) {
  const t = (pt: string, es: string, en: string) => tr(locale, pt, es, en);
  const intl = intlTag(locale);
  const step = Math.min(60, Math.max(15, stepMin || 30));
  const [anchor, setAnchor] = useState<Point | null>(null);
  const [grain, setGrain] = useState(step);
  const [dragBox, setDragBox] = useState<{ start: Point; end: Point } | null>(null);
  const dragRef = useRef<{ start: Point; end: Point } | null>(null);
  const commitRef = useRef(onCommitRange);
  const stopDragRef = useRef<(() => void) | null>(null);
  commitRef.current = onCommitRange;

  useEffect(() => () => stopDragRef.current?.(), []);

  useEffect(() => {
    if (!closeMode) setAnchor(null);
  }, [closeMode]);

  const heads = WEEKDAY_HEAD[locale] || WEEKDAY_HEAD.en;

  function labelDay(ymd: string, options: Intl.DateTimeFormatOptions) {
    const [y, m, d] = ymd.split('-').map(Number);
    return new Date(Date.UTC(y, (m || 1) - 1, d || 1)).toLocaleDateString(intl, { ...options, timeZone: 'UTC' });
  }

  function shift(direction: number) {
    if (view === 'day') onCursorYmd(addDaysYmd(cursorYmd, direction));
    else if (view === 'week') onCursorYmd(addDaysYmd(cursorYmd, direction * 7));
    else if (view === 'year') onCursorYmd(addMonthsYmd(cursorYmd, direction * 12));
    else onCursorYmd(addMonthsYmd(cursorYmd, direction));
  }

  const title =
    view === 'year'
      ? cursorYmd.slice(0, 4)
      : view === 'month'
        ? labelDay(`${cursorYmd.slice(0, 7)}-01`, { month: 'long', year: 'numeric' })
        : view === 'week'
          ? `${labelDay(startOfWeekMonday(cursorYmd), { day: 'numeric', month: 'short' })} – ${labelDay(addDaysYmd(startOfWeekMonday(cursorYmd), 6), { day: 'numeric', month: 'short', year: 'numeric' })}`
          : labelDay(cursorYmd, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  function pick(point: Point, nextGrain: number) {
    if (!closeMode) {
      onCursorYmd(point.ymd);
      if (view === 'month' || view === 'year') onView('day');
      return;
    }
    if (!anchor) {
      setAnchor(point);
      setGrain(nextGrain);
      return;
    }
    const start = earlier(anchor, point);
    const endPoint = earlier(anchor, point) === anchor ? point : anchor;
    const end = exclusiveEnd(endPoint, grain);
    onCommitRange(wall(start.ymd, start.min), wall(end.ymd, end.min));
    setAnchor(null);
  }

  function readSlot(target: EventTarget | null): Point | null {
    const el = (target as HTMLElement | null)?.closest?.('[data-slot]') as HTMLElement | null;
    if (!el) return null;
    const ymd = el.dataset.ymd;
    const min = Number(el.dataset.min);
    if (!ymd || !Number.isFinite(min)) return null;
    return { ymd, min };
  }

  function rangeWalls(start: Point, end: Point, nextGrain: number) {
    const first = start.ymd < end.ymd || (start.ymd === end.ymd && start.min <= end.min) ? start : end;
    const last = first === start ? end : start;
    const exclusive = exclusiveEnd(last, nextGrain);
    return [wall(first.ymd, first.min), wall(exclusive.ymd, exclusive.min)] as const;
  }

  function onGridPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const slot = readSlot(event.target);
    if (!slot) return;
    stopDragRef.current?.();
    dragRef.current = { start: slot, end: slot };
    setDragBox({ start: slot, end: slot });

    function move(ev: PointerEvent) {
      if (!dragRef.current) return;
      const next = readSlot(document.elementFromPoint(ev.clientX, ev.clientY));
      if (!next) return;
      if (next.ymd === dragRef.current.end.ymd && next.min === dragRef.current.end.min) return;
      dragRef.current.end = next;
      setDragBox({ start: dragRef.current.start, end: next });
    }
    function up(ev: PointerEvent) {
      const drag = dragRef.current;
      const slotEnd = readSlot(document.elementFromPoint(ev.clientX, ev.clientY));
      cancel();
      if (!drag) return;
      const unchanged = drag.start.ymd === drag.end.ymd && drag.start.min === drag.end.min;
      if (!slotEnd && unchanged) return;
      const [startWall, endWall] = rangeWalls(drag.start, slotEnd || drag.end, step);
      commitRef.current(startWall, endWall);
    }
    function cancel() {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      stopDragRef.current = null;
      dragRef.current = null;
      setDragBox(null);
    }
    stopDragRef.current = cancel;
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
  }

  function cellInDrag(ymd: string, min: number) {
    if (!dragBox) return false;
    const key = wall(ymd, min);
    const startKey = wall(dragBox.start.ymd, dragBox.start.min);
    const endKey = wall(dragBox.end.ymd, dragBox.end.min);
    const lo = startKey < endKey ? startKey : endKey;
    const hi = startKey < endKey ? endKey : startKey;
    return key >= lo && key <= hi;
  }

  function dayMarks(ymd: string) {
    return events.filter((event) => spanOnDay(event.startsAt, event.endsAt, ymd, timeZone));
  }

  const weekDays = useMemo(() => {
    const start = view === 'day' ? cursorYmd : startOfWeekMonday(cursorYmd);
    const count = view === 'day' ? 1 : 7;
    return Array.from({ length: count }, (_, index) => addDaysYmd(start, index));
  }, [cursorYmd, view]);

  const rowPx = 36;

  return (
    <section className="rounded-2xl border border-[color:var(--sys-line)] bg-[color:var(--sys-panel)] text-[color:var(--sys-ink)]">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-3">
        <button type="button" onClick={() => shift(-1)} className="rounded-full border border-slate-300 bg-white p-2 text-slate-800" aria-label={t('Anterior', 'Anterior', 'Previous')}>
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => shift(1)} className="rounded-full border border-slate-300 bg-white p-2 text-slate-800" aria-label={t('Seguinte', 'Siguiente', 'Next')}>
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onCursorYmd(ymdInTimeZone(new Date(), timeZone))}
          className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800"
        >
          {t('Hoje', 'Hoy', 'Today')}
        </button>
        <h2 className="min-w-[12rem] flex-1 text-base font-semibold capitalize text-slate-900">{title}</h2>
        {hideViewSwitch ? null : (
          <div className="flex flex-wrap gap-1">
            {(
              [
                ['day', t('Dia', 'Día', 'Day')],
                ['week', t('Semana', 'Semana', 'Week')],
                ['month', t('Mês', 'Mes', 'Month')],
                ['year', t('Ano', 'Año', 'Year')],
              ] as [AgendaView, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => onView(id)}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
                  view === id ? 'bg-teal-800 text-white' : 'bg-white text-slate-800 ring-1 ring-slate-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {closeMode ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-950">
          <span>
            {view === 'day' || view === 'week'
              ? t(
                  'Clique ou arraste um horário. Confirme no painel para o fechar.',
                  'Haz clic o arrastra un horario. Confirma en el panel para cerrarlo.',
                  'Click or drag a time. Confirm in the panel to close it.',
                )
              : anchor
              ? t(
                  'Início marcado. Clique o fim no calendário, ou feche só este trecho.',
                  'Inicio marcado. Haz clic en el fin en el calendario, o cierra solo este tramo.',
                  'Start is set. Click the end on the calendar, or close just this range.',
                )
              : t(
                  'Clique o início e depois o fim. No mês e no ano, cada clique é o dia inteiro.',
                  'Haz clic en el inicio y luego en el fin. En mes y año, cada clic es el día completo.',
                  'Click the start, then the end. In month and year, each click is the whole day.',
                )}
          </span>
          {anchor ? (
            <button
              type="button"
              onClick={() => pick(anchor, grain)}
              className="rounded-full bg-teal-800 px-3 py-1.5 text-sm font-semibold text-white"
            >
              {t('Fechar este trecho', 'Cerrar este tramo', 'Close this range')}
            </button>
          ) : null}
        </div>
      ) : null}

      {view === 'day' || view === 'week' ? (
        <div className="max-h-[70vh] overflow-auto" onPointerDown={onGridPointerDown}>
          <div className={`sticky top-0 z-10 grid border-b border-slate-200 bg-white ${view === 'day' ? 'grid-cols-[3.5rem_1fr]' : 'grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]'}`}>
            <div />
            {weekDays.map((ymd) => (
              <button
                key={ymd}
                type="button"
                onClick={() => {
                  onCursorYmd(ymd);
                  if (!closeMode) onView('day');
                }}
                className={`px-1 py-2 text-center text-xs font-semibold ${ymd === cursorYmd ? 'text-teal-900' : 'text-slate-700'}`}
              >
                <span className="block">{heads[(weekdayOfYmd(ymd) + 6) % 7]}</span>
                <span className={`mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full ${ymd === ymdInTimeZone(new Date(), timeZone) ? 'bg-teal-800 text-white' : ''}`}>
                  {Number(ymd.slice(8, 10))}
                </span>
              </button>
            ))}
          </div>
          <div className={`grid ${view === 'day' ? 'grid-cols-[3.5rem_1fr]' : 'grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]'}`}>
            <div className="relative text-[10px] text-slate-600" style={{ height: (24 * 60 / step) * rowPx }}>
              {Array.from({ length: 24 }, (_, hour) => (
                <div key={hour} className="absolute right-1" style={{ top: (hour * 60 / step) * rowPx }}>
                  {pad(hour)}:00
                </div>
              ))}
            </div>
            {weekDays.map((ymd) => (
              <div key={ymd} className="relative border-l border-slate-200" style={{ height: (24 * 60 / step) * rowPx }}>
                {Array.from({ length: (24 * 60) / step }, (_, index) => {
                  const min = index * step;
                  const cellKey = wall(ymd, min);
                  const startKey = anchor ? wall(anchor.ymd, anchor.min) : '';
                  const endPoint = anchor ? exclusiveEnd(anchor, grain) : null;
                  const endKey = endPoint ? wall(endPoint.ymd, endPoint.min) : '';
                  const selected = Boolean(anchor && cellKey >= startKey && cellKey < endKey) || cellInDrag(ymd, min);
                  return (
                    <button
                      key={min}
                      type="button"
                      data-slot=""
                      data-ymd={ymd}
                      data-min={min}
                      className={`absolute inset-x-0 cursor-pointer border-t border-slate-100 hover:bg-teal-100 ${selected ? 'bg-teal-100' : ''}`}
                      style={{ top: index * rowPx, height: rowPx }}
                      aria-label={`${ymd} ${pad(Math.floor(min / 60))}:${pad(min % 60)}`}
                    />
                  );
                })}
                {events.map((event) => {
                  const span = spanOnDay(event.startsAt, event.endsAt, ymd, timeZone);
                  if (!span) return null;
                  const top = (span.start / step) * rowPx;
                  const height = Math.max(rowPx / 2, ((span.end - span.start) / step) * rowPx);
                  return (
                    <div
                      key={event.id}
                      className={`absolute inset-x-1 z-20 overflow-hidden rounded-md border px-1 py-0.5 text-left text-[11px] font-medium leading-tight ${eventTone(event)} ${closeMode ? 'pointer-events-none' : ''}`}
                      style={{ top, height }}
                    >
                      <button
                        type="button"
                        className="block w-full truncate text-left"
                        onClick={() => {
                          if (event.kind === 'request') onOpenRequest(event.id);
                        }}
                      >
                        {event.title}
                      </button>
                      {event.kind === 'block' && (event.source === 'manual' || !event.source) ? (
                        <button type="button" className="underline" onClick={() => onReopenBlock(event.id)}>
                          {t('Reabrir', 'Reabrir', 'Reopen')}
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {view === 'month' ? (
        <div className="p-2">
          <div className="grid grid-cols-7 text-center text-xs font-semibold text-slate-600">
            {heads.map((head) => (
              <div key={head} className="py-1">{head}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {monthCells(cursorYmd).map((ymd) => {
              const marks = dayMarks(ymd);
              const inMonth = ymd.slice(0, 7) === cursorYmd.slice(0, 7);
              const picked = anchor?.ymd === ymd;
              return (
                <button
                  key={ymd}
                  type="button"
                  onClick={() => pick({ ymd, min: 0 }, 24 * 60)}
                  className={`min-h-[4.5rem] rounded-lg border p-1 text-left ${
                    picked ? 'border-teal-800 bg-teal-100' : 'border-slate-200 bg-white'
                  } ${inMonth ? 'text-slate-900' : 'text-slate-400'}`}
                >
                  <span className={`text-xs font-semibold ${ymd === ymdInTimeZone(new Date(), timeZone) ? 'text-teal-800' : ''}`}>
                    {Number(ymd.slice(8, 10))}
                  </span>
                  <span className="mt-1 block space-y-0.5">
                    {marks.slice(0, 3).map((event) => (
                      <span key={event.id} className={`block truncate rounded px-1 text-[10px] font-medium ${eventTone(event)}`}>
                        {event.title}
                      </span>
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {view === 'year' ? (
        <div className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 12 }, (_, month) => {
            const ymd = `${cursorYmd.slice(0, 4)}-${pad(month + 1)}-01`;
            return (
              <div key={ymd} className="rounded-xl border border-slate-200 p-2">
                <p className="mb-1 text-sm font-semibold capitalize text-slate-900">
                  {labelDay(ymd, { month: 'long' })}
                </p>
                <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] text-slate-500">
                  {heads.map((head) => (
                    <span key={head}>{head.slice(0, 1)}</span>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-0.5">
                  {monthCells(ymd).map((day) => {
                    const inMonth = day.slice(0, 7) === ymd.slice(0, 7);
                    const marks = inMonth ? dayMarks(day) : [];
                    const holiday = marks.some((event) => event.source === 'holiday');
                    const booking = marks.some((event) => event.kind === 'request');
                    const google = marks.some((event) => event.source === 'google');
                    const chorus = marks.some((event) => event.source === 'chorus');
                    const closed = marks.some((event) => event.kind === 'block' && event.source !== 'holiday' && event.source !== 'google' && event.source !== 'chorus');
                    return (
                      <button
                        key={day}
                        type="button"
                        disabled={!inMonth}
                        onClick={() => pick({ ymd: day, min: 0 }, 24 * 60)}
                        className={`h-6 rounded text-[10px] font-medium ${
                          !inMonth
                            ? 'text-transparent'
                            : anchor?.ymd === day
                              ? 'bg-teal-800 text-white'
                              : holiday
                                ? 'bg-amber-200 text-amber-950'
                                : booking
                                  ? 'bg-teal-100 text-teal-950'
                                  : google
                                    ? 'bg-blue-200 text-blue-950'
                                    : chorus
                                      ? 'bg-teal-50 text-teal-950 ring-1 ring-teal-700'
                                      : closed
                                        ? 'bg-slate-300 text-slate-900'
                                        : 'text-slate-800 hover:bg-slate-100'
                        }`}
                      >
                        {inMonth ? Number(day.slice(8, 10)) : ''}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3 border-t border-slate-200 px-3 py-2 text-xs text-slate-700">
        <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-teal-800" /> {t('Aceite', 'Aceptada', 'Accepted')}</span>
        <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-amber-200 ring-1 ring-amber-700" /> {t('Pendente', 'Pendiente', 'Pending')}</span>
        <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-slate-300" /> {t('Fechado', 'Cerrado', 'Closed')}</span>
        <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-teal-50 ring-1 ring-teal-800" /> CHORUS</span>
        <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-blue-200 ring-1 ring-blue-800" /> Google</span>
        <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-amber-200" /> {t('Feriado', 'Festivo', 'Holiday')}</span>
      </div>
    </section>
  );
}
