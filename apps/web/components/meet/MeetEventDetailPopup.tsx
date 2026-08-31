'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Check,
  Copy,
  Calendar,
  Loader2,
  MapPin,
  Pencil,
  Trash2,
  Users,
  Video,
  X,
  FileText,
  MonitorUp,
  Mail,
  UserMinus,
  FolderKanban,
} from 'lucide-react';
import { meetHubJoinPath, meetJoinTargetId, meetRecapPath, meetCapturePath, isGoogleImportedMeetSession } from '@/lib/meet/types';

export type MeetEventParticipant = {
  id: string;
  userId?: string | null;
  email?: string | null;
  displayName?: string | null;
  role: string;
  joinedAt?: string | null;
  user?: { id: string; name: string | null; email: string | null } | null;
};

export type MeetEventDetail = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  scheduledAt: string | null;
  endsAt: string | null;
  meetingUrl: string | null;
  roomSlug?: string;
  projectId?: string | null;
  createdById?: string | null;
  createdBy?: { id: string; name: string | null; email: string | null } | null;
  participants?: MeetEventParticipant[];
  _count?: { participants: number; actionItems: number };
  isPermanent?: boolean;
  recurrence?: string | null;
  seriesId?: string | null;
  seriesParentId?: string | null;
};

type Props = {
  locale: string;
  companyId: string;
  session: MeetEventDetail;
  currentUserId?: string | null;
  googleCalendarReady?: boolean;
  projects?: { id: string; name: string }[];
  onClose: () => void;
  onUpdated: (session: MeetEventDetail) => void;
  onDeleted: (sessionId: string) => void;
};

function localInputValue(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function MeetEventDetailPopup({
  locale,
  companyId,
  session,
  currentUserId,
  googleCalendarReady,
  projects = [],
  onClose,
  onUpdated,
  onDeleted,
}: Props) {
  const t = (pt: string, es: string, en: string) => (locale === 'pt' ? pt : locale === 'es' ? es : en);
  const intl = locale === 'pt' ? 'pt-BR' : locale === 'en' ? 'en-US' : 'es-ES';

  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [calBusy, setCalBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteScope, setDeleteScope] = useState<'this' | 'following' | 'series'>('this');
  const [editScope, setEditScope] = useState<'this' | 'following' | 'series'>('series');
  const [title, setTitle] = useState(session.title);
  const [description, setDescription] = useState(session.description || '');
  const [startsAt, setStartsAt] = useState(
    session.scheduledAt ? localInputValue(new Date(session.scheduledAt)) : '',
  );
  const [endsAt, setEndsAt] = useState(
    session.endsAt ? localInputValue(new Date(session.endsAt)) : '',
  );
  const [projectId, setProjectId] = useState(session.projectId || '');
  const [newInviteText, setNewInviteText] = useState('');
  const [sendInvites, setSendInvites] = useState(true);
  const [notifyAttendees, setNotifyAttendees] = useState(false);
  const [removedParticipantIds, setRemovedParticipantIds] = useState<string[]>([]);
  const [editParticipants, setEditParticipants] = useState<MeetEventParticipant[]>([]);
  const [resendingEmail, setResendingEmail] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  useEffect(() => {
    setTitle(session.title);
    setDescription(session.description || '');
    setStartsAt(session.scheduledAt ? localInputValue(new Date(session.scheduledAt)) : '');
    setEndsAt(session.endsAt ? localInputValue(new Date(session.endsAt)) : '');
    setProjectId(session.projectId || '');
    setNewInviteText('');
    setSendInvites(true);
    setNotifyAttendees(false);
    setRemovedParticipantIds([]);
    setEditParticipants(session.participants ?? []);
    setEditing(false);
    setConfirmDelete(false);
    setDeleteScope('this');
    setEditScope('series');
    setError(null);
    setSaveNotice(null);
  }, [session]);

  async function loadSessionForEdit() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/meet/sessions/${session.id}?companyId=${encodeURIComponent(companyId)}`,
      );
      const data = (await response.json()) as { session?: MeetEventDetail; error?: string };
      if (!response.ok || !data.session) throw new Error(data.error || 'Error');
      setEditParticipants(data.session.participants ?? []);
      setProjectId(data.session.projectId || '');
      setEditing(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  const isOwner = Boolean(
    currentUserId &&
      (session.createdById === currentUserId ||
        session.participants?.some(
          (p) => p.userId === currentUserId && (p.role === 'host' || p.role === 'cohost'),
        )),
  );

  const inSeries = Boolean(session.seriesId || session.seriesParentId || (session.recurrence && session.recurrence !== 'none'));
  const joinId = meetJoinTargetId(session);

  const whenLabel = useMemo(() => {
    if (!session.scheduledAt) {
      return t('Sem data marcada', 'Sin fecha programada', 'No scheduled date');
    }
    const start = new Date(session.scheduledAt);
    const end = session.endsAt ? new Date(session.endsAt) : null;
    const day = new Intl.DateTimeFormat(intl, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(start);
    const hour = new Intl.DateTimeFormat(intl, { hour: 'numeric', minute: '2-digit' });
    return end ? `${day} · ${hour.format(start)} – ${hour.format(end)}` : `${day} · ${hour.format(start)}`;
  }, [session.scheduledAt, session.endsAt, intl, locale]);

  const guests = session.participants ?? [];
  const guestCount = guests.length || session._count?.participants || 0;
  const joinedCount = guests.filter((g) => g.joinedAt).length;

  const visibleEditGuests = editParticipants.filter((g) => !removedParticipantIds.includes(g.id));

  function guestEmail(guest: MeetEventParticipant): string {
    return (guest.email || guest.user?.email || '').trim().toLowerCase();
  }

  function guestName(guest: MeetEventParticipant): string {
    return (
      guest.displayName ||
      guest.user?.name ||
      guest.email ||
      guest.user?.email ||
      t('Convidado', 'Invitado', 'Guest')
    );
  }

  function isOrganizerGuest(guest: MeetEventParticipant): boolean {
    return guest.role === 'host' || guest.userId === session.createdById;
  }

  function removeGuest(guest: MeetEventParticipant) {
    if (isOrganizerGuest(guest)) return;
    setRemovedParticipantIds((prev) => (prev.includes(guest.id) ? prev : [...prev, guest.id]));
  }

  async function resendInvite(email: string) {
    if (!email) return;
    setResendingEmail(email);
    setError(null);
    try {
      const response = await fetch(`/api/meet/sessions/${session.id}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, emails: [email], locale }),
      });
      const data = (await response.json()) as {
        error?: string;
        results?: { email: string; sent: boolean; error?: string }[];
      };
      if (!response.ok) throw new Error(data.error || 'Error');
      const sent = data.results?.[0]?.sent;
      setSaveNotice(
        sent
          ? t(`Convite reenviado para ${email}`, `Invitación reenviada a ${email}`, `Invite resent to ${email}`)
          : t(
              'Convite registado (e-mail pode não ter sido enviado — falta RESEND_API_KEY)',
              'Invitación registrada (el email puede no haberse enviado — falta RESEND_API_KEY)',
              'Invite logged (email may not have sent — RESEND_API_KEY missing)',
            ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setResendingEmail(null);
    }
  }

  async function copyLink() {
    if (!session.meetingUrl) return;
    try {
      await navigator.clipboard.writeText(session.meetingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  }

  async function saveEdits() {
    if (!title.trim()) return;
    setBusy(true);
    setError(null);
    setSaveNotice(null);
    try {
      const newEmails = newInviteText
        .split(/[,;\s]+/)
        .map((email) => email.trim().toLowerCase())
        .filter((email) => email.includes('@'));

      const payload: Record<string, unknown> = {
        companyId,
        title: title.trim(),
        description: description.trim() || null,
        scheduledAt: startsAt ? new Date(startsAt).toISOString() : null,
        endsAt: endsAt ? new Date(endsAt).toISOString() : null,
        editScope: inSeries ? editScope : 'this',
        locale,
      };
      if (newEmails.length > 0) payload.inviteEmails = newEmails;
      if (removedParticipantIds.length > 0) payload.removeParticipantIds = removedParticipantIds;
      if ((projectId || '') !== (session.projectId || '')) payload.projectId = projectId || null;
      if (sendInvites && newEmails.length > 0) payload.sendInvites = true;
      if (notifyAttendees) payload.notifyAttendees = true;

      const response = await fetch(`/api/meet/sessions/${session.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as {
        session?: MeetEventDetail;
        error?: string;
        inviteResults?: { email: string; sent: boolean }[];
      };
      if (!response.ok || !data.session) throw new Error(data.error || 'Error');
      onUpdated(data.session);
      setEditing(false);
      const sentCount = (data.inviteResults ?? []).filter((r) => r.sent).length;
      if (sentCount > 0) {
        setSaveNotice(
          t(
            `${sentCount} convite(s) enviado(s) por e-mail.`,
            `${sentCount} invitación(es) enviada(s) por email.`,
            `${sentCount} invite(s) sent by email.`,
          ),
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  async function syncGoogleCalendar() {
    setCalBusy(true);
    setError(null);
    try {
      // Sempre o mestre da série (API resolve seriesParentId)
      const syncId = session.seriesParentId || session.id;
      const response = await fetch(`/api/meet/sessions/${syncId}/calendar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          provider: 'google',
          notifyAttendees: true,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        }),
      });
      const data = (await response.json()) as { error?: string; event?: { htmlLink?: string } };
      if (!response.ok) throw new Error(data.error || 'Error');
      if (data.event?.htmlLink) {
        window.open(data.event.htmlLink, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setCalBusy(false);
    }
  }

  async function deleteSession() {
    setBusy(true);
    setError(null);
    try {
      const scope = session.isPermanent || (inSeries && deleteScope === 'series')
        ? session.isPermanent
          ? 'series'
          : deleteScope
        : inSeries
          ? deleteScope
          : 'this';
      const response = await fetch(
        `/api/meet/sessions/${session.id}?companyId=${encodeURIComponent(companyId)}&scope=${scope}`,
        { method: 'DELETE' },
      );
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Error');
      onDeleted(session.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/35 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl lg:max-w-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-end gap-1 px-3 pt-3">
          {isOwner && !editing && (
            <>
              <button
                type="button"
                onClick={() => void loadSessionForEdit()}
                className="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                title={t('Editar', 'Editar', 'Edit')}
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="rounded-full p-2 text-slate-500 hover:bg-red-50 hover:text-red-700"
                title={t('Apagar', 'Eliminar', 'Delete')}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
            aria-label={t('Fechar', 'Cerrar', 'Close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 px-5 pb-5 pt-1">
          {editing ? (
            <div className="space-y-4">
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="w-full border-b-2 border-teal-700 bg-transparent py-1 text-xl font-semibold text-slate-900 outline-none"
              />
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="text-xs font-medium text-slate-500">
                  {t('Início', 'Inicio', 'Starts')}
                  <input
                    type="datetime-local"
                    value={startsAt}
                    onChange={(event) => setStartsAt(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-xs font-medium text-slate-500">
                  {t('Fim', 'Fin', 'Ends')}
                  <input
                    type="datetime-local"
                    value={endsAt}
                    min={startsAt || undefined}
                    onChange={(event) => setEndsAt(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
                placeholder={t('Descrição', 'Descripción', 'Description')}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />

              {projects.length > 0 && (
                <label className="block text-xs font-medium text-slate-500">
                  <span className="mb-1 inline-flex items-center gap-1.5">
                    <FolderKanban className="h-3.5 w-3.5" />
                    {t('Projeto SIEP', 'Proyecto SIEP', 'SIEP project')}
                  </span>
                  <select
                    value={projectId}
                    onChange={(event) => setProjectId(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="">
                      {t('Sem projeto', 'Sin proyecto', 'No project')}
                    </option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                <p className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
                  <Users className="h-4 w-4 text-slate-500" />
                  {t('Participantes', 'Participantes', 'Participants')}
                </p>
                <ul className="mt-3 max-h-40 space-y-2 overflow-y-auto">
                  {visibleEditGuests.map((guest) => {
                    const name = guestName(guest);
                    const email = guestEmail(guest);
                    const organizer = isOrganizerGuest(guest);
                    return (
                      <li
                        key={guest.id}
                        className="flex items-center gap-2 rounded-lg bg-white px-2 py-1.5 ring-1 ring-slate-200"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-100 text-[10px] font-semibold text-teal-900">
                          {initials(name)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-slate-800">
                            {name}
                            {organizer && (
                              <span className="ml-1 font-normal text-slate-500">
                                ({t('organizador', 'organizador', 'organizer')})
                              </span>
                            )}
                          </p>
                          {email && email !== name && (
                            <p className="truncate text-[11px] text-slate-500">{email}</p>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-0.5">
                          {email && !organizer && (
                            <button
                              type="button"
                              disabled={resendingEmail === email}
                              onClick={() => void resendInvite(email)}
                              className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100 hover:text-teal-700 disabled:opacity-50"
                              title={t('Reenviar convite', 'Reenviar invitación', 'Resend invite')}
                            >
                              {resendingEmail === email ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Mail className="h-3.5 w-3.5" />
                              )}
                            </button>
                          )}
                          {!organizer && (
                            <button
                              type="button"
                              onClick={() => removeGuest(guest)}
                              className="rounded-full p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-700"
                              title={t('Remover', 'Quitar', 'Remove')}
                            >
                              <UserMinus className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                  {!visibleEditGuests.length && (
                    <li className="text-xs text-slate-500">
                      {t('Sem convidados ainda.', 'Aún no hay invitados.', 'No guests yet.')}
                    </li>
                  )}
                </ul>
                <label className="mt-3 block text-xs font-medium text-slate-500">
                  {t('Adicionar convidados (e-mails)', 'Añadir invitados (emails)', 'Add guests (emails)')}
                  <textarea
                    value={newInviteText}
                    onChange={(event) => setNewInviteText(event.target.value)}
                    rows={2}
                    placeholder={t(
                      'email1@..., email2@...',
                      'email1@..., email2@...',
                      'email1@..., email2@...',
                    )}
                    className="mt-1 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
                <div className="mt-2 space-y-2 text-xs text-slate-600">
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={sendInvites}
                      onChange={(event) => setSendInvites(event.target.checked)}
                      className="mt-0.5 rounded border-slate-300"
                    />
                    <span>
                      {t(
                        'Enviar convite por e-mail aos novos convidados',
                        'Enviar invitación por email a los nuevos invitados',
                        'Send email invite to new guests',
                      )}
                    </span>
                  </label>
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={notifyAttendees}
                      onChange={(event) => setNotifyAttendees(event.target.checked)}
                      className="mt-0.5 rounded border-slate-300"
                    />
                    <span>
                      {t(
                        'Reenviar convite a todos os convidados (atualização)',
                        'Reenviar invitación a todos los invitados (actualización)',
                        'Resend invite to all guests (update)',
                      )}
                    </span>
                  </label>
                </div>
              </div>

              {session.meetingUrl && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  <p className="font-medium text-slate-700">CHORUS</p>
                  <p className="mt-1 break-all">{session.meetingUrl}</p>
                </div>
              )}

              {inSeries && !session.isPermanent && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-800">
                  <p className="mb-2 text-xs font-medium text-slate-600">
                    {t('Aplicar alterações a', 'Aplicar cambios a', 'Apply changes to')}
                  </p>
                  <div className="space-y-2">
                    {(
                      [
                        ['this', t('Só esta ocorrência', 'Solo esta ocurrencia', 'Only this occurrence')],
                        [
                          'following',
                          t('Esta e as seguintes', 'Esta y las siguientes', 'This and following'),
                        ],
                        ['series', t('Toda a série', 'Toda la serie', 'Entire series')],
                      ] as const
                    ).map(([value, label]) => (
                      <label key={value} className="flex items-center gap-2 text-xs">
                        <input
                          type="radio"
                          name="editScope"
                          checked={editScope === value}
                          onChange={() => setEditScope(value)}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
                >
                  {t('Cancelar', 'Cancelar', 'Cancel')}
                </button>
                <button
                  type="button"
                  disabled={busy || !title.trim()}
                  onClick={() => void saveEdits()}
                  className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
                >
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t('Guardar', 'Guardar', 'Save')}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex gap-3">
                <span className="mt-1.5 h-4 w-4 shrink-0 rounded bg-teal-600" />
                <div className="min-w-0">
                  <h2 className="text-xl font-semibold leading-snug text-slate-900">{session.title}</h2>
                  <p className="mt-1 capitalize text-sm text-slate-600">{whenLabel}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 text-sm text-slate-700">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">CHORUS</p>
                  {session.meetingUrl && (
                    <button
                      type="button"
                      onClick={() => void copyLink()}
                      className="mt-1 inline-flex max-w-full items-center gap-1.5 truncate text-xs text-sky-700 hover:underline"
                    >
                      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      <span className="truncate">{session.meetingUrl}</span>
                    </button>
                  )}
                </div>
              </div>

              {(session.description || '').trim() && (
                <p className="whitespace-pre-wrap rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  {session.description}
                </p>
              )}

              <div className="flex items-start gap-3">
                <Users className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800">
                    {guestCount}{' '}
                    {guestCount === 1
                      ? t('convidado', 'invitado', 'guest')
                      : t('convidados', 'invitados', 'guests')}
                    {joinedCount > 0 && (
                      <span className="ml-2 font-normal text-slate-500">
                        · {joinedCount} {t('já entraram', 'ya entraron', 'joined')}
                      </span>
                    )}
                  </p>
                  <ul className="mt-3 max-h-48 space-y-2.5 overflow-y-auto pr-1">
                    {guests.map((guest) => {
                      const name = guestName(guest);
                      const email = guestEmail(guest) || guest.email || guest.user?.email || '';
                      const organizer = isOrganizerGuest(guest);
                      return (
                        <li key={guest.id} className="flex items-center gap-2.5">
                          <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-semibold text-teal-900">
                            {initials(name)}
                            {guest.joinedAt && (
                              <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 text-white">
                                <Check className="h-2.5 w-2.5" />
                              </span>
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-slate-800">
                              {name}
                              {email && email !== name && (
                                <span className="font-normal text-slate-500"> ({email})</span>
                              )}
                            </p>
                            {organizer && (
                              <p className="text-[11px] text-slate-500">
                                {t('Organizador', 'Organizador', 'Organizer')}
                              </p>
                            )}
                          </div>
                          {isOwner && email && !organizer && (
                            <button
                              type="button"
                              disabled={resendingEmail === email}
                              onClick={() => void resendInvite(email)}
                              className="shrink-0 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-teal-700 disabled:opacity-50"
                              title={t('Reenviar convite', 'Reenviar invitación', 'Resend invite')}
                            >
                              {resendingEmail === email ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Mail className="h-3.5 w-3.5" />
                              )}
                            </button>
                          )}
                        </li>
                      );
                    })}
                    {!guests.length && session.createdBy && (
                      <li className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-100 text-xs font-semibold text-teal-900">
                          {initials(session.createdBy.name || session.createdBy.email || 'O')}
                        </span>
                        <div>
                          <p className="text-sm font-medium text-slate-800">
                            {session.createdBy.name || session.createdBy.email}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {t('Organizador', 'Organizador', 'Organizer')}
                          </p>
                        </div>
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </>
          )}

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          )}

          {saveNotice && !error && (
            <p className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-900">
              {saveNotice}
            </p>
          )}

          {confirmDelete && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-900">
              <p className="font-medium">
                {session.isPermanent
                  ? t('Apagar esta sala permanente?', '¿Eliminar esta sala permanente?', 'Delete this permanent room?')
                  : t('Apagar esta reunião?', '¿Eliminar esta reunión?', 'Delete this meeting?')}
              </p>
              {inSeries && !session.isPermanent && (
                <div className="mt-3 space-y-2">
                  {(
                    [
                      ['this', t('Só esta ocorrência', 'Solo esta ocurrencia', 'Only this occurrence')],
                      [
                        'following',
                        t('Esta e as seguintes', 'Esta y las siguientes', 'This and following'),
                      ],
                      ['series', t('Toda a série', 'Toda la serie', 'Entire series')],
                    ] as const
                  ).map(([value, label]) => (
                    <label key={value} className="flex items-center gap-2 text-xs">
                      <input
                        type="radio"
                        name="deleteScope"
                        checked={deleteScope === value}
                        onChange={() => setDeleteScope(value)}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              )}
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-lg px-3 py-1.5 text-slate-600 hover:bg-white"
                >
                  {t('Cancelar', 'Cancelar', 'Cancel')}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void deleteSession()}
                  className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-1.5 font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {t('Apagar', 'Eliminar', 'Delete')}
                </button>
              </div>
            </div>
          )}

          {!editing && (
            <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
              {session.status !== 'ended' &&
                session.status !== 'cancelled' &&
                !isGoogleImportedMeetSession(session) && (
                <Link
                  href={meetHubJoinPath(joinId, companyId)}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
                >
                  <Video className="h-4 w-4" />
                  {t('Entrar na sala', 'Entrar a la sala', 'Join room')}
                </Link>
              )}
              {isGoogleImportedMeetSession(session) && session.meetingUrl && (
                <a
                  href={session.meetingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
                >
                  <Video className="h-4 w-4" />
                  {t('Abrir call externa', 'Abrir call externa', 'Open external call')}
                </a>
              )}
              <Link
                href={meetCapturePath({ companyId, sessionId: session.id })}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-semibold text-violet-900 hover:bg-violet-100"
              >
                <MonitorUp className="h-4 w-4" />
                {t('Captura + transcrição', 'Captura + transcripción', 'Capture + transcript')}
              </Link>
              <Link
                href={meetRecapPath(session.id, companyId)}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                <FileText className="h-4 w-4" />
                {t('Transcrição e resumo', 'Transcripción y resumen', 'Transcript & summary')}
              </Link>
              {session.meetingUrl && (
                <button
                  type="button"
                  onClick={() => void copyLink()}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {t('Copiar link', 'Copiar enlace', 'Copy link')}
                </button>
              )}
              {isOwner && googleCalendarReady && (
                <button
                  type="button"
                  disabled={calBusy}
                  onClick={() => void syncGoogleCalendar()}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  {calBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Calendar className="h-4 w-4" />
                  )}
                  {inSeries
                    ? t(
                        'Enviar série ao Google Calendar',
                        'Enviar serie a Google Calendar',
                        'Send series to Google Calendar',
                      )
                    : t(
                        'Enviar ao Google Calendar',
                        'Enviar a Google Calendar',
                        'Send to Google Calendar',
                      )}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
