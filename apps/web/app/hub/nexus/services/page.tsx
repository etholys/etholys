'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { touchRunwayChapter } from '@/lib/nexus-runway';

type Ticket = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  createdAt: string;
  companyId?: string;
};

type NetworkDetail = {
  id: string;
  name: string;
  anchorCompanyId: string;
  siepProject: { id: string; name: string; companyId: string } | null;
  members: Array<{
    companyId: string;
    company: { name: string; shortName: string };
    siepProject: { id: string; name: string; companyId: string } | null;
  }>;
};

const serviceOptions = [
  { id: 'website', label: 'Página web / landing page' },
  { id: 'branding', label: 'Identidade visual e peças base' },
  { id: 'social-media', label: 'Gestão de redes sociais com IA' },
  { id: 'automation', label: 'Automação e processos com IA' },
  { id: 'sales-assets', label: 'Materiais comerciais e vendas' },
];

function NexusServicesInner() {
  const searchParams = useSearchParams();
  const networkId = searchParams.get('network');

  useEffect(() => {
    touchRunwayChapter('services');
  }, []);

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [serviceType, setServiceType] = useState(serviceOptions[0].id);
  const [brief, setBrief] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [network, setNetwork] = useState<NetworkDetail | null>(null);
  const [targetCompanyId, setTargetCompanyId] = useState('');
  const [onlyWithSiepContext, setOnlyWithSiepContext] = useState(false);

  useEffect(() => {
    if (!networkId) {
      setNetwork(null);
      setTargetCompanyId('');
      return;
    }
    let cancelled = false;
    (async () => {
      const r = await fetch(`/api/nexus/networks/${encodeURIComponent(networkId)}`);
      const d = await r.json();
      if (cancelled) return;
      if (r.ok && d.network) {
        setNetwork(d.network);
        setTargetCompanyId(d.network.anchorCompanyId || '');
      } else {
        setNetwork(null);
        setTargetCompanyId('');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [networkId]);

  const companyLabel = useMemo(() => {
    const m = new Map<string, string>();
    if (network?.members) {
      for (const mem of network.members) {
        m.set(mem.companyId, mem.company.shortName || mem.company.name);
      }
    }
    return m;
  }, [network]);
  const selectableMembers = useMemo(
    () =>
      (network?.members || []).filter((m) =>
        onlyWithSiepContext ? Boolean(m.siepProject?.id || network?.siepProject?.id) : true
      ),
    [network, onlyWithSiepContext]
  );

  useEffect(() => {
    if (!networkId || !network) return;
    const hasCurrent = selectableMembers.some((m) => m.companyId === targetCompanyId);
    if (!hasCurrent) {
      setTargetCompanyId(selectableMembers[0]?.companyId || '');
    }
  }, [networkId, network, selectableMembers, targetCompanyId]);

  const selectedMember = network?.members.find((m) => m.companyId === targetCompanyId) || null;
  const selectedSiepName = selectedMember?.siepProject?.name || network?.siepProject?.name || null;

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const qs = networkId ? `?networkId=${encodeURIComponent(networkId)}` : '';
      const r = await fetch(`/api/nexus/service-tickets${qs}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha ao carregar tickets');
      setTickets(d.tickets || []);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erro');
    } finally {
      setLoading(false);
    }
  }, [networkId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = async () => {
    setSaving(true);
    setMsg(null);
    try {
      if (networkId && !targetCompanyId) {
        setMsg('Escolha a empresa alvo.');
        return;
      }
      const r = await fetch('/api/nexus/service-tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceType,
          brief,
          priority: 'MEDIUM',
          ...(networkId ? { networkId, targetCompanyId } : {}),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha ao abrir ticket');
      setBrief('');
      setMsg('Ticket criado com sucesso.');
      await refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erro ao abrir ticket');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {networkId && network && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          A listar tickets de <strong>{network.name}</strong>. Novos pedidos abrem na empresa selecionada.
          <label className="mt-2 block text-xs font-medium text-emerald-800">
            <input
              type="checkbox"
              checked={onlyWithSiepContext}
              onChange={(e) => setOnlyWithSiepContext(e.target.checked)}
              className="mr-2 align-middle"
            />
            Mostrar apenas empresas com contexto SIEP
          </label>
          <label className="mt-2 block text-xs font-medium text-emerald-800">
            Empresa alvo
            <select
              value={targetCompanyId}
              onChange={(e) => setTargetCompanyId(e.target.value)}
              className="mt-1 w-full max-w-md rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-gray-900"
            >
              {selectableMembers.map((m) => (
                <option key={m.companyId} value={m.companyId}>
                  {m.company.shortName || m.company.name}
                </option>
              ))}
            </select>
          </label>
          {selectedSiepName && (
            <p className="mt-2 text-xs text-emerald-800">
              Contexto SIEP efetivo da empresa alvo: <strong>{selectedSiepName}</strong>
            </p>
          )}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Serviços internos Etholys</h2>
        <p className="mt-1 text-sm text-gray-600">
          Abra pedidos para execução interna (IA, híbrido ou humano). Nexus usa esses tickets para acelerar a rota.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
        <select
          value={serviceType}
          onChange={(e) => setServiceType(e.target.value)}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
        >
          {serviceOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          rows={4}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          placeholder="Descreva objetivo, público, prazo e referências."
        />
        <button
          type="button"
          disabled={saving}
          onClick={create}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {saving ? 'A abrir ticket...' : 'Abrir ticket de serviço'}
        </button>
      </div>

      {loading ? (
        <div className="flex min-h-[20vh] items-center justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-emerald-600/30 border-t-emerald-600" />
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => (
            <div key={t.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-gray-900">{t.title}</p>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">{t.status}</span>
              </div>
              {t.description && <p className="mt-1 text-sm text-gray-600">{t.description}</p>}
              <p className="mt-2 text-xs text-gray-500">
                Prioridade {t.priority} · {new Date(t.createdAt).toLocaleString('pt-PT')}
                {networkId && t.companyId && (
                  <>
                    {' '}
                    · {companyLabel.get(t.companyId) || t.companyId}
                  </>
                )}
              </p>
            </div>
          ))}
          {tickets.length === 0 && <p className="text-sm text-gray-500">Sem tickets ainda. Abra o primeiro pedido.</p>}
        </div>
      )}

      {msg && <p className="text-sm text-gray-700">{msg}</p>}
    </div>
  );
}

export default function NexusServicesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[30vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500/30 border-t-emerald-600" />
        </div>
      }
    >
      <NexusServicesInner />
    </Suspense>
  );
}
