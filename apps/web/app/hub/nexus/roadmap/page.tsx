'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

type RoadmapAction = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  tags: string | null;
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

function NexusRoadmapInner() {
  const searchParams = useSearchParams();
  const networkId = searchParams.get('network');

  const [actions, setActions] = useState<RoadmapAction[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
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

  const refresh = useCallback(async (opts?: { background?: boolean }) => {
    if (!opts?.background) setLoading(true);
    try {
      const qs = networkId ? `?networkId=${encodeURIComponent(networkId)}` : '';
      const r = await fetch(`/api/nexus/roadmap-actions${qs}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha ao carregar ações');
      setActions(d.actions || []);
      if (!opts?.background) setMsg(null);
    } catch (e) {
      if (!opts?.background) setMsg(e instanceof Error ? e.message : 'Erro');
    } finally {
      if (!opts?.background) setLoading(false);
    }
  }, [networkId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') void refresh({ background: true });
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [refresh]);

  const create = async () => {
    setSaving(true);
    setMsg(null);
    try {
      if (networkId && !targetCompanyId) {
        setMsg('Escolha a empresa alvo.');
        return;
      }
      const r = await fetch('/api/nexus/roadmap-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          priority: 'MEDIUM',
          ...(networkId ? { networkId, targetCompanyId } : {}),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha ao criar ação');
      setTitle('');
      setDescription('');
      await refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erro ao criar ação');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {networkId && network && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
          A listar ações de <strong>{network.name}</strong> (todas as empresas membro). Novas ações ficam na empresa
          escolhida.
          <label className="mt-2 block text-xs font-medium text-indigo-800">
            <input
              type="checkbox"
              checked={onlyWithSiepContext}
              onChange={(e) => setOnlyWithSiepContext(e.target.checked)}
              className="mr-2 align-middle"
            />
            Mostrar apenas empresas com contexto SIEP
          </label>
          <label className="mt-2 block text-xs font-medium text-indigo-800">
            Empresa alvo para novas ações
            <select
              value={targetCompanyId}
              onChange={(e) => setTargetCompanyId(e.target.value)}
              className="mt-1 w-full max-w-md rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm text-gray-900"
            >
              {selectableMembers.map((m) => (
                <option key={m.companyId} value={m.companyId}>
                  {m.company.shortName || m.company.name}
                </option>
              ))}
            </select>
          </label>
          {selectedSiepName && (
            <p className="mt-2 text-xs text-indigo-800">
              Contexto SIEP efetivo da empresa alvo: <strong>{selectedSiepName}</strong>
            </p>
          )}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Rota viva de desenvolvimento</h2>
        <p className="mt-1 text-sm text-gray-600">
          Crie e acompanhe ações de melhoria. A IA e a equipe técnica podem ajustar continuamente esta rota.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          placeholder="Nova ação de rota (ex.: padronizar proposta comercial)"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          placeholder="Contexto, objetivo e resultado esperado"
        />
        <button
          type="button"
          disabled={saving}
          onClick={create}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? 'A criar...' : 'Criar ação'}
        </button>
      </div>

      {loading ? (
        <div className="flex min-h-[20vh] items-center justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-indigo-600/30 border-t-indigo-600" />
        </div>
      ) : (
        <div className="space-y-3">
          {actions.map((a) => (
            <div key={a.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-gray-900">{a.title}</p>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">{a.status}</span>
              </div>
              {a.description && <p className="mt-1 text-sm text-gray-600">{a.description}</p>}
              {networkId && a.companyId && (
                <p className="mt-1 text-xs text-gray-500">
                  Empresa: {companyLabel.get(a.companyId) || a.companyId}
                </p>
              )}
            </div>
          ))}
          {actions.length === 0 && <p className="text-sm text-gray-500">Sem ações ainda. Crie a primeira ação acima.</p>}
        </div>
      )}

      {msg && <p className="text-sm text-red-700">{msg}</p>}
    </div>
  );
}

export default function NexusRoadmapPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[30vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500/30 border-t-indigo-600" />
        </div>
      }
    >
      <NexusRoadmapInner />
    </Suspense>
  );
}
