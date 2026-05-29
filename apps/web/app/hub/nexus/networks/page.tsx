'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Network } from 'lucide-react';

const KIND_OPTIONS = [
  { value: 'COOP_HIERARCHY', label: 'Cooperativa / hierarquia' },
  { value: 'SALES_NETWORK', label: 'Rede comercial' },
  { value: 'MIXED', label: 'Misto' },
];

type Company = { id: string; name: string; shortName: string };
type Project = { id: string; name: string; companyId: string };
type NetworkRow = {
  id: string;
  name: string;
  kind: string;
  anchorCompany: { id: string; name: string; shortName: string };
  siepProject: { id: string; name: string } | null;
  members: Array<{ company: { id: string; shortName: string } }>;
};

export default function NexusNetworksPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [networks, setNetworks] = useState<NetworkRow[]>([]);
  const [anchorProjects, setAnchorProjects] = useState<Project[]>([]);
  const [name, setName] = useState('');
  const [kind, setKind] = useState('COOP_HIERARCHY');
  const [anchorCompanyId, setAnchorCompanyId] = useState('');
  const [extraMemberIds, setExtraMemberIds] = useState<Set<string>>(new Set());
  const [siepProjectId, setSiepProjectId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMsg(null);
    try {
      const [cRes, nRes] = await Promise.all([fetch('/api/companies'), fetch('/api/nexus/networks')]);
      const cJson = await cRes.json();
      const nJson = await nRes.json();
      if (!cRes.ok) throw new Error(cJson.error || 'Falha ao carregar empresas');
      if (!nRes.ok) throw new Error(nJson.error || 'Falha ao carregar redes');
      const list = (cJson.companies || []) as Company[];
      setCompanies(list);
      setNetworks(nJson.networks || []);
      setAnchorCompanyId((prev) => prev || list[0]?.id || '');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erro');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!anchorCompanyId) {
      setAnchorProjects([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const r = await fetch(`/api/projects?companyId=${encodeURIComponent(anchorCompanyId)}`);
      const d = await r.json();
      if (cancelled) return;
      if (r.ok) setAnchorProjects(d.projects || []);
      else setAnchorProjects([]);
    })();
    return () => {
      cancelled = true;
    };
  }, [anchorCompanyId]);

  const otherCompanies = useMemo(
    () => companies.filter((c) => c.id !== anchorCompanyId),
    [companies, anchorCompanyId]
  );

  const toggleMember = (id: string) => {
    setExtraMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const createNetwork = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const r = await fetch('/api/nexus/networks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          kind,
          anchorCompanyId,
          memberCompanyIds: [...extraMemberIds],
          siepProjectId: siepProjectId || null,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha ao criar rede');
      setName('');
      setExtraMemberIds(new Set());
      setSiepProjectId('');
      await load();
      if (d.network?.id) router.push(`/hub/nexus?network=${encodeURIComponent(d.network.id)}`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erro ao criar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-indigo-100 p-2 text-indigo-700">
            <Network className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Redes Nexus</h2>
            <p className="mt-1 text-sm text-gray-600">
              Agrupe empresas mãe e filiais (ou parceiros) numa só visão. O vínculo a um projeto SIEP é opcional — útil
              quando o acompanhamento faz parte de um projeto temporário.
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[20vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500/30 border-t-indigo-600" />
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Nova rede</h3>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              placeholder="Nome da rede (ex.: Grupo Norte — projeto X)"
            />
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
                Empresa âncora (mãe)
                <select
                  value={anchorCompanyId}
                  onChange={(e) => {
                    setAnchorCompanyId(e.target.value);
                    setExtraMemberIds(new Set());
                    setSiepProjectId('');
                  }}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.shortName || c.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block text-xs font-medium text-gray-600">
              Projeto SIEP (opcional, da âncora)
              <select
                value={siepProjectId}
                onChange={(e) => setSiepProjectId(e.target.value)}
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
            <div>
              <p className="text-xs font-medium text-gray-600">Membros adicionais</p>
              <p className="mt-0.5 text-xs text-gray-500">A âncora entra sempre na rede.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {otherCompanies.length === 0 && (
                  <p className="text-sm text-gray-500">Não há outras empresas no seu acesso.</p>
                )}
                {otherCompanies.map((c) => (
                  <label
                    key={c.id}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={extraMemberIds.has(c.id)}
                      onChange={() => toggleMember(c.id)}
                    />
                    {c.shortName || c.name}
                  </label>
                ))}
              </div>
            </div>
            <button
              type="button"
              disabled={saving || name.trim().length < 2}
              onClick={createNetwork}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'A criar…' : 'Criar rede'}
            </button>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900">As suas redes</h3>
            <ul className="mt-3 divide-y divide-gray-100">
              {networks.map((n) => (
                <li key={n.id} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0">
                  <div>
                    <p className="font-medium text-gray-900">{n.name}</p>
                    <p className="text-xs text-gray-500">
                      {n.members.length} empresas · âncora {n.anchorCompany.shortName}
                      {n.siepProject ? ` · SIEP: ${n.siepProject.name}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Link
                      href={`/hub/nexus?network=${encodeURIComponent(n.id)}`}
                      className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
                    >
                      Abrir no Nexus
                    </Link>
                    <Link
                      href={`/hub/nexus/networks/${encodeURIComponent(n.id)}`}
                      className="text-sm font-medium text-gray-700 underline decoration-gray-300 hover:text-gray-900"
                    >
                      Gerir rede
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
            {networks.length === 0 && <p className="text-sm text-gray-500">Ainda não há redes. Crie uma acima.</p>}
          </div>
        </>
      )}

      {msg && <p className="text-sm text-red-700">{msg}</p>}
    </div>
  );
}
