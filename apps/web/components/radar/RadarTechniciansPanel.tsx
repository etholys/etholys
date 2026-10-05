'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, UserCog } from 'lucide-react';
import { useRadarClientScopeOptional } from '@/components/radar/RadarClientScopeContext';
import { radarLoc, radarT } from '@/lib/radar/i18n';

type Tech = {
  id: string;
  userId: string;
  name: string | null;
  email: string;
  canSeeAll: boolean;
  canCreateClients: boolean;
  scopes: { id: string; clientId: string | null; clientName: string | null; propertyId: string | null; propertyName: string | null }[];
};
type Employee = { userId: string; name: string | null; email: string; alreadyTechnician: boolean };
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
  const loc = radarLoc(locale);
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
          {radarT(loc, 'Técnicos', 'Técnicos', 'Technicians')}
        </h2>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs text-emerald-200"
        >
          <Plus className="h-3.5 w-3.5" />
          {radarT(loc, 'Adicionar da equipa', 'Agregar del equipo', 'Add from staff')}
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
            <option value="">{radarT(loc, 'Escolher funcionário…', 'Elegir empleado…', 'Pick employee…')}</option>
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
            {radarT(loc, 'Ver toda a carteira', 'Ver toda la cartera', 'See full portfolio')}
          </label>
          <label className="flex items-center gap-2 text-xs text-white/70">
            <input type="checkbox" checked={canCreateClients} onChange={(e) => setCanCreateClients(e.target.checked)} />
            {radarT(loc, 'Pode criar clientes', 'Puede crear clientes', 'Can create clients')}
          </label>
          {!canSeeAll && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-[10px] uppercase text-white/40">{radarT(loc, 'Clientes (escala)', 'Clientes (escala)', 'Clients (bulk)')}</p>
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
                <p className="mb-1 text-[10px] uppercase text-white/40">{radarT(loc, 'Propriedades', 'Propiedades', 'Properties')}</p>
                <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-white/10 p-2">
                  {properties.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 text-xs text-white/70">
                      <input
                        type="checkbox"
                        checked={propertyIds.includes(p.id)}
                        onChange={() => toggleId(propertyIds, p.id, setPropertyIds)}
                      />
                      {p.name}
                      {!p.clientId ? ` · ${radarT(loc, 'própria', 'propia', 'own')}` : ''}
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
            {radarT(loc, 'Guardar técnico', 'Guardar técnico', 'Save technician')}
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
                      ? radarT(loc, 'Carteira completa', 'Cartera completa', 'Full portfolio')
                      : t.scopes.length
                        ? t.scopes
                            .map((s) => s.clientName || s.propertyName)
                            .filter(Boolean)
                            .join(', ')
                        : radarT(loc, 'Sem atribuições', 'Sin asignaciones', 'No assignments yet')}
                    {t.canCreateClients ? radarT(loc, ' · cria clientes', ' · crea clientes', ' · can create clients') : ''}
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
