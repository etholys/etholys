'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Loader2 } from 'lucide-react';
import { MeetConferenceFrame } from '@/components/meet/MeetConferenceFrame';
import { meetEmbedUrl } from '@/lib/meet/room';
import { meetHubJoinPath } from '@/lib/meet/types';
import { useApp } from '@/app/providers';

type PublicSession = {
  id: string;
  companyId: string;
  title: string;
  meetingUrl: string;
  status: string;
};

function GuestJoinContent() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { status: authStatus } = useSession();
  const { locale } = useApp();
  const t = (pt: string, es: string, en: string) =>
    locale === 'pt' ? pt : locale === 'en' ? en : es;
  const companyHint = searchParams.get('companyId')?.trim() || '';
  const [row, setRow] = useState<PublicSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [joinedName, setJoinedName] = useState<string | null>(null);
  const [checkingAccount, setCheckingAccount] = useState(true);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/meet/public/${encodeURIComponent(sessionId)}`);
        const d = (await r.json()) as { session?: PublicSession; error?: string };
        if (!r.ok || !d.session?.meetingUrl) throw new Error(d.error || 'Reunião não encontrada');
        if (!cancelled) setRow(d.session);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erro');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    if (!row) return;
    if (authStatus === 'loading') return;
    if (authStatus !== 'authenticated') {
      setCheckingAccount(false);
      return;
    }
    const companyId = companyHint || row.companyId;
    let cancelled = false;
    (async () => {
      const r = await fetch(
        `/api/meet/sessions/${row.id}?companyId=${encodeURIComponent(companyId)}`,
      );
      if (cancelled) return;
      if (r.ok) {
        router.replace(meetHubJoinPath(row.id, companyId));
        return;
      }
      setCheckingAccount(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [authStatus, row, companyHint, router]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#202124] px-6 text-center text-white">
        <p className="text-sm text-white/80">{error}</p>
      </div>
    );
  }

  if (!row || authStatus === 'loading' || checkingAccount) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#202124]">
        <Loader2 className="h-8 w-8 animate-spin text-white/70" />
      </div>
    );
  }

  if (!joinedName) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#202124] px-4">
        <form
          className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
          onSubmit={(event) => {
            event.preventDefault();
            const next = name.trim();
            if (next.length < 2) return;
            setJoinedName(next.slice(0, 80));
          }}
        >
          <p className="text-xs font-medium uppercase tracking-wide text-teal-700">CHORUS</p>
          <h1 className="mt-1 text-lg font-semibold text-slate-900">{row.title}</h1>
          <p className="mt-2 text-sm text-slate-600">
            {t(
              'Entra no browser com o teu nome. Não precisas de conta nem de instalar uma app.',
              'Entra en el navegador con tu nombre. No necesitas cuenta ni instalar una app.',
              'Join in the browser with your name. No account and no app install.',
            )}
          </p>
          <label className="mt-4 block text-xs font-medium text-slate-700">
            {t('Nome', 'Nombre', 'Name')}
            <input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder={t('Como queres aparecer', 'Cómo quieres aparecer', 'How you want to appear')}
            />
          </label>
          <button
            type="submit"
            disabled={name.trim().length < 2}
            className="mt-4 w-full rounded-full bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {t('Entrar na reunião', 'Entrar a la reunión', 'Join the meeting')}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#202124] p-2">
      <MeetConferenceFrame
        meetingUrl={meetEmbedUrl(row.meetingUrl, { title: row.title })}
        title={row.title}
        locale={locale === 'pt' || locale === 'en' ? locale : 'es'}
        displayName={joinedName}
      />
    </div>
  );
}

export default function GuestJoinPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#202124]">
          <Loader2 className="h-8 w-8 animate-spin text-white/70" />
        </div>
      }
    >
      <GuestJoinContent />
    </Suspense>
  );
}
