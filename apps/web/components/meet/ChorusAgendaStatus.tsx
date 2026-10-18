'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, Video } from 'lucide-react';
import { useApp } from '@/app/providers';

type StatusPayload = {
  request: {
    status: string;
    mode: string;
    bookerName: string;
    title: string;
    timeZone: string;
    startsAt: string;
    endsAt: string;
    proposedStartsAt: string | null;
    proposedEndsAt: string | null;
    locationText: string | null;
    note: string | null;
    joinUrl: string | null;
    guests: { name: string | null; email: string }[];
  };
  calendar: { googleUrl: string; outlookUrl: string; icsPath: string } | null;
};

const STATUS_LABEL: Record<string, [string, string, string]> = {
  pending: ['Pendente', 'Pendiente', 'Pending'],
  accepted: ['Aceite', 'Aceptada', 'Accepted'],
  declined: ['Recusado', 'Rechazada', 'Declined'],
  counter_proposed: ['Outro horário proposto', 'Otro horario propuesto', 'New time proposed'],
  cancelled: ['Cancelado', 'Cancelada', 'Cancelled'],
};

export default function ChorusAgendaStatus() {
  const params = useParams<{ code: string; token: string }>();
  const { locale } = useApp();
  const t = (pt: string, es: string, en: string) => (locale === 'pt' ? pt : locale === 'es' ? es : en);
  const intl = locale === 'pt' ? 'pt-BR' : locale === 'en' ? 'en-US' : 'es-ES';
  const [data, setData] = useState<StatusPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [mailNote, setMailNote] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/meet/public/agenda/${encodeURIComponent(params.code)}/r/${encodeURIComponent(params.token)}`,
      );
      const body = (await res.json()) as StatusPayload & { error?: string };
      if (!res.ok) throw new Error(body.error || 'not_found');
      setData(body);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'not_found');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.code, params.token]);

  function when(iso: string) {
    return new Date(iso).toLocaleString(intl, {
      dateStyle: 'full',
      timeStyle: 'short',
      timeZone: data?.request.timeZone || 'UTC',
    });
  }

  async function respond(action: 'accept' | 'decline') {
    setBusy(true);
    setMailNote(null);
    try {
      const res = await fetch(
        `/api/meet/public/agenda/${encodeURIComponent(params.code)}/r/${encodeURIComponent(params.token)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, locale }),
        },
      );
      const body = (await res.json()) as StatusPayload & { error?: string };
      if (!res.ok) throw new Error(body.error || 'status_invalid');
      setData(body);
      setMailNote(
        t(
          'Estado atualizado. Se o e-mail não estiver configurado, use os links desta página.',
          'Estado actualizado. Si el correo no está configurado, usa los enlaces de esta página.',
          'Status updated. If email is not configured, use the links on this page.',
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'status_invalid');
    } finally {
      setBusy(false);
    }
  }

  const statusLabel = data
    ? STATUS_LABEL[data.request.status]
      ? t(...STATUS_LABEL[data.request.status])
      : data.request.status
    : '';

  return (
    <div className="etholys-meet-light min-h-dvh bg-slate-50 text-slate-900" style={{ colorScheme: 'light' }}>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-700 to-slate-900">
            <Video className="h-4 w-4 text-teal-50" />
          </span>
          <p className="text-sm font-semibold tracking-[0.12em]">CHORUS</p>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-7 w-7 animate-spin text-teal-700" />
          </div>
        ) : error || !data ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error === 'not_found'
              ? t('Pedido não encontrado.', 'Solicitud no encontrada.', 'Request not found.')
              : error}
          </p>
        ) : (
          <>
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-800">{statusLabel}</p>
              <h1 className="mt-1 text-2xl font-semibold">{data.request.title}</h1>
              <p className="mt-2 text-sm text-slate-700">{when(data.request.startsAt)}</p>
              {data.request.status === 'counter_proposed' && data.request.proposedStartsAt ? (
                <p className="mt-2 text-sm font-medium text-teal-900">
                  {t('Proposta', 'Propuesta', 'Proposal')}: {when(data.request.proposedStartsAt)}
                </p>
              ) : null}
              <p className="mt-2 text-sm text-slate-600">
                {data.request.mode === 'virtual'
                  ? t('Virtual', 'Virtual', 'Virtual')
                  : t('Presencial', 'Presencial', 'In person')}
                {data.request.locationText ? ` · ${data.request.locationText}` : ''}
              </p>
              <p className="mt-1 text-xs text-slate-500">{data.request.timeZone}</p>
              {data.request.joinUrl ? (
                <a
                  href={data.request.joinUrl}
                  className="mt-4 inline-flex rounded-full bg-teal-800 px-4 py-2 text-sm font-semibold text-white"
                >
                  {t('Entrar na sala', 'Entrar a la sala', 'Join room')}
                </a>
              ) : null}
              {data.request.guests.length > 0 ? (
                <ul className="mt-4 space-y-1 text-sm text-slate-700">
                  {data.request.guests.map((guest) => (
                    <li key={guest.email}>
                      {guest.name ? `${guest.name} · ` : ''}
                      {guest.email}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            {data.request.status === 'pending' || data.request.status === 'counter_proposed' ? (
              <div className="flex flex-wrap gap-2">
                {data.request.status === 'counter_proposed' ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void respond('accept')}
                    className="rounded-full bg-teal-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {t('Aceitar horário', 'Aceptar horario', 'Accept time')}
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void respond('decline')}
                  className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60"
                >
                  {data.request.status === 'pending'
                    ? t('Cancelar pedido', 'Cancelar solicitud', 'Cancel request')
                    : t('Recusar', 'Rechazar', 'Decline')}
                </button>
              </div>
            ) : null}

            {mailNote ? <p className="text-sm text-slate-600">{mailNote}</p> : null}

            {data.calendar ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <p className="text-sm font-semibold">
                  {t('Calendário', 'Calendario', 'Calendar')}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {t(
                    'Descarregue o ficheiro ou abra no calendário que preferir. Não é preciso conta Etholys.',
                    'Descarga el archivo o ábrelo en el calendario que prefieras. No hace falta una cuenta Etholys.',
                    'Download the file or open it in the calendar you prefer. An Etholys account is not required.',
                  )}
                </p>
                <div className="mt-3 flex flex-wrap gap-3 text-sm font-medium">
                  <a className="text-teal-800 underline" href={data.calendar.icsPath}>
                    {t('Descarregar .ics', 'Descargar .ics', 'Download .ics')}
                  </a>
                  <a className="text-teal-800 underline" href={data.calendar.googleUrl} target="_blank" rel="noreferrer">
                    Google Calendar
                  </a>
                  <a className="text-teal-800 underline" href={data.calendar.outlookUrl} target="_blank" rel="noreferrer">
                    Outlook
                  </a>
                </div>
              </div>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}
