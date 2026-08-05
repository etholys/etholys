'use client';

import { useMemo, useState } from 'react';
import {
  Bell,
  CalendarDays,
  Clock3,
  FolderKanban,
  Link2,
  Loader2,
  Mail,
  MapPin,
  Users,
  X,
} from 'lucide-react';

export type CalendarProvider = 'google' | 'outlook' | 'none';

type Connections = {
  google: { configured: boolean; connected: boolean; ready: boolean; needsReconnect: boolean };
  outlook: { configured: boolean; connected: boolean; ready: boolean; needsReconnect: boolean };
};

export type ScheduleDraft = {
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  inviteEmails: string[];
  sendInvites: boolean;
  projectId: string | null;
  calendarProvider: CalendarProvider;
};

type Props = {
  locale: string;
  projects: { id: string; name: string }[];
  connections: Connections | null;
  saving: boolean;
  onClose: () => void;
  onConnect: (provider: 'google' | 'azure-ad') => void;
  onSave: (draft: ScheduleDraft) => Promise<void>;
};

function localInputValue(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function MeetScheduleDialog({
  locale,
  projects,
  connections,
  saving,
  onClose,
  onConnect,
  onSave,
}: Props) {
  const t = (pt: string, es: string, en: string) => (locale === 'pt' ? pt : locale === 'es' ? es : en);
  const initial = useMemo(() => {
    const start = new Date();
    start.setMinutes(Math.ceil(start.getMinutes() / 30) * 30, 0, 0);
    const end = new Date(start.getTime() + 60 * 60_000);
    return { start: localInputValue(start), end: localInputValue(end) };
  }, []);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startsAt, setStartsAt] = useState(initial.start);
  const [endsAt, setEndsAt] = useState(initial.end);
  const [inviteText, setInviteText] = useState('');
  const [projectId, setProjectId] = useState('');
  const [sendInvites, setSendInvites] = useState(true);
  const defaultProvider: CalendarProvider = connections?.google.ready
    ? 'google'
    : connections?.outlook.ready
      ? 'outlook'
      : 'none';
  const [calendarProvider, setCalendarProvider] = useState<CalendarProvider>(defaultProvider);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  function updateStart(value: string) {
    setStartsAt(value);
    const nextStart = new Date(value);
    if (Number.isFinite(nextStart.getTime())) {
      setEndsAt(localInputValue(new Date(nextStart.getTime() + 60 * 60_000)));
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    if (!title.trim() || !Number.isFinite(start.getTime()) || end <= start) return;
    await onSave({
      title: title.trim(),
      description: description.trim(),
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      timezone,
      inviteEmails: inviteText
        .split(/[,;\s]+/)
        .map((email) => email.trim().toLowerCase())
        .filter((email) => email.includes('@')),
      sendInvites,
      projectId: projectId || null,
      calendarProvider,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-5">
      <form
        onSubmit={submit}
        className="max-h-[96vh] w-full max-w-4xl overflow-y-auto rounded-t-3xl bg-slate-50 shadow-2xl sm:rounded-3xl"
      >
        <div className="sticky top-0 z-10 flex items-center gap-4 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur sm:px-7">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
            aria-label={t('Fechar', 'Cerrar', 'Close')}
          >
            <X className="h-5 w-5" />
          </button>
          <input
            autoFocus
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={t('Adicionar título', 'Agregar título', 'Add title')}
            className="min-w-0 flex-1 border-b-2 border-sky-600 bg-transparent px-1 py-2 text-xl font-medium text-slate-900 outline-none placeholder:text-slate-400 sm:text-2xl"
          />
          <button
            type="submit"
            disabled={saving || !title.trim() || new Date(endsAt) <= new Date(startsAt)}
            className="inline-flex items-center gap-2 rounded-full bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('Guardar', 'Guardar', 'Save')}
          </button>
        </div>

        <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[1fr_300px]">
          <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="grid gap-3 sm:grid-cols-[32px_1fr]">
              <Clock3 className="mt-2 h-5 w-5 text-slate-500" />
              <div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-medium text-slate-500">
                    {t('Início', 'Inicio', 'Starts')}
                    <input
                      type="datetime-local"
                      required
                      value={startsAt}
                      onChange={(event) => updateStart(event.target.value)}
                      className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </label>
                  <label className="text-xs font-medium text-slate-500">
                    {t('Fim', 'Fin', 'Ends')}
                    <input
                      type="datetime-local"
                      required
                      value={endsAt}
                      min={startsAt}
                      onChange={(event) => setEndsAt(event.target.value)}
                      className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </label>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <span>{timezone}</span>
                  <span>·</span>
                  <span>{t('Não se repete', 'No se repite', 'Does not repeat')}</span>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-[32px_1fr]">
              <Link2 className="mt-2 h-5 w-5 text-sky-600" />
              <div className="rounded-xl bg-sky-50 px-4 py-3">
                <p className="text-sm font-semibold text-sky-900">Etholys Meet</p>
                <p className="mt-0.5 text-xs text-sky-700">
                  {t(
                    'O link seguro da sala será criado ao guardar.',
                    'El enlace seguro de la sala se creará al guardar.',
                    'The secure room link will be created when you save.',
                  )}
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-[32px_1fr]">
              <FolderKanban className="mt-2 h-5 w-5 text-slate-500" />
              <select
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="">{t('Sem projeto vinculado', 'Sin proyecto vinculado', 'No linked project')}</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-3 sm:grid-cols-[32px_1fr]">
              <MapPin className="mt-2 h-5 w-5 text-slate-500" />
              <div className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-500">
                {t('Reunião online', 'Reunión online', 'Online meeting')}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-[32px_1fr]">
              <Bell className="mt-2 h-5 w-5 text-slate-500" />
              <div className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                {t('Notificação 10 minutos antes', 'Notificación 10 minutos antes', 'Notification 10 minutes before')}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-[32px_1fr]">
              <CalendarDays className="mt-2 h-5 w-5 text-slate-500" />
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={6}
                placeholder={t(
                  'Adicionar descrição, pauta ou materiais da reunião',
                  'Agregar descripción, agenda o materiales de la reunión',
                  'Add description, agenda or meeting materials',
                )}
                className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          <aside className="space-y-5">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-slate-500" />
                <h3 className="font-semibold text-slate-900">{t('Convidados', 'Invitados', 'Guests')}</h3>
              </div>
              <textarea
                value={inviteText}
                onChange={(event) => setInviteText(event.target.value)}
                rows={4}
                placeholder={t(
                  'E-mails separados por vírgula',
                  'Emails separados por comas',
                  'Emails separated by commas',
                )}
                className="mt-3 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500"
              />
              <label className="mt-3 flex items-start gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={sendInvites}
                  onChange={(event) => setSendInvites(event.target.checked)}
                  className="mt-0.5 rounded border-slate-300"
                />
                <span>
                  {t(
                    'Enviar convite com botões Google/Outlook e ficheiro .ics',
                    'Enviar invitación con botones Google/Outlook y archivo .ics',
                    'Send invite with Google/Outlook buttons and an .ics file',
                  )}
                </span>
              </label>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-slate-500" />
                <h3 className="font-semibold text-slate-900">
                  {t('O seu calendário', 'Tu calendario', 'Your calendar')}
                </h3>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {t(
                  'Ao escolher uma conta ligada, o evento é criado automaticamente.',
                  'Al elegir una cuenta conectada, el evento se crea automáticamente.',
                  'When you choose a connected account, the event is created automatically.',
                )}
              </p>
              <div className="mt-3 space-y-2">
                <ProviderOption
                  name="Google Calendar"
                  value="google"
                  selected={calendarProvider === 'google'}
                  status={connections?.google}
                  onSelect={() => setCalendarProvider('google')}
                  onConnect={() => onConnect('google')}
                  t={t}
                />
                <ProviderOption
                  name="Microsoft Outlook"
                  value="outlook"
                  selected={calendarProvider === 'outlook'}
                  status={connections?.outlook}
                  onSelect={() => setCalendarProvider('outlook')}
                  onConnect={() => onConnect('azure-ad')}
                  t={t}
                />
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5">
                  <input
                    type="radio"
                    name="calendar"
                    checked={calendarProvider === 'none'}
                    onChange={() => setCalendarProvider('none')}
                  />
                  <span className="text-sm text-slate-700">
                    {t('Só no Etholys', 'Solo en Etholys', 'Etholys only')}
                  </span>
                </label>
              </div>
            </section>
          </aside>
        </div>
      </form>
    </div>
  );
}

function ProviderOption({
  name,
  selected,
  status,
  onSelect,
  onConnect,
  t,
}: {
  name: string;
  value: 'google' | 'outlook';
  selected: boolean;
  status?: { configured: boolean; connected: boolean; ready: boolean; needsReconnect: boolean };
  onSelect: () => void;
  onConnect: () => void;
  t: (pt: string, es: string, en: string) => string;
}) {
  const ready = Boolean(status?.ready);
  return (
    <div
      className={`rounded-xl border px-3 py-2.5 ${
        selected ? 'border-sky-400 bg-sky-50' : 'border-slate-200'
      }`}
    >
      <div className="flex items-center gap-3">
        <input
          type="radio"
          name="calendar"
          checked={selected}
          disabled={!ready}
          onChange={onSelect}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-800">{name}</p>
          <p className={`text-[11px] ${ready ? 'text-emerald-700' : 'text-slate-500'}`}>
            {ready
              ? t('Ligado permanentemente', 'Conectado permanentemente', 'Permanently connected')
              : status?.connected
                ? t('É preciso voltar a autorizar', 'Hay que volver a autorizar', 'Reconnect required')
                : t('Não ligado', 'No conectado', 'Not connected')}
          </p>
        </div>
        {!ready && status?.configured && (
          <button
            type="button"
            onClick={onConnect}
            className="rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-sky-700 ring-1 ring-sky-200 hover:bg-sky-50"
          >
            {status?.connected ? t('Religar', 'Reconectar', 'Reconnect') : t('Ligar', 'Conectar', 'Connect')}
          </button>
        )}
      </div>
    </div>
  );
}
