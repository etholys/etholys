'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { KeyRound, Zap } from 'lucide-react';
import { mapForgeInviteError } from '@/lib/forge/i18n';
import { useForgeLocale, useForgeT } from '@/lib/forge/use-forge-t';

function ActivarContent() {
  const ft = useForgeT();
  const loc = useForgeLocale();
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token')?.trim() ?? '';
  const [preview, setPreview] = useState<{
    courseTitle: string;
    emailHint: string | null;
    loginEmail: string | null;
    courseId: string;
  } | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) {
      setError(ft('forge.invite.incomplete'));
      return;
    }
    fetch(`/api/forge/invite/preview?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(mapForgeInviteError(d.error || ft('forge.invite.invalid'), loc));
        setPreview({
          courseTitle: d.courseTitle,
          emailHint: d.emailHint,
          loginEmail: d.loginEmail ?? null,
          courseId: d.courseId,
        });
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : ft('forge.general.error'))
      );
  }, [token, ft, loc]);

  async function setPasswordAndEnter() {
    if (password.length < 8) {
      setError(ft('forge.invite.passwordMin'));
      return;
    }
    if (password !== confirm) {
      setError(ft('forge.invite.passwordMismatch'));
      return;
    }
    setBusy(true);
    setError('');
    const res = await fetch('/api/forge/invite/setup-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });
    const d = await res.json();
    if (!res.ok) {
      setError(mapForgeInviteError(d.error || ft('forge.general.error'), loc));
      setBusy(false);
      return;
    }
    const login = await signIn('credentials', {
      redirect: false,
      email: d.email,
      password,
    });
    setBusy(false);
    if (login?.error) {
      setError(ft('forge.invite.accountCreatedLogin'));
      return;
    }
    router.replace(d.redirect || `/hub/forge/cursos/${d.courseId}`);
  }

  async function magicEnter() {
    if (!preview?.loginEmail) return;
    setBusy(true);
    setError('');
    const login = await signIn('credentials', {
      redirect: false,
      email: preview.loginEmail,
      password: 'forge-magic',
      forgeMagicToken: token,
    } as Record<string, string>);
    setBusy(false);
    if (login?.error) {
      setError(ft('forge.invite.magicFailed'));
      return;
    }
    await fetch('/api/forge/invite/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    }).catch(() => {});
    router.replace(`/hub/forge/cursos/${preview.courseId}`);
  }

  if (error && !preview) {
    return <p className="text-center text-red-600">{error}</p>;
  }

  if (!preview) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-600/30 border-t-blue-600" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-white p-6 sm:p-8 shadow-lg space-y-5 max-w-md w-full">
      <h1 className="text-xl font-black text-slate-900">{ft('forge.invite.activate')}</h1>
      <p className="text-sm text-slate-600">
        {ft('forge.invite.course')}: <strong>{preview.courseTitle}</strong>
        {preview.emailHint && <> · {preview.emailHint}</>}
      </p>

      <button
        type="button"
        disabled={busy}
        onClick={magicEnter}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-700 py-3 text-sm font-bold text-white hover:bg-violet-800 disabled:opacity-50"
      >
        <Zap className="h-4 w-4" />
        {ft('forge.invite.magic')}
      </button>

      <p className="text-center text-xs text-slate-400">{ft('forge.invite.orPassword')}</p>

      <div className="space-y-3">
        <input
          type="password"
          placeholder={ft('forge.invite.passwordNew')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border px-3 py-3 text-base"
        />
        <input
          type="password"
          placeholder={ft('forge.invite.passwordRepeat')}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="w-full rounded-lg border px-3 py-3 text-base"
        />
        <button
          type="button"
          disabled={busy}
          onClick={setPasswordAndEnter}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 py-3 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-50"
        >
          <KeyRound className="h-4 w-4" />
          {ft('forge.invite.password')}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <p className="text-xs text-slate-500 text-center">
        <Link href="/login" className="underline">
          {ft('forge.invite.hasAccount')}
        </Link>
      </p>
    </div>
  );
}

function ActivarLoading() {
  const ft = useForgeT();
  return <p className="text-slate-500">{ft('forge.invite.loading')}</p>;
}

export default function ForgeActivarPage() {
  return (
    <div className="min-h-dvh flex items-center justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <Suspense fallback={<ActivarLoading />}>
        <ActivarContent />
      </Suspense>
    </div>
  );
}
