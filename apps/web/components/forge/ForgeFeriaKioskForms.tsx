'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { FERIA_AGE_RANGES, FERIA_GENDERS } from '@/lib/forge/feria-kiosk-core';
import { useForgeLocale, useForgeT } from '@/lib/forge/use-forge-t';

type SuccessPayload = {
  accessCode: string;
  teamNumber: number;
  playGroupName: string;
  redirect: string;
  magicLoginToken: string;
  existing: boolean;
};

export function ForgeFeriaRegisterForm({ initialRoomCode = '' }: { initialRoomCode?: string }) {
  const ft = useForgeT();
  const locale = useForgeLocale();
  const router = useRouter();
  const [roomCode, setRoomCode] = useState(initialRoomCode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [ageRange, setAgeRange] = useState('');
  const [gender, setGender] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<SuccessPayload | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/forge/feria/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode,
          name,
          email,
          ageRange: ageRange || undefined,
          gender: gender || undefined,
          consent,
          locale,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || ft('forge.general.error'));
        return;
      }
      setSuccess(data as SuccessPayload);
      try {
        localStorage.setItem(
          `forge_feria_${roomCode.trim().toUpperCase()}`,
          JSON.stringify({ email, accessCode: data.accessCode })
        );
      } catch {
        /* ignore */
      }
    } finally {
      setBusy(false);
    }
  };

  const enterRoom = async () => {
    if (!success) return;
    setBusy(true);
    setError('');
    const login = await signIn('credentials', {
      redirect: false,
      email: email.trim().toLowerCase(),
      password: 'forge-magic',
      forgeMagicToken: success.magicLoginToken,
    } as Parameters<typeof signIn>[1]);
    setBusy(false);
    if (login?.error) {
      setError(ft('forge.groupJoin.loginFailed'));
      return;
    }
    router.replace(success.redirect);
  };

  if (success) {
    return (
      <div className="space-y-4 rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
        {success.existing && (
          <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
            {ft('forge.feria.alreadyRegistered')}
          </p>
        )}
        <div className="text-center space-y-1">
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
            {ft('forge.feria.personalCode')}
          </p>
          <p className="text-3xl font-black tracking-[0.2em] text-slate-900">{success.accessCode}</p>
          <p className="text-xs text-slate-500">{ft('forge.feria.personalCodeHint')}</p>
        </div>
        <p className="text-sm text-center text-slate-700">
          {ft('forge.feria.teamAssigned', { team: String(success.teamNumber) })}
        </p>
        <button
          type="button"
          onClick={enterRoom}
          className="w-full rounded-xl bg-emerald-700 py-3 text-sm font-bold text-white shadow active:scale-[0.98]"
        >
          {ft('forge.feria.goToRoom')}
        </button>
        <p className="text-center text-xs">
          <Link href={`/expedicion/volver?room=${encodeURIComponent(roomCode)}`} className="text-emerald-800 underline">
            {ft('forge.feria.haveCode')}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">{ft('forge.feria.roomCode')}</label>
        <input
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-lg font-bold tracking-widest uppercase"
          placeholder="ABC123"
          required
          autoComplete="off"
        />
        <p className="mt-1 text-[11px] text-slate-500">{ft('forge.feria.roomCodeHint')}</p>
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">{ft('forge.feria.name')}</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5"
          required
          autoComplete="name"
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">{ft('forge.feria.email')}</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5"
          required
          autoComplete="email"
        />
        <p className="mt-1 text-[11px] text-slate-500">{ft('forge.feria.emailRequiredHint')}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">{ft('forge.feria.age')}</label>
          <select
            value={ageRange}
            onChange={(e) => setAgeRange(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-2 py-2.5 text-sm"
          >
            <option value="">{ft('forge.feria.selectAge')}</option>
            {FERIA_AGE_RANGES.map((id) => (
              <option key={id} value={id}>
                {ft(`forge.feria.age.${id}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">{ft('forge.feria.gender')}</label>
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-2 py-2.5 text-sm"
          >
            <option value="">{ft('forge.feria.selectGender')}</option>
            {FERIA_GENDERS.map((id) => (
              <option key={id} value={id}>
                {ft(`forge.feria.gender.${id}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <label className="flex items-start gap-2 text-xs text-slate-600">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5"
          required
        />
        <span>{ft('forge.feria.consent')}</span>
      </label>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-xl bg-emerald-700 py-3 text-sm font-bold text-white shadow disabled:opacity-60"
      >
        {busy ? ft('forge.general.loading') : ft('forge.feria.submit')}
      </button>

      <p className="text-center text-xs text-slate-500">
        <Link href={`/expedicion/volver${roomCode ? `?room=${encodeURIComponent(roomCode)}` : ''}`} className="text-emerald-800 underline">
          {ft('forge.feria.haveCode')}
        </Link>
      </p>
    </form>
  );
}

export function ForgeFeriaRejoinForm({ initialRoomCode = '' }: { initialRoomCode?: string }) {
  const ft = useForgeT();
  const locale = useForgeLocale();
  const router = useRouter();
  const [roomCode, setRoomCode] = useState(initialRoomCode);
  const [email, setEmail] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!initialRoomCode) return;
    try {
      const saved = localStorage.getItem(`forge_feria_${initialRoomCode.trim().toUpperCase()}`);
      if (saved) {
        const parsed = JSON.parse(saved) as { email?: string; accessCode?: string };
        if (parsed.email) setEmail(parsed.email);
        if (parsed.accessCode) setAccessCode(parsed.accessCode);
      }
    } catch {
      /* ignore */
    }
  }, [initialRoomCode]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/forge/feria/rejoin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode, email, accessCode, locale }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || ft('forge.general.error'));
        return;
      }
      const login = await signIn('credentials', {
        redirect: false,
        email: email.trim().toLowerCase(),
        password: 'forge-magic',
        forgeMagicToken: data.magicLoginToken,
      } as Parameters<typeof signIn>[1]);
      if (login?.error) {
        setError(ft('forge.groupJoin.loginFailed'));
        return;
      }
      router.replace(data.redirect);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">{ft('forge.feria.roomCode')}</label>
        <input
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-lg font-bold tracking-widest uppercase"
          required
        />
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">{ft('forge.feria.email')}</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5"
          required
        />
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">{ft('forge.feria.personalCode')}</label>
        <input
          value={accessCode}
          onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-lg font-bold tracking-widest uppercase"
          required
        />
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-xl bg-emerald-700 py-3 text-sm font-bold text-white shadow disabled:opacity-60"
      >
        {busy ? ft('forge.general.loading') : ft('forge.feria.returnSubmit')}
      </button>

      <p className="text-center text-xs text-slate-500">
        <Link href={`/expedicion/entrar${roomCode ? `?room=${encodeURIComponent(roomCode)}` : ''}`} className="text-emerald-800 underline">
          {ft('forge.feria.newHere')}
        </Link>
      </p>
    </form>
  );
}
