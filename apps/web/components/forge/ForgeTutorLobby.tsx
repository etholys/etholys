'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Building2, Calendar, Copy, Plus, UserPlus, Users, Video } from 'lucide-react';
import { ForgeInviteLearners } from '@/components/forge/ForgeInviteLearners';
import { useForgeT } from '@/lib/forge/use-forge-t';
import { formatSessionWhen, type SerializedLiveSession } from '@/lib/forge/live-sessions';

type PlayGroup = {
  id: string;
  name: string;
  mode: string;
  liveSessionId: string | null;
  liveSessionTitle?: string;
  memberCount: number;
  inviteUrl: string | null;
};

export function ForgeTutorLobby({ courseId }: { courseId: string }) {
  const ft = useForgeT();
  const [sessions, setSessions] = useState<SerializedLiveSession[]>([]);
  const [groups, setGroups] = useState<PlayGroup[]>([]);
  const [newName, setNewName] = useState('');
  const [linkSession, setLinkSession] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastInvite, setLastInvite] = useState<string | null>(null);
  const [showEnroll, setShowEnroll] = useState(false);

  const load = useCallback(async () => {
    const [sRes, gRes] = await Promise.all([
      fetch(`/api/forge/courses/${courseId}/live-sessions`),
      fetch(`/api/forge/courses/${courseId}/play-groups`),
    ]);
    const sData = await sRes.json();
    const gData = await gRes.json();
    setSessions(sData.sessions ?? []);
    setGroups(gData.groups ?? []);
  }, [courseId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createGroup(mode: 'live_team' | 'individual_coaching' = 'live_team') {
    if (!newName.trim()) return;
    setBusy(true);
    const res = await fetch(`/api/forge/courses/${courseId}/play-groups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newName.trim(),
        mode,
        liveSessionId: linkSession || null,
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

  function copyText(url: string) {
    void navigator.clipboard.writeText(url);
    alert(ft('forge.tutorLobby.copied'));
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-black text-slate-900">{ft('forge.tutorLobby.title')}</h1>
        <p className="text-sm text-slate-600 mt-1">{ft('forge.tutorLobby.subtitle')}</p>
      </div>

      <section className="rounded-2xl border-2 border-blue-300 bg-blue-50/80 p-4 space-y-3">
        <h2 className="font-bold flex items-center gap-2 text-blue-900">
          <Building2 className="h-5 w-5" />
          {ft('forge.tutorLobby.groups')} — {ft('forge.tutorLobby.groupsPrimary')}
        </h2>
        <p className="text-xs text-blue-900">{ft('forge.tutorLobby.groupsExplain')}</p>
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
            onClick={() => void createGroup('live_team')}
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
        <p className="text-[10px] text-blue-800">{ft('forge.tutorLobby.teamPlayHint')}</p>
      </section>

      <section className="rounded-2xl border bg-white p-4 space-y-3 opacity-90">
        <h2 className="font-bold flex items-center gap-2 text-slate-700">
          <Calendar className="h-5 w-5 text-violet-600" />
          {ft('forge.tutorLobby.sessions')}
        </h2>
        <p className="text-xs text-slate-500">{ft('forge.tutorLobby.sessionsExplain')}</p>
        <ul className="space-y-2">
          {sessions.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3">
              <div>
                <p className="font-semibold text-sm">{s.title}</p>
                <p className="text-xs text-slate-500">{formatSessionWhen(s.startsAt)}</p>
              </div>
              <span className="text-[10px] text-slate-400">{ft('forge.tutorLobby.sessionHint')}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/50 p-4 space-y-3">
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
      </section>

      <section className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
        <p className="font-bold text-slate-800">{ft('forge.tutorLobby.mapHelpTitle')}</p>
        <p className="mt-1">{ft('forge.tutorLobby.mapHelp')}</p>
        <Link
          href={`/hub/forge/cursos/${courseId}/alumnos`}
          className="mt-2 inline-flex items-center gap-1 font-bold text-violet-700"
        >
          <Users className="h-3.5 w-3.5" />
          {ft('forge.tutorLobby.seeLearners')}
        </Link>
      </section>
    </div>
  );
}
