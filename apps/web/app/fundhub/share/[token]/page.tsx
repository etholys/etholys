'use client';

import { useEffect, useState } from 'react';
import { BadgeCheck, Building2, MapPin } from 'lucide-react';
import type { ExecutionPassportPayload } from '@/lib/fundhub/passport-types';

export default function PublicPassportSharePage({ params }: { params: { token: string } }) {
  const [data, setData] = useState<ExecutionPassportPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/public/fundhub/passport/${encodeURIComponent(params.token)}`, {
          cache: 'no-store',
        });
        const d = (await r.json()) as ExecutionPassportPayload & { error?: string };
        if (!r.ok) throw new Error(d.error || 'Link inválido');
        if (!cancelled) setData(d);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Erro');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.token]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500/30 border-t-amber-600" />
      </div>
    );
  }

  if (err || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-lg font-semibold text-slate-900">Link indisponível</p>
          <p className="mt-2 text-sm text-slate-600">{err || 'Este perfil foi revogado ou expirou.'}</p>
        </div>
      </div>
    );
  }

  const score = data.stats.readinessScore;

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50/80 to-slate-50">
      <header className="border-b border-amber-100 bg-white/90 px-4 py-4 sm:px-8">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-amber-800">
            <BadgeCheck className="h-6 w-6" />
            <span className="text-sm font-bold tracking-wide">ETHOLYS · Perfil institucional</span>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-center">
            <p className="text-[10px] font-semibold uppercase text-amber-800">Readiness</p>
            <p className="text-xl font-bold text-amber-900">{score}%</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-8">
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">{data.company.name}</h1>
          {data.company.shortName && <p className="text-sm text-gray-500">{data.company.shortName}</p>}
          <div className="mt-3 flex flex-wrap gap-3 text-sm text-gray-600">
            {data.company.sector && (
              <span className="inline-flex items-center gap-1">
                <Building2 className="h-4 w-4" />
                {data.company.sector}
              </span>
            )}
            {data.company.country && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {data.company.country}
              </span>
            )}
          </div>
          {data.company.description && (
            <p className="mt-4 text-sm leading-relaxed text-gray-700">{data.company.description}</p>
          )}
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase text-gray-500">Delivery</p>
            <ul className="mt-2 space-y-1 text-sm text-gray-800">
              <li>SIEP projects: <strong>{data.stats.activeProjects}</strong></li>
              <li>Partners: <strong>{data.stats.partners}</strong></li>
              <li>Saved funds: <strong>{data.stats.savedFunds}</strong></li>
            </ul>
          </div>
          {data.coalition.length > 0 && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
              <p className="text-xs font-semibold uppercase text-emerald-800">Coalition</p>
              <ul className="mt-2 space-y-1 text-sm text-emerald-950">
                {data.coalition.map((m) => (
                  <li key={`${m.orgName}-${m.role}`}>
                    <strong>{m.orgName}</strong> — {m.role}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {data.recentProposals.length > 0 && (
          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="font-semibold text-gray-900">Proposal pipeline</h2>
            <ul className="mt-3 space-y-2 text-sm text-gray-700">
              {data.recentProposals.map((p, i) => (
                <li key={`${p.title}-${i}`}>
                  {p.title} · {p.fund.institution} · {p.status}
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="text-center text-xs text-slate-500">
          Vista pública de só leitura · gerada {new Date(data.generatedAt).toLocaleString()}
        </p>
      </main>
    </div>
  );
}
