'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Copy, Loader2, Video } from 'lucide-react';
import { useApp } from '@/app/providers';
import { useEnsureActiveCompany } from '@/hooks/useEnsureActiveCompany';
import { CompanyPicker } from '@/components/hub/CompanyPicker';
import { hmToMinutes, minutesToHm } from '@/lib/meet/booking-slots';
import { meetWallTimeToUtc } from '@/lib/meet/timezone';

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
    windows: { weekday: number; startMin: number; endMin: number }[];
    blocks: { id: string; startsAt: string; endsAt: string }[];
  };
  requests: RequestRow[];
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

export default function ChorusAgendaOrganizer() {
  const { locale } = useApp();
  const t = (pt: string, es: string, en: string) => (locale === 'pt' ? pt : locale === 'es' ? es : en);
  const intl = locale === 'pt' ? 'pt-BR' : locale === 'en' ? 'en-US' : 'es-ES';
  const { companies, companiesReady, companiesLoadError, companyId, setActiveCompanyId, reloadCompanies } =
    useEnsureActiveCompany();

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

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/meet/agenda?companyId=${encodeURIComponent(companyId)}`);
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
      setWindows(windowsFromPage(data.page.windows));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'error');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

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
          windows: windows
            .filter((row) => row.enabled)
            .map((row) => ({ weekday: row.weekday, startMin: row.startMin, endMin: row.endMin })),
        }),
      });
      const data = (await res.json()) as Agenda & { error?: string };
      if (!res.ok) throw new Error(data.error || 'error');
      setAgenda(data);
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
      body: JSON.stringify({ companyId, action: 'remove-block', blockId }),
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

  return (
    <div className="min-h-dvh bg-white text-slate-900">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3">
          <Link href="/hub/meet" className="inline-flex items-center gap-1 text-sm font-medium text-slate-600">
            <ArrowLeft className="h-4 w-4" />
            CHORUS
          </Link>
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-700 to-slate-900">
            <Video className="h-4 w-4 text-teal-50" />
          </span>
          <h1 className="text-lg font-semibold">{t('Agenda pública', 'Agenda pública', 'Public agenda')}</h1>
          <CompanyPicker
            companies={companies}
            activeCompanyId={companyId}
            onSelect={setActiveCompanyId}
            ready={companiesReady}
            error={companiesLoadError}
            onRetry={() => void reloadCompanies()}
            locale={locale}
            className="ml-auto"
          />
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
            <section className="rounded-2xl border border-slate-200 p-4">
              <p className="text-sm text-slate-600">
                {t(
                  'Envie este link. Quem abrir escolhe o dia e a hora, sem conta Etholys.',
                  'Envía este enlace. Quien lo abra elige el día y la hora, sin cuenta Etholys.',
                  'Share this link. People pick a day and time without an Etholys account.',
                )}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <code className="break-all rounded-lg bg-slate-100 px-3 py-2 text-sm">{agenda.page.publicUrl}</code>
                <button
                  type="button"
                  onClick={() => void copyText(agenda.page.publicUrl)}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-2 text-sm font-medium text-teal-800"
                >
                  {copied === agenda.page.publicUrl ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {t('Copiar', 'Copiar', 'Copy')}
                </button>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                {t(
                  'Quem tem Google Calendar ligado em CHORUS recebe a reunião confirmada nesse calendário. Quem reserva pode descarregar .ics ou abrir Google e Outlook.',
                  'Quien tiene Google Calendar conectado en CHORUS recibe la reunión confirmada en ese calendario. Quien reserva puede descargar .ics o abrir Google y Outlook.',
                  'If Google Calendar is connected in CHORUS, a confirmed meeting is added there. Bookers can download .ics or open Google and Outlook.',
                )}
              </p>
            </section>

            <section className="grid gap-4 rounded-2xl border border-slate-200 p-4 md:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block text-slate-600">{t('Título', 'Título', 'Title')}</span>
                <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2" />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-slate-600">{t('Fuso horário', 'Zona horaria', 'Timezone')}</span>
                <select value={timeZone} onChange={(e) => setTimeZone(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2">
                  {(agenda.timeZones || [timeZone]).map((zone) => (
                    <option key={zone} value={zone}>{zone}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm md:col-span-2">
                <span className="mb-1 block text-slate-600">{t('Descrição', 'Descripción', 'Description')}</span>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full rounded-xl border border-slate-200 px-3 py-2" />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-slate-600">{t('Duração', 'Duración', 'Length')}</span>
                <select value={slotMinutes} onChange={(e) => setSlotMinutes(Number(e.target.value))} className="w-full rounded-xl border border-slate-200 px-3 py-2">
                  {[15, 30, 45, 60, 90].map((n) => (
                    <option key={n} value={n}>{n} min</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-slate-600">{t('Local presencial', 'Lugar presencial', 'In-person place')}</span>
                <input value={locationText} onChange={(e) => setLocationText(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2" />
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
                        className="rounded-lg border border-slate-200 px-2 py-1"
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
                        className="rounded-lg border border-slate-200 px-2 py-1"
                      />
                    </div>
                  );
                })}
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveSettings()}
                className="rounded-full bg-teal-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {t('Guardar agenda', 'Guardar agenda', 'Save agenda')}
              </button>
            </section>

            <section className="rounded-2xl border border-slate-200 p-4">
              <h2 className="text-base font-semibold">{t('Fechar horário', 'Cerrar horario', 'Close a time')}</h2>
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <label className="text-sm">
                  <span className="mb-1 block text-slate-600">{t('Início', 'Inicio', 'Start')}</span>
                  <input type="datetime-local" value={blockStart} onChange={(e) => setBlockStart(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2" />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-slate-600">{t('Fim', 'Fin', 'End')}</span>
                  <input type="datetime-local" value={blockEnd} onChange={(e) => setBlockEnd(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2" />
                </label>
                <button type="button" onClick={() => void closeRange()} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold">
                  {t('Fechar', 'Cerrar', 'Close')}
                </button>
              </div>
              <ul className="mt-3 space-y-1 text-sm">
                {agenda.page.blocks.map((block) => (
                  <li key={block.id} className="flex items-center justify-between gap-2">
                    <span>{formatWhen(block.startsAt)} – {formatWhen(block.endsAt)}</span>
                    <button type="button" onClick={() => void removeBlock(block.id)} className="text-teal-800">
                      {t('Reabrir', 'Reabrir', 'Reopen')}
                    </button>
                  </li>
                ))}
              </ul>
            </section>

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
                    <article key={request.id} className="rounded-2xl border border-slate-200 p-4">
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
                          <input type="datetime-local" value={proposal.start} onChange={(e) => setCounter({ ...counter, [request.id]: { ...proposal, start: e.target.value } })} className="rounded-xl border border-slate-200 px-2 py-2 text-sm" />
                          <input type="datetime-local" value={proposal.end} onChange={(e) => setCounter({ ...counter, [request.id]: { ...proposal, end: e.target.value } })} className="rounded-xl border border-slate-200 px-2 py-2 text-sm" />
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
