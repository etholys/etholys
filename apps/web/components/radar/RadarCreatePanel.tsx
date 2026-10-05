'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, X } from 'lucide-react';
import { useRadarClientScope } from '@/components/radar/RadarClientScopeContext';
import { RADAR_SCOPE_ALL, RADAR_SCOPE_OWN } from '@/lib/radar/client-scope';

const MODULES = [
  { id: 'agriculture', label: { pt: 'Agricultura', es: 'Agricultura', en: 'Agriculture' } },
  { id: 'agroindustry', label: { pt: 'Agroindústria', es: 'Agroindustria', en: 'Agroindustry' } },
  { id: 'livestock', label: { pt: 'Pecuária', es: 'Ganadería', en: 'Livestock' } },
  { id: 'carbon', label: { pt: 'Carbono', es: 'Carbono', en: 'Carbon' } },
] as const;

type AuroraOpt = { id: string; name: string };

export function RadarCreatePanel({ locale = 'es' }: { locale?: string }) {
  const loc = locale === 'es' || locale === 'en' ? locale : 'pt';
  const router = useRouter();
  const {
    companyId,
    engagementId,
    clients,
    scope,
    selectedClientId,
    isOwnScope,
    createOpen,
    setCreateOpen,
    setScope,
    refreshClients,
    bumpListRevision,
  } = useRadarClientScope();

  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [phone, setPhone] = useState('');
  const [moduleId, setModuleId] = useState('agriculture');
  const [linkClientId, setLinkClientId] = useState('');
  const [clientMode, setClientMode] = useState<'new' | 'aurora'>('new');
  const [auroraOpts, setAuroraOpts] = useState<AuroraOpt[]>([]);
  const [linkedCompanyId, setLinkedCompanyId] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (createOpen !== 'client' || !companyId) return;
    void (async () => {
      const q = new URLSearchParams({ companyId, aurora: '1' });
      if (engagementId) q.set('engagementId', engagementId);
      const r = await fetch(`/api/radar/clients?${q}`);
      const d = await r.json().catch(() => ({}));
      if (r.ok) setAuroraOpts(d.aurora || []);
    })();
  }, [createOpen, companyId, engagementId]);

  if (!createOpen || !companyId) return null;

  const isClient = createOpen === 'client';
  const propertyOwner: 'own' | 'client' =
    isOwnScope || (!selectedClientId && scope === RADAR_SCOPE_OWN)
      ? 'own'
      : selectedClientId
        ? 'client'
        : linkClientId === 'own' || !linkClientId
          ? 'own'
          : 'client';

  const effectiveClientId =
    propertyOwner === 'own' ? null : selectedClientId || (linkClientId !== 'own' ? linkClientId : null);

  const close = () => {
    setCreateOpen(null);
    setName('');
    setContact('');
    setPhone('');
    setLinkedCompanyId('');
    setClientMode('new');
    setErr(null);
  };

  const companyQs = () => {
    const q = new URLSearchParams();
    q.set('company', companyId);
    if (engagementId) q.set('engagement', engagementId);
    return q;
  };

  const submitClient = async () => {
    setBusy(true);
    setErr(null);
    try {
      const payload: Record<string, unknown> = {
        companyId,
        engagementId,
        contactName: contact || undefined,
        contactPhone: phone || undefined,
      };
      if (clientMode === 'aurora') {
        if (!linkedCompanyId) throw new Error(loc === 'en' ? 'Pick an AURORA company.' : 'Escolhe uma empresa AURORA.');
        payload.linkedCompanyId = linkedCompanyId;
        const opt = auroraOpts.find((a) => a.id === linkedCompanyId);
        payload.name = name.trim() || opt?.name;
      } else {
        if (name.trim().length < 2) throw new Error(loc === 'en' ? 'Name required.' : 'Nome obrigatório.');
        payload.name = name;
      }
      const r = await fetch('/api/radar/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha');
      await refreshClients();
      bumpListRevision();
      setScope(d.client.id);
      close();
      window.setTimeout(() => setCreateOpen('property'), 50);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  };

  const submitProperty = async () => {
    if (name.trim().length < 2) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch('/api/radar/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          engagementId,
          clientId: effectiveClientId,
          name,
          moduleId,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha');
      await refreshClients();
      bumpListRevision();
      if (effectiveClientId) setScope(effectiveClientId);
      else setScope(RADAR_SCOPE_OWN);
      close();
      const q = companyQs();
      q.set('client', effectiveClientId || RADAR_SCOPE_OWN);
      router.push(`/hub/radar/properties/${d.property.id}?${q}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  };

  const title = isClient
    ? loc === 'es'
      ? 'Registrar cliente'
      : loc === 'en'
        ? 'Register client'
        : 'Cadastrar cliente'
    : loc === 'es'
      ? 'Nuevo espacio'
      : loc === 'en'
        ? 'New space'
        : 'Novo espaço';

  return (
    <div className="mb-6 rounded-[1.35rem] border border-emerald-400/30 bg-emerald-500/10 px-5 py-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200/70">RADAR</p>
          <h2 className="mt-1 font-serif text-2xl text-white">{title}</h2>
        </div>
        <button type="button" onClick={close} className="rounded-lg p-1.5 text-white/40 hover:bg-white/5 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>

      {isClient && (
        <div className="mt-4 inline-flex rounded-xl border border-white/15 bg-black/20 p-1">
          <button
            type="button"
            onClick={() => setClientMode('new')}
            className={`rounded-lg px-3 py-1.5 text-xs ${clientMode === 'new' ? 'bg-emerald-500 text-[#04110c] font-semibold' : 'text-white/60'}`}
          >
            {loc === 'en' ? 'New' : 'Novo'}
          </button>
          <button
            type="button"
            onClick={() => setClientMode('aurora')}
            className={`rounded-lg px-3 py-1.5 text-xs ${clientMode === 'aurora' ? 'bg-emerald-500 text-[#04110c] font-semibold' : 'text-white/60'}`}
          >
            AURORA / ATER
          </button>
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {isClient && clientMode === 'aurora' ? (
          <select
            value={linkedCompanyId}
            onChange={(e) => setLinkedCompanyId(e.target.value)}
            className="rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-400/40 sm:col-span-2"
          >
            <option value="">{loc === 'en' ? 'Pick AURORA company…' : 'Escolher empresa AURORA…'}</option>
            {auroraOpts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        ) : (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={
              isClient
                ? loc === 'en'
                  ? 'Client name'
                  : 'Nome do cliente'
                : loc === 'en'
                  ? 'Space name'
                  : 'Nome do espaço'
            }
            className="rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-400/40 sm:col-span-2"
            autoFocus
          />
        )}
        {isClient ? (
          <>
            <input
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder={loc === 'en' ? 'Contact (optional)' : 'Contacto (opcional)'}
              className="rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-400/40"
            />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={loc === 'en' ? 'Phone (optional)' : 'Telefone (opcional)'}
              className="rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-400/40"
            />
            {clientMode === 'aurora' && auroraOpts.length === 0 && (
              <p className="sm:col-span-2 text-xs text-white/45">
                {loc === 'en'
                  ? 'No ATER companies found for this operator. Create a new client instead.'
                  : 'Sem empresas ATER ligadas. Cria um cliente novo.'}
              </p>
            )}
          </>
        ) : (
          <>
            {!selectedClientId && (
              <select
                value={linkClientId || (isOwnScope ? 'own' : '')}
                onChange={(e) => setLinkClientId(e.target.value)}
                className="rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-400/40"
              >
                <option value="own">{loc === 'en' ? 'My operation (no client)' : 'Minha operação (sem cliente)'}</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
            <select
              value={moduleId}
              onChange={(e) => setModuleId(e.target.value)}
              className={`rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-400/40${!selectedClientId ? '' : ' sm:col-span-2'}`}
            >
              {MODULES.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label[loc]}
                </option>
              ))}
            </select>
          </>
        )}
      </div>

      {err && <p className="mt-3 text-sm text-rose-200">{err}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void (isClient ? submitClient() : submitProperty())}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-[#04110c] disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {isClient
            ? loc === 'en'
              ? 'Create client'
              : 'Criar cliente'
            : loc === 'en'
              ? 'Create & open'
              : 'Criar e abrir'}
        </button>
        <button type="button" onClick={close} className="rounded-xl px-4 py-2.5 text-sm text-white/60">
          {loc === 'en' ? 'Cancel' : 'Cancelar'}
        </button>
      </div>
    </div>
  );
}
