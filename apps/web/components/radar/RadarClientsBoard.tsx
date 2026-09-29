'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Loader2, Plus, Users } from 'lucide-react';

type Loc = 'pt' | 'es' | 'en';

type ClientRow = {
  id: string;
  name: string;
  contactName: string | null;
  contactPhone: string | null;
  propertyCount: number;
};

export function RadarClientsBoard({
  companyId,
  engagementId,
  locale,
}: {
  companyId: string;
  engagementId?: string | null;
  locale: string;
}) {
  const loc: Loc = locale === 'es' || locale === 'en' ? locale : 'pt';
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ companyId });
      if (engagementId) q.set('engagementId', engagementId);
      const r = await fetch(`/api/radar/clients?${q}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha');
      setClients(d.clients || []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setLoading(false);
    }
  }, [companyId, engagementId]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (name.trim().length < 2) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch('/api/radar/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          engagementId,
          name,
          contactName: contact || undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha');
      setName('');
      setContact('');
      setCreating(false);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  };

  const q = engagementId ? `?company=${companyId}&engagement=${engagementId}` : `?company=${companyId}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/40">RADAR · Prestadora</p>
          <h1 className="mt-2 font-serif text-4xl text-white">
            {loc === 'es' ? 'Clientes' : loc === 'en' ? 'Clients' : 'Clientes'}
          </h1>
          <p className="mt-2 max-w-lg text-sm text-white/55">
            {loc === 'es'
              ? 'Cada cliente abre su propio espacio: propiedades, planta, geo y sensores.'
              : loc === 'en'
                ? 'Each client opens their own space: properties, plant, geo and sensors.'
                : 'Cada cliente abre o seu espaço: propriedades, planta, geo e sensores.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-[#04110c]"
        >
          <Plus className="h-4 w-4" />
          {loc === 'en' ? 'New client' : 'Novo cliente'}
        </button>
      </div>

      {err && <p className="text-sm text-rose-200">{err}</p>}

      {creating && (
        <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] px-5 py-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={loc === 'en' ? 'Client name' : 'Nome do cliente'}
              className="rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-400/40"
              autoFocus
            />
            <input
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder={loc === 'en' ? 'Contact (optional)' : 'Contacto (opcional)'}
              className="rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-400/40"
            />
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void create()}
              className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-[#04110c] disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : loc === 'en' ? 'Create' : 'Criar'}
            </button>
            <button type="button" onClick={() => setCreating(false)} className="rounded-xl px-4 py-2 text-sm text-white/60">
              {loc === 'en' ? 'Cancel' : 'Cancelar'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-emerald-300" />
        </div>
      ) : clients.length === 0 ? (
        <div className="rounded-[1.5rem] border border-dashed border-white/15 bg-black/20 px-8 py-14 text-center">
          <Users className="mx-auto h-8 w-8 text-white/30" />
          <p className="mt-4 font-serif text-2xl text-white">
            {loc === 'es' ? 'Sin clientes aún' : loc === 'en' ? 'No clients yet' : 'Ainda sem clientes'}
          </p>
          <p className="mt-2 text-sm text-white/50">
            {loc === 'es'
              ? 'Registrá el primero para abrir propiedades y el embudo completo.'
              : 'Regista o primeiro para abrir propriedades e o funil completo.'}
          </p>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="mt-6 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-[#04110c]"
          >
            {loc === 'en' ? 'Register client' : 'Registar cliente'}
          </button>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {clients.map((c) => (
            <li key={c.id}>
              <Link
                href={`/hub/radar/provider/clients/${c.id}${q}`}
                className="group flex items-center justify-between rounded-[1.35rem] border border-white/10 bg-white/[0.03] px-5 py-5 transition hover:border-emerald-400/35 hover:bg-emerald-500/10"
              >
                <div>
                  <p className="text-lg font-medium text-white">{c.name}</p>
                  <p className="mt-1 text-xs text-white/45">
                    {c.propertyCount}{' '}
                    {loc === 'en' ? 'properties' : c.propertyCount === 1 ? 'propriedade' : 'propriedades'}
                    {c.contactName ? ` · ${c.contactName}` : ''}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-white/30 transition group-hover:text-emerald-200" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
