'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, UserCog } from 'lucide-react';
import { useRadarClientScopeOptional } from '@/components/radar/RadarClientScopeContext';

type Loc = 'pt' | 'es' | 'en';

type Employee = { userId: string; name: string | null; email: string; alreadyTechnician: boolean };
type Tech = {
  id: string;
  userId: string;
  name: string | null;
  email: string;
  canSeeAll: boolean;
  canCreateClients: boolean;
  scopes: { id: string; clientId: string | null; clientName: string | null; propertyId: string | null; propertyName: string | null }[];
};
type ClientOpt = { id: string; name: string };
type PropOpt = { id: string; name: string; clientId: string | null };

export function RadarTechniciansPanel({
  companyId,
  engagementId,
  locale,
}: {
  companyId: string;
  engagementId?: string | null;
  locale: string;
}) {
  const loc: Loc = locale === 'es' || locale === 'en' ? locale : 'pt';
  const scopeCtx = useRadarClientScopeOptional();
  const clientsFromScope = scopeCtx?.clients || [];

  const [technicians, setTechnicians] = useState<Tech[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [properties, setProperties] = useState<PropOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState('');
  const [canSeeAll, setCanSeeAll] = useState(false);
  const [canCreateClients, setCanCreateClients] = useState(false);
  const [clientIds, setClientIds] = useState<string[]>([]);
  const [propertyIds, setPropertyIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ companyId });
      if (engagementId) q.set('engagementId', engagementId);
      const [tRes, pRes] = await Promise.all([
        fetch(`/api/radar/technicians?${q}`),
        fetch(`/api/radar/properties?${q}&all=1`),
      ]);
      const td = await tRes.json();
      const pd = await pRes.json();
      if (tRes.ok) {
        setTechnicians(td.technicians || []);
        setEmployees(td.employees || []);
      }
      if (pRes.ok) {
        setProperties(
          (pd.properties || []).map((p: PropOpt) => ({
            id: p.id,
            name: p.name,
            clientId: p.clientId,
          })),
        );
      }
    } finally {
      setLoading(false);
    }
  }, [companyId, engagementId]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleId = (list: string[], id: string, set: (v: string[]) => void) => {
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };

  const submit = async () => {
    if (!userId) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch('/api/radar/technicians', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          engagementId,
          action: 'add',
          userId,
          canSeeAll,
          canCreateClients,
          clientIds,
          propertyIds,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha');
      setOpen(false);
      setUserId('');
      setClientIds([]);
      setPropertyIds([]);
      setCanSeeAll(false);
      setCanCreateClients(false);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  };

  const clients: ClientOpt[] = clientsFromScope.map((c) => ({ id: c.id, name: c.name }));

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">
          {loc === 'en' ? 'Technicians' : 'Técnicos'}
        </h2>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs text-emerald-200"
        >
          <Plus className="h-3.5 w-3.5" />
          {loc === 'en' ? 'Add from staff' : 'Adicionar da equipa'}
        </button>
      </div>

      {err && <p className="text-sm text-rose-200">{err}</p>}

      {open && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 space-y-3">
          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white"
          >
            <option value="">{loc === 'en' ? 'Pick employee…' : 'Escolher funcionário…'}</option>
            {employees
              .filter((e) => !e.alreadyTechnician)
              .map((e) => (
                <option key={e.userId} value={e.userId}>
                  {e.name || e.email}
                </option>
              ))}
          </select>
          <label className="flex items-center gap-2 text-xs text-white/70">
            <input type="checkbox" checked={canSeeAll} onChange={(e) => setCanSeeAll(e.target.checked)} />
            {loc === 'en' ? 'See full portfolio' : 'Ver toda a carteira'}
          </label>
          <label className="flex items-center gap-2 text-xs text-white/70">
            <input type="checkbox" checked={canCreateClients} onChange={(e) => setCanCreateClients(e.target.checked)} />
            {loc === 'en' ? 'Can create clients' : 'Pode criar clientes'}
          </label>
          {!canSeeAll && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-[10px] uppercase text-white/40">{loc === 'en' ? 'Clients (bulk)' : 'Clientes (escala)'}</p>
                <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-white/10 p-2">
                  {clients.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-xs text-white/70">
                      <input
                        type="checkbox"
                        checked={clientIds.includes(c.id)}
                        onChange={() => toggleId(clientIds, c.id, setClientIds)}
                      />
                      {c.name}
                    </label>
                  ))}
                  {clients.length === 0 && <p className="text-[11px] text-white/35">—</p>}
                </div>
              </div>
              <div>
                <p className="mb-1 text-[10px] uppercase text-white/40">{loc === 'en' ? 'Properties' : 'Propriedades'}</p>
                <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-white/10 p-2">
                  {properties.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 text-xs text-white/70">
                      <input
                        type="checkbox"
                        checked={propertyIds.includes(p.id)}
                        onChange={() => toggleId(propertyIds, p.id, setPropertyIds)}
                      />
                      {p.name}
                      {!p.clientId ? ' · própria' : ''}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
          <button
            type="button"
            disabled={busy || !userId}
            onClick={() => void submit()}
            className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-[#04110c] disabled:opacity-40"
          >
            {busy ? <Loader2 className="inline h-4 w-4 animate-spin" /> : null}{' '}
            {loc === 'en' ? 'Save technician' : 'Guardar técnico'}
          </button>
        </div>
      )}

      {loading ? (
        <Loader2 className="h-5 w-5 animate-spin text-emerald-300" />
      ) : technicians.length > 0 ? (
        <ul className="space-y-2">
          {technicians.map((t) => (
            <li
              key={t.id}
              className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
            >
              <div className="flex items-start gap-2">
                <UserCog className="mt-0.5 h-4 w-4 text-emerald-300/70" />
                <div>
                  <p className="text-sm font-medium text-white">{t.name || t.email}</p>
                  <p className="text-[11px] text-white/40">
                    {t.canSeeAll
                      ? loc === 'en'
                        ? 'Full portfolio'
                        : 'Carteira completa'
                      : t.scopes.length
                        ? t.scopes
                            .map((s) => s.clientName || s.propertyName)
                            .filter(Boolean)
                            .join(', ')
                        : loc === 'en'
                          ? 'No assignments yet'
                          : 'Sem atribuições'}
                    {t.canCreateClients ? (loc === 'en' ? ' · can create clients' : ' · cria clientes') : ''}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
