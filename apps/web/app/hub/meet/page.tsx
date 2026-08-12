'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn, useSession } from 'next-auth/react';
import {
  ArrowLeft,
  Video,
  Calendar,
  CalendarPlus,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Keyboard,
  Download,
  Plus,
  Loader2,
  Copy,
  Check,
  Users,
  Zap,
  X,
  Link2,
  CalendarRange,
  MonitorUp,
  FileText,
} from 'lucide-react';
import { useApp } from '@/app/providers';
import { useEnsureActiveCompany } from '@/hooks/useEnsureActiveCompany';
import { CompanyPicker } from '@/components/hub/CompanyPicker';
import { CompanyRequiredPanel } from '@/components/hub/CompanyRequiredPanel';
import {
  MeetScheduleDialog,
  type ScheduleDraft,
} from '@/components/meet/MeetScheduleDialog';
import {
  MeetCalendarView,
  type MeetCalendarScale,
} from '@/components/meet/MeetCalendarView';
import {
  MeetEventDetailPopup,
  type MeetEventDetail,
} from '@/components/meet/MeetEventDetailPopup';
import { meetHubJoinPath, meetJoinTargetId, meetRecapPath, meetRecapsPath } from '@/lib/meet/types';

type MeetSessionRow = MeetEventDetail & {
  mirror: string;
  roomSlug: string;
  isPermanent?: boolean;
  recurrence?: string | null;
  seriesId?: string | null;
  seriesParentId?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
};

const DAY_MS = 86_400_000;
const STALE_LIVE_MAX_MS = 4 * 60 * 60 * 1000;
const STALE_AFTER_END_GRACE_MS = 15 * 60 * 1000;

/** `live` no DB mas já fora da janela da reunião → tratar como passada no hub. */
function isActivelyLive(session: MeetSessionRow, now: number): boolean {
  if (session.status !== 'live') return false;
  if (session.isPermanent) return true;
  if (session.endsAt) {
    const end = new Date(session.endsAt).getTime();
    if (Number.isFinite(end) && now > end + STALE_AFTER_END_GRACE_MS) return false;
  }
  const startRaw = session.startedAt || session.scheduledAt;
  if (startRaw) {
    const start = new Date(startRaw).getTime();
    if (Number.isFinite(start) && now > start + STALE_LIVE_MAX_MS) return false;
  }
  return true;
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** Semana de segunda a domingo, como no Google Meet. */
function weekOf(date: Date): Date[] {
  const base = startOfDay(date);
  const weekday = (base.getDay() + 6) % 7;
  const monday = new Date(base.getTime() - weekday * DAY_MS);
  return Array.from({ length: 7 }, (_, i) => new Date(monday.getTime() + i * DAY_MS));
}

function sameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

export default function MeetHubPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-white">
          <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
        </div>
      }
    >
      <MeetHubContent />
    </Suspense>
  );
}

function MeetHubContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: authSession } = useSession();
  const { locale } = useApp();
  const {
    companies,
    companiesReady,
    companiesLoadError,
    companiesHttpStatus,
    companyId,
    setActiveCompanyId,
    reloadCompanies,
  } = useEnsureActiveCompany();
  const t = (pt: string, es: string, en: string) => (locale === 'pt' ? pt : locale === 'es' ? es : en);
  const intlLocale = locale === 'pt' ? 'pt-BR' : locale === 'en' ? 'en-US' : 'es-ES';
  const currentUserId = (authSession?.user as { id?: string } | undefined)?.id || null;

  const [sessions, setSessions] = useState<MeetSessionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  const [joinInput, setJoinInput] = useState('');
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [shareSession, setShareSession] = useState<{ id: string; meetingUrl: string } | null>(null);
  const [detailSessionId, setDetailSessionId] = useState<string | null>(null);
  const [calBusyId, setCalBusyId] = useState<string | null>(null);
  const [jitsiStatus, setJitsiStatus] = useState<{ baseUrl: string; isDemo: boolean } | null>(null);
  const [connections, setConnections] = useState<{
    google: { configured: boolean; connected: boolean; ready: boolean; needsReconnect: boolean };
    outlook: { configured: boolean; connected: boolean; ready: boolean; needsReconnect: boolean };
  } | null>(null);
  const [mainView, setMainView] = useState<'agenda' | 'calendar'>('agenda');
  const [calendarScale, setCalendarScale] = useState<MeetCalendarScale>('month');

  useEffect(() => {
    const post = searchParams.get('post')?.trim();
    if (post && companyId) {
      router.replace(meetRecapPath(post, companyId));
    }
  }, [searchParams, companyId, router]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch('/api/meet/status');
        const d = (await r.json()) as { baseUrl?: string; isDemo?: boolean };
        if (!cancelled && r.ok) {
          setJitsiStatus({ baseUrl: d.baseUrl || '', isDemo: Boolean(d.isDemo) });
        }
      } catch {
        /* status é informativo */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(
        `/api/meet/sessions?companyId=${encodeURIComponent(companyId)}&limit=200`,
      );
      const d = (await r.json()) as { sessions?: MeetSessionRow[]; error?: string };
      if (!r.ok) throw new Error(d.error || 'Error');
      setSessions(d.sessions ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!companyId) {
      setProjects([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch(`/api/projects?companyId=${encodeURIComponent(companyId)}`);
        const d = (await r.json()) as { projects?: { id: string; name: string }[] };
        if (!cancelled && r.ok) setProjects(d.projects ?? []);
      } catch {
        if (!cancelled) setProjects([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const loadConnections = useCallback(async () => {
    try {
      const response = await fetch('/api/meet/calendar/connections');
      const data = (await response.json()) as typeof connections & { error?: string };
      if (response.ok && data) {
        setConnections({
          google: data.google,
          outlook: data.outlook,
        });
      }
    } catch {
      /* A agenda Etholys continua funcional sem OAuth. */
    }
  }, []);

  useEffect(() => {
    void loadConnections();
  }, [loadConnections]);

  const week = useMemo(() => weekOf(selectedDate), [selectedDate]);

  const dayGroups = useMemo(() => {
    const now = Date.now();
    const ofDay = sessions.filter((s) => {
      const when = s.scheduledAt ? new Date(s.scheduledAt) : null;
      return when ? sameDay(when, selectedDate) : false;
    });
    const byTime = [...ofDay].sort((a, b) => {
      const av = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
      const bv = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
      return av - bv;
    });
    return {
      permanent: sessions.filter(
        (session) =>
          Boolean(session.isPermanent) &&
          session.status !== 'ended' &&
          session.status !== 'cancelled',
      ),
      unscheduled: sessions.filter(
        (session) =>
          !session.isPermanent &&
          !session.scheduledAt &&
          session.status !== 'ended' &&
          session.status !== 'cancelled',
      ),
      live: byTime.filter((s) => isActivelyLive(s, now)),
      upcoming: byTime.filter(
        (s) =>
          !isActivelyLive(s, now) &&
          s.status !== 'ended' &&
          s.status !== 'cancelled' &&
          s.status !== 'live' &&
          (!s.scheduledAt || new Date(s.scheduledAt).getTime() >= now),
      ),
      past: byTime.filter(
        (s) =>
          !s.isPermanent &&
          !isActivelyLive(s, now) &&
          (s.status === 'ended' ||
            s.status === 'cancelled' ||
            s.status === 'live' ||
            (!!s.scheduledAt && new Date(s.scheduledAt).getTime() < now)),
      ),
    };
  }, [sessions, selectedDate]);

  async function createSession(mode: 'instant' | 'later' | 'scheduled' | 'permanent', draft?: ScheduleDraft) {
    if (!companyId) return;
    const finalTitle =
      mode === 'instant'
        ? t('Reunião agora', 'Reunión ahora', 'Meeting now')
        : mode === 'later' || mode === 'permanent'
          ? t('Sala permanente', 'Sala permanente', 'Permanent room')
          : draft?.title || '';
    if (!finalTitle.trim()) return;

    setSaving(true);
    setError(null);
    try {
      const emails = draft?.inviteEmails ?? [];
      const linkedProject = draft?.projectId ?? null;
      const isPermanent = mode === 'permanent' || Boolean(draft?.isPermanent) || mode === 'later';
      // Com Google/Outlook: o calendário notifica os convidados — evita 2 e-mails (Resend + Google).
      const usesCalendarInvite =
        mode === 'scheduled' &&
        !isPermanent &&
        Boolean(draft?.calendarProvider && draft.calendarProvider !== 'none');
      const r = await fetch('/api/meet/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          title: finalTitle.trim(),
          description: draft?.description,
          mirror: linkedProject ? 'siep' : 'loose',
          projectId: linkedProject,
          inviteEmails: emails,
          sendInvites: Boolean(draft?.sendInvites && emails.length && !usesCalendarInvite),
          scheduledAt: draft?.startsAt,
          endsAt: draft?.endsAt,
          unscheduled: isPermanent,
          isPermanent,
          recurrence: isPermanent ? 'none' : draft?.recurrence || 'none',
          recurrenceUntil: isPermanent ? null : draft?.recurrenceUntil,
          locale,
        }),
      });
      const d = (await r.json()) as {
        session?: { id: string; meetingUrl?: string | null };
        error?: string;
      };
      if (!r.ok) throw new Error(d.error || 'Error');

      setNewMenuOpen(false);

      if (mode === 'scheduled' && d.session?.id && draft) {
        let calendarSyncError: string | null = null;
        if (usesCalendarInvite) {
          const calendarResponse = await fetch(`/api/meet/sessions/${d.session.id}/calendar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              companyId,
              provider: draft.calendarProvider,
              notifyAttendees: Boolean(draft.sendInvites),
              // Obrigatório para séries recorrentes na Google Calendar API
              timeZone:
                draft.timezone ||
                Intl.DateTimeFormat().resolvedOptions().timeZone ||
                'UTC',
            }),
          });
          const calendarData = (await calendarResponse.json()) as {
            error?: string;
            event?: { htmlLink?: string };
          };
          if (!calendarResponse.ok) {
            calendarSyncError = t(
              `A reunião foi criada, mas o calendário não sincronizou: ${calendarData.error || 'erro'}`,
              `La reunión fue creada, pero el calendario no se sincronizó: ${calendarData.error || 'error'}`,
              `The meeting was created, but calendar sync failed: ${calendarData.error || 'error'}`,
            );
          }
        }
        setScheduleOpen(false);
        if (draft.isPermanent) {
          setShareSession({ id: d.session.id, meetingUrl: d.session.meetingUrl || '' });
        } else {
          setSelectedDate(new Date(draft.startsAt));
          setMainView('calendar');
        }
        await load();
        if (calendarSyncError) setError(calendarSyncError);
        return;
      }

      if ((mode === 'later' || mode === 'permanent') && d.session?.id && d.session.meetingUrl) {
        setShareSession({ id: d.session.id, meetingUrl: d.session.meetingUrl });
        await load();
        return;
      }

      if (mode === 'instant' && d.session?.id) {
        router.push(meetHubJoinPath(d.session.id, companyId));
        return;
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  function connectCalendar(provider: 'google' | 'azure-ad') {
    void signIn(provider, {
      callbackUrl: '/hub/meet?calendarConnected=1',
      redirect: true,
    });
  }

  function joinByCode() {
    const raw = joinInput.trim();
    if (!raw || !companyId) return;
    setError(null);

    const needle = raw.replace(/\/+$/, '').split('/').pop() || raw;
    const match = sessions.find(
      (s) => s.roomSlug === needle || s.id === needle || s.meetingUrl === raw,
    );
    if (match) {
      router.push(meetHubJoinPath(match.id, companyId));
      return;
    }
    if (/^https?:\/\//i.test(raw)) {
      window.open(raw, '_blank', 'noopener,noreferrer');
      return;
    }
    setError(
      t(
        'Código não encontrado nas reuniões desta empresa. Cole o link completo.',
        'Código no encontrado en las reuniones de esta empresa. Pega el enlace completo.',
        'Code not found in this company’s meetings. Paste the full link.',
      ),
    );
  }

  async function copyUrl(url: string, id: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      /* clipboard pode estar bloqueado */
    }
  }

  async function syncCalendar(sessionId: string, provider: 'google' | 'outlook') {
    if (!companyId) return;
    setCalBusyId(`${sessionId}:${provider}`);
    setError(null);
    try {
      const r = await fetch(`/api/meet/sessions/${sessionId}/calendar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          provider,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        }),
      });
      const d = (await r.json()) as { error?: string; event?: { htmlLink?: string } };
      if (!r.ok) throw new Error(d.error || 'Error');
      if (d.event?.htmlLink) window.open(d.event.htmlLink, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setCalBusyId(null);
    }
  }

  const headerDate = new Intl.DateTimeFormat(intlLocale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(selectedDate);

  const detailSession = useMemo(
    () => sessions.find((session) => session.id === detailSessionId) || null,
    [sessions, detailSessionId],
  );

  function openSessionDetail(sessionId: string) {
    setDetailSessionId(sessionId);
  }

  function handleDetailUpdated(session: MeetEventDetail) {
    setSessions((prev) =>
      prev.map((row) =>
        row.id === session.id
          ? {
              ...row,
              ...session,
              mirror: row.mirror,
              roomSlug: row.roomSlug,
            }
          : row,
      ),
    );
    // Séries: recarregar lista para reflectir horários propagados
    if (session.seriesId || session.seriesParentId || (session.recurrence && session.recurrence !== 'none')) {
      void load();
    }
  }

  function handleDetailDeleted(sessionId: string) {
    setSessions((prev) => prev.filter((row) => row.id !== sessionId));
    setDetailSessionId(null);
  }

  return (
    <div className="flex min-h-dvh flex-col bg-white pb-[env(safe-area-inset-bottom)]">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <Link
            href="/hub"
            className="inline-flex touch-manipulation items-center gap-1.5 rounded-lg px-2 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Hub</span>
          </Link>

          <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-600">
              <Video className="h-4 w-4 text-white" />
            </span>
            <span className="truncate text-lg font-semibold tracking-tight text-slate-900">
              Etholys Meet
            </span>
          </div>

          <CompanyPicker
            companies={companies}
            activeCompanyId={companyId}
            onSelect={setActiveCompanyId}
            ready={companiesReady}
            error={companiesLoadError}
            onRetry={() => void reloadCompanies()}
            locale={locale}
            className="ml-auto sm:ml-0"
          />

          <div className="order-last flex w-full items-center gap-2 sm:order-none sm:ml-auto sm:w-auto">
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-slate-100 px-3 py-2.5 sm:w-72 sm:py-2">
              <Keyboard className="h-4 w-4 shrink-0 text-slate-500" />
              <input
                value={joinInput}
                onChange={(e) => setJoinInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') joinByCode();
                }}
                placeholder={t(
                  'Insira um código ou link',
                  'Ingresa un código o enlace',
                  'Enter a code or link',
                )}
                className="w-full bg-transparent text-base text-slate-800 outline-none placeholder:text-slate-500 sm:text-sm"
                enterKeyHint="go"
                autoCapitalize="off"
                autoCorrect="off"
              />
            </div>
            <button
              type="button"
              onClick={joinByCode}
              disabled={!joinInput.trim()}
              className="touch-manipulation rounded-full px-3 py-2.5 text-sm font-semibold text-sky-700 hover:bg-sky-50 disabled:text-slate-400 disabled:hover:bg-transparent sm:py-2"
            >
              {t('Entrar', 'Unirse', 'Join')}
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setNewMenuOpen((open) => !open)}
                disabled={!companyId}
                className="inline-flex touch-manipulation items-center gap-2 rounded-full bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50 sm:py-2"
              >
                <Plus className="h-4 w-4" />
                {t('Nova', 'Nueva', 'New')}
              </button>
              {newMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40 bg-slate-950/40 sm:bg-transparent"
                    onClick={() => setNewMenuOpen(false)}
                    aria-hidden
                  />
                  <div className="fixed inset-x-0 bottom-0 z-50 overflow-hidden rounded-t-2xl border border-slate-200 bg-white py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-full sm:mt-2 sm:w-72 sm:rounded-xl sm:pb-1 sm:shadow-xl">
                    <div className="mb-1 flex justify-center sm:hidden">
                      <span className="h-1 w-10 rounded-full bg-slate-200" />
                    </div>
                    <p className="px-4 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-slate-400 sm:hidden">
                      {t('Nova reunião', 'Nueva reunión', 'New meeting')}
                    </p>
                    <button
                      type="button"
                      onClick={() => void createSession('permanent')}
                      disabled={saving}
                      className="flex w-full touch-manipulation items-start gap-3 px-4 py-3.5 text-left hover:bg-slate-50 disabled:opacity-60 sm:py-3"
                    >
                      <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
                      <span>
                        <span className="block text-sm font-medium text-slate-900">
                          {t(
                            'Criar sala permanente',
                            'Crear sala permanente',
                            'Create permanent room',
                          )}
                        </span>
                        <span className="block text-xs text-slate-500">
                          {t(
                            'Link fixo para a equipa, sempre válido',
                            'Enlace fijo para el equipo, siempre válido',
                            'Fixed team link, always valid',
                          )}
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void createSession('instant')}
                      disabled={saving}
                      className="flex w-full touch-manipulation items-start gap-3 px-4 py-3.5 text-left hover:bg-slate-50 disabled:opacity-60 sm:py-3"
                    >
                      <Zap className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
                      <span>
                        <span className="block text-sm font-medium text-slate-900">
                          {t('Iniciar uma reunião instantânea', 'Iniciar una reunión instantánea', 'Start an instant meeting')}
                        </span>
                        <span className="block text-xs text-slate-500">
                          {t('Entra imediatamente na sala', 'Entra de inmediato en la sala', 'Joins the room right away')}
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNewMenuOpen(false);
                        setScheduleOpen(true);
                      }}
                      className="flex w-full touch-manipulation items-start gap-3 px-4 py-3.5 text-left hover:bg-slate-50 sm:py-3"
                    >
                      <CalendarPlus className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
                      <span>
                        <span className="block text-sm font-medium text-slate-900">
                          {t(
                            'Programar no calendário',
                            'Programar en el calendario',
                            'Schedule in calendar',
                          )}
                        </span>
                        <span className="block text-xs text-slate-500">
                          {t(
                            'Data, horário, convidados e calendário',
                            'Fecha, horario, invitados y calendario',
                            'Date, time, guests and calendar',
                          )}
                        </span>
                      </span>
                    </button>
                    <Link
                      href={
                        companyId
                          ? `/hub/meet/capture?companyId=${encodeURIComponent(companyId)}`
                          : '/hub/meet/capture'
                      }
                      onClick={() => setNewMenuOpen(false)}
                      className="flex w-full touch-manipulation items-start gap-3 px-4 py-3.5 text-left hover:bg-slate-50 sm:py-3"
                    >
                      <MonitorUp className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
                      <span>
                        <span className="block text-sm font-medium text-slate-900">
                          {t(
                            'Captura externa (Zoom/Teams)',
                            'Captura externa (Zoom/Teams)',
                            'External capture (Zoom/Teams)',
                          )}
                        </span>
                        <span className="block text-xs text-slate-500">
                          {t(
                            'Gravar ecrã + transcrever reuniões fora do Etholys',
                            'Grabar pantalla + transcribir reuniones fuera de Etholys',
                            'Record screen + transcribe meetings outside Etholys',
                          )}
                        </span>
                      </span>
                    </Link>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
        {!companyId && (
          <CompanyRequiredPanel
            locale={locale}
            companies={companies}
            ready={companiesReady}
            error={companiesLoadError}
            httpStatus={companiesHttpStatus}
            activeCompanyId={companyId}
            onSelect={setActiveCompanyId}
            onRetry={() => void reloadCompanies()}
          />
        )}

        {jitsiStatus?.isDemo && (
          <p className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {t(
              'Servidor de vídeo em modo demo: as chamadas cortam a cerca de 5 minutos.',
              'Servidor de vídeo en modo demo: las llamadas se cortan a unos 5 minutos.',
              'Video server in demo mode: calls cut off after about 5 minutes.',
            )}
          </p>
        )}

        {error && (
          <div className="mb-5 flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)} className="shrink-0">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setMainView('agenda')}
              className={`rounded-lg px-3 py-2 text-sm font-medium ${
                mainView === 'agenda' ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-600'
              }`}
            >
              <Video className="mr-1.5 inline h-4 w-4" />
              {t('Reuniões', 'Reuniones', 'Meetings')}
            </button>
            <button
              type="button"
              onClick={() => setMainView('calendar')}
              className={`rounded-lg px-3 py-2 text-sm font-medium ${
                mainView === 'calendar' ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-600'
              }`}
            >
              <CalendarRange className="mr-1.5 inline h-4 w-4" />
              {t('Meu calendário', 'Mi calendario', 'My calendar')}
            </button>
            <Link
              href={meetRecapsPath(companyId)}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:text-sky-700"
            >
              <FileText className="mr-1.5 inline h-4 w-4" />
              {t('Transcrições', 'Transcripciones', 'Transcripts')}
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {connections?.google.ready ? (
              <span className="rounded-full bg-emerald-50 px-3 py-1.5 font-medium text-emerald-700">
                Google Calendar · {t('ligado', 'conectado', 'connected')}
              </span>
            ) : connections?.google.configured ? (
              <button
                type="button"
                onClick={() => connectCalendar('google')}
                className="rounded-full border border-slate-200 px-3 py-1.5 font-medium text-sky-700 hover:bg-sky-50"
              >
                {t('Ligar Google Calendar', 'Conectar Google Calendar', 'Connect Google Calendar')}
              </button>
            ) : null}
            {connections?.outlook.ready ? (
              <span className="rounded-full bg-emerald-50 px-3 py-1.5 font-medium text-emerald-700">
                Outlook · {t('ligado', 'conectado', 'connected')}
              </span>
            ) : connections?.outlook.configured ? (
              <button
                type="button"
                onClick={() => connectCalendar('azure-ad')}
                className="rounded-full border border-slate-200 px-3 py-1.5 font-medium text-sky-700 hover:bg-sky-50"
              >
                {t('Ligar Outlook', 'Conectar Outlook', 'Connect Outlook')}
              </button>
            ) : null}
          </div>
        </div>

        {mainView === 'agenda' ? (
          <>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold capitalize text-slate-900">{headerDate}</h1>
            <button
              type="button"
              onClick={() => setSelectedDate(startOfDay(new Date()))}
              className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              {t('Hoje', 'Hoy', 'Today')}
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSelectedDate((d) => new Date(d.getTime() - 7 * DAY_MS))}
              className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
              aria-label={t('Semana anterior', 'Semana anterior', 'Previous week')}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {week.map((day) => {
              const isSelected = sameDay(day, selectedDate);
              const isToday = sameDay(day, new Date());
              const label = new Intl.DateTimeFormat(intlLocale, { weekday: 'short' })
                .format(day)
                .replace('.', '')
                .toUpperCase();
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => setSelectedDate(day)}
                  className={`flex w-11 flex-col items-center rounded-xl px-1 py-1.5 text-[11px] transition ${
                    isSelected ? 'bg-sky-100 text-sky-900' : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  <span className="font-medium">{label}</span>
                  <span
                    className={`mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                      isSelected
                        ? 'bg-sky-600 text-white'
                        : isToday
                          ? 'text-sky-700'
                          : 'text-slate-700'
                    }`}
                  >
                    {day.getDate()}
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setSelectedDate((d) => new Date(d.getTime() + 7 * DAY_MS))}
              className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
              aria-label={t('Semana seguinte', 'Semana siguiente', 'Next week')}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-6">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-sky-600" />
            </div>
          ) : dayGroups.permanent.length +
              dayGroups.unscheduled.length +
              dayGroups.live.length +
              dayGroups.upcoming.length +
              dayGroups.past.length ===
            0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 py-16 text-center">
              <Video className="mx-auto h-9 w-9 text-slate-300" />
              <p className="mt-3 text-sm font-medium text-slate-700">
                {t('Nenhuma reunião neste dia', 'Ninguna reunión este día', 'No meetings on this day')}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {t(
                  'Use «Nova» para começar agora ou criar com convidados.',
                  'Usa «Nueva» para empezar ahora o crear con invitados.',
                  'Use “New” to start now or create with guests.',
                )}
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {dayGroups.permanent.length > 0 && (
                <MeetingGroup
                  label={t('Salas permanentes', 'Salas permanentes', 'Permanent rooms')}
                  sessions={dayGroups.permanent}
                  companyId={companyId}
                  intlLocale={intlLocale}
                  copiedId={copiedId}
                  calBusyId={calBusyId}
                  onOpen={openSessionDetail}
                  onCopy={copyUrl}
                  onCalendar={syncCalendar}
                  t={t}
                />
              )}
              {dayGroups.live.length > 0 && (
                <MeetingGroup
                  label={t('A decorrer', 'En curso', 'Happening now')}
                  accent
                  sessions={dayGroups.live}
                  companyId={companyId}
                  intlLocale={intlLocale}
                  copiedId={copiedId}
                  calBusyId={calBusyId}
                  onOpen={openSessionDetail}
                  onCopy={copyUrl}
                  onCalendar={syncCalendar}
                  t={t}
                />
              )}
              {dayGroups.upcoming.length > 0 && (
                <MeetingGroup
                  label={t('Próximas', 'Próximas', 'Upcoming')}
                  sessions={dayGroups.upcoming}
                  companyId={companyId}
                  intlLocale={intlLocale}
                  copiedId={copiedId}
                  calBusyId={calBusyId}
                  onOpen={openSessionDetail}
                  onCopy={copyUrl}
                  onCalendar={syncCalendar}
                  t={t}
                />
              )}
              {dayGroups.past.length > 0 && (
                <MeetingGroup
                  label={t('Passadas', 'Pasadas', 'Past')}
                  sessions={dayGroups.past}
                  companyId={companyId}
                  intlLocale={intlLocale}
                  copiedId={copiedId}
                  calBusyId={calBusyId}
                  onOpen={openSessionDetail}
                  onCopy={copyUrl}
                  onCalendar={syncCalendar}
                  t={t}
                />
              )}
              {dayGroups.unscheduled.length > 0 && (
                <MeetingGroup
                  label={t('Links sem data', 'Enlaces sin fecha', 'Unscheduled links')}
                  sessions={dayGroups.unscheduled}
                  companyId={companyId}
                  intlLocale={intlLocale}
                  copiedId={copiedId}
                  calBusyId={calBusyId}
                  onOpen={openSessionDetail}
                  onCopy={copyUrl}
                  onCalendar={syncCalendar}
                  t={t}
                />
              )}
            </div>
          )}
        </div>
          </>
        ) : (
          <MeetCalendarView
            locale={locale}
            companyId={companyId}
            sessions={sessions}
            anchor={selectedDate}
            scale={calendarScale}
            onAnchorChange={setSelectedDate}
            onScaleChange={setCalendarScale}
            onSelectSession={openSessionDetail}
          />
        )}

        {detailSession && companyId && (
          <MeetEventDetailPopup
            locale={locale}
            companyId={companyId}
            session={detailSession}
            currentUserId={currentUserId}
            googleCalendarReady={Boolean(connections?.google.ready)}
            onClose={() => setDetailSessionId(null)}
            onUpdated={handleDetailUpdated}
            onDeleted={handleDetailDeleted}
          />
        )}

      </main>

      {scheduleOpen && (
        <MeetScheduleDialog
          locale={locale}
          projects={projects}
          connections={connections}
          saving={saving}
          onClose={() => setScheduleOpen(false)}
          onConnect={connectCalendar}
          onSave={(draft) => createSession('scheduled', draft)}
        />
      )}

      {shareSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {t('A sua reunião está pronta', 'Tu reunión está lista', 'Your meeting is ready')}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {t(
                    'Partilhe este link com quem vai participar.',
                    'Comparte este enlace con quienes participarán.',
                    'Share this link with the participants.',
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShareSession(null)}
                className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-5 flex items-center gap-2 rounded-xl bg-slate-100 p-2 pl-3">
              <span className="min-w-0 flex-1 truncate text-sm text-slate-700">
                {shareSession.meetingUrl}
              </span>
              <button
                type="button"
                onClick={() => void copyUrl(shareSession.meetingUrl, shareSession.id)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-sky-700 shadow-sm"
              >
                {copiedId === shareSession.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copiedId === shareSession.id
                  ? t('Copiado', 'Copiado', 'Copied')
                  : t('Copiar', 'Copiar', 'Copy')}
              </button>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShareSession(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                {t('Fechar', 'Cerrar', 'Close')}
              </button>
              <Link
                href={meetHubJoinPath(shareSession.id, companyId)}
                className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
              >
                {t('Entrar agora', 'Entrar ahora', 'Join now')}
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type GroupProps = {
  label: string;
  accent?: boolean;
  sessions: MeetSessionRow[];
  companyId: string;
  intlLocale: string;
  copiedId: string | null;
  calBusyId: string | null;
  onOpen: (sessionId: string) => void;
  onCopy: (url: string, id: string) => void;
  onCalendar: (sessionId: string, provider: 'google' | 'outlook') => void;
  t: (pt: string, es: string, en: string) => string;
};

function MeetingGroup({
  label,
  accent,
  sessions,
  companyId,
  intlLocale,
  copiedId,
  calBusyId,
  onOpen,
  onCopy,
  onCalendar,
  t,
}: GroupProps) {
  const timeFmt = new Intl.DateTimeFormat(intlLocale, { hour: '2-digit', minute: '2-digit' });

  return (
    <section>
      <h2 className="text-sm font-medium text-slate-500">{label}</h2>
      <ul className="mt-3 space-y-3">
        {sessions.map((s) => {
          const start = s.scheduledAt ? new Date(s.scheduledAt) : null;
          const end = s.endsAt ? new Date(s.endsAt) : null;
          const timeLabel = start
            ? end
              ? `${timeFmt.format(start)} – ${timeFmt.format(end)}`
              : timeFmt.format(start)
            : '';
          return (
            <li
              key={s.id}
              className={`group rounded-2xl px-4 py-4 transition sm:px-5 ${
                accent ? 'bg-sky-50 ring-1 ring-sky-200' : 'bg-slate-50 hover:bg-slate-100/80'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <button
                  type="button"
                  onClick={() => onOpen(s.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  {timeLabel && (
                    <p className="text-xs font-medium text-slate-500">{timeLabel}</p>
                  )}
                  <p className="mt-0.5 truncate text-base font-semibold text-slate-900 hover:text-sky-700">
                    {s.title}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    {s.projectId && (
                      <span className="rounded-full bg-indigo-50 px-2 py-0.5 font-medium text-indigo-700">
                        SIEP
                      </span>
                    )}
                    {s.isPermanent && (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
                        {t('Permanente', 'Permanente', 'Permanent')}
                      </span>
                    )}
                    {(s.recurrence && s.recurrence !== 'none') || s.seriesParentId ? (
                      <span className="rounded-full bg-violet-50 px-2 py-0.5 font-medium text-violet-700">
                        {t('Série', 'Serie', 'Series')}
                      </span>
                    ) : null}
                    {s.mirror !== 'loose' && s.mirror !== 'siep' && (
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 font-medium uppercase text-slate-600">
                        {s.mirror}
                      </span>
                    )}
                    {s._count && s._count.participants > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {s._count.participants}
                      </span>
                    )}
                    {s._count && s._count.actionItems > 0 && (
                      <span className="inline-flex items-center gap-1 text-amber-700">
                        <Sparkles className="h-3.5 w-3.5" />
                        {s._count.actionItems}{' '}
                        {t('tarefas', 'tareas', 'tasks')}
                      </span>
                    )}
                  </div>
                </button>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onOpen(s.id)}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {t('Detalhes', 'Detalles', 'Details')}
                  </button>
                  {s.meetingUrl && companyId && s.status !== 'ended' && (
                    <Link
                      href={meetHubJoinPath(meetJoinTargetId(s), companyId)}
                      className="rounded-full bg-sky-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-sky-700"
                    >
                      {t('Entrar', 'Unirse', 'Join')}
                    </Link>
                  )}
                  <Link
                    href={meetRecapPath(s.id, companyId)}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <FileText className="mr-1 inline h-3 w-3" />
                    {t('Transcrição', 'Transcripción', 'Transcript')}
                  </Link>

                  <div className="flex items-center gap-1 opacity-70 transition group-hover:opacity-100">
                    {s.meetingUrl && (
                      <button
                        type="button"
                        onClick={() => onCopy(s.meetingUrl!, s.id)}
                        title={t('Copiar link', 'Copiar enlace', 'Copy link')}
                        className="rounded-full p-2 text-slate-500 hover:bg-white hover:text-slate-800"
                      >
                        {copiedId === s.id ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}
                    {companyId && (
                      <>
                        <a
                          href={`/api/meet/sessions/${s.id}/ics?companyId=${encodeURIComponent(companyId)}`}
                          title=".ics"
                          className="rounded-full p-2 text-slate-500 hover:bg-white hover:text-slate-800"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </a>
                        <button
                          type="button"
                          disabled={calBusyId === `${s.id}:google`}
                          onClick={() => onCalendar(s.id, 'google')}
                          title="Google Calendar"
                          className="rounded-full p-2 text-slate-500 hover:bg-white hover:text-slate-800 disabled:opacity-50"
                        >
                          {calBusyId === `${s.id}:google` ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Calendar className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          disabled={calBusyId === `${s.id}:outlook`}
                          onClick={() => onCalendar(s.id, 'outlook')}
                          title="Outlook Calendar"
                          className="rounded-full p-2 text-slate-500 hover:bg-white hover:text-slate-800 disabled:opacity-50"
                        >
                          {calBusyId === `${s.id}:outlook` ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <CalendarPlus className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
