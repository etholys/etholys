'use client';

import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { useForgeT } from '@/lib/forge/use-forge-t';

export function ForgeAssignFacilitator({ courseId }: { courseId: string }) {
  const ft = useForgeT();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);

  async function assign() {
    if (!email.trim()) return;
    setBusy(true);
    setOk(false);
    const res = await fetch(`/api/forge/courses/${courseId}/facilitators`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim() }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json();
      alert(d.error || ft('forge.general.error'));
      return;
    }
    setOk(true);
    setEmail('');
  }

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/30 p-4 space-y-2">
      <h4 className="flex items-center gap-2 text-sm font-bold text-violet-900">
        <UserPlus className="h-4 w-4" />
        {ft('forge.facilitator.add')}
      </h4>
      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@empresa.com"
          className="flex-1 rounded-lg border px-3 py-2 text-sm"
        />
        <button
          type="button"
          disabled={busy}
          onClick={assign}
          className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-bold text-white hover:bg-violet-800 disabled:opacity-50"
        >
          {busy ? '…' : ft('forge.facilitator.addBtn')}
        </button>
      </div>
      {ok && <p className="text-xs text-emerald-700">{ft('forge.facilitator.ok')}</p>}
      <p className="text-xs text-slate-500">{ft('forge.facilitator.hint')}</p>
    </div>
  );
}
