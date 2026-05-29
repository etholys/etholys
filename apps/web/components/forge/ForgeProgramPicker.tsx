'use client';

import { useEffect, useState } from 'react';
import { Route } from 'lucide-react';
import { useForgeT } from '@/lib/forge/use-forge-t';

type Program = { id: string; title: string };

export function ForgeProgramPicker({
  courseId,
  companyId,
  programId,
  onUpdated,
}: {
  courseId: string;
  companyId: string;
  programId?: string | null;
  onUpdated: () => void;
}) {
  const ft = useForgeT();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [value, setValue] = useState(programId ?? '');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setValue(programId ?? '');
  }, [programId]);

  useEffect(() => {
    const q = companyId ? `?companyId=${encodeURIComponent(companyId)}` : '';
    fetch(`/api/forge/programs${q}`)
      .then((r) => r.json())
      .then((d) => setPrograms(d.programs ?? []));
  }, [companyId]);

  async function save(next: string) {
    setBusy(true);
    setValue(next);
    await fetch(`/api/forge/courses/${courseId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ programId: next || null }),
    });
    setBusy(false);
    onUpdated();
  }

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-4">
      <label className="flex items-center gap-2 text-sm font-bold text-slate-800">
        <Route className="h-4 w-4 text-violet-600" />
        {ft('forge.program.picker')}
      </label>
      <select
        value={value}
        disabled={busy}
        onChange={(e) => save(e.target.value)}
        className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white"
      >
        <option value="">{ft('forge.program.none')}</option>
        {programs.map((p) => (
          <option key={p.id} value={p.id}>
            {p.title}
          </option>
        ))}
      </select>
      <p className="mt-1 text-xs text-slate-500">
        {ft('forge.program.pickerHint')}{' '}
        <a href="/hub/forge/trilhas" className="text-violet-700 underline">
          {ft('forge.nav.trails')}
        </a>
        .
      </p>
    </div>
  );
}
