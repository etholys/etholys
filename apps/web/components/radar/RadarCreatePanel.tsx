'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, X } from 'lucide-react';
import { useRadarClientScope } from '@/components/radar/RadarClientScopeContext';
import { RADAR_CLIENT_ALL } from '@/lib/radar/client-scope';

const MODULES = [
  { id: 'agriculture', label: { pt: 'Agricultura', es: 'Agricultura', en: 'Agriculture' } },
  { id: 'agroindustry', label: { pt: 'Agroindústria', es: 'Agroindustria', en: 'Agroindustry' } },
  { id: 'livestock', label: { pt: 'Pecuária', es: 'Ganadería', en: 'Livestock' } },
  { id: 'carbon', label: { pt: 'Carbono', es: 'Carbono', en: 'Carbon' } },
] as const;

export function RadarCreatePanel({ locale = 'pt' }: { locale?: string }) {
  const loc = locale === 'es' || locale === 'en' ? locale : 'pt';
  const router = useRouter();
  const {
    companyId,
    engagementId,
    clients,
    clientScope,
    selectedClientId,
    createOpen,
    setCreateOpen,
    setClientScope,
    refreshClients,
    bumpListRevision,
  } = useRadarClientScope();

  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [phone, setPhone] = useState('');
  const [moduleId, setModuleId] = useState('agriculture');
  const [linkClientId, setLinkClientId] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!createOpen || !companyId) return null;

  const isClient = createOpen === 'client';
  const effectiveClientId = selectedClientId || linkClientId || '';

  const close = () => {
    setCreateOpen(null);
    setName('');
    setContact('');
    setPhone('');
    setErr(null);
  };

  const companyQs = () => {
    const q = new URLSearchParams();
    q.set('company', companyId);
    if (engagementId) q.set('engagement', engagementId);
    return q;
  };

  const submitClient = async () => {
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
          contactPhone: phone || undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha');
      await refreshClients();
      bumpListRevision();
      setClientScope(d.client.id);
      close();
      // Re-open farm form under the new client without full remount flicker
      window.setTimeout(() => {
        setCreateOpen('property');
      }, 50);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  };

  const submitProperty = async () => {
    if (name.trim().length < 2) return;
    if (!effectiveClientId) {
      setErr(loc === 'en' ? 'Pick a client first.' : 'Seleciona um cliente primeiro.');
      return;
    }
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
      if (clientScope === RADAR_CLIENT_ALL) setClientScope(effectiveClientId);
      close();
      const q = companyQs();
      q.set('client', effectiveClientId);
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
      ? 'Registrar finca / propiedad'
      : loc === 'en'
        ? 'Register farm / property'
        : 'Cadastrar fazenda / propriedade';

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

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={
            isClient
              ? loc === 'en'
                ? 'Client name'
                : 'Nome do cliente'
              : loc === 'en'
                ? 'Farm / property name'
                : 'Nome da fazenda / propriedade'
          }
          className="rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-400/40 sm:col-span-2"
          autoFocus
        />
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
          </>
        ) : (
          <>
            {!selectedClientId && (
              <select
                value={linkClientId}
                onChange={(e) => setLinkClientId(e.target.value)}
                className="rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-400/40"
              >
                <option value="">{loc === 'en' ? 'Link to client…' : 'Ligar a cliente…'}</option>
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
              className={cnSelect(!selectedClientId)}
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
              ? 'Create & open funnel'
              : 'Criar e abrir funil'}
        </button>
        <button type="button" onClick={close} className="rounded-xl px-4 py-2.5 text-sm text-white/60">
          {loc === 'en' ? 'Cancel' : 'Cancelar'}
        </button>
      </div>
    </div>
  );
}

function cnSelect(full: boolean) {
  return `rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-400/40${full ? '' : ' sm:col-span-2'}`;
}
