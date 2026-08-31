'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Plus, Search, X } from 'lucide-react';
import { useApp } from '@/app/providers';
import { NexusAtCaseCard, type AtCaseCardModel } from '@/components/nexus/NexusAtCaseCard';
import { groupSectorsForSelect, sectorBadgeLabel } from '@/components/nexus/NexusAtSectorPlaybook';

type Company = { id: string; name: string; shortName: string; sectorId?: string | null };
type SectorCatalogRow = {
  id: string;
  groupId: string;
  label: { es: string; pt: string; en: string };
};
type SectorPortfolioRow = { sectorId: string; companies: number; contracts: number; openCases: number };
type SiepProject = { id: string; name: string; code: string | null; companyId: string };
type Service = {
  id: string;
  title: string;
  kind: string;
  status: string;
  contractRef: string | null;
  operatorCompany: { id: string; name: string; shortName: string };
  sponsorCompany?: { id: string; name: string; shortName: string } | null;
  siepProject?: { id: string; name: string; code?: string | null } | null;
  primarySectorId?: string | null;
  sectorMix?: string[];
  members: Array<{
    companyId: string;
    memberRole: string;
    sectorId?: string | null;
    company: { shortName: string; name: string };
  }>;
  projects: Array<{ id: string; name: string; status: string }>;
  openCaseCount: number;
  clientCount: number;
  projectCount: number;
  updatedAt: string;
};

type Agenda = {
  overdue: AtCaseCardModel[];
  today: AtCaseCardModel[];
  week: AtCaseCardModel[];
  noDate: AtCaseCardModel[];
};

type InboxTab = 'all' | 'overdue' | 'today' | 'week';

type PickedClient = { key: string; id?: string; name: string; shortName?: string };

export default function NexusAtPage() {
  const router = useRouter();
  const { locale, activeCompanyId } = useApp();
  const es = locale === 'es';
  const loc = (es ? 'es' : locale === 'pt' ? 'pt' : 'en') as 'es' | 'pt' | 'en';

  const [sectorCatalog, setSectorCatalog] = useState<SectorCatalogRow[]>([]);
  const [sectorGroups, setSectorGroups] = useState<Array<{ id: string; label: { es: string; pt: string; en: string } }>>([]);
  const [sectorPortfolio, setSectorPortfolio] = useState<SectorPortfolioRow[]>([]);
  const [sectorFilter, setSectorFilter] = useState<string>('all');
  const [selectedSectorIds, setSelectedSectorIds] = useState<string[]>([]);

  const [services, setServices] = useState<Service[]>([]);
  const [inbox, setInbox] = useState<AtCaseCardModel[]>([]);
  const [agenda, setAgenda] = useState<Agenda>({ overdue: [], today: [], week: [], noDate: [] });
  const [summary, setSummary] = useState({
    services: 0,
    openCases: 0,
    overdue: 0,
    dueToday: 0,
    dueThisWeek: 0,
  });
  const [inboxTab, setInboxTab] = useState<InboxTab>('all');
  const [myCompanies, setMyCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [companyNames, setCompanyNames] = useState<Record<string, string>>({});

  const [title, setTitle] = useState('');
  const [contractRef, setContractRef] = useState('');
  const [operatorCompanyId, setOperatorCompanyId] = useState('');

  const [sponsor, setSponsor] = useState<PickedClient | null>(null);
  const [sponsorQuery, setSponsorQuery] = useState('');
  const [sponsorSuggestions, setSponsorSuggestions] = useState<Company[]>([]);
  const [siepProjectId, setSiepProjectId] = useState('');
  const [siepProjects, setSiepProjects] = useState<SiepProject[]>([]);
  const [loadingSiep, setLoadingSiep] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [inboxRes, cRes, secRes] = await Promise.all([
        fetch('/api/nexus/at/inbox'),
        fetch('/api/companies'),
        fetch('/api/nexus/at/sectors'),
      ]);
      const inboxJson = await inboxRes.json();
      const cJson = await cRes.json();
      const secJson = secRes.ok ? await secRes.json() : { sectors: [], groups: [] };
      if (!inboxRes.ok) throw new Error(inboxJson.error || 'Error');
      setSectorCatalog(secJson.sectors || []);
      setSectorGroups(secJson.groups || []);
      setSectorPortfolio(inboxJson.sectorPortfolio || []);
      const list = (cJson.companies || []) as Company[];
      const nameMap: Record<string, string> = {};
      for (const c of list) nameMap[c.id] = c.shortName || c.name;
      setCompanyNames(nameMap);
      setMyCompanies(list);
      setServices(inboxJson.services || []);
      setInbox(inboxJson.inbox || []);
      setAgenda(inboxJson.agenda || { overdue: [], today: [], week: [], noDate: [] });
      setSummary(
        inboxJson.summary || { services: 0, openCases: 0, overdue: 0, dueToday: 0, dueThisWeek: 0 }
      );
      const preferred = activeCompanyId && list.some((c) => c.id === activeCompanyId) ? activeCompanyId : list[0]?.id || '';
      setOperatorCompanyId((prev) => prev || preferred);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [activeCompanyId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!showForm) return;
    const q = sponsorQuery.trim();
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/nexus/at/client-companies?q=${encodeURIComponent(q)}&take=20`);
        const d = await r.json();
        if (!cancelled && r.ok) setSponsorSuggestions(d.companies || []);
      } catch {
        if (!cancelled) setSponsorSuggestions([]);
      }
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [sponsorQuery, showForm]);

  useEffect(() => {
    const ids = [...new Set([sponsor?.id, operatorCompanyId].filter(Boolean) as string[])];
    if (ids.length === 0) {
      setSiepProjects([]);
      setSiepProjectId('');
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingSiep(true);
      try {
        const r = await fetch(
          `/api/nexus/at/siep-projects?companyIds=${encodeURIComponent(ids.join(','))}`
        );
        const d = await r.json();
        if (!cancelled && r.ok) setSiepProjects(d.projects || []);
      } catch {
        if (!cancelled) setSiepProjects([]);
      } finally {
        if (!cancelled) setLoadingSiep(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sponsor?.id, operatorCompanyId]);

  const pickSponsor = (c: Company) => {
    if (c.id === operatorCompanyId) return;
    setSponsor({ key: c.id, id: c.id, name: c.name, shortName: c.shortName });
    setSponsorQuery('');
  };

  const primarySectorId = selectedSectorIds[0] || '';

  const toggleSector = (id: string) => {
    setSelectedSectorIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const sectorSelectGroups = useMemo(
    () => groupSectorsForSelect(sectorCatalog, sectorGroups as never, loc),
    [sectorCatalog, sectorGroups, loc]
  );

  const companyNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of myCompanies) m.set(c.id, c.shortName || c.name);
    if (sponsor?.id) m.set(sponsor.id, sponsor.shortName || sponsor.name);
    return m;
  }, [myCompanies, sponsor]);

  const createSponsorByName = async () => {
    const name = sponsorQuery.trim();
    if (name.length < 2) return;
    try {
      const r = await fetch('/api/nexus/at/client-companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Error');
      setSponsor({
        key: d.company.id,
        id: d.company.id,
        name: d.company.name,
        shortName: d.company.shortName,
      });
      setSponsorQuery('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    }
  };

  const create = async () => {
    setSaving(true);
    setError(null);
    try {
      const r = await fetch('/api/nexus/at/engagements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          kind: 'CONTRACT',
          operatorCompanyId,
          primarySectorId: primarySectorId || undefined,
          sectorIds: selectedSectorIds,
          clientCompanyIds: [],
          newClients: [],
          contractRef: contractRef.trim() || undefined,
          sponsorCompanyId: sponsor?.id || undefined,
          newSponsor: sponsor && !sponsor.id ? { name: sponsor.name, shortName: sponsor.shortName } : undefined,
          siepProjectId: siepProjectId || undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || (es ? 'No se pudo crear' : 'Falha ao criar'));

      const projectName = es ? 'Diagnóstico inicial' : 'Diagnóstico inicial';
      await fetch(`/api/nexus/at/engagements/${encodeURIComponent(d.engagement.id)}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: projectName }),
      });

      setShowForm(false);
      setTitle('');
      setContractRef('');
      setSponsor(null);
      setSiepProjectId('');
      setSelectedSectorIds([]);
      router.push(`/hub/nexus/at/${d.engagement.id}?import=1`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setSaving(false);
    }
  };

  const visibleInbox = useMemo(() => {
    if (inboxTab === 'overdue') return agenda.overdue;
    if (inboxTab === 'today') return agenda.today;
    if (inboxTab === 'week') return agenda.week;
    return inbox;
  }, [inboxTab, inbox, agenda]);

  const withCompanyLabel = (c: AtCaseCardModel): AtCaseCardModel => ({
    ...c,
    companyLabel: c.companyId ? companyNames[c.companyId] || c.companyLabel : null,
  });

  const filteredServices = useMemo(() => {
    if (sectorFilter === 'all') return services;
    return services.filter(
      (s) =>
        s.primarySectorId === sectorFilter ||
        s.sectorMix?.includes(sectorFilter) ||
        s.members.some((m) => m.sectorId === sectorFilter)
    );
  }, [services, sectorFilter]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {es ? 'Asistencia técnica' : 'Assistência técnica'}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          <Plus className="h-4 w-4" />
          {es ? 'Nuevo contrato' : 'Novo contrato'}
        </button>
      </header>

      <div className="flex flex-wrap gap-6 border-b border-slate-200 pb-4 text-sm">
        <div>
          <span className="text-slate-400">{es ? 'Contratos' : 'Contratos'}</span>
          <span className="ml-2 font-semibold text-slate-900">{summary.services}</span>
        </div>
        <div>
          <span className="text-slate-400">{es ? 'Abiertos' : 'Abertos'}</span>
          <span className="ml-2 font-semibold text-slate-900">{summary.openCases}</span>
        </div>
        <div className={summary.overdue ? 'text-amber-700' : ''}>
          <span className="text-slate-400">{es ? 'Atrasados' : 'Atrasados'}</span>
          <span className="ml-2 inline-flex items-center gap-1 font-semibold">
            {summary.overdue > 0 && <AlertTriangle className="h-3.5 w-3.5" />}
            {summary.overdue}
          </span>
        </div>
        <div>
          <span className="text-slate-400">{es ? 'Hoy' : 'Hoje'}</span>
          <span className="ml-2 font-semibold text-slate-900">{summary.dueToday}</span>
        </div>
      </div>

      {sectorPortfolio.length > 0 && (
        <section className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900">
              {es ? 'Cartera por sector' : 'Carteira por setor'}
            </h2>
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => setSectorFilter('all')}
                className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                  sectorFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {es ? 'Todos' : 'Todos'}
              </button>
              {sectorPortfolio.map((row) => (
                <button
                  key={row.sectorId}
                  type="button"
                  onClick={() => setSectorFilter(row.sectorId)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                    sectorFilter === row.sectorId ? 'bg-teal-800 text-white' : 'bg-teal-50 text-teal-900'
                  }`}
                >
                  {sectorBadgeLabel(row.sectorId, loc) || row.sectorId} · {row.companies}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {sectorPortfolio.map((row) => (
              <button
                key={`card-${row.sectorId}`}
                type="button"
                onClick={() => setSectorFilter(row.sectorId)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-teal-300 hover:shadow-sm"
              >
                <p className="text-sm font-medium text-slate-900">
                  {sectorBadgeLabel(row.sectorId, loc) || row.sectorId}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {row.contracts} {es ? 'contratos' : 'contratos'} · {row.companies}{' '}
                  {es ? 'empresas' : 'empresas'} · {row.openCases} {es ? 'casos abiertos' : 'casos abertos'}
                </p>
              </button>
            ))}
          </div>
        </section>
      )}

      {showForm && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900">
                {es ? 'Nuevo contrato / servicio' : 'Novo contrato / serviço'}
              </h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <label className="block text-sm font-medium text-slate-700">
                {es ? 'Nombre del servicio' : 'Nome do serviço'}
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  autoFocus
                  className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                  placeholder={es ? 'Ej. AT Cooperativas Norte 2026' : 'Ex. AT Cooperativas Norte 2026'}
                />
              </label>

              <div>
                <p className="text-sm font-medium text-slate-700">
                  {es ? 'Sectores del programa' : 'Setores do programa'}
                  <span className="ml-1 font-normal text-slate-400">
                    ({selectedSectorIds.length})
                  </span>
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {es ? 'Puede elegir varias áreas de intervención.' : 'Pode escolher várias áreas de intervenção.'}
                </p>
                <div className="mt-2 max-h-44 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-2">
                  {sectorSelectGroups.map((g) => (
                    <div key={g.groupId}>
                      <p className="text-[10px] font-semibold uppercase text-slate-400">{g.groupLabel}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {g.sectors.map((s) => {
                          const on = selectedSectorIds.includes(s.id);
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => toggleSector(s.id)}
                              className={`rounded-md px-2 py-1 text-xs font-medium ${
                                on ? 'bg-teal-800 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                              }`}
                            >
                              {s.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm font-medium text-slate-700">
                  {es ? 'Referencia' : 'Referência'}
                  <input
                    value={contractRef}
                    onChange={(e) => setContractRef(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                    placeholder="CTR-2026-01"
                  />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  {es ? 'Operador (quien presta)' : 'Operador (quem presta)'}
                  <select
                    value={operatorCompanyId}
                    onChange={(e) => setOperatorCompanyId(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                  >
                    {myCompanies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.shortName || c.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="rounded-xl border border-teal-100 bg-teal-50/40 p-3">
                <p className="text-sm font-medium text-slate-800">
                  {es ? 'Cliente contratante' : 'Cliente contratante'}
                </p>
                {sponsor ? (
                  <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm">
                    <span className="font-medium text-slate-900">
                      {sponsor.shortName || sponsor.name}
                      {!sponsor.id && (
                        <span className="ml-2 text-[10px] uppercase text-emerald-700">
                          {es ? 'nueva' : 'nova'}
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSponsor(null);
                        setSiepProjectId('');
                      }}
                      className="text-slate-400 hover:text-slate-700"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="relative mt-2">
                    <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      value={sponsorQuery}
                      onChange={(e) => setSponsorQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const first = sponsorSuggestions.find((c) => c.id !== operatorCompanyId);
                          if (first) pickSponsor(first);
                          else createSponsorByName();
                        }
                      }}
                      className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm outline-none focus:border-slate-400"
                      placeholder={
                        es ? 'Buscar o crear incubadora / institución…' : 'Pesquisar ou criar incubadora / instituição…'
                      }
                    />
                    {sponsorQuery.trim().length > 0 && (
                      <ul className="absolute z-10 mt-1 max-h-36 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                        {sponsorSuggestions
                          .filter((c) => c.id !== operatorCompanyId)
                          .map((c) => (
                            <li key={c.id}>
                              <button
                                type="button"
                                onClick={() => pickSponsor(c)}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                              >
                                {c.shortName || c.name}
                              </button>
                            </li>
                          ))}
                        {sponsorQuery.trim().length >= 2 && (
                          <li>
                            <button
                              type="button"
                              onClick={createSponsorByName}
                              className="w-full px-3 py-2 text-left text-sm font-medium text-emerald-800 hover:bg-slate-50"
                            >
                              + {es ? 'Crear' : 'Criar'} «{sponsorQuery.trim()}»
                            </button>
                          </li>
                        )}
                      </ul>
                    )}
                  </div>
                )}

                <label className="mt-3 block text-sm font-medium text-slate-700">
                  {es ? 'Proyecto institucional (SIEP)' : 'Projeto institucional (SIEP)'}
                  <select
                    value={siepProjectId}
                    onChange={(e) => setSiepProjectId(e.target.value)}
                    disabled={loadingSiep}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 disabled:opacity-50"
                  >
                    <option value="">
                      {loadingSiep
                        ? es
                          ? 'Cargando…'
                          : 'A carregar…'
                        : siepProjects.length === 0
                          ? es
                            ? '— sin proyectos SIEP —'
                            : '— sem projetos SIEP —'
                          : es
                            ? '— sin proyecto —'
                            : '— sem projeto —'}
                    </option>
                    {siepProjects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.code ? `${p.code} · ` : ''}
                        {p.name}
                        {companyNameById.get(p.companyId)
                          ? ` (${companyNameById.get(p.companyId)})`
                          : ''}
                      </option>
                    ))}
                  </select>
                  {!loadingSiep && siepProjects.length === 0 && (
                    <Link
                      href="/siep/projects"
                      className="mt-1 inline-block text-[11px] font-medium text-teal-800 hover:underline"
                    >
                      {es ? 'Crear proyecto en SIEP →' : 'Criar projeto no SIEP →'}
                    </Link>
                  )}
                </label>
              </div>

              <div className="rounded-lg border border-teal-100 bg-teal-50/60 px-3 py-2.5 text-xs text-teal-950">
                {es
                  ? 'Primero defines el marco legal (contrato, contratante, sectores). Después importas las MIPYMEs beneficiarias — cada una tendrá su proceso individual.'
                  : 'Primeiro defines o marco legal (contrato, contratante, setores). Depois importas as MIPYMEs beneficiárias — cada uma terá o seu processo individual.'}
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
                >
                  {es ? 'Cancelar' : 'Cancelar'}
                </button>
                <button
                  type="button"
                  disabled={saving || title.trim().length < 2 || !operatorCompanyId || selectedSectorIds.length === 0}
                  onClick={create}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40"
                >
                  {saving
                    ? es
                      ? 'Creando…'
                      : 'A criar…'
                    : es
                      ? 'Criar marco legal'
                      : 'Criar marco legal'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[24vh] items-center justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-300 border-t-slate-800" />
        </div>
      ) : (
        <>
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900">{es ? 'Agenda' : 'Agenda'}</h2>
              <div className="flex gap-1">
                {(
                  [
                    ['all', es ? 'Todos' : 'Todos', inbox.length],
                    ['overdue', es ? 'Atrasados' : 'Atrasados', agenda.overdue.length],
                    ['today', es ? 'Hoy' : 'Hoje', agenda.today.length],
                    ['week', es ? 'Semana' : 'Semana', agenda.week.length],
                  ] as const
                ).map(([key, label, n]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setInboxTab(key)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                      inboxTab === key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {label} {n}
                  </button>
                ))}
              </div>
            </div>
            {visibleInbox.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">
                {es ? 'Sin casos en esta vista.' : 'Sem casos nesta vista.'}
              </p>
            ) : (
              <div className="space-y-2">
                {visibleInbox.map((c) => (
                  <NexusAtCaseCard
                    key={c.id}
                    caseItem={withCompanyLabel(c)}
                    showServiceLink
                    onUpdated={() => load()}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-900">
              {es ? 'Contratos / servicios' : 'Contratos / serviços'}
            </h2>
            {filteredServices.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center">
                <p className="text-sm text-slate-500">
                  {es
                    ? 'Aún no hay contratos. Crea uno e incluye las empresas que atendéis.'
                    : 'Ainda não há contratos. Cria um e inclui as empresas que atendem.'}
                </p>
                <button
                  type="button"
                  onClick={() => setShowForm(true)}
                  className="mt-3 text-sm font-medium text-slate-900 underline"
                >
                  {es ? 'Nuevo contrato' : 'Novo contrato'}
                </button>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
                {filteredServices.map((s) => {
                  const clients = s.members.filter((m) => m.memberRole === 'client');
                  const sponsorLabel = s.sponsorCompany
                    ? s.sponsorCompany.shortName || s.sponsorCompany.name
                    : null;
                  const siepLabel = s.siepProject?.name || null;
                  const sectorLabelMain = sectorBadgeLabel(s.primarySectorId, loc);
                  return (
                    <li key={s.id}>
                      <Link
                        href={`/hub/nexus/at/${s.id}`}
                        className="flex flex-wrap items-center justify-between gap-2 px-4 py-3.5 transition hover:bg-slate-50"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-900">{s.title}</p>
                          {sectorLabelMain && (
                            <span className="mt-1 inline-block rounded bg-teal-50 px-2 py-0.5 text-[10px] font-medium text-teal-900">
                              {sectorLabelMain}
                            </span>
                          )}
                          <p className="mt-0.5 truncate text-xs text-slate-500">
                            {s.contractRef ? `${s.contractRef} · ` : ''}
                            {sponsorLabel
                              ? `${es ? 'Contrata' : 'Contrata'}: ${sponsorLabel}`
                              : es
                                ? 'Sin contratante'
                                : 'Sem contratante'}
                            {siepLabel ? ` · ${siepLabel}` : ''}
                            {clients.length > 0
                              ? ` · ${clients.map((m) => m.company.shortName || m.company.name).join(', ')}`
                              : ''}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2 text-xs text-slate-500">
                          <span>
                            {s.projectCount} {es ? 'proy.' : 'proj.'}
                          </span>
                          {s.openCaseCount > 0 && (
                            <span className="rounded-full bg-slate-900 px-2 py-0.5 font-medium text-white">
                              {s.openCaseCount}
                            </span>
                          )}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}

      {error && !showForm && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
