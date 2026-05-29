'use client';

import { useState } from 'react';
import { Mail, UserPlus } from 'lucide-react';
import { useForgeLocale, useForgeT } from '@/lib/forge/use-forge-t';

export function ForgeInviteLearners({ courseId }: { courseId: string }) {
  const ft = useForgeT();
  const locale = useForgeLocale();
  const [emails, setEmails] = useState('');
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<
    { email: string; ok: boolean; error?: string; inviteUrl?: string; emailSent?: boolean }[] | null
  >(null);

  async function invite() {
    const list = emails
      .split(/[\n,;]+/)
      .map((e) => e.trim())
      .filter(Boolean);
    if (list.length === 0) return;
    setBusy(true);
    setResults(null);
    const res = await fetch(`/api/forge/courses/${courseId}/invite-learners`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emails: list, locale }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      alert(data.error || 'Erro');
      return;
    }
    setResults(data.results ?? []);
    setEmails('');
  }

  return (
    <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-5 space-y-4">
      <div>
        <h3 className="flex items-center gap-2 font-bold text-slate-900">
          <UserPlus className="h-5 w-5 text-blue-600" />
          {ft('forge.invite.panel')}
        </h3>
        <p className="mt-1 text-sm text-slate-600">{ft('forge.invite.panelHint')}</p>
      </div>
      <textarea
        value={emails}
        onChange={(e) => setEmails(e.target.value)}
        rows={4}
        placeholder="alumno1@institucion.edu&#10;alumno2@institucion.edu"
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
      />
      <button
        type="button"
        disabled={busy}
        onClick={invite}
        className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-50"
      >
        <Mail className="h-4 w-4" />
        {busy ? '…' : ft('forge.invite.send')}
      </button>
      {results && (
        <ul className="text-sm space-y-3">
          {results.map((r) => (
            <li key={r.email} className={r.ok ? 'text-emerald-800' : 'text-red-600'}>
              <span className="font-medium">{r.email}</span>{' '}
              {r.ok ? (
                <>
                  ✓{' '}
                  {r.emailSent ? ft('forge.invite.resultEmailSent') : ft('forge.invite.resultCopyLink')}
                  {r.inviteUrl && (
                    <input
                      readOnly
                      value={r.inviteUrl}
                      className="mt-1 block w-full rounded-lg border border-emerald-200 bg-white px-2 py-1 text-xs font-mono text-slate-700"
                      onFocus={(e) => e.target.select()}
                    />
                  )}
                </>
              ) : (
                `— ${r.error}`
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-slate-500">{ft('forge.invite.resendHint')}</p>
    </div>
  );
}
