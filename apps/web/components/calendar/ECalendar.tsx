'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { useApp } from '@/app/providers';
import { calendarEventVisible } from '@/lib/calendar/visibility';
import type { CalendarFeedEvent, CalendarLayer } from '@/lib/calendar/types';
import { cn } from '@/lib/utils';

type View = 'day' | 'week' | 'month';

const HIDDEN_KEY = 'etholys.ecalendar.hidden';

function startOfDay(d: Date) {
  const n = new Date(d);
  n.setHours(0, 0, 0, 0);
  return n;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function startOfWeek(d: Date) {
  const n = startOfDay(d);
  const pad = (n.getDay() + 6) % 7;
  return addDays(n, -pad);
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function rangeFor(view: View, cursor: Date) {
  if (view === 'day') {
    const from = startOfDay(cursor);
    return { from, to: addDays(from, 1) };
  }
  if (view === 'week') {
    const from = startOfWeek(cursor);
    return { from, to: addDays(from, 7) };
  }
  const first = startOfMonth(cursor);
  const pad = (first.getDay() + 6) % 7;
  const from = addDays(first, -pad);
  return { from, to: addDays(from, 42) };
}

function readHidden(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function ECalendar() {
  const { locale, activeCompanyId } = useApp();
  const t = (pt: string, es: string, en: string) => (locale === 'pt' ? pt : locale === 'es' ? es : en);

  const [view, setView] = useState<View>('month');
  const [cursor, setCursor] = useState(() => new Date());
  const [events, setEvents] = useState<CalendarFeedEvent[]>([]);
  const [layers, setLayers] = useState<CalendarLayer[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [composer, setComposer] = useState<{ day: Date } | null>(null);
  const [title, setTitle] = useState('');
  const [allDay, setAllDay] = useState(true);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<CalendarFeedEvent | null>(null);

  useEffect(() => {
    setHidden(readHidden());
  }, []);

  const range = useMemo(() => rangeFor(view, cursor), [view, cursor]);
  const enabled = useMemo(() => {
    const off = new Set(hidden);
    return new Set(layers.map((l) => l.id).filter((id) => !off.has(id)));
  }, [hidden, layers]);

  const visible = useMemo(
    () => events.filter((ev) => calendarEventVisible(ev, enabled)),
    [events, enabled],
  );

  const load = useCallback(async () => {
    if (!activeCompanyId) return;
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({
        companyId: activeCompanyId,
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      });
      const res = await fetch(`/api/calendar/events?${q}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      setEvents(data.events || []);
      setLayers(data.layers || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [activeCompanyId, range.from, range.to]);

  useEffect(() => {
    void load();
  }, [load]);

  function toggleLayer(id: string) {
    setHidden((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      localStorage.setItem(HIDDEN_KEY, JSON.stringify(next));
      return next;
    });
  }

  function shift(dir: number) {
    setCursor((c) => {
      if (view === 'month') return new Date(c.getFullYear(), c.getMonth() + dir, 1);
      if (view === 'week') return addDays(c, dir * 7);
      return addDays(c, dir);
    });
  }

  const titleLabel =
    view === 'day'
      ? cursor.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      : view === 'week'
        ? `${range.from.toLocaleDateString(locale, { day: 'numeric', month: 'short' })} – ${addDays(range.to, -1).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}`
        : cursor.toLocaleDateString(locale, { month: 'long', year: 'numeric' });

  async function createEvent() {
    if (!activeCompanyId || !composer || !title.trim()) return;
    setSaving(true);
    try {
      const day = startOfDay(composer.day);
      let startsAt = day;
      let endsAt: Date | null = null;
      if (!allDay) {
        const [sh, sm] = startTime.split(':').map(Number);
        const [eh, em] = endTime.split(':').map(Number);
        startsAt = new Date(day);
        startsAt.setHours(sh || 0, sm || 0, 0, 0);
        endsAt = new Date(day);
        endsAt.setHours(eh || 0, em || 0, 0, 0);
      }
      const res = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: activeCompanyId,
          title: title.trim(),
          startsAt: startsAt.toISOString(),
          endsAt: endsAt ? endsAt.toISOString() : null,
          allDay,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      setComposer(null);
      setTitle('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  async function removeSelected() {
    if (!selected?.editable) return;
    const id = selected.id.replace(/^personal:/, '');
    const res = await fetch(`/api/calendar/events/${id}`, { method: 'DELETE' });
    if (!res.ok) return;
    setSelected(null);
    await load();
  }

  const mine = layers.filter((l) => l.group === 'mine');
  const systems = layers.filter((l) => l.group === 'systems');
  const projects = layers.filter((l) => l.group === 'projects');

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white text-slate-800 md:flex-row">
      <aside className="flex w-full shrink-0 flex-col border-b border-slate-200 md:w-64 md:border-b-0 md:border-r">
        <div className="p-3">
          <button
            type="button"
            onClick={() => {
              setComposer({ day: startOfDay(new Date()) });
              setAllDay(true);
            }}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium shadow-sm hover:bg-slate-50"
          >
            <Plus className="h-4 w-4 text-[#1a73e8]" />
            {t('Criar', 'Crear', 'Create')}
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 pb-6">
          <LayerGroup title={t('Os meus calendários', 'Mis calendarios', 'My calendars')} layers={mine} hidden={hidden} onToggle={toggleLayer} />
          <LayerGroup title={t('Sistemas', 'Sistemas', 'Systems')} layers={systems} hidden={hidden} onToggle={toggleLayer} />
          <LayerGroup title={t('Projetos', 'Proyectos', 'Projects')} layers={projects} hidden={hidden} onToggle={toggleLayer} />
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2">
          <button type="button" onClick={() => setCursor(new Date())} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50">
            {t('Hoje', 'Hoy', 'Today')}
          </button>
          <button type="button" aria-label="Prev" onClick={() => shift(-1)} className="rounded-full p-1.5 hover:bg-slate-100">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button type="button" aria-label="Next" onClick={() => shift(1)} className="rounded-full p-1.5 hover:bg-slate-100">
            <ChevronRight className="h-5 w-5" />
          </button>
          <h2 className="min-w-0 flex-1 truncate text-lg font-normal capitalize text-slate-900">{titleLabel}</h2>
          {loading && <span className="text-xs text-slate-400">{t('A atualizar', 'Actualizando', 'Updating')}</span>}
          <div className="flex rounded-lg border border-slate-300 p-0.5 text-sm">
            {(['day', 'week', 'month'] as View[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={cn('rounded-md px-3 py-1 capitalize', view === v ? 'bg-blue-50 font-medium text-[#1a73e8]' : 'text-slate-600 hover:bg-slate-50')}
              >
                {v === 'day' ? t('Dia', 'Día', 'Day') : v === 'week' ? t('Semana', 'Semana', 'Week') : t('Mês', 'Mes', 'Month')}
              </button>
            ))}
          </div>
        </div>
        {error && <p className="border-b border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}
        <div className="min-h-0 flex-1 overflow-auto">
          {view === 'month' ? (
            <MonthGrid
              cursor={cursor}
              events={visible}
              onDay={(day) => setComposer({ day })}
              onEvent={setSelected}
            />
          ) : (
            <TimeGrid
              days={view === 'day' ? [startOfDay(cursor)] : Array.from({ length: 7 }, (_, i) => addDays(range.from, i))}
              events={visible}
              onEvent={setSelected}
            />
          )}
        </div>
      </section>

      {composer && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-medium">{t('Novo evento', 'Nuevo evento', 'New event')}</h3>
              <button type="button" onClick={() => setComposer(null)} className="rounded-full p-1 hover:bg-slate-100" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-2 text-xs text-slate-500">
              {composer.day.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('Adicionar título', 'Añadir título', 'Add title')}
              className="mb-3 w-full border-b border-slate-200 py-2 text-lg outline-none focus:border-[#1a73e8]"
            />
            <label className="mb-3 flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
              {t('Dia inteiro', 'Todo el día', 'All day')}
            </label>
            {!allDay && (
              <div className="mb-3 flex gap-2">
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="rounded-md border border-slate-200 px-2 py-1 text-sm" />
                <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="rounded-md border border-slate-200 px-2 py-1 text-sm" />
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setComposer(null)} className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
                {t('Cancelar', 'Cancelar', 'Cancel')}
              </button>
              <button
                type="button"
                disabled={saving || !title.trim()}
                onClick={() => void createEvent()}
                className="rounded-md bg-[#1a73e8] px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {t('Guardar', 'Guardar', 'Save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center" onClick={() => setSelected(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-1 h-1.5 w-10 rounded-full" style={{ background: selected.color }} />
            <h3 className="text-base font-medium">{selected.title}</h3>
            <p className="mt-1 text-sm text-slate-500">
              {new Date(selected.startsAt).toLocaleString(locale, selected.allDay ? { dateStyle: 'full' } : { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              {selected.href && (
                <Link href={selected.href} className="rounded-md px-3 py-1.5 text-sm font-medium text-[#1a73e8] hover:bg-blue-50">
                  {t('Abrir origem', 'Abrir origen', 'Open source')}
                </Link>
              )}
              {selected.editable && (
                <button type="button" onClick={() => void removeSelected()} className="rounded-md px-3 py-1.5 text-sm text-red-600 hover:bg-red-50">
                  {t('Apagar', 'Eliminar', 'Delete')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LayerGroup({
  title,
  layers,
  hidden,
  onToggle,
}: {
  title: string;
  layers: CalendarLayer[];
  hidden: string[];
  onToggle: (id: string) => void;
}) {
  if (layers.length === 0) return null;
  return (
    <div>
      <p className="mb-1 px-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">{title}</p>
      <ul className="space-y-0.5">
        {layers.map((layer) => {
          const on = !hidden.includes(layer.id);
          return (
            <li key={layer.id}>
              <label className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-sm hover:bg-slate-50">
                <input type="checkbox" checked={on} onChange={() => onToggle(layer.id)} className="sr-only" />
                <span
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border-2"
                  style={{ borderColor: layer.color, background: on ? layer.color : 'transparent' }}
                >
                  {on && <span className="h-1.5 w-1.5 rounded-sm bg-white" />}
                </span>
                <span className="truncate">{layer.label}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function MonthGrid({
  cursor,
  events,
  onDay,
  onEvent,
}: {
  cursor: Date;
  events: CalendarFeedEvent[];
  onDay: (day: Date) => void;
  onEvent: (ev: CalendarFeedEvent) => void;
}) {
  const first = startOfMonth(cursor);
  const pad = (first.getDay() + 6) % 7;
  const cells = Array.from({ length: 42 }, (_, i) => addDays(first, i - pad));
  const today = startOfDay(new Date());
  const byDay = new Map<string, CalendarFeedEvent[]>();
  for (const ev of events) {
    const key = dayKey(new Date(ev.startsAt));
    const list = byDay.get(key) || [];
    list.push(ev);
    byDay.set(key, list);
  }
  const weekdays = [1, 2, 3, 4, 5, 6, 0].map((dow) => new Date(2024, 0, 1 + dow).toLocaleDateString(undefined, { weekday: 'short' }));

  return (
    <div className="flex h-full min-h-[640px] flex-col">
      <div className="grid grid-cols-7 border-b border-slate-200">
        {weekdays.map((label) => (
          <div key={label} className="px-2 py-2 text-center text-[11px] font-medium uppercase text-slate-500">
            {label}
          </div>
        ))}
      </div>
      <div className="grid flex-1 grid-cols-7 grid-rows-6">
        {cells.map((day) => {
          const inMonth = day.getMonth() === cursor.getMonth();
          const items = byDay.get(dayKey(day)) || [];
          return (
            <div
              key={dayKey(day)}
              className={cn('min-h-[96px] border-b border-r border-slate-100 p-1', !inMonth && 'bg-slate-50/80')}
              onClick={() => onDay(day)}
            >
              <div className="mb-1 flex justify-center">
                <span
                  className={cn(
                    'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs',
                    sameDay(day, today) && 'bg-[#1a73e8] font-medium text-white',
                    !sameDay(day, today) && (inMonth ? 'text-slate-800' : 'text-slate-400'),
                  )}
                >
                  {day.getDate()}
                </span>
              </div>
              <div className="space-y-0.5">
                {items.slice(0, 3).map((ev) => (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEvent(ev);
                    }}
                    className="block w-full truncate rounded px-1 py-0.5 text-left text-[11px] font-medium text-white"
                    style={{ background: ev.color }}
                  >
                    {ev.title}
                  </button>
                ))}
                {items.length > 3 && <p className="px-1 text-[10px] text-slate-500">+{items.length - 3}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TimeGrid({
  days,
  events,
  onEvent,
}: {
  days: Date[];
  events: CalendarFeedEvent[];
  onEvent: (ev: CalendarFeedEvent) => void;
}) {
  const hours = Array.from({ length: 15 }, (_, i) => i + 7);
  const today = startOfDay(new Date());
  return (
    <div className="min-w-[720px]">
      <div className="grid border-b border-slate-200" style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0,1fr))` }}>
        <div />
        {days.map((day) => (
          <div key={dayKey(day)} className="px-2 py-2 text-center">
            <div className="text-[11px] uppercase text-slate-500">{day.toLocaleDateString(undefined, { weekday: 'short' })}</div>
            <div className={cn('mx-auto mt-0.5 flex h-8 w-8 items-center justify-center rounded-full text-sm', sameDay(day, today) && 'bg-[#1a73e8] text-white')}>
              {day.getDate()}
            </div>
          </div>
        ))}
      </div>
      <div className="relative grid" style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0,1fr))` }}>
        <div>
          {hours.map((h) => (
            <div key={h} className="h-12 pr-2 text-right text-[10px] text-slate-400">
              {String(h).padStart(2, '0')}:00
            </div>
          ))}
        </div>
        {days.map((day) => {
          const timed = events.filter((ev) => !ev.allDay && sameDay(new Date(ev.startsAt), day));
          const allday = events.filter((ev) => ev.allDay && sameDay(new Date(ev.startsAt), day));
          return (
            <div key={dayKey(day)} className="relative border-l border-slate-100">
              {allday.slice(0, 2).map((ev) => (
                <button key={ev.id} type="button" onClick={() => onEvent(ev)} className="mb-0.5 block w-full truncate px-1 text-left text-[10px] font-medium text-white" style={{ background: ev.color }}>
                  {ev.title}
                </button>
              ))}
              {hours.map((h) => (
                <div key={h} className="h-12 border-b border-slate-100" />
              ))}
              {timed.map((ev) => {
                const start = new Date(ev.startsAt);
                const minutes = start.getHours() * 60 + start.getMinutes() - 7 * 60;
                const top = Math.max(0, (minutes / (15 * 60)) * 100);
                return (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => onEvent(ev)}
                    className="absolute left-1 right-1 truncate rounded px-1 text-left text-[11px] font-medium text-white"
                    style={{ top: `${top}%`, background: ev.color, minHeight: 22 }}
                  >
                    {ev.title}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
