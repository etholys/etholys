'use client';

import { useCallback, useEffect, useState } from 'react';
import { Copy, Download, Plus, RefreshCw, Users } from 'lucide-react';
import { buildFeriaSessionCsv, downloadCsv, type FeriaExportRow } from '@/lib/forge/feria-export';
import { useForgeT } from '@/lib/forge/use-forge-t';

type FeriaMember = {
  id: string;
  name: string;
  email: string;
  accessCode: string;
  ageRange: string | null;
  gender: string | null;
  locale: string;
  registeredAt: string;
};

type FeriaGroup = {
  id: string;
  name: string;
  teamNumber: number;
  memberCount: number;
  members: FeriaMember[];
};

type FeriaSession = {
  id: string;
  roomCode: string;
  title: string | null;
  teamSize: number;
  active: boolean;
  participantCount: number;
  entryUrl: string;
  groups: FeriaGroup[];
};

export function ForgeFeriaSessionPanel({ courseId }: { courseId: string }) {
  const ft = useForgeT();
  const [sessions, setSessions] = useState<FeriaSession[]>([]);
  const [busy, setBusy] = useState(false);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [teamSize, setTeamSize] = useState(4);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`/api/forge/courses/${courseId}/feria-sessions`)
      .then((r) => r.json())
      .then((d) => setSessions(d.sessions ?? []))
      .catch(() => setSessions([]));
  }, [courseId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const createSession = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/forge/courses/${courseId}/feria-sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title || undefined, teamSize }),
      });
      if (res.ok) {
        setTitle('');
        load();
      }
    } finally {
      setBusy(false);
    }
  };

  const createEmptyTeam = async (sessionId: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/forge/courses/${courseId}/feria-sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, createEmptyGroup: true }),
      });
      if (res.ok) load();
    } finally {
      setBusy(false);
    }
  };

  const moveMember = async (registrationId: string, playGroupId: string) => {
    setMovingId(registrationId);
    try {
      const res = await fetch(`/api/forge/courses/${courseId}/feria-sessions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationId, playGroupId }),
      });
      if (res.ok) load();
    } finally {
      setMovingId(null);
    }
  };

  const copyLink = (path: string) => {
    const url = `${window.location.origin}${path}`;
    void navigator.clipboard.writeText(url);
    setCopied(path);
    setTimeout(() => setCopied(null), 2000);
  };

  const exportSession = (session: FeriaSession) => {
    const rows: FeriaExportRow[] = [];
    for (const g of session.groups) {
      for (const m of g.members) {
        rows.push({
          roomCode: session.roomCode,
          sessionTitle: session.title,
          teamNumber: g.teamNumber,
          teamName: g.name,
          name: m.name,
          email: m.email,
          accessCode: m.accessCode,
          ageRange: m.ageRange,
          gender: m.gender,
          locale: m.locale,
          registeredAt: m.registeredAt,
        });
      }
    }
    downloadCsv(`feria-${session.roomCode}.csv`, buildFeriaSessionCsv(rows));
  };

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-bold text-emerald-900 hover:bg-emerald-100/60"
      >
        <Users className="h-4 w-4" />
        {ft('forge.feria.facilitatorTitle')}
      </button>
      {open && (
        <div className="border-t border-emerald-200 px-3 py-3 space-y-3 text-xs">
          <p className="text-emerald-800/80">{ft('forge.feria.facilitatorHint')}</p>

          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[120px]">
              <label className="block font-bold text-emerald-900 mb-1">{ft('forge.feria.sessionTitle')}</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-emerald-200 px-2 py-1.5"
              />
            </div>
            <div className="w-20">
              <label className="block font-bold text-emerald-900 mb-1">{ft('forge.feria.teamSize')}</label>
              <input
                type="number"
                min={2}
                max={8}
                value={teamSize}
                onChange={(e) => setTeamSize(Number(e.target.value) || 4)}
                className="w-full rounded-lg border border-emerald-200 px-2 py-1.5"
              />
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={createSession}
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-2 font-bold text-white disabled:opacity-60"
            >
              <Plus className="h-3.5 w-3.5" />
              {ft('forge.feria.createSession')}
            </button>
            <button type="button" onClick={load} className="rounded-lg border border-emerald-300 p-2 text-emerald-800">
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>

          {sessions.map((s) => (
            <div key={s.id} className="rounded-lg border border-emerald-200 bg-white p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-black text-emerald-900 tracking-widest">{s.roomCode}</p>
                  <p className="text-emerald-700">{s.title || '—'}</p>
                  <p className="text-slate-500">{ft('forge.feria.participants', { count: s.participantCount })}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => copyLink(s.entryUrl)}
                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 px-2 py-1 font-bold text-emerald-800"
                  >
                    <Copy className="h-3 w-3" />
                    {copied === s.entryUrl ? ft('forge.feria.copied') : ft('forge.feria.copyLink')}
                  </button>
                  <button
                    type="button"
                    onClick={() => exportSession(s)}
                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 px-2 py-1 font-bold text-emerald-800"
                  >
                    <Download className="h-3 w-3" />
                    {ft('forge.feria.exportCsv')}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => createEmptyTeam(s.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-dashed border-emerald-400 px-2 py-1 font-bold text-emerald-800"
                  >
                    <Plus className="h-3 w-3" />
                    {ft('forge.feria.createEmptyTeam')}
                  </button>
                </div>
              </div>

              {s.groups.length > 0 && (
                <div>
                  <p className="font-bold text-slate-700 mb-1">{ft('forge.feria.autoGroups')}</p>
                  <div className="space-y-2 max-h-48 overflow-auto">
                    {s.groups.map((g) => (
                      <div key={g.id} className="rounded bg-slate-50 px-2 py-1.5 space-y-1">
                        <p>
                          <span className="font-bold">{g.name}</span>
                          <span className="text-slate-500 ml-2">
                            ({g.memberCount}/{s.teamSize})
                          </span>
                        </p>
                        {g.members.map((m) => (
                          <div key={m.id} className="flex flex-wrap items-center gap-1 pl-2">
                            <span className="text-slate-700">{m.name}</span>
                            <span className="text-slate-400 text-[10px]">{m.email}</span>
                            <select
                              value={g.id}
                              disabled={movingId === m.id}
                              onChange={(e) => {
                                const next = e.target.value;
                                if (next && next !== g.id) void moveMember(m.id, next);
                              }}
                              className="ml-auto rounded border border-slate-200 px-1 py-0.5 text-[10px]"
                              aria-label={ft('forge.feria.moveToTeam')}
                            >
                              {s.groups.map((opt) => (
                                <option key={opt.id} value={opt.id}>
                                  {ft('forge.feria.teamOption', { n: opt.teamNumber })}
                                </option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
