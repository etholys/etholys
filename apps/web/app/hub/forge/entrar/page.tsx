'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession, signIn } from 'next-auth/react';
import Link from 'next/link';
import { GraduationCap } from 'lucide-react';
import { mapForgeInviteError } from '@/lib/forge/i18n';
import { useForgeLocale, useForgeT } from '@/lib/forge/use-forge-t';

function EntrarContent() {
  const ft = useForgeT();
  const loc = useForgeLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token')?.trim() ?? '';
  const { status } = useSession();
  const [preview, setPreview] = useState<{
    courseTitle: string;
    coverEmoji: string;
    emailHint: string | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) {
      setError(ft('forge.entrar.missingToken'));
      return;
    }
    fetch(`/api/forge/invite/preview?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(mapForgeInviteError(d.error || ft('forge.invite.invalid'), loc));
        setPreview({
          courseTitle: d.courseTitle,
          coverEmoji: d.coverEmoji,
          emailHint: d.emailHint,
        });
      })
      .catch((e) => setError(e instanceof Error ? e.message : ft('forge.general.error')));
  }, [token, ft, loc]);

  useEffect(() => {
    if (status !== 'authenticated' || !token || !preview || error) return;
    setBusy(true);
    fetch('/api/forge/invite/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || ft('forge.general.error'));
        router.replace(d.redirect || `/hub/forge/cursos/${d.courseId}`);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : ft('forge.general.error'));
        setBusy(false);
      });
  }, [status, token, preview, error, router, ft]);

  if (!token) {
    return <p className="text-center text-slate-600">{ft('forge.entrar.incomplete')}</p>;
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-800">
        {error}
        <p className="mt-4">
          <Link href="/login" className="text-blue-700 underline">
            {ft('forge.entrar.login')}
          </Link>
        </p>
      </div>
    );
  }

  if (!preview) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-600/30 border-t-blue-600" />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm text-center space-y-4">
        <span className="text-5xl">{preview.coverEmoji}</span>
        <h1 className="text-2xl font-black text-slate-900">{preview.courseTitle}</h1>
        <p className="text-slate-600">
          {ft('forge.entrar.inviteFor')} {preview.emailHint ?? ft('forge.entrar.yourAccount')}.
        </p>
        <button
          type="button"
          onClick={() =>
            signIn(undefined, {
              callbackUrl: `/hub/forge/entrar?token=${encodeURIComponent(token)}`,
            })
          }
          className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-6 py-3 text-sm font-bold text-white hover:bg-blue-800"
        >
          <GraduationCap className="h-5 w-5" />
          {ft('forge.entrar.loginEnter')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 py-16 text-slate-600">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-violet-600/30 border-t-violet-600" />
      <p>{busy ? ft('forge.entrar.activating') : ft('forge.entrar.preparing')}</p>
    </div>
  );
}

export default function ForgeEntrarPage() {
  const ft = useForgeT();
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <Suspense fallback={<p className="text-center text-slate-500">{ft('forge.general.loading')}</p>}>
          <EntrarContent />
        </Suspense>
      </div>
    </div>
  );
}
