'use client';

import { useCallback, useEffect, useState } from 'react';
import { Calendar, Plus, Trash2, Radio, PlayCircle } from 'lucide-react';
import { useForgeT } from '@/lib/forge/use-forge-t';
import {
  formatSessionWhen,
  type SerializedLiveSession,
} from '@/lib/forge/live-sessions';

type ActivityOpt = { id: string; title: string; moduleTitle: string };

type Props = {
  courseId: string;
  modules: { id: string; title: string; activities: { id: string; title: string }[] }[];
};

function SessionRecordingEditor({
  session,
  onSaved,
}: {
  session: SerializedLiveSession;
  onSaved: () => void;
}) {
  const ft = useForgeT();
  const [url, setUrl] = useState(session.recordingUrl ?? '');
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const res = await fetch(`/api/forge/live-sessions/${session.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recordingUrl: url.trim() || null }),
    });
    setBusy(false);
    if (res.ok) onSaved();
  }

  return (
    <div className="mt-2 flex flex-wrap gap-2 items-center">
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder={ft('forge.live.pasteRecording')}
        className="flex-1 min-w-[12rem] rounded-lg border border-slate-200 px-2 py-1 text-xs"
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => void save()}
        className="rounded-lg bg-violet-700 px-2 py-1 text-xs font-bold text-white disabled:opacity-50"
      >
        {busy ? '…' : ft('forge.live.saveRecording')}
      </button>
      {session.recordingUrl && (
        <a
          href={session.recordingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-semibold text-violet-700 underline"
        >
          <PlayCircle className="h-3 w-3" />
          {ft('forge.live.recording')}
        </a>
      )}
    </div>
  );
}

export function ForgeLiveSessionsManager({ courseId, modules }: Props) {
  const ft = useForgeT();
  const [sessions, setSessions] = useState<SerializedLiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    title: '',
    startsAt: '',
    endsAt: '',
    meetingUrl: '',
    activityId: '',
    facilitatorNotes: '',
  });
  const [busy, setBusy] = useState(false);

  const activities: ActivityOpt[] = modules.flatMap((m) =>
    m.activities.map((a) => ({ id: a.id, title: a.title, moduleTitle: m.title }))
  );

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/forge/courses/${courseId}/live-sessions`);
    const data = await res.json();
    if (res.ok) setSessions(data.sessions ?? []);
    setLoading(false);
  }, [courseId]);

  useEffect(() => {
    load();
  }, [load]);

  async function addSession() {
    if (!form.title.trim() || !form.startsAt) {
      alert(ft('forge.live.titleRequired'));
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/forge/courses/${courseId}/live-sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: form.title.trim(),
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
        meetingUrl: form.meetingUrl || undefined,
        activityId: form.activityId || undefined,
        facilitatorNotes: form.facilitatorNotes || undefined,
      }),
    });
    setBusy(false);
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || ft('forge.general.error'));
      return;
    }
    setForm({
      title: '',
      startsAt: '',
      endsAt: '',
      meetingUrl: '',
      activityId: '',
      facilitatorNotes: '',
    });
    await load();
  }

  async function removeSession(id: string) {
    if (!confirm(ft('forge.live.deleteConfirm'))) return;
    const res = await fetch(`/api/forge/live-sessions/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const d = await res.json();
      alert(d.error || ft('forge.general.error'));
      return;
    }
    await load();
  }

  return (
    <div className="rounded-2xl border border-violet-200 bg-white p-5 shadow-sm space-y-4">
      <div>
        <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
          <Calendar className="h-5 w-5 text-violet-600" />
          {ft('forge.live.calendar')}
        </h3>
        <p className="mt-1 text-sm text-slate-500">{ft('forge.live.managerHint')}</p>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">{ft('forge.live.loading')}</p>
      ) : sessions.length === 0 ? (
        <p className="text-sm text-slate-500 rounded-lg bg-slate-50 p-3">{ft('forge.live.emptySessions')}</p>
      ) : (
        <ul className="space-y-2">
          {sessions.map((s) => (
            <li
              key={s.id}
              className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 ${
                s.status === 'live'
                  ? 'border-emerald-300 bg-emerald-50'
                  : s.status === 'upcoming'
                    ? 'border-violet-200 bg-violet-50/50'
                    : 'border-slate-100 bg-slate-50/80 opacity-75'
              }`}
            >
              <div>
                <p className="font-semibold text-slate-900 flex items-center gap-2">
                  {s.status === 'live' && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
                      <Radio className="h-3 w-3 animate-pulse" /> {ft('forge.live.liveBadge')}
                    </span>
                  )}
                  {s.title}
                </p>
                <p className="text-xs text-slate-600 mt-0.5">
                  {formatSessionWhen(s.startsAt)}
                  {s.endsAt ? ` → ${formatSessionWhen(s.endsAt)}` : ''}
                </p>
                {s.activityTitle && (
                  <p className="text-xs text-violet-700 mt-1">
                    {ft('forge.live.focus', { title: s.activityTitle })}
                  </p>
                )}
                {(s.status === 'past' || s.status === 'live') && (
                  <SessionRecordingEditor session={s} onSaved={() => void load()} />
                )}
              </div>
              <button
                type="button"
                onClick={() => removeSession(s.id)}
                className="shrink-0 rounded-lg p-2 text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-xl border border-dashed border-violet-300 p-4 space-y-3">
        <p className="text-sm font-bold text-slate-800 flex items-center gap-1">
          <Plus className="h-4 w-4" /> {ft('forge.live.newSession')}
        </p>
        <input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder={ft('forge.live.titlePlaceholder')}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-slate-600">
            {ft('forge.live.startLabel')}
            <input
              type="datetime-local"
              value={form.startsAt}
              onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs text-slate-600">
            {ft('forge.live.endLabel')}
            <input
              type="datetime-local"
              value={form.endsAt}
              onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
        </div>
        <select
          value={form.activityId}
          onChange={(e) => setForm({ ...form, activityId: e.target.value })}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="">{ft('forge.live.noActivity')}</option>
          {activities.map((a) => (
            <option key={a.id} value={a.id}>
              {a.moduleTitle} — {a.title}
            </option>
          ))}
        </select>
        <input
          value={form.meetingUrl}
          onChange={(e) => setForm({ ...form, meetingUrl: e.target.value })}
          placeholder={ft('forge.live.meetingPlaceholder')}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <textarea
          value={form.facilitatorNotes}
          onChange={(e) => setForm({ ...form, facilitatorNotes: e.target.value })}
          rows={2}
          placeholder={ft('forge.live.facilitatorNotes')}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <button
          type="button"
          disabled={busy}
          onClick={addSession}
          className="rounded-xl bg-violet-700 px-5 py-2 text-sm font-bold text-white hover:bg-violet-800 disabled:opacity-50"
        >
          {busy ? '…' : ft('forge.live.addSession')}
        </button>
      </div>
    </div>
  );
}
