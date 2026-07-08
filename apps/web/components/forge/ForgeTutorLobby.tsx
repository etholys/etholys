'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  Building2,
  Calendar,
  ChevronRight,
  Copy,
  Filter,
  Gamepad2,
  Plus,
  Settings,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { ForgeInviteLearners } from '@/components/forge/ForgeInviteLearners';
import { ForgeFeriaSessionPanel } from '@/components/forge/ForgeFeriaSessionPanel';
import { useForgeT } from '@/lib/forge/use-forge-t';
import { formatSessionWhen, type SerializedLiveSession } from '@/lib/forge/live-sessions';

type EditionStatus = 'preparation' | 'running' | 'finished' | 'archived';

type EditionSummary = {
  id: string;
  name: string;
  status: EditionStatus;
  effectiveStatus: EditionStatus;
  startsAt: string | null;
  endsAt: string | null;
  groupCount: number;
  learnerCount: number;
  attentionCount: number;
};

type AttentionItem = {
  id: string;
  editionId: string;
  label: string;
  href?: string;
};

type PlayGroup = {
  id: string;
  name: string;
  mode: string;
  liveSessionId: string | null;
  liveSessionTitle?: string;
  memberCount: number;
  inviteUrl: string | null;
};

const STATUS_FILTERS = ['all', 'preparation', 'running', 'finished'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

function statusBadgeClass(status: EditionStatus): string {
  switch (status) {
    case 'running':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'finished':
      return 'bg-slate-100 text-slate-600 border-slate-200';
    case 'archived':
      return 'bg-slate-50 text-slate-400 border-slate-100';
    default:
      return 'bg-amber-100 text-amber-900 border-amber-200';
  }
}

function formatDateRange(startsAt: string | null, endsAt: string | null): string {
  if (!startsAt && !endsAt) return '—';
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  if (startsAt && endsAt) return `${fmt(startsAt)} → ${fmt(endsAt)}`;
  if (startsAt) return fmt(startsAt);
  return fmt(endsAt!);
}

export function ForgeTutorLobby({ courseId, embedded = false }: { courseId: string; embedded?: boolean }) {
  const ft = useForgeT();
  const [editions, setEditions] = useState<EditionSummary[]>([]);
  const [attention, setAttention] = useState<AttentionItem[]>([]);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [showAttention, setShowAttention] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');

  const load = useCallback(async () => {
    const res = await fetch(`/api/forge/courses/${courseId}/editions`);
    const d = await res.json();
    setEditions(d.editions ?? []);
    setAttention(d.attention ?? []);
  }, [courseId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (filter === 'all') return editions;
    return editions.filter((e) => e.effectiveStatus === filter);
  }, [editions, filter]);

  async function createEdition(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setBusy(true);
    const res = await fetch(`/api/forge/courses/${courseId}/editions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newName.trim(),
        startsAt: newStart || null,
        endsAt: newEnd || null,
      }),
    });
    setBusy(false);
    if (res.ok) {
      setModalOpen(false);
      setNewName('');
      setNewStart('');
      setNewEnd('');
      void load();
    } else {
      const d = await res.json();
      alert(d.error || ft('forge.general.error'));
    }
  }

  function statusLabel(status: EditionStatus): string {
    return ft(`forge.editions.status.${status}`);
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className={embedded ? 'text-lg font-black text-slate-900' : 'text-2xl font-black text-slate-900'}>
            {embedded ? ft('forge.editions.sectionTitle') : ft('forge.editions.title')}
          </h2>
          {!embedded && <p className="text-sm text-slate-600 mt-1">{ft('forge.editions.subtitle')}</p>}
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-violet-800"
        >
          <Plus className="h-4 w-4" />
          {ft('forge.editions.create')}
        </button>
      </div>

      {attention.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/80 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowAttention((v) => !v)}
            className="flex w-full items-center gap-2 px-4 py-3 text-left"
          >
            <AlertCircle className="h-5 w-5 text-amber-700 shrink-0" />
            <span className="font-bold text-amber-900 text-sm">
              {ft('forge.editions.attentionTitle', { count: attention.length })}
            </span>
            <ChevronRight
              className={`ml-auto h-4 w-4 text-amber-700 transition ${showAttention ? 'rotate-90' : ''}`}
            />
          </button>
          {showAttention && (
            <ul className="border-t border-amber-200 px-4 py-2 space-y-1">
              {attention.map((a) => (
                <li key={a.id}>
                  {a.href ? (
                    <Link href={a.href} className="block rounded-lg px-2 py-1.5 text-xs text-amber-900 hover:bg-amber-100/80">
                      {a.label}
                    </Link>
                  ) : (
                    <span className="block px-2 py-1.5 text-xs text-amber-900">{a.label}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-slate-400" />
        {STATUS_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-bold border transition ${
              filter === f
                ? 'bg-violet-700 text-white border-violet-700'
                : 'bg-white text-slate-600 border-slate-200 hover:border-violet-300'
            }`}
          >
            {ft(`forge.editions.filter.${f}`)}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-10 text-center">
          <Users className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 font-bold text-slate-700">{ft('forge.editions.empty')}</p>
          <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">{ft('forge.editions.emptyHint')}</p>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2 text-sm font-bold text-white"
          >
            <Plus className="h-4 w-4" />
            {ft('forge.editions.create')}
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((ed) => (
            <Link
              key={ed.id}
              href={`/hub/forge/cursos/${courseId}/turmas/${ed.id}`}
              className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-violet-300 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-bold text-slate-900 group-hover:text-violet-800">{ed.name}</h2>
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${statusBadgeClass(ed.effectiveStatus)}`}
                >
                  {statusLabel(ed.effectiveStatus)}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-500 flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {formatDateRange(ed.startsAt, ed.endsAt)}
              </p>
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">
                <span className="flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" />
                  {ft('forge.editions.cardGroups', { n: ed.groupCount })}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {ft('forge.editions.cardLearners', { n: ed.learnerCount })}
                </span>
                {ed.attentionCount > 0 && (
                  <span className="flex items-center gap-1 text-amber-700 font-bold">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {ft('forge.editions.cardAttention', { n: ed.attentionCount })}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      <p className="text-xs text-slate-400">{ft('forge.editions.calendarNote')}</p>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black text-slate-900">{ft('forge.editions.createTitle')}</h2>
              <button type="button" onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={(e) => void createEdition(e)} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{ft('forge.editions.nameLabel')}</label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={ft('forge.editions.namePlaceholder')}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  required
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">{ft('forge.editions.startLabel')}</label>
                  <input
                    type="date"
                    value={newStart}
                    onChange={(e) => setNewStart(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">{ft('forge.editions.endLabel')}</label>
                  <input
                    type="date"
                    value={newEnd}
                    onChange={(e) => setNewEnd(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 rounded-lg border px-4 py-2 text-sm font-bold text-slate-600"
                >
                  {ft('forge.general.close')}
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="flex-1 rounded-lg bg-violet-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                >
                  {ft('forge.editions.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export function ForgeEditionDetail({
  courseId,
  editionId,
}: {
  courseId: string;
  editionId: string;
}) {
  const ft = useForgeT();
  const [edition, setEdition] = useState<{
    id: string;
    name: string;
    status: EditionStatus;
    effectiveStatus: EditionStatus;
    startsAt: string | null;
    endsAt: string | null;
  } | null>(null);
  const [groups, setGroups] = useState<PlayGroup[]>([]);
  const [sessions, setSessions] = useState<SerializedLiveSession[]>([]);
  const [newName, setNewName] = useState('');
  const [linkSession, setLinkSession] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastInvite, setLastInvite] = useState<string | null>(null);
  const [showEnroll, setShowEnroll] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/forge/courses/${courseId}/editions/${editionId}`);
    const d = await res.json();
    if (d.edition) setEdition(d.edition);
    setGroups(d.groups ?? []);
    setSessions(
      (d.courseSessions ?? []).map((s: { id: string; title: string; startsAt: string; endsAt: string | null }) => ({
        id: s.id,
        title: s.title,
        startsAt: s.startsAt,
        endsAt: s.endsAt,
      }))
    );
  }, [courseId, editionId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createGroup() {
    if (!newName.trim()) return;
    setBusy(true);
    const res = await fetch(`/api/forge/courses/${courseId}/play-groups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newName.trim(),
        mode: 'live_team',
        liveSessionId: linkSession || null,
        editionId,
      }),
    });
    const d = await res.json();
    setBusy(false);
    if (res.ok) {
      setNewName('');
      setLastInvite(d.inviteUrl ?? null);
      void load();
    } else alert(d.error || ft('forge.general.error'));
  }

  async function updateStatus(status: EditionStatus) {
    const res = await fetch(`/api/forge/courses/${courseId}/editions/${editionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.ok) void load();
  }

  function copyText(url: string) {
    void navigator.clipboard.writeText(url);
    alert(ft('forge.tutorLobby.copied'));
  }

  if (!edition) {
    return <p className="text-sm text-slate-500">{ft('forge.general.loading')}</p>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="rounded-2xl border bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span
              className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase mb-2 ${statusBadgeClass(edition.effectiveStatus)}`}
            >
              {ft(`forge.editions.status.${edition.effectiveStatus}`)}
            </span>
            <h1 className="text-2xl font-black text-slate-900">{edition.name}</h1>
            <p className="text-sm text-slate-500 mt-1">{formatDateRange(edition.startsAt, edition.endsAt)}</p>
          </div>
          <select
            value={edition.status}
            onChange={(e) => void updateStatus(e.target.value as EditionStatus)}
            className="rounded-lg border px-3 py-2 text-xs font-bold"
          >
            {(['preparation', 'running', 'finished', 'archived'] as const).map((s) => (
              <option key={s} value={s}>
                {ft(`forge.editions.status.${s}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <section className="rounded-2xl border-2 border-violet-300 bg-gradient-to-br from-violet-50 to-indigo-50 p-4">
        <h2 className="font-bold text-violet-900 text-sm flex items-center gap-2">
          <Gamepad2 className="h-5 w-5" />
          {ft('forge.edition.enterRoomTitle')}
        </h2>
        <p className="mt-1 text-xs text-violet-800">{ft('forge.edition.enterRoomHint')}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href={`/hub/forge/cursos/${courseId}/sala?editionId=${editionId}`}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-violet-800"
          >
            <Gamepad2 className="h-4 w-4" />
            {ft('forge.edition.enterRoom')}
          </Link>
          <a
            href={`/expedicion/entrar`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-violet-300 bg-white px-4 py-2.5 text-sm font-semibold text-violet-800 hover:bg-violet-50"
          >
            {ft('forge.edition.previewEntryPage')}
          </a>
        </div>
        <p className="mt-2 text-[11px] text-violet-700">{ft('forge.edition.enterRoomSteps')}</p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="font-bold text-slate-900 text-sm">{ft('forge.edition.settingsTitle')}</h2>
        <p className="mt-1 text-xs text-slate-500">{ft('forge.edition.settingsHint')}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Link
            href={`/hub/forge/cursos/${courseId}?edit=settings&from=edition&editionId=${editionId}`}
            className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-800 hover:border-violet-300 hover:bg-violet-50/50"
          >
            <Settings className="h-4 w-4 text-violet-600 shrink-0" />
            {ft('forge.edition.settingsDelivery')}
          </Link>
          <Link
            href={`/hub/forge/cursos/${courseId}/analytics?from=edition&editionId=${editionId}`}
            className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-800 hover:border-amber-300 hover:bg-amber-50/50"
          >
            <BarChart3 className="h-4 w-4 text-amber-600 shrink-0" />
            {ft('forge.edition.settingsAnalytics')}
          </Link>
        </div>
      </section>

      <ForgeFeriaSessionPanel courseId={courseId} editionId={editionId} alwaysExpanded />

      <section className="rounded-2xl border-2 border-blue-300 bg-blue-50/80 p-4 space-y-3">
        <h2 className="font-bold flex items-center gap-2 text-blue-900">
          <Building2 className="h-5 w-5" />
          {ft('forge.tutorLobby.groups')}
        </h2>
        <p className="text-xs text-blue-800">{ft('forge.tutorLobby.groupsManualHint')}</p>
        <div className="flex flex-wrap gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={ft('forge.tutorLobby.groupName')}
            className="flex-1 min-w-[140px] rounded-lg border px-3 py-2 text-sm"
          />
          <select
            value={linkSession}
            onChange={(e) => setLinkSession(e.target.value)}
            className="rounded-lg border px-2 py-2 text-xs max-w-[180px]"
          >
            <option value="">{ft('forge.tutorLobby.noSessionLink')}</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy}
            onClick={() => void createGroup()}
            className="inline-flex items-center gap-1 rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {ft('forge.tutorLobby.createCompany')}
          </button>
        </div>
        {lastInvite && (
          <div className="rounded-lg bg-white border border-blue-200 p-3 text-xs">
            <p className="font-bold text-blue-900">{ft('forge.tutorLobby.inviteLink')}</p>
            <p className="mt-1 break-all font-mono text-blue-800">{lastInvite}</p>
            <button
              type="button"
              onClick={() => copyText(lastInvite)}
              className="mt-2 inline-flex items-center gap-1 rounded-lg bg-blue-700 px-3 py-1.5 font-bold text-white"
            >
              <Copy className="h-3.5 w-3.5" />
              {ft('forge.tutorLobby.copyLink')}
            </button>
          </div>
        )}
        <ul className="space-y-2">
          {groups.map((g) => (
            <li key={g.id} className="rounded-xl border border-blue-200 bg-white p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">{g.name}</p>
                  <p className="text-xs text-slate-500">
                    {g.memberCount} {ft('forge.tutorLobby.members')}
                    {g.liveSessionTitle ? ` · ${g.liveSessionTitle}` : ''}
                  </p>
                </div>
                <Link
                  href={`/hub/forge/cursos/${courseId}/sala?group=${g.id}${g.liveSessionId ? `&session=${g.liveSessionId}` : ''}`}
                  className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white"
                >
                  {ft('forge.room.enter')}
                </Link>
              </div>
              {g.inviteUrl && (
                <div className="flex flex-wrap items-center gap-2 text-[10px]">
                  <span className="truncate font-mono text-slate-600 flex-1 min-w-0">{g.inviteUrl}</span>
                  <button
                    type="button"
                    onClick={() => copyText(g.inviteUrl!)}
                    className="shrink-0 rounded border px-2 py-0.5 font-bold"
                  >
                    {ft('forge.tutorLobby.copyLink')}
                  </button>
                </div>
              )}
            </li>
          ))}
          {groups.length === 0 && (
            <p className="text-sm text-slate-600">{ft('forge.tutorLobby.noGroups')}</p>
          )}
        </ul>
      </section>

      <section id="alunos" className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/50 p-4 space-y-3">
        <h2 className="font-bold flex items-center gap-2 text-emerald-900">
          <UserPlus className="h-5 w-5" />
          {ft('forge.tutorLobby.enrollTitle')}
        </h2>
        <p className="text-xs text-emerald-800">{ft('forge.tutorLobby.enrollHint')}</p>
        <button
          type="button"
          onClick={() => setShowEnroll((v) => !v)}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white"
        >
          {showEnroll ? ft('forge.tutorLobby.hideEnroll') : ft('forge.tutorLobby.showEnroll')}
        </button>
        {showEnroll && <ForgeInviteLearners courseId={courseId} />}
        <Link
          href={`/hub/forge/cursos/${courseId}/alumnos`}
          className="inline-flex items-center gap-1 text-xs font-bold text-violet-700"
        >
          <Users className="h-3.5 w-3.5" />
          {ft('forge.tutorLobby.seeLearners')}
        </Link>
      </section>

      <section className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowCalendar((v) => !v)}
          className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-bold text-slate-700"
        >
          <Calendar className="h-4 w-4 text-violet-600" />
          {ft('forge.editions.courseCalendar')}
          <span className="ml-auto text-xs font-normal text-slate-400">
            {ft('forge.editions.sessionsCount', { n: sessions.length })}
          </span>
        </button>
        {showCalendar && (
          <div className="border-t border-slate-200 px-4 py-3 space-y-2">
            <p className="text-xs text-slate-500">{ft('forge.editions.calendarExplain')}</p>
            <ul className="space-y-2">
              {sessions.map((s) => (
                <li key={s.id} className="rounded-lg border bg-white p-3 text-sm">
                  <p className="font-semibold">{s.title}</p>
                  <p className="text-xs text-slate-500">{formatSessionWhen(s.startsAt)}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
