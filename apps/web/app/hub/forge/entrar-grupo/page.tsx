'use client';

import { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Users } from 'lucide-react';
import { useForgeT } from '@/lib/forge/use-forge-t';

function EntrarGrupoContent() {
  const ft = useForgeT();
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token')?.trim() ?? '';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function join(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !email.trim()) return;
    setBusy(true);
    setError('');
    const res = await fetch('/api/forge/play-groups/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, email: email.trim(), name: name.trim() || undefined }),
    });
    const d = await res.json();
    if (!res.ok) {
      setError(d.error || ft('forge.general.error'));
      setBusy(false);
      return;
    }
    const login = await signIn('credentials', {
      redirect: false,
      email: email.trim().toLowerCase(),
      password: 'forge-magic',
      forgeMagicToken: d.magicLoginToken,
    } as Parameters<typeof signIn>[1]);
    setBusy(false);
    if (login?.error) {
      setError(ft('forge.groupJoin.loginFailed'));
      return;
    }
    router.replace(d.redirect || `/hub/forge/cursos/${d.courseId}`);
  }

  if (!token) {
    return <p className="text-center text-red-600">{ft('forge.groupJoin.invalidLink')}</p>;
  }

  return (
    <form
      onSubmit={(e) => void join(e)}
      className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-lg space-y-4"
    >
      <div className="flex items-center gap-2 text-emerald-800">
        <Users className="h-6 w-6" />
        <h1 className="text-xl font-black">{ft('forge.groupJoin.title')}</h1>
      </div>
      <p className="text-sm text-slate-600">{ft('forge.groupJoin.subtitle')}</p>
      <input
        type="text"
        required
        placeholder={ft('forge.groupJoin.name')}
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full rounded-lg border px-3 py-2.5 text-sm"
      />
      <input
        type="email"
        required
        placeholder={ft('forge.groupJoin.email')}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-lg border px-3 py-2.5 text-sm"
      />
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-xl bg-emerald-700 py-3 text-sm font-bold text-white disabled:opacity-50"
      >
        {busy ? ft('forge.general.loading') : ft('forge.groupJoin.enter')}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}

export default function EntrarGrupoPage() {
  return (
    <div className="min-h-dvh flex items-center justify-center p-4 bg-slate-100">
      <Suspense
        fallback={
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-600/30 border-t-emerald-600" />
        }
      >
        <EntrarGrupoContent />
      </Suspense>
    </div>
  );
}
