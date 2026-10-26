'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, Video } from 'lucide-react';
import { useApp } from '@/app/providers';
import ChorusAgendaOrganizer from '@/components/meet/ChorusAgendaOrganizer';
import { minutesToHm } from '@/lib/meet/booking-slots';

type Slot = { date: string; startsAt: string; endsAt: string };
type Agenda = {
  page: {
    title: string;
    description: string | null;
    timeZone: string;
    slotMinutes: number;
    allowVirtual: boolean;
    allowInPerson: boolean;
    locationText: string | null;
    ownerName: string | null;
    dayYmd: string;
    startMin: number;
    endMin: number;
  };
  slots: Slot[];
};

const ERRORS: Record<string, [string, string, string]> = {
  slot_taken: ['Esse horário já não está livre.', 'Ese horario ya no está libre.', 'That time is no longer open.'],
  email_invalid: ['E-mail inválido.', 'Correo inválido.', 'Invalid email.'],
  name_required: ['Indique o seu nome.', 'Indica tu nombre.', 'Enter your name.'],
  mode_invalid: ['Escolha virtual ou presencial.', 'Elige virtual o presencial.', 'Choose virtual or in person.'],
  not_found: ['Dia não encontrado.', 'Día no encontrado.', 'Day not found.'],
};

export default function ChorusPublicOpenDay() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const code = params.code;
  const { locale } = useApp();
  const t = (pt: string, es: string, en: string) => (locale === 'pt' ? pt : locale === 'es' ? es : en);
  const intl = locale === 'pt' ? 'pt-BR' : locale === 'en' ? 'en-US' : 'es-ES';

  const [agenda, setAgenda] = useState<Agenda | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mode, setMode] = useState<'virtual' | 'presencial'>('virtual');
  const [locationText, setLocationText] = useState('');
  const [note, setNote] = useState('');
  const [guests, setGuests] = useState<{ name: string; email: string }[]>([{ name: '', email: '' }]);
  const [saving, setSaving] = useState(false);
  const [ownerCompanyId, setOwnerCompanyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/meet/public/agenda/d/${encodeURIComponent(code)}`, {
          credentials: 'include',
        });
        const data = (await res.json()) as Agenda & { error?: string; viewer?: string; companyId?: string };
        if (!res.ok) throw new Error(data.error || 'not_found');
        if (cancelled) return;
        if (data.viewer === 'owner' && data.companyId) {
          setOwnerCompanyId(data.companyId);
          return;
        }
        setAgenda(data);
        const firstMode = data.page.allowVirtual ? 'virtual' : 'presencial';
        setMode(firstMode);
        setLocationText(data.page.locationText || '');
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'not_found');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  function labelDay(ymd: string) {
    const [y, m, d] = ymd.split('-').map(Number);
    return new Date(Date.UTC(y, (m || 1) - 1, d || 1)).toLocaleDateString(intl, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }

  function labelTime(iso: string) {
    return new Date(iso).toLocaleTimeString(intl, {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: agenda?.page.timeZone || 'UTC',
    });
  }

  async function submit() {
    if (!slot || !agenda) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/meet/public/agenda/d/${encodeURIComponent(code)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          mode,
          startsAt: slot.startsAt,
          endsAt: new Date(
            new Date(slot.startsAt).getTime() + agenda.page.slotMinutes * 60_000,
          ).toISOString(),
          note,
          locationText: mode === 'presencial' ? locationText : null,
          guests: guests.filter((guest) => guest.email.trim()),
          locale,
        }),
      });
      const data = (await res.json()) as { statusPath?: string; error?: string };
      if (!res.ok || !data.statusPath) throw new Error(data.error || 'slot_taken');
      router.push(data.statusPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'slot_taken');
      setSaving(false);
    }
  }

  const errText = error ? (ERRORS[error] ? t(...ERRORS[error]) : error) : null;

  if (ownerCompanyId) {
    return <ChorusAgendaOrganizer lockedCompanyId={ownerCompanyId} />;
  }

  const field =
    'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 [color-scheme:light]';

  return (
    <div className="etholys-meet-light min-h-dvh bg-slate-50 text-slate-900" style={{ colorScheme: 'light' }}>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-700 to-slate-900">
            <Video className="h-4 w-4 text-teal-50" />
          </span>
          <div>
            <p className="text-sm font-semibold tracking-[0.12em]">CHORUS</p>
            <p className="text-xs text-slate-500">
              {t('Horários do dia', 'Horarios del día', 'Day schedule')}
            </p>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-7 w-7 animate-spin text-teal-700" />
          </div>
        ) : !agenda ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{errText}</p>
        ) : (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold">{agenda.page.title}</h1>
              {agenda.page.ownerName ? (
                <p className="mt-1 text-sm text-slate-600">{agenda.page.ownerName}</p>
              ) : null}
              <p className="mt-2 text-base font-medium text-teal-900">{labelDay(agenda.page.dayYmd)}</p>
              {agenda.page.description ? (
                <p className="mt-3 text-sm leading-relaxed text-slate-700">{agenda.page.description}</p>
              ) : null}
              <p className="mt-2 text-xs text-slate-500">
                {minutesToHm(agenda.page.startMin)}–{minutesToHm(agenda.page.endMin)} ·{' '}
                {t('Cada reunião', 'Cada reunión', 'Each meeting')}: {agenda.page.slotMinutes} min ·{' '}
                {agenda.page.timeZone}
              </p>
            </div>

            {errText ? (
              <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{errText}</p>
            ) : null}

            {agenda.slots.length === 0 ? (
              <p className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
                {t(
                  'Não há horários abertos neste dia.',
                  'No hay horarios abertos en este día.',
                  'There are no open times on this day.',
                )}
              </p>
            ) : (
              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">
                  {t('Escolha o horário de início', 'Elige la hora de inicio', 'Pick a start time')}
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {agenda.slots.map((item) => (
                    <button
                      key={item.startsAt}
                      type="button"
                      onClick={() => setSlot(item)}
                      className={`rounded-xl px-3 py-3 text-sm font-semibold ${
                        slot?.startsAt === item.startsAt
                          ? 'bg-teal-800 text-white'
                          : 'bg-white text-teal-950 ring-1 ring-slate-300 hover:bg-teal-50'
                      }`}
                    >
                      {labelTime(item.startsAt)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {slot ? (
              <form
                className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submit();
                }}
              >
                <p className="text-sm font-medium text-slate-700">
                  {labelDay(slot.date)} · {t('Início', 'Inicio', 'Start')} {labelTime(slot.startsAt)} ·{' '}
                  {agenda.page.slotMinutes} min
                </p>
                {agenda.page.allowVirtual && agenda.page.allowInPerson ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setMode('virtual')}
                      className={`rounded-full px-3 py-2 text-sm font-semibold ${
                        mode === 'virtual' ? 'bg-teal-800 text-white' : 'bg-slate-200 text-slate-900'
                      }`}
                    >
                      {t('Virtual', 'Virtual', 'Virtual')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('presencial')}
                      className={`rounded-full px-3 py-2 text-sm font-semibold ${
                        mode === 'presencial' ? 'bg-teal-800 text-white' : 'bg-slate-200 text-slate-900'
                      }`}
                    >
                      {t('Presencial', 'Presencial', 'In person')}
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-slate-600">
                    {mode === 'virtual'
                      ? t('Reunião virtual', 'Reunión virtual', 'Virtual meeting')
                      : t('Reunião presencial', 'Reunión presencial', 'In-person meeting')}
                  </p>
                )}
                {mode === 'virtual' ? (
                  <p className="text-xs text-slate-500">
                    {t(
                      'Quando o organizador aceitar, a sala CHORUS é criada e o link chega por e-mail, se o envio estiver ativo.',
                      'Cuando quien organiza acepte, se crea la sala CHORUS y el enlace llega por correo, si el envío está activo.',
                      'When the organizer accepts, a CHORUS room is created and the link is emailed if mail is configured.',
                    )}
                  </p>
                ) : (
                  <label className="block text-sm">
                    <span className="mb-1 block text-slate-600">{t('Local', 'Lugar', 'Place')}</span>
                    <input
                      value={locationText}
                      onChange={(event) => setLocationText(event.target.value)}
                      className={field}
                      placeholder={agenda.page.locationText || ''}
                    />
                  </label>
                )}
                <label className="block text-sm">
                  <span className="mb-1 block text-slate-600">{t('Nome', 'Nombre', 'Name')}</span>
                  <input required value={name} onChange={(event) => setName(event.target.value)} className={field} />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-slate-600">{t('E-mail', 'Correo', 'Email')}</span>
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className={field}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-slate-600">{t('Nota', 'Nota', 'Note')}</span>
                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    rows={3}
                    className={field}
                  />
                </label>
                <div className="space-y-2">
                  <p className="text-sm text-slate-600">{t('Convidados', 'Invitados', 'Guests')}</p>
                  {guests.map((guest, index) => (
                    <div key={index} className="grid gap-2 sm:grid-cols-2">
                      <input
                        value={guest.name}
                        onChange={(event) => {
                          const next = [...guests];
                          next[index] = { ...guest, name: event.target.value };
                          setGuests(next);
                        }}
                        placeholder={t('Nome', 'Nombre', 'Name')}
                        className={field}
                      />
                      <input
                        value={guest.email}
                        onChange={(event) => {
                          const next = [...guests];
                          next[index] = { ...guest, email: event.target.value };
                          setGuests(next);
                        }}
                        placeholder={t('E-mail', 'Correo', 'Email')}
                        className={field}
                      />
                    </div>
                  ))}
                  {guests.length < 15 ? (
                    <button
                      type="button"
                      onClick={() => setGuests([...guests, { name: '', email: '' }])}
                      className="text-sm font-medium text-teal-800"
                    >
                      {t('Adicionar convidado', 'Añadir invitado', 'Add guest')}
                    </button>
                  ) : null}
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-full bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {t('Pedir este horário', 'Pedir este horario', 'Request this time')}
                </button>
                <p className="text-xs text-slate-500">
                  {t(
                    'O horário fica pendente até o organizador aceitar. Não é preciso criar conta.',
                    'El horario queda pendiente hasta que quien organiza acepte. No hace falta crear una cuenta.',
                    'The time stays pending until the organizer accepts. No account is required.',
                  )}
                </p>
              </form>
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
}
