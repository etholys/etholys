'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CalendarPlus,
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
  Trash2,
  Users,
  Video,
  X,
} from 'lucide-react';
import { useApp } from '@/app/providers';
import { useEnsureActiveCompany } from '@/hooks/useEnsureActiveCompany';
import { AppearanceToggle } from '@/components/hub/AppearanceToggle';
import { SystemAtmosphere } from '@/components/hub/SystemAtmosphere';
import { CompanyPicker } from '@/components/hub/CompanyPicker';
import { sysTheme } from '@/lib/system-shell';
import { cn } from '@/lib/utils';
import {
  BOOKING_SLOT_MINUTE_OPTIONS,
  addDaysYmd,
  hmToMinutes,
  minutesToHm,
  startOfWeekMonday,
  ymdInTimeZone,
} from '@/lib/meet/booking-slots';
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
type OpenDayRow = {
  id: string;
  kind?: 'slots';
  publicUrl: string;
  dayYmd: string;
  title: string;
  description: string | null;
  locationText: string | null;
  slotMinutes: number;
  startMin: number;
  endMin: number;
  allowVirtual: boolean;
  allowInPerson: boolean;
  active: boolean;
};

type GroupEventRow = {
  id: string;
  kind?: 'group';
  publicUrl: string;
  dayYmd: string;
  title: string;
  description: string | null;
  locationText: string | null;
  startMin: number;
  endMin: number;
  allowVirtual: boolean;
  allowInPerson: boolean;
  capacity: number | null;
  registrationCount: number;
  registrations?: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    note: string | null;
    mode: string;
    createdAt: string;
  }[];
  active: boolean;
};

type CreateActivityKind = 'slots' | 'group';

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
  openDays?: OpenDayRow[];
  groupEvents?: GroupEventRow[];
  requests: RequestRow[];
  externalBusy?: { id: string; source: 'chorus' | 'google'; title: string; startsAt: string; endsAt: string }[];
  timeZones?: string[];
  createdOpenDay?: OpenDayRow;
  createdGroupEvent?: GroupEventRow;
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
  const [blockLabel, setBlockLabel] = useState('');
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [counter, setCounter] = useState<Record<string, { start: string }>>({});
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
  const [shareTargetUrl, setShareTargetUrl] = useState<string | null>(null);
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);
  const [activityKind, setActivityKind] = useState<CreateActivityKind | null>(null);
  const [openDayYmd, setOpenDayYmd] = useState('');
  const [openDayTitle, setOpenDayTitle] = useState('');
  const [openDayDescription, setOpenDayDescription] = useState('');
  const [openDayLocation, setOpenDayLocation] = useState('');
  const [openDaySlotMinutes, setOpenDaySlotMinutes] = useState(30);
  const [openDayStartHm, setOpenDayStartHm] = useState('09:00');
  const [openDayEndHm, setOpenDayEndHm] = useState('18:00');
  const [openDayVirtual, setOpenDayVirtual] = useState(true);
  const [openDayInPerson, setOpenDayInPerson] = useState(true);
  const [groupCapacity, setGroupCapacity] = useState('');
  const [expandedGroupEventId, setExpandedGroupEventId] = useState<string | null>(null);
  const cursorSet = useRef(false);
  const shareBtnRef = useRef<HTMLButtonElement>(null);
  const shareMenuRef = useRef<HTMLDivElement>(null);
  const range = useMemo(() => visibleAgendaRange(view, cursorYmd), [view, cursorYmd]);
  const openDays = agenda?.openDays || [];
  const groupEvents = agenda?.groupEvents || [];

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
      setShareTargetUrl(null);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [shareOpen]);

  function openShareMenu(url: string, anchor: HTMLElement | null) {
    const rect = anchor?.getBoundingClientRect();
    if (!rect) return;
    setShareTargetUrl(url);
    setSharePos({ top: rect.top, left: Math.min(rect.right + 8, window.innerWidth - 188) });
    setShareOpen(true);
  }

  function resetActivityForm() {
    const weekday = (() => {
      const match = cursorYmd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!match) return -1;
      return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))).getUTCDay();
    })();
    const win = windows.find((row) => row.weekday === weekday && row.enabled);
    setActivityKind(null);
    setOpenDayYmd(cursorYmd);
    setOpenDayTitle('');
    setOpenDayDescription('');
    setOpenDayLocation(locationText);
    setOpenDaySlotMinutes(slotMinutes);
    setOpenDayStartHm(minutesToHm(win?.startMin ?? 9 * 60));
    setOpenDayEndHm(minutesToHm(win?.endMin ?? 18 * 60));
    setOpenDayVirtual(allowVirtual);
    setOpenDayInPerson(allowInPerson);
    setGroupCapacity('');
  }

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
    if (url.includes('/a/d/')) {
      return t(
        `Pode marcar um horário neste dia aberto: ${url}`,
        `Puedes reservar un horario en este día abierto: ${url}`,
        `You can book a time on this open day: ${url}`,
      );
    }
    if (url.includes('/a/e/')) {
      return t(
        `Pode inscrever-se neste evento: ${url}`,
        `Puedes inscribirte en este evento: ${url}`,
        `You can register for this event: ${url}`,
      );
    }
    return t(
      `Pode marcar um horário na minha agenda: ${url}`,
      `Puedes reservar un horario en mi agenda: ${url}`,
      `You can book a time on my agenda: ${url}`,
    );
  }

  async function createOpenDay() {
    if (!companyId || !openDayYmd) return;
    const startMin = hmToMinutes(openDayStartHm);
    const endMin = hmToMinutes(openDayEndHm);
    if (startMin == null || endMin == null || endMin - startMin < 15) {
      setError(t('Horário inválido.', 'Horario inválido.', 'Invalid hours.'));
      return;
    }
    if (!openDayVirtual && !openDayInPerson) {
      setError(t('Escolha virtual e/ou presencial.', 'Elige virtual y/o presencial.', 'Choose virtual and/or in person.'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/meet/agenda/open-days', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          dayYmd: openDayYmd,
          title: openDayTitle.trim() || null,
          description: openDayDescription.trim() || null,
          locationText: openDayLocation.trim() || null,
          slotMinutes: openDaySlotMinutes,
          startMin,
          endMin,
          allowVirtual: openDayVirtual,
          allowInPerson: openDayInPerson,
          from: range.from,
          to: range.to,
        }),
      });
      const data = (await res.json()) as Agenda & { error?: string };
      if (!res.ok) throw new Error(data.error || 'error');
      setAgenda(data);
      setActivityDialogOpen(false);
      setInfo(t('Horários do dia criados.', 'Horarios del día creados.', 'Day schedule created.'));
      if (data.createdOpenDay?.publicUrl) {
        void copyText(data.createdOpenDay.publicUrl);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'error');
    } finally {
      setSaving(false);
    }
  }

  async function createGroupEvent() {
    if (!companyId || !openDayYmd) return;
    const startMin = hmToMinutes(openDayStartHm);
    const endMin = hmToMinutes(openDayEndHm);
    if (startMin == null || endMin == null || endMin - startMin < 15) {
      setError(t('Horário inválido.', 'Horario inválido.', 'Invalid hours.'));
      return;
    }
    if (!openDayVirtual && !openDayInPerson) {
      setError(t('Escolha virtual e/ou presencial.', 'Elige virtual y/o presencial.', 'Choose virtual and/or in person.'));
      return;
    }
    const capacityRaw = groupCapacity.trim();
    const capacity = capacityRaw ? Number(capacityRaw) : null;
    if (capacityRaw && (!Number.isFinite(capacity) || (capacity as number) < 1)) {
      setError(t('Capacidade inválida.', 'Capacidad inválida.', 'Invalid capacity.'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/meet/agenda/group-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          dayYmd: openDayYmd,
          title: openDayTitle.trim() || null,
          description: openDayDescription.trim() || null,
          locationText: openDayLocation.trim() || null,
          startMin,
          endMin,
          allowVirtual: openDayVirtual,
          allowInPerson: openDayInPerson,
          capacity,
          from: range.from,
          to: range.to,
        }),
      });
      const data = (await res.json()) as Agenda & { error?: string };
      if (!res.ok) throw new Error(data.error || 'error');
      setAgenda(data);
      setActivityDialogOpen(false);
      setInfo(t('Evento criado.', 'Evento creado.', 'Event created.'));
      if (data.createdGroupEvent?.publicUrl) {
        void copyText(data.createdGroupEvent.publicUrl);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'error');
    } finally {
      setSaving(false);
    }
  }

  async function removeOpenDay(openDayId: string) {
    if (!companyId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/meet/agenda/open-days', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, openDayId, from: range.from, to: range.to }),
      });
      const data = (await res.json()) as Agenda & { error?: string };
      if (!res.ok) throw new Error(data.error || 'error');
      setAgenda(data);
      setInfo(t('Dia removido.', 'Día eliminado.', 'Day removed.'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'error');
    } finally {
      setSaving(false);
    }
  }

  async function removeGroupEvent(groupEventId: string) {
    if (!companyId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/meet/agenda/group-events', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, groupEventId, from: range.from, to: range.to }),
      });
      const data = (await res.json()) as Agenda & { error?: string };
      if (!res.ok) throw new Error(data.error || 'error');
      setAgenda(data);
      setInfo(t('Evento removido.', 'Evento eliminado.', 'Event removed.'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'error');
    } finally {
      setSaving(false);
    }
  }

  function labelOpenDay(ymd: string) {
    const [y, m, d] = ymd.split('-').map(Number);
    return new Date(Date.UTC(y, (m || 1) - 1, d || 1)).toLocaleDateString(intl, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    });
  }

  function shareMailSubject(url: string) {
    if (url.includes('/a/d/')) {
      return t('Horários do dia', 'Horarios del día', 'Day schedule');
    }
    if (url.includes('/a/e/')) {
      return t('Evento / capacitação', 'Evento / capacitación', 'Event / training');
    }
    return t('Agenda pública', 'Agenda pública', 'Public agenda');
  }

  function wallToIso(value: string) {
    return meetWallTimeToUtc(value, timeZone).toISOString();
  }

  async function closeRange() {
    if (!companyId || !blockStart || !blockEnd || blockEnd <= blockStart) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/meet/agenda', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          startsAt: wallToIso(blockStart),
          endsAt: wallToIso(blockEnd),
          label: blockLabel.trim() || null,
          from: range.from,
          to: range.to,
        }),
      });
      const data = (await res.json()) as Agenda & { error?: string };
      if (!res.ok) throw new Error(data.error || 'slot_invalid');
      setAgenda(data);
      setBlockStart('');
      setBlockEnd('');
      setBlockLabel('');
      setBlockDialogOpen(false);
      setInfo(t('Horário fechado na agenda.', 'Horario cerrado en la agenda.', 'Time closed on the agenda.'));
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
              : block.label || t('Fechado', 'Cerrado', 'Closed'),
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

  function commitRange(startWall: string, endWall: string) {
    setBlockStart(startWall);
    setBlockEnd(endWall);
    setBlockLabel('');
    setBlockDialogOpen(true);
    setError(null);
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
        'etholys-system etholys-meet relative flex w-full text-[color:var(--sys-ink)]',
        embedded
          ? 'min-h-0 min-h-[70vh] flex-1'
          : 'etholys-hub isolate min-h-dvh w-full overflow-hidden bg-[color:var(--sys-canvas-bg,#07111A)]',
      )}
      data-accent="teal"
    >
      {embedded ? null : (
        <>
          <div
            aria-hidden
            className="pointer-events-none fixed inset-0 -z-10 bg-[color:var(--sys-canvas-bg,#07111A)]"
          />
          <SystemAtmosphere accent="teal" />
        </>
      )}
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

          {collapsed ? (
            <button
              type="button"
              className={sideItem(false)}
              title={`${slotMinutes} min`}
              onClick={() => {
                setCollapsed(false);
                setSettingsOpen(true);
                window.setTimeout(
                  () => document.getElementById('agenda-slot-duration')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
                  50,
                );
              }}
            >
              <span className="text-[10px] font-semibold tabular-nums">{slotMinutes}</span>
            </button>
          ) : (
            <label id="agenda-slot-duration-side" className="block px-1 pb-2 text-xs text-[color:var(--sys-muted)]">
              <span className="mb-1 flex items-center gap-1.5 font-medium">
                {t('Duração da reunião', 'Duración de la reunión', 'Meeting length')}
              </span>
              <select
                value={slotMinutes}
                onChange={(e) => setSlotMinutes(Number(e.target.value))}
                className={FIELD}
                aria-describedby="agenda-slot-duration-hint"
              >
                {BOOKING_SLOT_MINUTE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n === 60
                      ? t('1 hora', '1 hora', '1 hour')
                      : n === 120
                        ? t('2 horas', '2 horas', '2 hours')
                        : `${n} min`}
                  </option>
                ))}
              </select>
              <span id="agenda-slot-duration-hint" className="mt-1 block text-[10px] leading-snug text-[color:var(--sys-faint)]">
                {t(
                  'O convidado só escolhe o início; o fim é automático.',
                  'El invitado solo elige el inicio; el fin es automático.',
                  'Guests only pick a start; the end is automatic.',
                )}
              </span>
            </label>
          )}

          <button
            ref={shareBtnRef}
            type="button"
            disabled={!agenda}
            title={t('Partilhar', 'Compartir', 'Share')}
            aria-expanded={shareOpen && shareTargetUrl === agenda?.page.publicUrl}
            onClick={() => {
              if (shareOpen && shareTargetUrl === agenda?.page.publicUrl) {
                setShareOpen(false);
                setShareTargetUrl(null);
                return;
              }
              if (agenda) openShareMenu(agenda.page.publicUrl, shareBtnRef.current);
            }}
            className={sideItem(shareOpen && shareTargetUrl === agenda?.page.publicUrl)}
          >
            <Share2 className="h-4 w-4 shrink-0" />
            {collapsed ? null : <span>{t('Partilhar', 'Compartir', 'Share')}</span>}
          </button>

          <button
            type="button"
            disabled={!agenda}
            title={t('Criar atividade', 'Crear actividad', 'Create activity')}
            onClick={() => {
              resetActivityForm();
              setActivityDialogOpen(true);
              setCloseMode(false);
              setSettingsOpen(false);
            }}
            className={sideItem(activityDialogOpen)}
          >
            <CalendarPlus className="h-4 w-4 shrink-0" />
            {collapsed ? null : <span>{t('Criar atividade', 'Crear actividad', 'Create activity')}</span>}
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
          <button
            type="button"
            onClick={() => {
              setSettingsOpen((open) => {
                const next = !open;
                if (next) {
                  window.setTimeout(
                    () => document.getElementById('agenda-slot-duration')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
                    50,
                  );
                }
                return next;
              });
            }}
            className={sideItem(settingsOpen)}
            title={t('Definições', 'Ajustes', 'Settings')}
          >
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

            {openDays.length > 0 || groupEvents.length > 0 ? (
              <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 text-slate-900">
                {openDays.length > 0 ? (
                  <div>
                    <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
                      {t('Horários do dia', 'Horarios del día', 'Day schedules')}
                    </h2>
                    <ul className="mt-3 space-y-2">
                      {openDays.map((day) => (
                        <li
                          key={day.id}
                          className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-slate-900">{day.title}</p>
                            <p className="text-xs text-slate-600">
                              {labelOpenDay(day.dayYmd)} · {minutesToHm(day.startMin)}–{minutesToHm(day.endMin)} ·{' '}
                              {day.slotMinutes} min · {t('1:1', '1:1', '1:1')}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={(event) => openShareMenu(day.publicUrl, event.currentTarget)}
                            className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800"
                          >
                            <Share2 className="h-3.5 w-3.5" />
                            {t('Partilhar', 'Compartir', 'Share')}
                          </button>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => void removeOpenDay(day.id)}
                            className="rounded-full p-1.5 text-slate-500 hover:bg-slate-200"
                            title={t('Remover', 'Eliminar', 'Remove')}
                            aria-label={t('Remover', 'Eliminar', 'Remove')}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {groupEvents.length > 0 ? (
                  <div>
                    <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
                      {t('Eventos / capacitações', 'Eventos / capacitaciones', 'Events / training')}
                    </h2>
                    <ul className="mt-3 space-y-2">
                      {groupEvents.map((event) => (
                        <li
                          key={event.id}
                          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-slate-900">{event.title}</p>
                              <p className="text-xs text-slate-600">
                                {labelOpenDay(event.dayYmd)} · {minutesToHm(event.startMin)}–
                                {minutesToHm(event.endMin)} · {event.registrationCount}{' '}
                                {t('inscritos', 'inscritos', 'registered')}
                                {event.capacity != null ? ` / ${event.capacity}` : ''}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedGroupEventId((id) => (id === event.id ? null : event.id))
                              }
                              className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800"
                            >
                              <Users className="h-3.5 w-3.5" />
                              {t('Inscritos', 'Inscritos', 'Registrants')}
                            </button>
                            <button
                              type="button"
                              onClick={(ev) => openShareMenu(event.publicUrl, ev.currentTarget)}
                              className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800"
                            >
                              <Share2 className="h-3.5 w-3.5" />
                              {t('Partilhar', 'Compartir', 'Share')}
                            </button>
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => void removeGroupEvent(event.id)}
                              className="rounded-full p-1.5 text-slate-500 hover:bg-slate-200"
                              title={t('Remover', 'Eliminar', 'Remove')}
                              aria-label={t('Remover', 'Eliminar', 'Remove')}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                          {expandedGroupEventId === event.id ? (
                            <ul className="mt-2 space-y-1 border-t border-slate-200 pt-2">
                              {(event.registrations || []).length === 0 ? (
                                <li className="text-xs text-slate-500">
                                  {t('Ainda sem inscritos.', 'Aún sin inscritos.', 'No registrants yet.')}
                                </li>
                              ) : (
                                (event.registrations || []).map((reg) => (
                                  <li key={reg.id} className="text-xs text-slate-700">
                                    <span className="font-semibold text-slate-900">{reg.name}</span>
                                    {' · '}
                                    {reg.email}
                                    {reg.phone ? ` · ${reg.phone}` : ''}
                                    {' · '}
                                    {reg.mode}
                                    {reg.note ? (
                                      <span className="block text-slate-500">{reg.note}</span>
                                    ) : null}
                                  </li>
                                ))
                              )}
                            </ul>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </section>
            ) : null}

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
              <label id="agenda-slot-duration" className="block text-sm md:col-span-2">
                <span className="mb-1 block font-medium text-slate-800">
                  {t('Duração de cada reunião', 'Duración de cada reunión', 'Length of each meeting')}
                </span>
                <select value={slotMinutes} onChange={(e) => setSlotMinutes(Number(e.target.value))} className={FIELD}>
                  {BOOKING_SLOT_MINUTE_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n === 60
                        ? t('1 hora', '1 hora', '1 hour')
                        : n === 120
                          ? t('2 horas', '2 horas', '2 hours')
                          : `${n} min`}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-xs text-slate-600">
                  {t(
                    'A agenda gera horários com esta duração. O convidado escolhe só o início.',
                    'La agenda genera horarios con esta duración. El invitado solo elige el inicio.',
                    'The agenda lays out slots of this length. Guests only pick a start time.',
                  )}
                </span>
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
                  const proposal = counter[request.id] || { start: '' };
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
                          <label className="text-sm">
                            <span className="mb-1 block text-slate-600">{t('Novo início', 'Nuevo inicio', 'New start')}</span>
                            <input
                              type="datetime-local"
                              value={proposal.start}
                              onChange={(e) => setCounter({ ...counter, [request.id]: { start: e.target.value } })}
                              className={FIELD}
                            />
                          </label>
                          <button
                            type="button"
                            disabled={saving || !proposal.start}
                            onClick={() => {
                              const proposedStartsAt = wallToIso(proposal.start);
                              const proposedEndsAt = new Date(
                                new Date(proposedStartsAt).getTime() + slotMinutes * 60_000,
                              ).toISOString();
                              void act(request.id, 'counter', { proposedStartsAt, proposedEndsAt });
                            }}
                            className="rounded-full border border-teal-700 px-3 py-2 text-sm font-semibold text-teal-900"
                          >
                            {t('Propor outro horário', 'Proponer otro horario', 'Propose another time')}
                            {` (${slotMinutes} min)`}
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
      {shareOpen && sharePos && shareTargetUrl ? (
        <div
          role="menu"
          ref={shareMenuRef}
          className="fixed z-[70] w-44 rounded-xl border border-[color:var(--sys-line)] bg-[color:var(--sys-panel)] p-1 shadow-lg"
          style={{ top: sharePos.top, left: sharePos.left }}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => void copyText(shareTargetUrl)}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-[color:var(--sys-ink)] hover:bg-[color:var(--sys-nav-hover)]"
          >
            {copied === shareTargetUrl ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied === shareTargetUrl ? t('Copiado', 'Copiado', 'Copied') : t('Copiar enlace', 'Copiar enlace', 'Copy link')}
          </button>
          <a
            role="menuitem"
            href={`mailto:?subject=${encodeURIComponent(
              shareMailSubject(shareTargetUrl),
            )}&body=${encodeURIComponent(publicShareText(shareTargetUrl))}`}
            onClick={() => {
              setShareOpen(false);
              setShareTargetUrl(null);
            }}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-[color:var(--sys-ink)] hover:bg-[color:var(--sys-nav-hover)]"
          >
            <Mail className="h-4 w-4" />
            {t('E-mail', 'Correo', 'Email')}
          </a>
          <a
            role="menuitem"
            href={`https://wa.me/?text=${encodeURIComponent(publicShareText(shareTargetUrl))}`}
            target="_blank"
            rel="noreferrer"
            onClick={() => {
              setShareOpen(false);
              setShareTargetUrl(null);
            }}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-[color:var(--sys-ink)] hover:bg-[color:var(--sys-nav-hover)]"
          >
            {t('WhatsApp', 'WhatsApp', 'WhatsApp')}
          </a>
        </div>
      ) : null}
      {activityDialogOpen ? (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-4"
          onClick={() => setActivityDialogOpen(false)}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="agenda-activity-title"
            className="etholys-meet-light max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 text-slate-900 shadow-2xl sm:rounded-2xl"
            style={{ colorScheme: 'light' }}
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              if (activityKind === 'slots') void createOpenDay();
              else if (activityKind === 'group') void createGroupEvent();
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 id="agenda-activity-title" className="text-lg font-semibold text-slate-900">
                {activityKind === 'slots'
                  ? t('Horários do dia', 'Horarios del día', 'Day schedule')
                  : activityKind === 'group'
                    ? t('Evento / capacitação', 'Evento / capacitación', 'Event / training')
                    : t('Criar atividade', 'Crear actividad', 'Create activity')}
              </h2>
              <button
                type="button"
                onClick={() => setActivityDialogOpen(false)}
                className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
                aria-label={t('Cancelar', 'Cancelar', 'Cancel')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {!activityKind ? (
              <div className="mt-4 space-y-3">
                <p className="text-sm text-slate-600">
                  {t(
                    'Escolha o tipo de atividade. O título é livre — pode chamar como quiser.',
                    'Elige el tipo de actividad. El título es libre — puedes llamarlo como quieras.',
                    'Choose the activity type. The title is free text — name it however you want.',
                  )}
                </p>
                <button
                  type="button"
                  onClick={() => setActivityKind('slots')}
                  className="flex w-full flex-col items-start gap-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-left hover:border-teal-700 hover:bg-teal-50"
                >
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Clock className="h-4 w-4 text-teal-800" />
                    {t('Horários / atendimento', 'Horarios / atención', 'Slots / office hours')}
                  </span>
                  <span className="text-xs text-slate-600">
                    {t(
                      '1:1 — o convidado escolhe só um horário de início na janela do dia.',
                      '1:1 — el invitado solo elige una hora de inicio en la ventana del día.',
                      '1:1 — guest picks only a start time within the day window.',
                    )}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setActivityKind('group')}
                  className="flex w-full flex-col items-start gap-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-left hover:border-teal-700 hover:bg-teal-50"
                >
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Users className="h-4 w-4 text-teal-800" />
                    {t('Evento / capacitação', 'Evento / capacitación', 'Event / training')}
                  </span>
                  <span className="text-xs text-slate-600">
                    {t(
                      'Grupo — várias pessoas inscrevem-se no mesmo bloco (formulário, sem grelha de slots).',
                      'Grupo — varias personas se inscriben al mismo bloque (formulario, sin rejilla de slots).',
                      'Group — many people register for the same block (form, no slot grid).',
                    )}
                  </span>
                </button>
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => setActivityDialogOpen(false)}
                    className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800"
                  >
                    {t('Cancelar', 'Cancelar', 'Cancel')}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setActivityKind(null)}
                  className="mt-2 text-xs font-semibold text-teal-800"
                >
                  {t('← Mudar tipo', '← Cambiar tipo', '← Change type')}
                </button>
                <p className="mt-1 text-sm text-slate-600">
                  {activityKind === 'slots'
                    ? t(
                        'Link público com horários livres desse dia. O convidado marca um atendimento 1:1.',
                        'Enlace público con horarios libres de ese día. El invitado reserva una atención 1:1.',
                        'Public link with open times that day. Guests book a 1:1 slot.',
                      )
                    : t(
                        'Link público de inscrição no evento completo — todos no mesmo horário.',
                        'Enlace público de inscripción al evento completo — todos en el mismo horario.',
                        'Public registration link for the whole event — everyone in the same block.',
                      )}
                </p>
                <label className="mt-4 block text-sm font-medium text-slate-700">
                  {t('Data', 'Fecha', 'Date')}
                  <input
                    type="date"
                    required
                    value={openDayYmd}
                    onChange={(event) => setOpenDayYmd(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900"
                  />
                </label>
                <label className="mt-3 block text-sm font-medium text-slate-700">
                  {t('Título (opcional)', 'Título (opcional)', 'Title (optional)')}
                  <input
                    value={openDayTitle}
                    onChange={(event) => setOpenDayTitle(event.target.value)}
                    placeholder={
                      activityKind === 'slots'
                        ? t('Ex.: Atendimento técnico', 'Ej.: Atención técnica', 'E.g. Technical assistance')
                        : t('Ex.: Capacitação aberta', 'Ej.: Capacitación abierta', 'E.g. Open training')
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900"
                  />
                </label>
                <label className="mt-3 block text-sm font-medium text-slate-700">
                  {t('Notas (opcional)', 'Notas (opcional)', 'Notes (optional)')}
                  <textarea
                    value={openDayDescription}
                    onChange={(event) => setOpenDayDescription(event.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900"
                  />
                </label>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="text-sm font-medium text-slate-700">
                    {t('Início', 'Inicio', 'Start')}
                    <input
                      type="time"
                      required
                      value={openDayStartHm}
                      onChange={(event) => setOpenDayStartHm(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900"
                    />
                  </label>
                  <label className="text-sm font-medium text-slate-700">
                    {t('Fim', 'Fin', 'End')}
                    <input
                      type="time"
                      required
                      value={openDayEndHm}
                      onChange={(event) => setOpenDayEndHm(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900"
                    />
                  </label>
                </div>
                {activityKind === 'slots' ? (
                  <label className="mt-3 block text-sm font-medium text-slate-700">
                    {t('Duração de cada atendimento', 'Duración de cada atención', 'Length of each slot')}
                    <select
                      value={openDaySlotMinutes}
                      onChange={(event) => setOpenDaySlotMinutes(Number(event.target.value))}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900"
                    >
                      {BOOKING_SLOT_MINUTE_OPTIONS.map((n) => (
                        <option key={n} value={n}>
                          {n === 60
                            ? t('1 hora', '1 hora', '1 hour')
                            : n === 120
                              ? t('2 horas', '2 horas', '2 hours')
                              : `${n} min`}
                        </option>
                      ))}
                    </select>
                    <span className="mt-1 block text-xs font-normal text-slate-600">
                      {t(
                        'O convidado escolhe só o horário de início.',
                        'El invitado solo elige la hora de inicio.',
                        'Guests only pick a start time.',
                      )}
                    </span>
                  </label>
                ) : (
                  <label className="mt-3 block text-sm font-medium text-slate-700">
                    {t('Capacidade (opcional)', 'Capacidad (opcional)', 'Capacity (optional)')}
                    <input
                      type="number"
                      min={1}
                      max={10000}
                      value={groupCapacity}
                      onChange={(event) => setGroupCapacity(event.target.value)}
                      placeholder={t('Sem limite', 'Sin límite', 'No limit')}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900"
                    />
                  </label>
                )}
                <label className="mt-3 block text-sm font-medium text-slate-700">
                  {t('Local (opcional)', 'Lugar (opcional)', 'Place (optional)')}
                  <input
                    value={openDayLocation}
                    onChange={(event) => setOpenDayLocation(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900"
                  />
                </label>
                <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-800">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={openDayVirtual}
                      onChange={(e) => setOpenDayVirtual(e.target.checked)}
                    />
                    {t('Virtual', 'Virtual', 'Virtual')}
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={openDayInPerson}
                      onChange={(e) => setOpenDayInPerson(e.target.checked)}
                    />
                    {t('Presencial', 'Presencial', 'In person')}
                  </label>
                </div>
                {error ? <p className="mt-3 text-sm text-red-800">{error}</p> : null}
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setActivityDialogOpen(false)}
                    className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800"
                  >
                    {t('Cancelar', 'Cancelar', 'Cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={saving || !openDayYmd}
                    className="rounded-full bg-teal-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {saving ? '…' : t('Criar e copiar link', 'Crear y copiar enlace', 'Create and copy link')}
                  </button>
                </div>
              </>
            )}
          </form>
        </div>
      ) : null}
      {blockDialogOpen ? (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-4"
          onClick={() => setBlockDialogOpen(false)}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="agenda-block-title"
            className="etholys-meet-light w-full max-w-md rounded-t-2xl bg-white p-5 text-slate-900 shadow-2xl sm:rounded-2xl"
            style={{ colorScheme: 'light' }}
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              void closeRange();
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 id="agenda-block-title" className="text-lg font-semibold text-slate-900">
                {t('Fechar horário', 'Cerrar horario', 'Close a time')}
              </h2>
              <button
                type="button"
                onClick={() => setBlockDialogOpen(false)}
                className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
                aria-label={t('Cancelar', 'Cancelar', 'Cancel')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              {t(
                'Este horário deixa de aceitar marcações.',
                'Este horario deja de aceptar reservas.',
                'This time will no longer accept bookings.',
              )}
            </p>
            <label className="mt-4 block text-sm font-medium text-slate-700">
              {t('Motivo (opcional)', 'Motivo (opcional)', 'Reason (optional)')}
              <input
                value={blockLabel}
                onChange={(event) => setBlockLabel(event.target.value)}
                placeholder={t('Reunião interna', 'Reunión interna', 'Internal meeting')}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900"
              />
            </label>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">
                {t('Início', 'Inicio', 'Start')}
                <input
                  type="datetime-local"
                  required
                  value={blockStart}
                  onChange={(event) => setBlockStart(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900"
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                {t('Fim', 'Fin', 'End')}
                <input
                  type="datetime-local"
                  required
                  value={blockEnd}
                  onChange={(event) => setBlockEnd(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900"
                />
              </label>
            </div>
            {error ? <p className="mt-3 text-sm text-red-800">{error}</p> : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setBlockDialogOpen(false)}
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800"
              >
                {t('Cancelar', 'Cancelar', 'Cancel')}
              </button>
              <button
                type="submit"
                disabled={saving || !blockStart || !blockEnd || blockEnd <= blockStart}
                className="rounded-full bg-teal-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving ? '…' : t('Fechar horário', 'Cerrar horario', 'Close time')}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
