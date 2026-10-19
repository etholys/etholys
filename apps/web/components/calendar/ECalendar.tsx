'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Plus, Search, X } from 'lucide-react';
import { useApp } from '@/app/providers';
import { calendarEventVisible } from '@/lib/calendar/visibility';
import type { CalendarFeedEvent, CalendarLayer } from '@/lib/calendar/types';
import {
  addDays,
  chipForeground,
  dayKey,
  eventMatchesQuery,
  rangeFor,
  sameDay,
  startOfDay,
  startOfMonth,
  type CalendarView,
} from '@/lib/calendar/view';
import { cn } from '@/lib/utils';

const HIDDEN_KEY = 'etholys.ecalendar.hidden';

function readHidden(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function timeValue(d: Date) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function ECalendar() {
  const { locale, activeCompanyId } = useApp();
  const t = (pt: string, es: string, en: string) => (locale === 'pt' ? pt : locale === 'es' ? es : en);

  const [view, setView] = useState<CalendarView>('month');
  const [cursor, setCursor] = useState(() => new Date());
  const [focusDay, setFocusDay] = useState(() => startOfDay(new Date()));
  const [events, setEvents] = useState<CalendarFeedEvent[]>([]);
  const [layers, setLayers] = useState<CalendarLayer[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [layerQuery, setLayerQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [composer, setComposer] = useState<{ day: Date } | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
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
    () => events.filter((ev) => calendarEventVisible(ev, enabled) && eventMatchesQuery(ev, query)),
    [events, enabled, query],
  );

  const dayEvents = useMemo(
    () =>
      visible
        .filter((ev) => sameDay(new Date(ev.startsAt), focusDay))
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    [visible, focusDay],
  );

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const ev of events) {
      if (!eventMatchesQuery(ev, query)) continue;
      map.set(ev.calendarId, (map.get(ev.calendarId) || 0) + 1);
      if (ev.projectId && ev.calendarId !== `project:${ev.projectId}`) {
        map.set(`project:${ev.projectId}`, (map.get(`project:${ev.projectId}`) || 0) + 1);
      }
    }
    return map;
  }, [events, query]);

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

  function openCreate(day: Date) {
    setFocusDay(startOfDay(day));
    setSelected(null);
    setTitle('');
    setDescription('');
    setAllDay(true);
    setStartTime('09:00');
    setEndTime('10:00');
    setComposer({ day: startOfDay(day) });
  }

  function shift(dir: number) {
    setCursor((c) => {
      if (view === 'month') return new Date(c.getFullYear(), c.getMonth() + dir, 1);
      if (view === 'week') return addDays(c, dir * 7);
      return addDays(c, dir);
    });
  }

  function stamp(day: Date, clock: string) {
    const [h, m] = clock.split(':').map(Number);
    const d = startOfDay(day);
    d.setHours(h || 0, m || 0, 0, 0);
    return d;
  }

  async function createEvent() {
    if (!activeCompanyId || !composer || !title.trim()) return;
    setSaving(true);
    try {
      const day = startOfDay(composer.day);
      const startsAt = allDay ? day : stamp(day, startTime);
      const endsAt = allDay ? null : stamp(day, endTime);
      const res = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: activeCompanyId,
          title: title.trim(),
          description,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt ? endsAt.toISOString() : null,
          allDay,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      setComposer(null);
      setTitle('');
      setDescription('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  async function saveSelected() {
    if (!selected?.editable || !title.trim()) return;
    setSaving(true);
    try {
      const id = selected.id.replace(/^personal:/, '');
      const day = startOfDay(new Date(selected.startsAt));
      const startsAt = allDay ? day : stamp(day, startTime);
      const endsAt = allDay ? null : stamp(day, endTime);
      const res = await fetch(`/api/calendar/events/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt ? endsAt.toISOString() : null,
          allDay,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      setSelected(null);
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

  function pickEvent(ev: CalendarFeedEvent) {
    setComposer(null);
    setSelected(ev);
    setFocusDay(startOfDay(new Date(ev.startsAt)));
    setTitle(ev.title);
    setDescription(ev.description || '');
    setAllDay(ev.allDay);
    setStartTime(timeValue(new Date(ev.startsAt)));
    setEndTime(timeValue(ev.endsAt ? new Date(ev.endsAt) : new Date(ev.startsAt)));
  }

  const titleLabel =
    view === 'day'
      ? cursor.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      : view === 'week'
        ? `${range.from.toLocaleDateString(locale, { day: 'numeric', month: 'short' })} – ${addDays(range.to, -1).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}`
        : cursor.toLocaleDateString(locale, { month: 'long', year: 'numeric' });

  const lq = layerQuery.trim().toLowerCase();
  const filterLayers = (list: CalendarLayer[]) => list.filter((l) => !lq || l.label.toLowerCase().includes(lq));
  const mine = filterLayers(layers.filter((l) => l.group === 'mine'));
  const systems = filterLayers(layers.filter((l) => l.group === 'systems'));
  const projects = filterLayers(layers.filter((l) => l.group === 'projects'));

  return (
    <div className="ecalendar flex min-h-0 flex-1 flex-col md:flex-row">
      <aside className="ec-line flex w-full shrink-0 flex-col border-b md:w-64 md:border-b-0 md:border-r">
        <div className="space-y-2 p-3">
          <button type="button" onClick={() => openCreate(focusDay)} className="ec-primary inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold">
            <Plus className="h-4 w-4" />
            {t('Criar', 'Crear', 'Create')}
          </button>
          <label className="ec-line ec-soft flex items-center gap-2 rounded-lg border px-2 py-1.5">
            <Search className="ec-faint h-3.5 w-3.5" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('Procurar eventos', 'Buscar eventos', 'Search events')}
              className="w-full bg-transparent text-sm outline-none"
            />
          </label>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 pb-4">
          <LayerGroup title={t('Os meus calendários', 'Mis calendarios', 'My calendars')} layers={mine} hidden={hidden} counts={counts} onToggle={toggleLayer} />
          <LayerGroup title={t('Sistemas', 'Sistemas', 'Systems')} layers={systems} hidden={hidden} counts={counts} onToggle={toggleLayer} />
          <div>
            <p className="ec-faint mb-1 px-1 text-[11px] font-semibold uppercase tracking-wide">{t('Projetos', 'Proyectos', 'Projects')}</p>
            <input
              value={layerQuery}
              onChange={(e) => setLayerQuery(e.target.value)}
              placeholder={t('Filtrar projetos', 'Filtrar proyectos', 'Filter projects')}
              className="ec-line mb-2 w-full rounded-md border px-2 py-1 text-xs outline-none"
            />
            <LayerGroup title="" layers={projects} hidden={hidden} counts={counts} onToggle={toggleLayer} />
          </div>
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <div className="ec-line flex flex-wrap items-center gap-2 border-b px-3 py-2">
          <button type="button" onClick={() => { setCursor(new Date()); setFocusDay(startOfDay(new Date())); }} className="ec-line ec-soft rounded-md border px-3 py-1.5 text-sm font-semibold">
            {t('Hoje', 'Hoy', 'Today')}
          </button>
          <button type="button" aria-label="Prev" onClick={() => shift(-1)} className="ec-soft rounded-full p-1.5">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button type="button" aria-label="Next" onClick={() => shift(1)} className="ec-soft rounded-full p-1.5">
            <ChevronRight className="h-5 w-5" />
          </button>
          <h2 className="min-w-0 flex-1 truncate text-lg font-medium capitalize">{titleLabel}</h2>
          {loading && <span className="ec-faint text-xs">{t('A atualizar', 'Actualizando', 'Updating')}</span>}
          <div className="ec-line flex rounded-lg border p-0.5 text-sm">
            {(['day', 'week', 'month'] as CalendarView[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={cn('rounded-md px-3 py-1 font-medium', view === v ? 'ec-primary' : 'ec-muted')}
              >
                {v === 'day' ? t('Dia', 'Día', 'Day') : v === 'week' ? t('Semana', 'Semana', 'Week') : t('Mês', 'Mes', 'Month')}
              </button>
            ))}
          </div>
        </div>
        {error && <p className="border-b border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-800">{error}</p>}
        <div className="min-h-0 flex-1 overflow-auto">
          {view === 'month' ? (
            <MonthGrid cursor={cursor} events={visible} focusDay={focusDay} onDay={(day) => { setFocusDay(startOfDay(day)); }} onEvent={pickEvent} onCreate={openCreate} />
          ) : (
            <TimeGrid
              days={view === 'day' ? [startOfDay(cursor)] : Array.from({ length: 7 }, (_, i) => addDays(range.from, i))}
              events={visible}
              onEvent={pickEvent}
            />
          )}
        </div>
      </section>

      <aside className="ec-line flex w-full shrink-0 flex-col border-t md:w-72 md:border-l md:border-t-0">
        <div className="ec-line border-b px-4 py-3">
          <p className="text-sm font-semibold">
            {focusDay.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <p className="ec-faint text-xs">{t(`${dayEvents.length} neste dia`, `${dayEvents.length} en este día`, `${dayEvents.length} this day`)}</p>
        </div>
        <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
          {dayEvents.length === 0 && (
            <li className="ec-faint px-2 py-6 text-center text-sm">{t('Nada neste dia. Cria um evento ou escolhe outro dia.', 'Nada en este día. Crea un evento o elige otro día.', 'Nothing this day. Create an event or pick another day.')}</li>
          )}
          {dayEvents.map((ev) => (
            <li key={ev.id}>
              <button type="button" onClick={() => pickEvent(ev)} className="ec-soft flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left">
                <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: ev.color }} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{ev.title}</span>
                  <span className="ec-faint block text-xs">{ev.allDay ? t('Dia inteiro', 'Todo el día', 'All day') : new Date(ev.startsAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {composer && (
        <Editor
          titleLabel={t('Novo evento', 'Nuevo evento', 'New event')}
          dayLabel={composer.day.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}
          title={title}
          description={description}
          allDay={allDay}
          startTime={startTime}
          endTime={endTime}
          saving={saving}
          t={t}
          onTitle={setTitle}
          onDescription={setDescription}
          onAllDay={setAllDay}
          onStart={setStartTime}
          onEnd={setEndTime}
          onClose={() => setComposer(null)}
          onSave={() => void createEvent()}
        />
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={() => setSelected(null)}>
          <div className="ec-surface w-full max-w-md rounded-2xl p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 h-1.5 w-12 rounded-full" style={{ background: selected.color }} />
            {selected.editable ? (
              <>
                <Field title={title} description={description} allDay={allDay} startTime={startTime} endTime={endTime} t={t} onTitle={setTitle} onDescription={setDescription} onAllDay={setAllDay} onStart={setStartTime} onEnd={setEndTime} />
                <div className="mt-4 flex justify-end gap-2">
                  <button type="button" onClick={() => void removeSelected()} className="rounded-md px-3 py-1.5 text-sm font-medium text-red-700">{t('Apagar', 'Eliminar', 'Delete')}</button>
                  <button type="button" disabled={saving || !title.trim()} onClick={() => void saveSelected()} className="ec-primary rounded-md px-4 py-1.5 text-sm font-semibold disabled:opacity-50">{t('Guardar', 'Guardar', 'Save')}</button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-base font-semibold">{selected.title}</h3>
                <p className="ec-muted mt-1 text-sm">
                  {new Date(selected.startsAt).toLocaleString(locale, selected.allDay ? { dateStyle: 'full' } : { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
                {selected.href && (
                  <Link href={selected.href} className="mt-4 inline-flex text-sm font-semibold" style={{ color: '#1a73e8' }}>
                    {t('Abrir origem', 'Abrir origen', 'Open source')}
                  </Link>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Editor(props: {
  titleLabel: string;
  dayLabel: string;
  title: string;
  description: string;
  allDay: boolean;
  startTime: string;
  endTime: string;
  saving: boolean;
  t: (pt: string, es: string, en: string) => string;
  onTitle: (v: string) => void;
  onDescription: (v: string) => void;
  onAllDay: (v: boolean) => void;
  onStart: (v: string) => void;
  onEnd: (v: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="ec-surface w-full max-w-md rounded-2xl p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold">{props.titleLabel}</h3>
          <button type="button" onClick={props.onClose} className="rounded-full p-1" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <p className="ec-faint mb-2 text-xs">{props.dayLabel}</p>
        <Field {...props} />
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={props.onClose} className="ec-muted rounded-md px-3 py-1.5 text-sm font-medium">{props.t('Cancelar', 'Cancelar', 'Cancel')}</button>
          <button type="button" disabled={props.saving || !props.title.trim()} onClick={props.onSave} className="ec-primary rounded-md px-4 py-1.5 text-sm font-semibold disabled:opacity-50">{props.t('Guardar', 'Guardar', 'Save')}</button>
        </div>
      </div>
    </div>
  );
}

function Field(props: {
  title: string;
  description: string;
  allDay: boolean;
  startTime: string;
  endTime: string;
  t: (pt: string, es: string, en: string) => string;
  onTitle: (v: string) => void;
  onDescription: (v: string) => void;
  onAllDay: (v: boolean) => void;
  onStart: (v: string) => void;
  onEnd: (v: string) => void;
}) {
  return (
    <>
      <input value={props.title} onChange={(e) => props.onTitle(e.target.value)} placeholder={props.t('Adicionar título', 'Añadir título', 'Add title')} className="ec-line mb-3 w-full border-b py-2 text-lg outline-none" />
      <textarea value={props.description} onChange={(e) => props.onDescription(e.target.value)} placeholder={props.t('Notas', 'Notas', 'Notes')} rows={2} className="ec-line mb-3 w-full rounded-md border px-2 py-1.5 text-sm outline-none" />
      <label className="ec-muted mb-3 flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" checked={props.allDay} onChange={(e) => props.onAllDay(e.target.checked)} />
        {props.t('Dia inteiro', 'Todo el día', 'All day')}
      </label>
      {!props.allDay && (
        <div className="mb-1 flex gap-2">
          <input type="time" value={props.startTime} onChange={(e) => props.onStart(e.target.value)} className="ec-line rounded-md border px-2 py-1 text-sm" />
          <input type="time" value={props.endTime} onChange={(e) => props.onEnd(e.target.value)} className="ec-line rounded-md border px-2 py-1 text-sm" />
        </div>
      )}
    </>
  );
}

function LayerGroup({
  title,
  layers,
  hidden,
  counts,
  onToggle,
}: {
  title: string;
  layers: CalendarLayer[];
  hidden: string[];
  counts: Map<string, number>;
  onToggle: (id: string) => void;
}) {
  if (layers.length === 0) return null;
  return (
    <div>
      {title && <p className="ec-faint mb-1 px-1 text-[11px] font-semibold uppercase tracking-wide">{title}</p>}
      <ul className="space-y-0.5">
        {layers.map((layer) => {
          const on = !hidden.includes(layer.id);
          return (
            <li key={layer.id}>
              <label className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-sm">
                <input type="checkbox" checked={on} onChange={() => onToggle(layer.id)} className="sr-only" />
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border-2" style={{ borderColor: layer.color, background: on ? layer.color : 'transparent' }}>
                  {on && <span className="h-1.5 w-1.5 rounded-sm" style={{ background: chipForeground(layer.color) }} />}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">{layer.label}</span>
                <span className="ec-faint text-[11px] tabular-nums">{counts.get(layer.id) || 0}</span>
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
  focusDay,
  onDay,
  onEvent,
  onCreate,
}: {
  cursor: Date;
  events: CalendarFeedEvent[];
  focusDay: Date;
  onDay: (day: Date) => void;
  onEvent: (ev: CalendarFeedEvent) => void;
  onCreate: (day: Date) => void;
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
      <div className="ec-line grid grid-cols-7 border-b">
        {weekdays.map((label) => (
          <div key={label} className="ec-faint px-2 py-2 text-center text-[11px] font-semibold uppercase">{label}</div>
        ))}
      </div>
      <div className="grid flex-1 grid-cols-7 grid-rows-6">
        {cells.map((day) => {
          const inMonth = day.getMonth() === cursor.getMonth();
          const items = byDay.get(dayKey(day)) || [];
          const focused = sameDay(day, focusDay);
          return (
            <div
              key={dayKey(day)}
              className={cn('ec-line min-h-[96px] border-b border-r p-1', !inMonth && 'opacity-60', focused && 'ec-soft')}
              onClick={() => onDay(day)}
              onDoubleClick={() => onCreate(day)}
            >
              <div className="mb-1 flex justify-center">
                <span className={cn('inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold', sameDay(day, today) && 'ec-primary')}>
                  {day.getDate()}
                </span>
              </div>
              <div className="space-y-0.5">
                {items.slice(0, 3).map((ev) => (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onEvent(ev); }}
                    className="block w-full truncate rounded px-1 py-0.5 text-left text-[11px] font-semibold"
                    style={{ background: ev.color, color: chipForeground(ev.color) }}
                  >
                    {ev.allDay ? '' : `${new Date(ev.startsAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} `}
                    {ev.title}
                  </button>
                ))}
                {items.length > 3 && <p className="ec-faint px-1 text-[10px] font-medium">+{items.length - 3}</p>}
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
      <div className="ec-line grid border-b" style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0,1fr))` }}>
        <div />
        {days.map((day) => (
          <div key={dayKey(day)} className="px-2 py-2 text-center">
            <div className="ec-faint text-[11px] font-semibold uppercase">{day.toLocaleDateString(undefined, { weekday: 'short' })}</div>
            <div className={cn('mx-auto mt-0.5 flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold', sameDay(day, today) && 'ec-primary')}>{day.getDate()}</div>
          </div>
        ))}
      </div>
      <div className="relative grid" style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0,1fr))` }}>
        <div>
          {hours.map((h) => (
            <div key={h} className="ec-faint h-12 pr-2 text-right text-[10px] font-medium">{String(h).padStart(2, '0')}:00</div>
          ))}
        </div>
        {days.map((day) => {
          const timed = events.filter((ev) => !ev.allDay && sameDay(new Date(ev.startsAt), day));
          const allday = events.filter((ev) => ev.allDay && sameDay(new Date(ev.startsAt), day));
          return (
            <div key={dayKey(day)} className="ec-line relative border-l">
              {allday.slice(0, 2).map((ev) => (
                <button key={ev.id} type="button" onClick={() => onEvent(ev)} className="mb-0.5 block w-full truncate px-1 text-left text-[10px] font-semibold" style={{ background: ev.color, color: chipForeground(ev.color) }}>{ev.title}</button>
              ))}
              {hours.map((h) => <div key={h} className="ec-line h-12 border-b" />)}
              {timed.map((ev) => {
                const start = new Date(ev.startsAt);
                const minutes = start.getHours() * 60 + start.getMinutes() - 7 * 60;
                const top = Math.max(0, (minutes / (15 * 60)) * 100);
                return (
                  <button key={ev.id} type="button" onClick={() => onEvent(ev)} className="absolute left-1 right-1 truncate rounded px-1 text-left text-[11px] font-semibold" style={{ top: `${top}%`, background: ev.color, color: chipForeground(ev.color), minHeight: 22 }}>{ev.title}</button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
