'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CalendarRange,
  Check,
  Clock,
  Copy,
  Loader2,
  Mail,
  Menu,
  Ban,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Share2,
  Sun,
  Video,
} from 'lucide-react';
import { useApp } from '@/app/providers';
import { useEnsureActiveCompany } from '@/hooks/useEnsureActiveCompany';
import { AppearanceToggle } from '@/components/hub/AppearanceToggle';
import { SystemAtmosphere } from '@/components/hub/SystemAtmosphere';
import { CompanyPicker } from '@/components/hub/CompanyPicker';
import { sysTheme } from '@/lib/system-shell';
import { cn } from '@/lib/utils';
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
  'w-full rounded-lg border border-[color:var(--sys-line)] bg-[color:var(--sys-panel-soft)] px-2.5 py-1.5 text-sm text-[color:var(--sys-ink)]';

function zoneCity(zone: string) {
  return (zone.split('/').pop() || zone).replace(/_/g, ' ');
}

function zoneOffset(zone: string) {
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'shortOffset' })
      .formatToParts(new Date())
      .find((item) => item.type === 'timeZoneName');
    return part?.value || '';
  } catch {
    return '';
  }
}

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
  const [collapsed, setCollapsed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [sharePos, setSharePos] = useState<{ top: number; left: number } | null>(null);
  const cursorSet = useRef(false);
  const shareBtnRef = useRef<HTMLButtonElement>(null);
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
    function close(event: MouseEvent) {
      const target = event.target as Node;
      if (shareBtnRef.current?.contains(target) || shareMenuRef.current?.contains(target)) return;
      setShareOpen(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
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

  const embedded = surface === 'calendar';
  const views: { id: AgendaView; label: string }[] = [
    { id: 'day', label: t('Dia', 'Día', 'Day') },
    { id: 'week', label: t('Semana', 'Semana', 'Week') },
    { id: 'month', label: t('Mês', 'Mes', 'Month') },
    { id: 'year', label: t('Ano', 'Año', 'Year') },
  ];
  function sideItem(active: boolean) {
    return cn(
      'flex w-full items-center rounded-lg text-sm font-medium transition',
      collapsed ? 'justify-center px-2 py-2.5' : 'gap-2 px-3 py-2',
      active
        ? 'bg-teal-500/15 text-[color:var(--sys-ink)]'
        : 'text-[color:var(--sys-nav-idle)] hover:bg-[color:var(--sys-nav-hover)] hover:text-[color:var(--sys-ink)]',
    );
  }

  return (
    <div
      className={cn(
        'etholys-system etholys-meet relative flex min-h-0 text-[color:var(--sys-ink)]',
        embedded ? 'min-h-[70vh] flex-1' : 'etholys-hub isolate min-h-dvh bg-[color:var(--sys-canvas-bg,#07111A)]',
      )}
      data-accent="teal"
    >
      {embedded ? null : <SystemAtmosphere accent="teal" />}
      {sidebarOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          aria-label={t('Fechar', 'Cerrar', 'Close')}
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}
      <aside
        className={cn(
          embedded
            ? 'absolute inset-y-0 left-0 z-20 flex flex-col border-r border-[color:var(--sys-line)] bg-[color:var(--sys-aside-bg)] lg:static'
            : sysTheme.aside,
          collapsed ? 'w-16' : 'w-60',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        <div className={cn('flex items-center gap-2 border-b border-[color:var(--sys-line)]', collapsed ? 'justify-center p-2' : 'p-3')}>
          <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border', sysTheme.icon.teal)}>
            <Video className="h-4 w-4" />
          </span>
          {collapsed ? null : (
            <div className="min-w-0">
              <p className={sysTheme.brand}>CHORUS</p>
              <p className="truncate text-[11px] text-[color:var(--sys-faint)]">{t('Agenda pública', 'Agenda pública', 'Public agenda')}</p>
            </div>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            className="ml-auto hidden rounded-lg p-1.5 text-[color:var(--sys-faint)] hover:bg-[color:var(--sys-nav-hover)] hover:text-[color:var(--sys-ink)] lg:inline-flex"
            title={collapsed ? t('Expandir', 'Expandir', 'Expand') : t('Minimizar', 'Minimizar', 'Collapse')}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2">
          {!collapsed && !lockedCompanyId ? (
            <div className="hub-company-picker-dark mb-2">
              <CompanyPicker
                companies={companies}
                activeCompanyId={companyId}
                onSelect={setActiveCompanyId}
                ready={companiesReady}
                error={companiesLoadError}
                onRetry={() => void reloadCompanies()}
                locale={locale}
                compact
                tone="dark"
                className="w-full"
              />
            </div>
          ) : null}

          {collapsed ? (
            <button
              type="button"
              title={views.find((item) => item.id === view)?.label}
              onClick={() => {
                const index = views.findIndex((item) => item.id === view);
                setView(views[(index + 1) % views.length].id);
              }}
              className={sideItem(true)}
            >
              <CalendarRange className="h-4 w-4 shrink-0" />
            </button>
          ) : (
            <label className="block px-1 pb-1 text-xs text-[color:var(--sys-muted)]">
              <span className="mb-1 flex items-center gap-1.5 font-medium uppercase tracking-[0.14em] text-[10px] text-[color:var(--sys-faint)]">
                {t('Vista', 'Vista', 'View')}
              </span>
              <span className="flex items-center gap-2 rounded-lg border border-[color:var(--sys-line)] bg-[color:var(--sys-panel-soft)] px-2">
                <CalendarRange className="h-3.5 w-3.5 shrink-0 text-[color:var(--sys-faint)]" />
                <select
                  value={view}
                  onChange={(event) => setView(event.target.value as AgendaView)}
                  className="w-full bg-transparent py-1.5 text-sm text-[color:var(--sys-ink)] outline-none"
                >
                  {views.map((item) => (
                    <option key={item.id} value={item.id}>{item.label}</option>
                  ))}
                </select>
              </span>
            </label>
          )}

          <div className="my-2 border-t border-[color:var(--sys-line)]" />

          {collapsed ? (
            <button type="button" className={sideItem(false)} title={zoneCity(timeZone)} onClick={() => setCollapsed(false)}>
              <Clock className="h-4 w-4" />
            </button>
          ) : (
            <label className="block px-1 pb-2 text-xs text-[color:var(--sys-muted)]">
              <span className="mb-1 flex items-center gap-1.5 font-medium">
                <Clock className="h-3.5 w-3.5" />
                {t('Fuso', 'Zona', 'Zone')}
              </span>
              <select value={timeZone} onChange={(e) => setTimeZone(e.target.value)} className={FIELD}>
                {(agenda?.timeZones || [timeZone]).map((zone) => (
                  <option key={zone} value={zone}>
                    {zoneCity(zone)} {zoneOffset(zone)}
                  </option>
                ))}
              </select>
            </label>
          )}

          <button
            ref={shareBtnRef}
            type="button"
            disabled={!agenda}
            title={t('Partilhar', 'Compartir', 'Share')}
            aria-expanded={shareOpen}
            onClick={() => {
              if (shareOpen) {
                setShareOpen(false);
                return;
              }
              const rect = shareBtnRef.current?.getBoundingClientRect();
              if (!rect) return;
              setSharePos({ top: rect.top, left: Math.min(rect.right + 8, window.innerWidth - 188) });
              setShareOpen(true);
            }}
            className={sideItem(shareOpen)}
          >
            <Share2 className="h-4 w-4 shrink-0" />
            {collapsed ? null : <span>{t('Partilhar', 'Compartir', 'Share')}</span>}
          </button>

          <button
            type="button"
            onClick={() => {
              setCloseMode((open) => !open);
              setSettingsOpen(false);
            }}
            className={sideItem(closeMode)}
          >
            <Ban className="h-4 w-4 shrink-0" />
            {collapsed ? null : <span>{t('Fechar horário', 'Cerrar horario', 'Close a time')}</span>}
          </button>
        </div>

        <div className="space-y-1 border-t border-[color:var(--sys-line)] p-2">
          <button
            type="button"
            onClick={() => {
              setSettingsOpen(true);
              window.setTimeout(() => document.getElementById('agenda-holidays')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
            }}
            className={sideItem(false)}
            title={t('Feriados', 'Festivos', 'Holidays')}
          >
            <Sun className="h-4 w-4 shrink-0" />
            {collapsed ? null : (
              <span>
                {t('Feriados', 'Festivos', 'Holidays')}
                {holidayCountries.length ? ` (${holidayCountries.length})` : ''}
              </span>
            )}
          </button>
          <button type="button" onClick={() => setSettingsOpen((open) => !open)} className={sideItem(settingsOpen)} title={t('Definições', 'Ajustes', 'Settings')}>
            <Settings className="h-4 w-4 shrink-0" />
            {collapsed ? null : <span>{t('Definições', 'Ajustes', 'Settings')}</span>}
          </button>
          <button type="button" disabled={saving} onClick={() => void saveSettings()} className={cn(sideItem(false), 'text-teal-200')} title={t('Guardar', 'Guardar', 'Save')}>
            <Check className="h-4 w-4 shrink-0" />
            {collapsed ? null : <span>{saving ? '…' : t('Guardar', 'Guardar', 'Save')}</span>}
          </button>
          <AppearanceToggle collapsed={collapsed} />
          <Link
            href={embedded ? '/hub/meet' : '/hub/calendar?view=agenda'}
            className={sideItem(false)}
            title={embedded ? 'CHORUS' : 'eCalendar'}
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            {collapsed ? null : <span>{embedded ? 'CHORUS' : 'eCalendar'}</span>}
          </Link>
        </div>
      </aside>

      <div className={cn('relative z-10 flex min-w-0 flex-1 flex-col', collapsed ? 'lg:ml-16' : 'lg:ml-60', embedded && 'lg:ml-0')}>
        <div className="flex items-center gap-2 border-b border-[color:var(--sys-line)] px-3 py-2 lg:hidden">
          <button type="button" onClick={() => setSidebarOpen(true)} className="rounded-lg p-1.5 text-[color:var(--sys-ink)]">
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold">{t('Agenda pública', 'Agenda pública', 'Public agenda')}</span>
        </div>
      <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-4">
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
              hideViewSwitch
            />

            {settingsOpen ? (
            <>
            <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 md:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block text-slate-600">{t('Título', 'Título', 'Title')}</span>
                <input value={title} onChange={(e) => setTitle(e.target.value)} className={FIELD} />
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
                        className={cn(FIELD, 'w-auto disabled:opacity-50')}
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
                        className={cn(FIELD, 'w-auto disabled:opacity-50')}
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
      {shareOpen && sharePos && agenda ? (
        <div
          role="menu"
          ref={shareMenuRef}
          className="fixed z-[70] w-44 rounded-xl border border-[color:var(--sys-line)] bg-[color:var(--sys-panel)] p-1 shadow-lg"
          style={{ top: sharePos.top, left: sharePos.left }}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => void copyText(agenda.page.publicUrl)}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-[color:var(--sys-ink)] hover:bg-[color:var(--sys-nav-hover)]"
          >
            {copied === agenda.page.publicUrl ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied === agenda.page.publicUrl ? t('Copiado', 'Copiado', 'Copied') : t('Copiar enlace', 'Copiar enlace', 'Copy link')}
          </button>
          <a
            role="menuitem"
            href={`mailto:?subject=${encodeURIComponent(t('Agenda pública', 'Agenda pública', 'Public agenda'))}&body=${encodeURIComponent(publicShareText(agenda.page.publicUrl))}`}
            onClick={() => setShareOpen(false)}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-[color:var(--sys-ink)] hover:bg-[color:var(--sys-nav-hover)]"
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
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-[color:var(--sys-ink)] hover:bg-[color:var(--sys-nav-hover)]"
          >
            {t('WhatsApp', 'WhatsApp', 'WhatsApp')}
          </a>
        </div>
      ) : null}
    </div>
  );
}
