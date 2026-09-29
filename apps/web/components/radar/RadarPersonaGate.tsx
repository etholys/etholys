'use client';

import { useState } from 'react';
import { Building2, Handshake, Loader2 } from 'lucide-react';
import { RADAR_ORG_ROLE_COPY, type RadarOrgRole } from '@/lib/radar/org-role';

type Loc = 'pt' | 'es' | 'en';

const GATE = {
  pt: {
    eyebrow: 'RADAR',
    title: 'Como usas o RADAR?',
    sub: 'Isto define o teu espaço — não é um interruptor numa página. Podes mudar depois com a equipa Etholys.',
    continue: 'Entrar',
  },
  es: {
    eyebrow: 'RADAR',
    title: '¿Cómo usás el RADAR?',
    sub: 'Esto define tu espacio — no es un interruptor en una página. Podés cambiarlo después con el equipo Etholys.',
    continue: 'Entrar',
  },
  en: {
    eyebrow: 'RADAR',
    title: 'How do you use RADAR?',
    sub: 'This defines your space — not a toggle on one page. You can change it later with the Etholys team.',
    continue: 'Enter',
  },
} as const;

export function RadarPersonaGate({
  companyId,
  engagementId,
  locale,
  onChosen,
}: {
  companyId: string;
  engagementId?: string | null;
  locale: string;
  onChosen: (role: RadarOrgRole, homePath: string) => void;
}) {
  const loc: Loc = locale === 'es' || locale === 'en' ? locale : 'pt';
  const copy = GATE[loc];
  const [role, setRole] = useState<RadarOrgRole | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!role) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch('/api/radar/org-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, engagementId, radarOrgRole: role }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha');
      onChosen(role, d.homePath as string);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-emerald-500/12 via-[#07140f] to-teal-900/40 px-6 py-10 sm:px-10">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-emerald-400/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-teal-500/10 blur-3xl" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-200/70">{copy.eyebrow}</p>
        <h1 className="mt-3 font-serif text-4xl tracking-tight text-white sm:text-5xl">{copy.title}</h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/55">{copy.sub}</p>

        {err && <p className="mt-4 text-sm text-rose-200">{err}</p>}

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {(['producer', 'provider'] as const).map((id) => {
            const meta = RADAR_ORG_ROLE_COPY[id][loc];
            const active = role === id;
            const Icon = id === 'producer' ? Building2 : Handshake;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setRole(id)}
                className={`rounded-[1.35rem] border px-5 py-5 text-left transition ${
                  active
                    ? 'border-emerald-400/55 bg-emerald-500/15 shadow-[0_0_0_1px_rgba(52,211,153,0.25)]'
                    : 'border-white/10 bg-white/[0.03] hover:border-white/25'
                }`}
              >
                <span
                  className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${
                    active ? 'bg-emerald-400/20 text-emerald-100' : 'bg-white/5 text-white/50'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <p className="mt-4 text-lg font-medium text-white">{meta.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-white/55">{meta.body}</p>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          disabled={!role || busy}
          onClick={() => void submit()}
          className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-6 py-3.5 text-sm font-semibold text-[#04110c] disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {copy.continue}
        </button>
      </div>
    </div>
  );
}
