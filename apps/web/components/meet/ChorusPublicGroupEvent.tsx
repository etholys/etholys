'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Check, Loader2, Video } from 'lucide-react';
import { useApp } from '@/app/providers';
import ChorusAgendaOrganizer from '@/components/meet/ChorusAgendaOrganizer';
import { minutesToHm } from '@/lib/meet/booking-slots';

type Agenda = {
  page: {
    title: string;
    description: string | null;
    timeZone: string;
    allowVirtual: boolean;
    allowInPerson: boolean;
    locationText: string | null;
    ownerName: string | null;
    dayYmd: string;
    startMin: number;
    endMin: number;
    capacity: number | null;
    registrationCount: number;
    spotsLeft: number | null;
    full: boolean;
  };
};

const ERRORS: Record<string, [string, string, string]> = {
  email_invalid: ['E-mail inválido.', 'Correo inválido.', 'Invalid email.'],
  name_required: ['Indique o seu nome.', 'Indica tu nombre.', 'Enter your name.'],
  mode_invalid: ['Escolha virtual ou presencial.', 'Elige virtual o presencial.', 'Choose virtual or in person.'],
  not_found: ['Evento não encontrado.', 'Evento no encontrado.', 'Event not found.'],
  event_full: ['Este evento já está completo.', 'Este evento ya está completo.', 'This event is full.'],
  already_registered: [
    'Este e-mail já está inscrito.',
    'Este correo ya está inscrito.',
    'This email is already registered.',
  ],
};

export default function ChorusPublicGroupEvent() {
  const params = useParams<{ code: string }>();
  const code = params.code;
  const { locale } = useApp();
  const t = (pt: string, es: string, en: string) => (locale === 'pt' ? pt : locale === 'es' ? es : en);
  const intl = locale === 'pt' ? 'pt-BR' : locale === 'en' ? 'en-US' : 'es-ES';

  const [agenda, setAgenda] = useState<Agenda | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [mode, setMode] = useState<'virtual' | 'presencial'>('virtual');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [ownerCompanyId, setOwnerCompanyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/meet/public/agenda/e/${encodeURIComponent(code)}`, {
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

  async function submit() {
    if (!agenda) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/meet/public/agenda/e/${encodeURIComponent(code)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, note, mode }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || 'not_found');
      setDone(true);
      setAgenda({
        ...agenda,
        page: {
          ...agenda.page,
          registrationCount: agenda.page.registrationCount + 1,
          spotsLeft:
            agenda.page.spotsLeft == null ? null : Math.max(0, agenda.page.spotsLeft - 1),
          full:
            agenda.page.spotsLeft != null ? agenda.page.spotsLeft - 1 <= 0 : agenda.page.full,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'not_found');
    } finally {
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
              {t('Evento / capacitação', 'Evento / capacitación', 'Event / training')}
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
              <p className="mt-1 text-sm text-slate-700">
                {minutesToHm(agenda.page.startMin)}–{minutesToHm(agenda.page.endMin)} · {agenda.page.timeZone}
              </p>
              {agenda.page.description ? (
                <p className="mt-3 text-sm leading-relaxed text-slate-700">{agenda.page.description}</p>
              ) : null}
              {agenda.page.locationText ? (
                <p className="mt-2 text-sm text-slate-600">
                  {t('Local', 'Lugar', 'Place')}: {agenda.page.locationText}
                </p>
              ) : null}
              {agenda.page.capacity != null ? (
                <p className="mt-2 text-xs text-slate-500">
                  {agenda.page.full
                    ? t('Vagas esgotadas', 'Cupos agotados', 'No spots left')
                    : t(
                        `${agenda.page.spotsLeft} vaga(s) restante(s)`,
                        `${agenda.page.spotsLeft} cupo(s) restante(s)`,
                        `${agenda.page.spotsLeft} spot(s) left`,
                      )}
                </p>
              ) : null}
            </div>

            {errText ? (
              <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{errText}</p>
            ) : null}

            {done ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-6 text-emerald-950">
                <p className="flex items-center gap-2 text-base font-semibold">
                  <Check className="h-5 w-5" />
                  {t('Inscrição confirmada', 'Inscripción confirmada', 'Registration confirmed')}
                </p>
                <p className="mt-2 text-sm">
                  {t(
                    'Recebemos os seus dados. O organizador verá a inscrição na lista do evento.',
                    'Recibimos tus datos. Quien organiza verá la inscripción en la lista del evento.',
                    'We received your details. The organizer will see the registration on the event list.',
                  )}
                </p>
              </div>
            ) : agenda.page.full ? (
              <p className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
                {t(
                  'Este evento já não aceita mais inscrições.',
                  'Este evento ya no acepta más inscripciones.',
                  'This event is no longer accepting registrations.',
                )}
              </p>
            ) : (
              <form
                className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submit();
                }}
              >
                <p className="text-sm font-medium text-slate-800">
                  {t('Formulário de inscrição', 'Formulario de inscripción', 'Registration form')}
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
                      ? t('Participação virtual', 'Participación virtual', 'Virtual attendance')
                      : t('Participação presencial', 'Participación presencial', 'In-person attendance')}
                  </p>
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
                  <span className="mb-1 block text-slate-600">{t('Telefone', 'Teléfono', 'Phone')}</span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    className={field}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-slate-600">{t('Notas', 'Notas', 'Notes')}</span>
                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    rows={3}
                    className={field}
                  />
                </label>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-full bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {t('Inscrever-me', 'Inscribirme', 'Register')}
                </button>
                <p className="text-xs text-slate-500">
                  {t(
                    'Inscrição no evento completo — não escolhe horário individual. Não é preciso criar conta.',
                    'Inscripción al evento completo — no eliges horario individual. No hace falta crear una cuenta.',
                    'Registers for the whole event — no individual time slot. No account is required.',
                  )}
                </p>
              </form>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
