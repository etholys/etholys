'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Video,
  Users,
  Calendar,
  Sparkles,
  GraduationCap,
  Sprout,
  ExternalLink,
  Download,
  Plus,
  Loader2,
  Copy,
  Check,
} from 'lucide-react';
import { useApp } from '@/app/providers';
import { isLikelyDbId } from '@/lib/utils';
import { MeetPostMeetingPanel } from '@/components/meet/MeetPostMeetingPanel';
import { meetHubJoinPath } from '@/lib/meet/types';

type MeetSessionRow = {
  id: string;
  title: string;
  mirror: string;
  status: string;
  scheduledAt: string | null;
  meetingUrl: string | null;
  roomSlug: string;
  projectId?: string | null;
  _count?: { participants: number; actionItems: number };
};

export default function MeetHubPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
        </div>
      }
    >
      <MeetHubContent />
    </Suspense>
  );
}

function MeetHubContent() {
  const searchParams = useSearchParams();
  const { locale, activeCompanyId } = useApp();
  const t = (pt: string, es: string, en: string) => (locale === 'pt' ? pt : locale === 'es' ? es : en);
  const companyId = activeCompanyId && isLikelyDbId(activeCompanyId) ? activeCompanyId : '';

  const [sessions, setSessions] = useState<MeetSessionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [inviteEmails, setInviteEmails] = useState('');
  const [sendInvites, setSendInvites] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [postSessionId, setPostSessionId] = useState<string | null>(null);
  const [jitsiStatus, setJitsiStatus] = useState<{
    baseUrl: string;
    isDemo: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    const post = searchParams.get('post')?.trim();
    if (post) setPostSessionId(post);
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/meet/status');
        const d = (await r.json()) as {
          baseUrl?: string;
          isDemo?: boolean;
          message?: string;
        };
        if (!cancelled && r.ok) {
          setJitsiStatus({
            baseUrl: d.baseUrl || '',
            isDemo: Boolean(d.isDemo),
            message: d.message || '',
          });
        }
      } catch {
        /* ignore */
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
      const r = await fetch(`/api/meet/sessions?companyId=${encodeURIComponent(companyId)}`);
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
      setProjectId('');
      return;
    }
    let cancelled = false;
    (async () => {
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

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!companyId || !title.trim()) return;
    setSaving(true);
    setError(null);
    setCreatedUrl(null);
    try {
      const emails = inviteEmails
        .split(/[,;\s]+/)
        .map((x) => x.trim())
        .filter(Boolean);
      const linkedProject = projectId || null;
      const r = await fetch('/api/meet/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          title: title.trim(),
          mirror: linkedProject ? 'siep' : 'loose',
          projectId: linkedProject,
          inviteEmails: emails,
          sendInvites: sendInvites && emails.length > 0,
          locale,
        }),
      });
      const d = (await r.json()) as {
        session?: { id: string; meetingUrl?: string | null };
        error?: string;
      };
      if (!r.ok) throw new Error(d.error || 'Error');
      setTitle('');
      setInviteEmails('');
      setProjectId('');
      if (d.session?.meetingUrl && d.session?.id && companyId) {
        window.location.href = meetHubJoinPath(d.session.id, companyId);
        return;
      }
      if (d.session?.meetingUrl) setCreatedUrl(d.session.meetingUrl);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  async function copyUrl(url: string, id: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50/80 to-slate-50">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link
            href="/hub"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-800 hover:text-slate-600"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('Voltar ao Hub', 'Volver al Hub', 'Back to Hub')}
          </Link>
          <div className="flex items-center gap-2 text-slate-800">
            <Video className="h-6 w-6 text-sky-700" />
            <span className="font-bold tracking-tight">Meet</span>
            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-900">
              F5
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-8 px-4 py-10 sm:px-6">
        {jitsiStatus?.isDemo && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <p className="font-semibold">
              {t(
                'Jitsi ainda em modo demo (meet.jit.si)',
                'Jitsi aún en modo demo (meet.jit.si)',
                'Jitsi still in demo mode (meet.jit.si)',
              )}
            </p>
            <p className="mt-1 text-amber-900/90">
              {t(
                'Chamadas no iframe cortam ~5 min. No Contabo: DNS meet → IP, firewall UDP 10000, depois bash scripts/setup-jitsi-contabo.sh. Guia: docs/MEET-JITSI-CONTABO.md',
                'Las llamadas en iframe cortan ~5 min. En Contabo: DNS meet → IP, firewall UDP 10000, luego bash scripts/setup-jitsi-contabo.sh. Guía: docs/MEET-JITSI-CONTABO.md',
                'Iframe calls cut at ~5 min. On Contabo: DNS meet → IP, firewall UDP 10000, then bash scripts/setup-jitsi-contabo.sh. Guide: docs/MEET-JITSI-CONTABO.md',
              )}
            </p>
          </div>
        )}
        {jitsiStatus && !jitsiStatus.isDemo && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs text-emerald-900">
            {t('Vídeo:', 'Vídeo:', 'Video:')} {jitsiStatus.baseUrl}
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-bold text-slate-900">
            {t('Nova reunião', 'Nueva reunión', 'New meeting')}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {t(
              'Cria uma sala, descarrega o calendário (.ics) e envia convites por e-mail (se Resend estiver configurado). Na call: use «Gravar» no Jitsi para guardar o vídeo no teu PC. Depois: Pós-reunião → colar notas/transcrição → IA cria resumo e tarefas.',
              'Crea una sala, descarga el calendario (.ics) y envía invitaciones (si Resend está configurado). En la call: usa «Grabar» en Jitsi para guardar el vídeo en tu PC. Después: Post-reunión → pegar notas/transcripción → IA crea resumen y tareas.',
              'Create a room, download calendar (.ics), send email invites (if Resend is set). In-call: use Record in Jitsi to save video to your PC. After: Post-meeting → paste notes/transcript → AI summary and tasks.',
            )}
          </p>

          {!companyId ? (
            <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {t(
                'Selecione uma empresa no Hub para criar reuniões.',
                'Selecciona una empresa en el Hub para crear reuniones.',
                'Select a company in the Hub to create meetings.',
              )}
            </p>
          ) : (
            <form onSubmit={handleCreate} className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  {t('Título', 'Título', 'Title')} *
                </label>
                <input
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder={t(
                    'Capacitação equipe campo',
                    'Capacitación equipo campo',
                    'Field team training',
                  )}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  {t('Projeto SIEP (opcional)', 'Proyecto SIEP (opcional)', 'SIEP project (optional)')}
                </label>
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="">
                    {t('Sem vínculo — reunião solta', 'Sin vínculo — reunión libre', 'No link — loose meeting')}
                  </option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  {t('Convidados (e-mails)', 'Invitados (emails)', 'Guests (emails)')}
                </label>
                <input
                  value={inviteEmails}
                  onChange={(e) => setInviteEmails(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="a@org.com, b@org.com"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={sendInvites}
                  onChange={(e) => setSendInvites(e.target.checked)}
                  className="rounded border-slate-300"
                />
                {t(
                  'Enviar e-mail agora (requer RESEND_API_KEY)',
                  'Enviar email ahora (requiere RESEND_API_KEY)',
                  'Send email now (requires RESEND_API_KEY)',
                )}
              </label>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {t('Criar sala', 'Crear sala', 'Create room')}
              </button>
            </form>
          )}

          {createdUrl && (
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm">
              <span className="font-medium text-sky-900">{t('Sala pronta', 'Sala lista', 'Room ready')}</span>
              <a
                href={createdUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-sky-700 underline"
              >
                {t('Abrir Jitsi', 'Abrir Jitsi', 'Open Jitsi')}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          )}

          {error && (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-slate-900">
              {t('Reuniões recentes', 'Reuniones recientes', 'Recent meetings')}
            </h2>
            <button
              type="button"
              onClick={() => void load()}
              className="text-sm text-sky-700 hover:underline"
            >
              {t('Atualizar', 'Actualizar', 'Refresh')}
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-sky-600" />
            </div>
          ) : sessions.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              {t('Nenhuma reunião ainda.', 'Ninguna reunión aún.', 'No meetings yet.')}
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {sessions.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-semibold text-slate-900">{s.title}</p>
                    <p className="text-xs text-slate-500">
                      {s.mirror} · {s.status}
                      {s.projectId
                        ? ` · SIEP`
                        : ''}
                      {s.scheduledAt
                        ? ` · ${new Date(s.scheduledAt).toLocaleString(locale === 'pt' ? 'pt-BR' : locale === 'en' ? 'en-US' : 'es-ES')}`
                        : ''}
                      {s._count ? ` · ${s._count.participants} ${t('pessoas', 'personas', 'people')}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {s.meetingUrl && companyId && (
                      <>
                        <Link
                          href={meetHubJoinPath(s.id, companyId)}
                          className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700"
                        >
                          {t('Entrar', 'Entrar', 'Join')}
                        </Link>
                        <button
                          type="button"
                          onClick={() => void copyUrl(s.meetingUrl!, s.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          {copiedId === s.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          {t('Copiar link', 'Copiar enlace', 'Copy link')}
                        </button>
                      </>
                    )}
                    {companyId && (
                      <a
                        href={`/api/meet/sessions/${s.id}/ics?companyId=${encodeURIComponent(companyId)}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <Download className="h-3 w-3" />
                        .ics
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => setPostSessionId(s.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-800 hover:bg-sky-100"
                    >
                      <Sparkles className="h-3 w-3" />
                      {t('Pós-reunião', 'Post-reunión', 'Post-meeting')}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {postSessionId && companyId && (
          <MeetPostMeetingPanel
            companyId={companyId}
            sessionId={postSessionId}
            locale={locale}
            onClose={() => setPostSessionId(null)}
            onUpdated={() => void load()}
          />
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            {t('Espelhos e roadmap', 'Espejos y roadmap', 'Mirrors & roadmap')}
          </h2>
          <ul className="mt-4 space-y-3 text-sm text-slate-800">
            <li className="flex gap-3">
              <Users className="h-5 w-5 shrink-0 text-sky-700" />
              <span>
                {t(
                  'Breakouts: no Jitsi self-hosted, o host cria salas paralelas (essencial para capacitações).',
                  'Breakouts: en Jitsi self-hosted, el host crea salas paralelas (esencial para capacitaciones).',
                  'Breakouts: on self-hosted Jitsi, the host creates parallel rooms (essential for trainings).',
                )}
              </span>
            </li>
            <li className="flex gap-3">
              <Calendar className="h-5 w-5 shrink-0 text-sky-700" />
              <span>
                {t(
                  'Calendário: .ics agora; OAuth Google/Outlook depois.',
                  'Calendario: .ics ahora; OAuth Google/Outlook después.',
                  'Calendar: .ics now; Google/Outlook OAuth later.',
                )}
              </span>
            </li>
            <li className="flex gap-3">
              <Sparkles className="h-5 w-5 shrink-0 text-sky-700" />
              <span>
                {t(
                  'IA pós-reunião: resumo, tarefas SIEP e alerta em curso na sala integrada.',
                  'IA post-reunión: resumen, tareas SIEP y alerta en curso en la sala integrada.',
                  'Post-meeting AI: summary, SIEP tasks, and live briefing in the integrated room.',
                )}
              </span>
            </li>
          </ul>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Link
              href="/hub/forge"
              className="flex items-start gap-3 rounded-xl border border-violet-200 bg-violet-50/50 px-4 py-3 text-sm transition hover:border-violet-400"
            >
              <GraduationCap className="h-5 w-5 shrink-0 text-violet-700" />
              <div>
                <p className="font-semibold text-slate-900">FORGE</p>
                <p className="mt-0.5 text-slate-600">
                  {t('Capacitações / salão', 'Capacitaciones / salón', 'Trainings / salon')}
                </p>
              </div>
            </Link>
            <Link
              href="/siep"
              className="flex items-start gap-3 rounded-xl border border-indigo-200 bg-indigo-50/50 px-4 py-3 text-sm transition hover:border-indigo-400"
            >
              <Sprout className="h-5 w-5 shrink-0 text-indigo-700" />
              <div>
                <p className="font-semibold text-slate-900">SIEP</p>
                <p className="mt-0.5 text-slate-600">
                  {t('Reuniões por projeto (aba Meetings)', 'Reuniones por proyecto (pestaña Meetings)', 'Project meetings (Meetings tab)')}
                </p>
              </div>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
