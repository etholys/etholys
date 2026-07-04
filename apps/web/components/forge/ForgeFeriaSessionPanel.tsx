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

type Props = {
  courseId: string;
  editionId?: string;
  /** Aberto por defeito na página da turma */
  defaultOpen?: boolean;
  /** Esconde o botão colapsável — mostra sempre expandido */
  alwaysExpanded?: boolean;
};

export function ForgeFeriaSessionPanel({
  courseId,
  editionId,
  defaultOpen = false,
  alwaysExpanded = false,
}: Props) {
  const ft = useForgeT();
  const [sessions, setSessions] = useState<FeriaSession[]>([]);
  const [busy, setBusy] = useState(false);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [teamSize, setTeamSize] = useState(4);
  const [open, setOpen] = useState(defaultOpen || alwaysExpanded);
  const [copied, setCopied] = useState<string | null>(null);

  const query = editionId ? `?editionId=${encodeURIComponent(editionId)}` : '';

  const load = useCallback(() => {
    fetch(`/api/forge/courses/${courseId}/feria-sessions${query}`)
      .then((r) => r.json())
      .then((d) => setSessions(d.sessions ?? []))
      .catch(() => setSessions([]));
  }, [courseId, query]);

  useEffect(() => {
    if (open || alwaysExpanded) load();
  }, [open, alwaysExpanded, load]);

  const createSession = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/forge/courses/${courseId}/feria-sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title || undefined, teamSize, editionId: editionId ?? null }),
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

  const copyText = (text: string, key: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const fullEntryUrl = (path: string) =>
    typeof window !== 'undefined' ? `${window.location.origin}${path}` : path;

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

  const panelBody = (
    <div className={`space-y-3 text-xs ${alwaysExpanded ? '' : 'border-t border-emerald-200 px-3 py-3'}`}>
      <p className="text-emerald-800/90">{ft('forge.feria.facilitatorHint')}</p>

      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-[140px]">
          <label className="block font-bold text-emerald-900 mb-1">{ft('forge.feria.sessionTitle')}</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={ft('forge.feria.sessionTitlePlaceholder')}
            className="w-full rounded-lg border border-emerald-200 px-2 py-1.5 text-sm"
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
            className="w-full rounded-lg border border-emerald-200 px-2 py-1.5 text-sm"
          />
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void createSession()}
          className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-2 font-bold text-white disabled:opacity-60"
        >
          <Plus className="h-3.5 w-3.5" />
          {ft('forge.feria.createSession')}
        </button>
        <button type="button" onClick={load} className="rounded-lg border border-emerald-300 p-2 text-emerald-800">
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {sessions.length === 0 ? (
        <p className="rounded-lg border border-dashed border-emerald-300 bg-white/80 px-3 py-4 text-sm text-emerald-900">
          {ft('forge.feria.noSessionYet')}
        </p>
      ) : null}

      {sessions.map((s) => {
        const entryFull = fullEntryUrl(s.entryUrl);
        return (
          <div key={s.id} className="rounded-xl border border-emerald-200 bg-white p-4 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                  {ft('forge.feria.roomCodeLabel')}
                </p>
                <p className="text-3xl font-black text-emerald-900 tracking-[0.25em]">{s.roomCode}</p>
                {s.title ? <p className="text-sm text-emerald-800 mt-1">{s.title}</p> : null}
                <p className="text-slate-500 mt-1">{ft('forge.feria.participants', { count: s.participantCount })}</p>
              </div>
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => copyText(s.roomCode, `code-${s.id}`)}
                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 px-2 py-1 font-bold text-emerald-800"
                >
                  <Copy className="h-3 w-3" />
                  {copied === `code-${s.id}` ? ft('forge.feria.copied') : ft('forge.feria.copyCode')}
                </button>
                <button
                  type="button"
                  onClick={() => copyText(entryFull, `link-${s.id}`)}
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-2 py-1 font-bold text-white"
                >
                  <Copy className="h-3 w-3" />
                  {copied === `link-${s.id}` ? ft('forge.feria.copied') : ft('forge.feria.copyLink')}
                </button>
                <button
                  type="button"
                  onClick={() => exportSession(s)}
                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 px-2 py-1 font-bold text-emerald-800"
                >
                  <Download className="h-3 w-3" />
                  {ft('forge.feria.exportCsv')}
                </button>
              </div>
            </div>
            <p className="break-all rounded-lg bg-emerald-50 px-2 py-1.5 font-mono text-[11px] text-emerald-900">
              {entryFull}
            </p>

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

            <button
              type="button"
              disabled={busy}
              onClick={() => void createEmptyTeam(s.id)}
              className="inline-flex items-center gap-1 rounded-lg border border-dashed border-emerald-400 px-2 py-1 font-bold text-emerald-800"
            >
              <Plus className="h-3 w-3" />
              {ft('forge.feria.createEmptyTeam')}
            </button>
          </div>
        );
      })}
    </div>
  );

  if (alwaysExpanded) {
    return (
      <section className="rounded-2xl border-2 border-emerald-300 bg-emerald-50/80 p-4 space-y-2">
        <h2 className="font-bold flex items-center gap-2 text-emerald-900 text-sm">
          <Users className="h-5 w-5" />
          {ft('forge.feria.facilitatorTitle')}
        </h2>
        {panelBody}
      </section>
    );
  }

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
      {open && panelBody}
    </div>
  );
}
