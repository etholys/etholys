'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Save } from 'lucide-react';

const KIND_OPTIONS = [
  { value: 'COOP_HIERARCHY', label: 'Cooperativa / hierarquia' },
  { value: 'SALES_NETWORK', label: 'Rede comercial' },
  { value: 'MIXED', label: 'Misto' },
];

type Project = { id: string; name: string; companyId: string };
type Company = { id: string; name: string; shortName: string };

type Member = {
  id: string;
  companyId: string;
  memberRole: string;
  siepProjectId: string | null;
  company: { id: string; name: string; shortName: string };
  siepProject: { id: string; name: string; companyId: string } | null;
};

type NetworkDetail = {
  id: string;
  name: string;
  kind: string;
  anchorCompanyId: string;
  siepProjectId: string | null;
  anchorCompany: { id: string; name: string; shortName: string };
  siepProject: { id: string; name: string; companyId: string } | null;
  members: Member[];
};

export default function NexusNetworkDetailPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';

  const [network, setNetwork] = useState<NetworkDetail | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [projectsByCompany, setProjectsByCompany] = useState<Record<string, Project[]>>({});
  const [name, setName] = useState('');
  const [kind, setKind] = useState('COOP_HIERARCHY');
  const [networkSiepId, setNetworkSiepId] = useState('');
  const [memberSiepDraft, setMemberSiepDraft] = useState<Record<string, string>>({});
  const [addCompanyId, setAddCompanyId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const memberCompanyIdSet = useMemo(() => new Set((network?.members || []).map((m) => m.companyId)), [network]);

  const loadNetwork = useCallback(async () => {
    if (!id) return;
    const r = await fetch(`/api/nexus/networks/${encodeURIComponent(id)}`);
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Rede não encontrada');
    const n = d.network as NetworkDetail;
    setNetwork(n);
    setName(n.name);
    setKind(n.kind);
    setNetworkSiepId(n.siepProjectId || '');
    const drafts: Record<string, string> = {};
    for (const m of n.members) {
      drafts[m.companyId] = m.siepProjectId || '';
    }
    setMemberSiepDraft(drafts);
  }, [id]);

  const loadCompanies = useCallback(async () => {
    const r = await fetch('/api/companies');
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Empresas');
    setCompanies(d.companies || []);
  }, []);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setMsg(null);
      try {
        await Promise.all([loadNetwork(), loadCompanies()]);
      } catch (e) {
        if (!cancelled) setMsg(e instanceof Error ? e.message : 'Erro ao carregar');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, loadNetwork, loadCompanies]);

  useEffect(() => {
    if (!network) return;
    const ids = [...new Set(network.members.map((m) => m.companyId))];
    let cancelled = false;
    (async () => {
      for (const cid of ids) {
        if (cancelled) return;
        const r = await fetch(`/api/projects?companyId=${encodeURIComponent(cid)}`);
        const d = await r.json();
        if (cancelled) return;
        if (r.ok) {
          setProjectsByCompany((prev) => ({ ...prev, [cid]: d.projects || [] }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [network]);

  const anchorProjects = projectsByCompany[network?.anchorCompanyId || ''] || [];

  const saveNetwork = async () => {
    if (!id) return;
    setSaving(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/nexus/networks/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          kind,
          siepProjectId: networkSiepId || null,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha ao guardar');
      setMsg('Rede atualizada.');
      await loadNetwork();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erro');
    } finally {
      setSaving(false);
    }
  };

  const saveMemberSiep = async (companyId: string) => {
    if (!id) return;
    setSaving(true);
    setMsg(null);
    try {
      const raw = memberSiepDraft[companyId] ?? '';
      const r = await fetch(`/api/nexus/networks/${encodeURIComponent(id)}/members`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          siepProjectId: raw || null,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha ao atualizar membro');
      setMsg('Projeto SIEP do membro atualizado.');
      await loadNetwork();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erro');
    } finally {
      setSaving(false);
    }
  };

  const addMember = async () => {
    if (!id || !addCompanyId) return;
    setSaving(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/nexus/networks/${encodeURIComponent(id)}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: addCompanyId }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha ao adicionar');
      setAddCompanyId('');
      setMsg('Empresa adicionada à rede.');
      await loadNetwork();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erro');
    } finally {
      setSaving(false);
    }
  };

  const removeMember = async (companyId: string) => {
    if (!id) return;
    if (!confirm('Remover esta empresa da rede?')) return;
    setSaving(true);
    setMsg(null);
    try {
      const r = await fetch(
        `/api/nexus/networks/${encodeURIComponent(id)}/members?companyId=${encodeURIComponent(companyId)}`,
        { method: 'DELETE' }
      );
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha ao remover');
      setMsg('Membro removido.');
      await loadNetwork();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erro');
    } finally {
      setSaving(false);
    }
  };

  const availableToAdd = useMemo(
    () => companies.filter((c) => !memberCompanyIdSet.has(c.id)),
    [companies, memberCompanyIdSet]
  );

  const listHref = `/hub/nexus/networks?network=${encodeURIComponent(id)}`;

  if (!id) {
    return <p className="text-sm text-gray-600">Rede inválida.</p>;
  }

  if (loading) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500/30 border-t-indigo-600" />
      </div>
    );
  }

  if (!network) {
    return <p className="text-sm text-red-700">{msg || 'Rede não encontrada.'}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link
          href={listHref}
          className="inline-flex items-center gap-1 text-indigo-700 hover:text-indigo-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Redes
        </Link>
        <span className="text-gray-300">|</span>
        <Link
          href={`/hub/nexus?network=${encodeURIComponent(id)}`}
          className="font-medium text-indigo-700 hover:text-indigo-900"
        >
          Abrir Nexus nesta rede
        </Link>
        <span className="text-gray-300">|</span>
        <Link
          href={`/hub/nexus/coach?network=${encodeURIComponent(id)}`}
          className="font-medium text-violet-700 hover:text-violet-900"
        >
          Assistente IA
        </Link>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
        <h1 className="text-xl font-semibold text-gray-900">Gerir rede</h1>
        <p className="text-sm text-gray-600">
          Atualize metadados e o projeto SIEP opcional da rede (âncora). Por empresa, pode definir um projeto SIEP
          próprio — útil quando só algumas entidades fazem parte de um projeto temporário.
        </p>
        <label className="block text-xs font-medium text-gray-600">
          Nome
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium text-gray-600">
            Tipo
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              {KIND_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-gray-600">
            Projeto SIEP da rede (opcional, da âncora)
            <select
              value={networkSiepId}
              onChange={(e) => setNetworkSiepId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              <option value="">— Nenhum —</option>
              {anchorProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          type="button"
          disabled={saving || name.trim().length < 2}
          onClick={saveNetwork}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? 'A guardar…' : 'Guardar rede'}
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Membros</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b text-xs uppercase text-gray-500">
                <th className="py-2 pr-4">Empresa</th>
                <th className="py-2 pr-4">Papel</th>
                <th className="py-2 pr-4">SIEP por empresa (opcional)</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {network.members.map((m) => {
                const opts = projectsByCompany[m.companyId] || [];
                return (
                  <tr key={m.id} className="border-b border-gray-100">
                    <td className="py-2 pr-4 font-medium text-gray-900">{m.company.shortName || m.company.name}</td>
                    <td className="py-2 pr-4 text-gray-600">{m.memberRole === 'anchor' ? 'Âncora' : 'Membro'}</td>
                    <td className="py-2 pr-4">
                      <select
                        value={memberSiepDraft[m.companyId] ?? ''}
                        onChange={(e) =>
                          setMemberSiepDraft((prev) => ({ ...prev, [m.companyId]: e.target.value }))
                        }
                        className="w-full max-w-xs rounded-lg border border-gray-200 px-2 py-1 text-xs"
                      >
                        <option value="">— Nenhum (usa SIEP da rede se existir) —</option>
                        {opts.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => saveMemberSiep(m.companyId)}
                          className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50"
                        >
                          Aplicar SIEP
                        </button>
                        {m.memberRole !== 'anchor' && (
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => removeMember(m.companyId)}
                            className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                          >
                            Remover
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {availableToAdd.length > 0 && (
          <div className="flex flex-wrap items-end gap-2 border-t pt-4">
            <label className="text-xs font-medium text-gray-600">
              Adicionar empresa
              <select
                value={addCompanyId}
                onChange={(e) => setAddCompanyId(e.target.value)}
                className="mt-1 block w-64 rounded-lg border border-gray-200 px-3 py-2 text-sm"
              >
                <option value="">— Escolher —</option>
                {availableToAdd.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.shortName || c.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={saving || !addCompanyId}
              onClick={addMember}
              className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              Adicionar
            </button>
          </div>
        )}
      </div>

      {msg && <p className="text-sm text-gray-700">{msg}</p>}
    </div>
  );
}
