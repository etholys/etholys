'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Calendar, Copy, Plus, UserPlus, Users, Video } from 'lucide-react';
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
  hasInvite: boolean;
};

export function ForgeTutorLobby({ courseId }: { courseId: string }) {
  const ft = useForgeT();
  const [sessions, setSessions] = useState<SerializedLiveSession[]>([]);
  const [groups, setGroups] = useState<PlayGroup[]>([]);
  const [newName, setNewName] = useState('');
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
      body: JSON.stringify({ name: newName.trim(), mode }),
    });
    const d = await res.json();
    setBusy(false);
    if (res.ok) {
      setNewName('');
      setLastInvite(d.inviteUrl ?? null);
      void load();
    } else alert(d.error || ft('forge.general.error'));
  }

  function copyInvite() {
    if (!lastInvite) return;
    void navigator.clipboard.writeText(lastInvite);
    alert(ft('forge.tutorLobby.copied'));
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-black text-slate-900">{ft('forge.tutorLobby.title')}</h1>
        <p className="text-sm text-slate-600 mt-1">{ft('forge.tutorLobby.subtitle')}</p>
        <p className="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {ft('forge.tutorLobby.pickRoom')}
        </p>
      </div>

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

      <section className="rounded-2xl border bg-white p-4 space-y-3">
        <h2 className="font-bold flex items-center gap-2">
          <Calendar className="h-5 w-5 text-violet-600" />
          {ft('forge.tutorLobby.sessions')}
        </h2>
        <ul className="space-y-2">
          {sessions.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3">
              <div>
                <p className="font-semibold">{s.title}</p>
                <p className="text-xs text-slate-500">{formatSessionWhen(s.startsAt)}</p>
              </div>
              <Link
                href={`/hub/forge/cursos/${courseId}/sala?session=${s.id}`}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white"
              >
                <Video className="h-3.5 w-3.5" />
                {ft('forge.room.enter')}
              </Link>
            </li>
          ))}
          {sessions.length === 0 && (
            <p className="text-sm text-slate-500">{ft('forge.tutorLobby.noSessions')}</p>
          )}
        </ul>
      </section>

      <section className="rounded-2xl border bg-white p-4 space-y-3">
        <h2 className="font-bold flex items-center gap-2">
          <Users className="h-5 w-5 text-blue-600" />
          {ft('forge.tutorLobby.groups')}
        </h2>
        <p className="text-xs text-slate-600">{ft('forge.tutorLobby.groupsHint')}</p>
        <div className="flex flex-wrap gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={ft('forge.tutorLobby.groupName')}
            className="flex-1 min-w-[160px] rounded-lg border px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void createGroup('live_team')}
            className="inline-flex items-center gap-1 rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {ft('forge.tutorLobby.createGroup')}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void createGroup('individual_coaching')}
            className="inline-flex items-center gap-1 rounded-lg bg-violet-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {ft('forge.tutorLobby.createCoaching')}
          </button>
        </div>
        {lastInvite && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs">
            <p className="font-bold text-emerald-900">{ft('forge.tutorLobby.inviteLink')}</p>
            <p className="mt-1 break-all font-mono text-emerald-800">{lastInvite}</p>
            <button
              type="button"
              onClick={copyInvite}
              className="mt-2 inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-1.5 font-bold text-white"
            >
              <Copy className="h-3.5 w-3.5" />
              {ft('forge.tutorLobby.copyLink')}
            </button>
          </div>
        )}
        <ul className="space-y-2">
          {groups.map((g) => (
            <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3">
              <div>
                <p className="font-semibold">{g.name}</p>
                <p className="text-xs text-slate-500">
                  {g.memberCount} {ft('forge.tutorLobby.members')}
                  {g.mode === 'individual_coaching' ? ` · ${ft('forge.tutorLobby.coaching')}` : ''}
                </p>
              </div>
              <Link
                href={`/hub/forge/cursos/${courseId}/sala?group=${g.id}${g.liveSessionId ? `&session=${g.liveSessionId}` : ''}`}
                className="rounded-lg bg-violet-700 px-3 py-2 text-xs font-bold text-white"
              >
                {ft('forge.room.enter')}
              </Link>
            </li>
          ))}
          {groups.length === 0 && (
            <p className="text-sm text-slate-500">{ft('forge.tutorLobby.noGroups')}</p>
          )}
        </ul>
      </section>
    </div>
  );
}
