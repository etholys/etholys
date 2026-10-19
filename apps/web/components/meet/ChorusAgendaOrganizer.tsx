'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Copy, Loader2, Mail, Share2, Video } from 'lucide-react';
import { useApp } from '@/app/providers';
import { useEnsureActiveCompany } from '@/hooks/useEnsureActiveCompany';
import { CompanyPicker } from '@/components/hub/CompanyPicker';
import { addDaysYmd, hmToMinutes, minutesToHm, startOfWeekMonday, ymdInTimeZone } from '@/lib/meet/booking-slots';
import { meetWallTimeToUtc } from '@/lib/meet/timezone';
import { AGENDA_HOLIDAY_COUNTRIES } from '@/lib/meet/holiday-countries';
import ChorusAgendaCalendar, { type AgendaCalEvent, type AgendaView } from '@/components/meet/ChorusAgendaCalendar';

type WindowRow = { weekday: number; startMin: number; endMin: number; enabled: boolean };
type RequestRow = {
  id: string;
  status: string;
  mode: string;
  bookerName: string;
  bookerEmail: string;
  startsAt: string;
  endsAt: string;
  proposedStartsAt: string | null;
  proposedEndsAt: string | null;
  locationText: string | null;
  note: string | null;
  joinUrl: string | null;
  statusUrl: string;
  guests: { name: string | null; email: string }[];
};
type Agenda = {
  page: {
    publicUrl: string;
    title: string;
    description: string | null;
    timeZone: string;
    slotMinutes: number;
    locationText: string | null;
    allowVirtual: boolean;
    allowInPerson: boolean;
    holidayCountries?: string[];
    windows: { weekday: number; startMin: number; endMin: number }[];
    blocks: { id: string; startsAt: string; endsAt: string; source?: string; label?: string | null }[];
  };
  requests: RequestRow[];
  externalBusy?: { id: string; source: 'chorus' | 'google'; title: string; startsAt: string; endsAt: string }[];
  timeZones?: string[];
};

const WEEKDAYS: { weekday: number; pt: string; es: string; en: string }[] = [
  { weekday: 1, pt: 'Segunda', es: 'Lunes', en: 'Monday' },
  { weekday: 2, pt: 'Terça', es: 'Martes', en: 'Tuesday' },
  { weekday: 3, pt: 'Quarta', es: 'Miércoles', en: 'Wednesday' },
  { weekday: 4, pt: 'Quinta', es: 'Jueves', en: 'Thursday' },
  { weekday: 5, pt: 'Sexta', es: 'Viernes', en: 'Friday' },
  { weekday: 6, pt: 'Sábado', es: 'Sábado', en: 'Saturday' },
  { weekday: 0, pt: 'Domingo', es: 'Domingo', en: 'Sunday' },
];

const STATUS_LABEL: Record<string, [string, string, string]> = {
  pending: ['Pendente', 'Pendiente', 'Pending'],
  accepted: ['Aceite', 'Aceptada', 'Accepted'],
  declined: ['Recusado', 'Rechazada', 'Declined'],
  counter_proposed: ['Horário proposto', 'Horario propuesto', 'Time proposed'],
  cancelled: ['Cancelado', 'Cancelada', 'Cancelled'],
};

function visibleAgendaRange(view: AgendaView, cursorYmd: string): { from: string; to: string } {
  if (view === 'day') return { from: cursorYmd, to: addDaysYmd(cursorYmd, 1) };
  if (view === 'week') {
    const start = startOfWeekMonday(cursorYmd);
    return { from: start, to: addDaysYmd(start, 7) };
  }
  if (view === 'year') {
    const year = Number(cursorYmd.slice(0, 4));
    return { from: `${cursorYmd.slice(0, 4)}-01-01`, to: `${year + 1}-01-01` };
  }
  const first = `${cursorYmd.slice(0, 7)}-01`;
  const start = startOfWeekMonday(first);
  return { from: start, to: addDaysYmd(start, 42) };
}

function windowsFromPage(rows: { weekday: number; startMin: number; endMin: number }[]): WindowRow[] {
  return WEEKDAYS.map((day) => {
    const found = rows.find((row) => row.weekday === day.weekday);
    return {
      weekday: day.weekday,
      enabled: Boolean(found),
      startMin: found?.startMin ?? 9 * 60,
      endMin: found?.endMin ?? 18 * 60,
    };
  });
}

const FIELD =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 [color-scheme:light]';

export default function ChorusAgendaOrganizer({
  lockedCompanyId,
  surface = 'chorus',
}: {
  lockedCompanyId?: string;
  /** A mesma agenda abre no Chorus e no eCalendar. */
  surface?: 'chorus' | 'calendar';
} = {}) {
  const { locale } = useApp();
  const t = (pt: string, es: string, en: string) => (locale === 'pt' ? pt : locale === 'es' ? es : en);
  const intl = locale === 'pt' ? 'pt-BR' : locale === 'en' ? 'en-US' : 'es-ES';
  const ensured = useEnsureActiveCompany();
  const { companies, companiesReady, companiesLoadError, setActiveCompanyId, reloadCompanies } = ensured;
  const companyId = lockedCompanyId || ensured.companyId;

  const [agenda, setAgenda] = useState<Agenda | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [timeZone, setTimeZone] = useState('America/Sao_Paulo');
  const [slotMinutes, setSlotMinutes] = useState(30);
  const [locationText, setLocationText] = useState('');
  const [allowVirtual, setAllowVirtual] = useState(true);
  const [allowInPerson, setAllowInPerson] = useState(true);
  const [windows, setWindows] = useState<WindowRow[]>(windowsFromPage([]));
  const [blockStart, setBlockStart] = useState('');
  const [blockEnd, setBlockEnd] = useState('');
  const [counter, setCounter] = useState<Record<string, { start: string; end: string }>>({});
  const [holidayCountries, setHolidayCountries] = useState<string[]>([]);
  const [view, setView] = useState<AgendaView>('week');
  const [cursorYmd, setCursorYmd] = useState(() => ymdInTimeZone(new Date(), 'America/Sao_Paulo'));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [closeMode, setCloseMode] = useState(false);
  const [focusRequestId, setFocusRequestId] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const cursorSet = useRef(false);
  const shareMenuRef = useRef<HTMLDivElement>(null);
  const range = useMemo(() => visibleAgendaRange(view, cursorYmd), [view, cursorYmd]);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ companyId, from: range.from, to: range.to });
      const res = await fetch(`/api/meet/agenda?${params.toString()}`);
      const data = (await res.json()) as Agenda & { error?: string };
      if (!res.ok) throw new Error(data.error || 'error');
      setAgenda(data);
      setTitle(data.page.title);
      setDescription(data.page.description || '');
      setTimeZone(data.page.timeZone);
      setSlotMinutes(data.page.slotMinutes);
      setLocationText(data.page.locationText || '');
      setAllowVirtual(data.page.allowVirtual);
      setAllowInPerson(data.page.allowInPerson);
      setHolidayCountries(data.page.holidayCountries || []);
      setWindows(windowsFromPage(data.page.windows));
      if (!cursorSet.current) {
        setCursorYmd(ymdInTimeZone(new Date(), data.page.timeZone));
        cursorSet.current = true;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'error');
    } finally {
      setLoading(false);
    }
  }, [companyId, range.from, range.to]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!shareOpen) return;
    function onPointer(event: MouseEvent) {
      if (!shareMenuRef.current?.contains(event.target as Node)) setShareOpen(false);
    }
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [shareOpen]);

  async function saveSettings() {
    if (!companyId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/meet/agenda', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          title,
          description,
          timeZone,
          slotMinutes,
          locationText,
          allowVirtual,
          allowInPerson,
          holidayCountries,
          locale,
          from: range.from,
          to: range.to,
          windows: windows
            .filter((row) => row.enabled)
            .map((row) => ({ weekday: row.weekday, startMin: row.startMin, endMin: row.endMin })),
        }),
      });
      const data = (await res.json()) as Agenda & { error?: string };
      if (!res.ok) throw new Error(data.error || 'error');
      setAgenda(data);
      setTimeZone(data.page.timeZone);
      setHolidayCountries(data.page.holidayCountries || []);
      setInfo(t('Agenda guardada.', 'Agenda guardada.', 'Agenda saved.'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'error');
    } finally {
      setSaving(false);
    }
  }

  async function copyText(value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(value);
    window.setTimeout(() => setCopied(null), 1600);
  }

  function publicShareText(url: string) {
    return t(
      `Pode marcar um horário na minha agenda: ${url}`,
      `Puedes reservar un horario en mi agenda: ${url}`,
      `You can book a time on my agenda: ${url}`,
    );
  }

  function wallToIso(value: string) {
    return meetWallTimeToUtc(value, timeZone).toISOString();
  }

  async function closeRange() {
    if (!companyId || !blockStart || !blockEnd) return;
    setSaving(true);
    try {
      const res = await fetch('/api/meet/agenda', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          startsAt: wallToIso(blockStart),
          endsAt: wallToIso(blockEnd),
          from: range.from,
          to: range.to,
        }),
      });
      const data = (await res.json()) as Agenda & { error?: string };
      if (!res.ok) throw new Error(data.error || 'slot_invalid');
      setAgenda(data);
      setBlockStart('');
      setBlockEnd('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'slot_invalid');
    } finally {
      setSaving(false);
    }
  }

  async function removeBlock(blockId: string) {
    if (!companyId) return;
    const res = await fetch('/api/meet/agenda', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, action: 'remove-block', blockId, from: range.from, to: range.to }),
    });
    const data = (await res.json()) as Agenda & { error?: string };
    if (res.ok) setAgenda(data);
    else setError(data.error || 'error');
  }

  async function act(requestId: string, action: string, extra?: { proposedStartsAt?: string; proposedEndsAt?: string }) {
    if (!companyId) return;
    setSaving(true);
    setInfo(null);
    try {
      const res = await fetch(`/api/meet/agenda/requests/${encodeURIComponent(requestId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, action, locale, ...extra }),
      });
      const data = (await res.json()) as { error?: string; mailSent?: boolean; joinUrl?: string | null };
      if (!res.ok) throw new Error(data.error || 'error');
      if (data.mailSent === false) {
        setInfo(
          t(
            'Estado gravado. O e-mail não saiu — copie o link do pedido.',
            'Estado guardado. El correo no salió — copia el enlace del pedido.',
            'Status saved. Email was not sent — copy the request link.',
          ),
        );
      } else {
        setInfo(t('Pedido atualizado.', 'Solicitud actualizada.', 'Request updated.'));
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'error');
    } finally {
      setSaving(false);
    }
  }

  function formatWhen(iso: string) {
    return new Date(iso).toLocaleString(intl, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone,
    });
  }

  const calendarEvents: AgendaCalEvent[] = agenda
    ? [
        ...agenda.page.blocks.map((block) => ({
          id: block.id,
          kind: 'block' as const,
          source: block.source || 'manual',
          title:
            block.source === 'holiday'
              ? block.label || t('Feriado', 'Festivo', 'Holiday')
              : t('Fechado', 'Cerrado', 'Closed'),
          startsAt: block.startsAt,
          endsAt: block.endsAt,
        })),
        ...agenda.requests
          .filter((request) => request.status !== 'declined' && request.status !== 'cancelled')
          .map((request) => {
            const proposed = request.status === 'counter_proposed' && request.proposedStartsAt && request.proposedEndsAt;
            return {
              id: request.id,
              kind: 'request' as const,
              status: request.status,
              title: request.bookerName,
              startsAt: proposed ? request.proposedStartsAt! : request.startsAt,
              endsAt: proposed ? request.proposedEndsAt! : request.endsAt,
            };
          }),
        ...(agenda.externalBusy || []).map((block) => ({
          id: block.id,
          kind: 'block' as const,
          source: block.source,
          title:
            block.source === 'google'
              ? `Google · ${block.title}`
              : `CHORUS · ${block.title}`,
          startsAt: block.startsAt,
          endsAt: block.endsAt,
        })),
      ]
    : [];

  function toggleCountry(code: string) {
    setHolidayCountries((current) =>
      current.includes(code) ? current.filter((item) => item !== code) : [...current, code],
    );
  }

  async function commitRange(startWall: string, endWall: string) {
    setBlockStart(startWall);
    setBlockEnd(endWall);
    if (!companyId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/meet/agenda', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          startsAt: meetWallTimeToUtc(startWall, timeZone).toISOString(),
          endsAt: meetWallTimeToUtc(endWall, timeZone).toISOString(),
          from: range.from,
          to: range.to,
        }),
      });
      const data = (await res.json()) as Agenda & { error?: string };
      if (!res.ok) throw new Error(data.error || 'slot_invalid');
      setAgenda(data);
      setInfo(t('Horário fechado na agenda.', 'Horario cerrado en la agenda.', 'Time closed on the agenda.'));
      setCloseMode(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'slot_invalid');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="etholys-meet-light min-h-dvh bg-white text-slate-900" style={{ colorScheme: 'light' }}>
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3">
          <Link
            href={surface === 'calendar' ? '/hub/calendar' : '/hub/meet'}
            className="inline-flex items-center gap-1 text-sm font-medium text-slate-600"
          >
            <ArrowLeft className="h-4 w-4" />
            {surface === 'calendar' ? 'eCalendar' : 'CHORUS'}
          </Link>
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-700 to-slate-900">
            <Video className="h-4 w-4 text-teal-50" />
          </span>
          <h1 className="text-lg font-semibold">{t('Agenda pública', 'Agenda pública', 'Public agenda')}</h1>
          <div className="ml-auto flex flex-wrap items-center gap-3">
            <Link
              href={surface === 'calendar' ? '/hub/meet/agenda' : '/hub/calendar?view=agenda'}
              className="text-sm font-medium text-teal-800"
            >
              {surface === 'calendar'
                ? t('Abrir no Chorus', 'Abrir en Chorus', 'Open in Chorus')
                : t('Abrir no eCalendar', 'Abrir en eCalendar', 'Open in eCalendar')}
            </Link>
            {lockedCompanyId ? null : (
              <CompanyPicker
                companies={companies}
                activeCompanyId={companyId}
                onSelect={setActiveCompanyId}
                ready={companiesReady}
                error={companiesLoadError}
                onRetry={() => void reloadCompanies()}
                locale={locale}
              />
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        {error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
        ) : null}
        {info ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{info}</p>
        ) : null}
        {loading || !agenda ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-7 w-7 animate-spin text-teal-700" />
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-2">
              <div className="relative" ref={shareMenuRef}>
                <button
                  type="button"
                  aria-expanded={shareOpen}
                  aria-haspopup="menu"
                  onClick={() => setShareOpen((open) => !open)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900"
                >
                  <Share2 className="h-4 w-4" />
                  {t('Partilhar', 'Compartir', 'Share')}
                </button>
                {shareOpen ? (
                  <div
                    role="menu"
                    className="absolute left-0 z-20 mt-1 w-44 rounded-xl border border-slate-200 bg-white p-1 shadow-lg"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => void copyText(agenda.page.publicUrl)}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-slate-800 hover:bg-slate-50"
                    >
                      {copied === agenda.page.publicUrl ? <Check className="h-4 w-4 text-teal-800" /> : <Copy className="h-4 w-4" />}
                      {copied === agenda.page.publicUrl ? t('Copiado', 'Copiado', 'Copied') : t('Copiar', 'Copiar', 'Copy')}
                    </button>
                    <a
                      role="menuitem"
                      href={`mailto:?subject=${encodeURIComponent(t('Agenda pública', 'Agenda pública', 'Public agenda'))}&body=${encodeURIComponent(publicShareText(agenda.page.publicUrl))}`}
                      onClick={() => setShareOpen(false)}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-800 hover:bg-slate-50"
                    >
                      <Mail className="h-4 w-4" />
                      {t('E-mail', 'Correo', 'Email')}
                    </a>
                    <a
                      role="menuitem"
                      href={`https://wa.me/?text=${encodeURIComponent(publicShareText(agenda.page.publicUrl))}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => setShareOpen(false)}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-800 hover:bg-slate-50"
                    >
                      {t('WhatsApp', 'WhatsApp', 'WhatsApp')}
                    </a>
                  </div>
                ) : null}
              </div>
              <label className="block min-w-[16rem] flex-1 text-sm">
                <span className="mb-1 block font-medium text-slate-700">{t('Fuso horário', 'Zona horaria', 'Timezone')}</span>
                <select value={timeZone} onChange={(e) => setTimeZone(e.target.value)} className={FIELD}>
                  {(agenda.timeZones || [timeZone]).map((zone) => (
                    <option key={zone} value={zone}>{zone}</option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => {
                  setCloseMode((open) => !open);
                  setSettingsOpen(false);
                }}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  closeMode ? 'bg-teal-800 text-white' : 'border border-slate-300 bg-white text-slate-900'
                }`}
              >
                {t('Fechar horário', 'Cerrar horario', 'Close a time')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSettingsOpen(true);
                  window.setTimeout(() => document.getElementById('agenda-holidays')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
                }}
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900"
              >
                {t('Feriados', 'Festivos', 'Holidays')}
                {holidayCountries.length ? ` (${holidayCountries.length})` : ''}
              </button>
              <button
                type="button"
                onClick={() => setSettingsOpen((open) => !open)}
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900"
              >
                {settingsOpen
                  ? t('Ocultar definições', 'Ocultar ajustes', 'Hide settings')
                  : t('Definições', 'Ajustes', 'Settings')}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveSettings()}
                className="rounded-full bg-teal-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {t('Guardar agenda', 'Guardar agenda', 'Save agenda')}
              </button>
            </div>
            <p className="text-xs text-slate-600">
              {t(
                'O fuso muda já o calendário e os horários. A página pública usa o fuso depois de guardar. Os feriados escolhidos também fecham a página pública ao guardar.',
                'La zona horaria ya cambia el calendario y los horarios. La página pública usa la zona después de guardar. Los festivos elegidos también cierran la página pública al guardar.',
                'The timezone updates the calendar and times right away. The public page uses it after you save. Chosen holidays also close the public page when you save.',
              )}
            </p>
            <ChorusAgendaCalendar
              timeZone={timeZone}
              locale={locale}
              events={calendarEvents}
              cursorYmd={cursorYmd}
              view={view}
              stepMin={slotMinutes}
              closeMode={closeMode}
              onCursorYmd={setCursorYmd}
              onView={setView}
              onCommitRange={(startWall, endWall) => void commitRange(startWall, endWall)}
              onOpenRequest={(id) => {
                setFocusRequestId(id);
                window.setTimeout(() => document.getElementById(`agenda-request-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 30);
              }}
              onReopenBlock={(id) => void removeBlock(id)}
            />

            {settingsOpen ? (
            <>
            <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 md:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block text-slate-600">{t('Título', 'Título', 'Title')}</span>
                <input value={title} onChange={(e) => setTitle(e.target.value)} className={FIELD} />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-slate-600">{t('Fuso horário', 'Zona horaria', 'Timezone')}</span>
                <select value={timeZone} onChange={(e) => setTimeZone(e.target.value)} className={FIELD}>
                  {(agenda.timeZones || [timeZone]).map((zone) => (
                    <option key={zone} value={zone}>{zone}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm md:col-span-2">
                <span className="mb-1 block text-slate-600">{t('Descrição', 'Descripción', 'Description')}</span>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={FIELD} />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-slate-600">{t('Duração', 'Duración', 'Length')}</span>
                <select value={slotMinutes} onChange={(e) => setSlotMinutes(Number(e.target.value))} className={FIELD}>
                  {[15, 30, 45, 60, 90].map((n) => (
                    <option key={n} value={n}>{n} min</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-slate-600">{t('Local presencial', 'Lugar presencial', 'In-person place')}</span>
                <input value={locationText} onChange={(e) => setLocationText(e.target.value)} className={FIELD} />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={allowVirtual} onChange={(e) => setAllowVirtual(e.target.checked)} />
                {t('Virtual (cria sala CHORUS ao aceitar)', 'Virtual (crea sala CHORUS al aceptar)', 'Virtual (creates a CHORUS room on accept)')}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={allowInPerson} onChange={(e) => setAllowInPerson(e.target.checked)} />
                {t('Presencial', 'Presencial', 'In person')}
              </label>
              <div className="md:col-span-2 space-y-2">
                <p className="text-sm font-medium">{t('Horário semanal', 'Horario semanal', 'Weekly hours')}</p>
                {windows.map((row, index) => {
                  const label = WEEKDAYS.find((day) => day.weekday === row.weekday);
                  return (
                    <div key={row.weekday} className="flex flex-wrap items-center gap-2 text-sm">
                      <label className="flex w-28 items-center gap-2">
                        <input
                          type="checkbox"
                          checked={row.enabled}
                          onChange={(e) => {
                            const next = [...windows];
                            next[index] = { ...row, enabled: e.target.checked };
                            setWindows(next);
                          }}
                        />
                        {label ? t(label.pt, label.es, label.en) : row.weekday}
                      </label>
                      <input
                        type="time"
                        disabled={!row.enabled}
                        value={minutesToHm(row.startMin)}
                        onChange={(e) => {
                          const startMin = hmToMinutes(e.target.value);
                          if (startMin == null) return;
                          const next = [...windows];
                          next[index] = { ...row, startMin };
                          setWindows(next);
                        }}
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-slate-900 disabled:bg-slate-200 disabled:text-slate-800 [color-scheme:light]"
                      />
                      <span>–</span>
                      <input
                        type="time"
                        disabled={!row.enabled}
                        value={minutesToHm(row.endMin === 24 * 60 ? 0 : row.endMin)}
                        onChange={(e) => {
                          const endMin = hmToMinutes(e.target.value);
                          if (endMin == null) return;
                          const next = [...windows];
                          next[index] = { ...row, endMin: endMin === 0 ? 24 * 60 : endMin };
                          setWindows(next);
                        }}
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-slate-900 disabled:bg-slate-200 disabled:text-slate-800 [color-scheme:light]"
                      />
                    </div>
                  );
                })}
              </div>
              <fieldset id="agenda-holidays" className="md:col-span-2 space-y-2">
                <legend className="text-sm font-medium text-slate-900">
                  {t('Feriados públicos', 'Festivos públicos', 'Public holidays')}
                </legend>
                <p className="text-xs text-slate-600">
                  {t(
                    'Escolha um ou mais países. Ao guardar, esses dias ficam fechados no calendário e na página pública.',
                    'Elige uno o más países. Al guardar, esos días quedan cerrados en el calendario y en la página pública.',
                    'Pick one or more countries. On save, those days are closed on the calendar and the public page.',
                  )}
                </p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {AGENDA_HOLIDAY_COUNTRIES.map((country) => (
                    <label key={country.code} className="flex items-center gap-2 text-sm text-slate-900">
                      <input
                        type="checkbox"
                        checked={holidayCountries.includes(country.code)}
                        onChange={() => toggleCountry(country.code)}
                      />
                      {t(country.pt, country.es, country.en)}
                    </label>
                  ))}
                </div>
              </fieldset>
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveSettings()}
                className="rounded-full bg-teal-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {t('Guardar agenda', 'Guardar agenda', 'Save agenda')}
              </button>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-900">
              <h2 className="text-base font-semibold">{t('Fechar horário', 'Cerrar horario', 'Close a time')}</h2>
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <label className="text-sm">
                  <span className="mb-1 block text-slate-600">{t('Início', 'Inicio', 'Start')}</span>
                  <input type="datetime-local" value={blockStart} onChange={(e) => setBlockStart(e.target.value)} className={FIELD} />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-slate-600">{t('Fim', 'Fin', 'End')}</span>
                  <input type="datetime-local" value={blockEnd} onChange={(e) => setBlockEnd(e.target.value)} className={FIELD} />
                </label>
                <button type="button" onClick={() => void closeRange()} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold">
                  {t('Fechar', 'Cerrar', 'Close')}
                </button>
              </div>
              <ul className="mt-3 space-y-1 text-sm">
                {agenda.page.blocks.filter((block) => block.source !== 'holiday').map((block) => (
                  <li key={block.id} className="flex items-center justify-between gap-2">
                    <span>{formatWhen(block.startsAt)} – {formatWhen(block.endsAt)}</span>
                    <button type="button" onClick={() => void removeBlock(block.id)} className="font-medium text-teal-800">
                      {t('Reabrir', 'Reabrir', 'Reopen')}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
            </>
            ) : null}

            <section className="space-y-3">
              <h2 className="text-base font-semibold">{t('Pedidos', 'Solicitudes', 'Requests')}</h2>
              {agenda.requests.length === 0 ? (
                <p className="text-sm text-slate-500">{t('Ainda não há pedidos.', 'Todavía no hay solicitudes.', 'No requests yet.')}</p>
              ) : (
                agenda.requests.map((request) => {
                  const open = request.status === 'pending' || request.status === 'counter_proposed';
                  const proposal = counter[request.id] || { start: '', end: '' };
                  const label = STATUS_LABEL[request.status];
                  return (
                    <article id={`agenda-request-${request.id}`} key={request.id} className={`rounded-2xl border bg-white p-4 text-slate-900 ${focusRequestId === request.id ? 'border-teal-700 ring-2 ring-teal-700' : 'border-slate-200'}`}>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-teal-800">
                            {label ? t(...label) : request.status}
                          </p>
                          <p className="font-semibold">{request.bookerName}</p>
                          <p className="text-sm text-slate-600">{request.bookerEmail}</p>
                          <p className="mt-1 text-sm">{formatWhen(request.startsAt)}</p>
                          {request.proposedStartsAt ? (
                            <p className="text-sm text-teal-900">
                              {t('Proposta', 'Propuesta', 'Proposal')}: {formatWhen(request.proposedStartsAt)}
                            </p>
                          ) : null}
                          <p className="text-sm text-slate-600">
                            {request.mode === 'virtual' ? t('Virtual', 'Virtual', 'Virtual') : t('Presencial', 'Presencial', 'In person')}
                            {request.locationText ? ` · ${request.locationText}` : ''}
                          </p>
                          {request.note ? <p className="mt-1 text-sm text-slate-700">{request.note}</p> : null}
                          {request.guests.length > 0 ? (
                            <ul className="mt-2 text-sm text-slate-700">
                              {request.guests.map((guest) => (
                                <li key={guest.email}>{guest.name ? `${guest.name} · ` : ''}{guest.email}</li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                        <button type="button" onClick={() => void copyText(request.statusUrl)} className="text-sm font-medium text-teal-800">
                          {copied === request.statusUrl ? t('Copiado', 'Copiado', 'Copied') : t('Copiar link do pedido', 'Copiar enlace', 'Copy request link')}
                        </button>
                      </div>
                      {request.joinUrl ? (
                        <a href={request.joinUrl} className="mt-2 inline-block text-sm font-semibold text-teal-800 underline">
                          {t('Sala CHORUS', 'Sala CHORUS', 'CHORUS room')}
                        </a>
                      ) : null}
                      {open ? (
                        <div className="mt-3 flex flex-wrap items-end gap-2">
                          <button type="button" disabled={saving} onClick={() => void act(request.id, 'accept')} className="rounded-full bg-teal-800 px-3 py-2 text-sm font-semibold text-white">
                            {t('Aceitar', 'Aceptar', 'Accept')}
                          </button>
                          <button type="button" disabled={saving} onClick={() => void act(request.id, 'decline')} className="rounded-full border border-slate-300 px-3 py-2 text-sm font-semibold">
                            {t('Recusar', 'Rechazar', 'Decline')}
                          </button>
                          <button type="button" disabled={saving} onClick={() => void act(request.id, 'close')} className="rounded-full border border-slate-300 px-3 py-2 text-sm font-semibold">
                            {t('Fechar horário', 'Cerrar horario', 'Close time')}
                          </button>
                          <input type="datetime-local" value={proposal.start} onChange={(e) => setCounter({ ...counter, [request.id]: { ...proposal, start: e.target.value } })} className={FIELD} />
                          <input type="datetime-local" value={proposal.end} onChange={(e) => setCounter({ ...counter, [request.id]: { ...proposal, end: e.target.value } })} className={FIELD} />
                          <button
                            type="button"
                            disabled={saving || !proposal.start || !proposal.end}
                            onClick={() =>
                              void act(request.id, 'counter', {
                                proposedStartsAt: wallToIso(proposal.start),
                                proposedEndsAt: wallToIso(proposal.end),
                              })
                            }
                            className="rounded-full border border-teal-700 px-3 py-2 text-sm font-semibold text-teal-900"
                          >
                            {t('Propor outro horário', 'Proponer otro horario', 'Propose another time')}
                          </button>
                        </div>
                      ) : null}
                    </article>
                  );
                })
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
