'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CalendarDays, FolderKanban, Headphones, Inbox, Plus } from 'lucide-react';
import { NexusAtCaseCard, type AtCaseCardModel } from '@/components/nexus/NexusAtCaseCard';

type Company = { id: string; name: string; shortName: string };
type NetworkRow = { id: string; name: string };
type Service = {
  id: string;
  title: string;
  kind: string;
  status: string;
  contractRef: string | null;
  operatorCompany: { id: string; name: string; shortName: string };
  members: Array<{ companyId: string; memberRole: string; company: { shortName: string; name: string } }>;
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

type InboxTab = 'all' | 'overdue' | 'today' | 'week' | 'noDate';

const KIND_OPTIONS = [
  { value: 'CONTRACT', label: 'Contrato' },
  { value: 'PROJECT', label: 'Projeto (tipo)' },
  { value: 'PROGRAM', label: 'Programa' },
];

export default function NexusAtPage() {
  const router = useRouter();
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
  const [companies, setCompanies] = useState<Company[]>([]);
  const [networks, setNetworks] = useState<NetworkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [companyNames, setCompanyNames] = useState<Record<string, string>>({});

  const [title, setTitle] = useState('');
  const [kind, setKind] = useState('CONTRACT');
  const [operatorCompanyId, setOperatorCompanyId] = useState('');
  const [clientIds, setClientIds] = useState<Set<string>>(new Set());
  const [networkId, setNetworkId] = useState('');
  const [contractRef, setContractRef] = useState('');
  const [description, setDescription] = useState('');
  const [firstProjectName, setFirstProjectName] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setMsg(null);
    try {
      const [inboxRes, cRes, nRes] = await Promise.all([
        fetch('/api/nexus/at/inbox'),
        fetch('/api/companies'),
        fetch('/api/nexus/networks'),
      ]);
      const inboxJson = await inboxRes.json();
      const cJson = await cRes.json();
      const nJson = await nRes.json();
      if (!inboxRes.ok) throw new Error(inboxJson.error || 'Falha ao carregar AT');
      if (!cRes.ok) throw new Error(cJson.error || 'Empresas');
      const list = (cJson.companies || []) as Company[];
      const nameMap: Record<string, string> = {};
      for (const c of list) nameMap[c.id] = c.shortName || c.name;
      setCompanyNames(nameMap);
      setCompanies(list);
      setServices(inboxJson.services || []);
      setInbox(inboxJson.inbox || []);
      setAgenda(
        inboxJson.agenda || { overdue: [], today: [], week: [], noDate: [] }
      );
      setSummary(
        inboxJson.summary || { services: 0, openCases: 0, overdue: 0, dueToday: 0, dueThisWeek: 0 }
      );
      setNetworks((nJson.networks || []).map((n: { id: string; name: string }) => ({ id: n.id, name: n.name })));
      setOperatorCompanyId((prev) => prev || list[0]?.id || '');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erro');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const otherCompanies = useMemo(
    () => companies.filter((c) => c.id !== operatorCompanyId),
    [companies, operatorCompanyId]
  );

  const toggleClient = (id: string) => {
    setClientIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const create = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const r = await fetch('/api/nexus/at/engagements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          kind,
          operatorCompanyId,
          clientCompanyIds: [...clientIds],
          networkId: networkId || undefined,
          contractRef: contractRef || undefined,
          description: description || undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha ao criar serviço');

      const projectName = firstProjectName.trim() || 'Projeto inicial';
      await fetch(`/api/nexus/at/engagements/${encodeURIComponent(d.engagement.id)}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: projectName }),
      });

      setShowForm(false);
      setTitle('');
      setClientIds(new Set());
      setNetworkId('');
      setContractRef('');
      setDescription('');
      setFirstProjectName('');
      router.push(`/hub/nexus/at/${d.engagement.id}`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erro');
    } finally {
      setSaving(false);
    }
  };

  const visibleInbox = useMemo(() => {
    if (inboxTab === 'overdue') return agenda.overdue;
    if (inboxTab === 'today') return agenda.today;
    if (inboxTab === 'week') return agenda.week;
    if (inboxTab === 'noDate') return agenda.noDate;
    return inbox;
  }, [inboxTab, inbox, agenda]);

  const withCompanyLabel = (c: AtCaseCardModel): AtCaseCardModel => ({
    ...c,
    companyLabel: c.companyId ? companyNames[c.companyId] : null,
  });

  const kindLabel = (k: string) => KIND_OPTIONS.find((o) => o.value === k)?.label || k;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-gray-900">
            <Headphones className="h-5 w-5 text-violet-700" />
            Assistência técnica
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            Serviço → projeto → empresa. Inbox global para a equipa; dentro de cada serviço, filas separadas por
            empresa.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-violet-700 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-800"
        >
          <Plus className="h-4 w-4" />
          Novo serviço
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-violet-700">Serviços</p>
          <p className="mt-1 text-2xl font-semibold text-violet-950">{summary.services}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Casos abertos</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{summary.openCases}</p>
        </div>
        <div
          className={`rounded-xl border px-4 py-3 ${summary.overdue ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white'}`}
        >
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Atrasados</p>
          <p className="mt-1 flex items-center gap-1.5 text-2xl font-semibold text-gray-900">
            {summary.overdue > 0 && <AlertTriangle className="h-5 w-5 text-amber-600" />}
            {summary.overdue}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Hoje / semana</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">
            {summary.dueToday}
            <span className="text-base font-normal text-gray-400"> / {summary.dueThisWeek}</span>
          </p>
        </div>
      </div>

      {showForm && (
        <div className="space-y-3 rounded-xl border border-violet-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-violet-800">1. Serviço</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium text-gray-700 sm:col-span-2">
              Nome do serviço
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                placeholder="Ex.: AT Cooperativas Norte 2026"
              />
            </label>
            <label className="block text-xs font-medium text-gray-700">
              Tipo comercial
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
            <label className="block text-xs font-medium text-gray-700">
              Ref. / código
              <input
                value={contractRef}
                onChange={(e) => setContractRef(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs font-medium text-gray-700">
              Operador
              <select
                value={operatorCompanyId}
                onChange={(e) => setOperatorCompanyId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.shortName || c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium text-gray-700">
              Rede NEXUS (opcional)
              <select
                value={networkId}
                onChange={(e) => setNetworkId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              >
                <option value="">— nenhuma —</option>
                {networks.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="pt-1 text-xs font-medium uppercase tracking-wide text-violet-800">2. Empresas</p>
          <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-gray-100 p-2">
            {otherCompanies.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm text-gray-800">
                <input type="checkbox" checked={clientIds.has(c.id)} onChange={() => toggleClient(c.id)} />
                {c.shortName || c.name}
              </label>
            ))}
            {otherCompanies.length === 0 && (
              <p className="text-xs text-gray-500">Sem outras empresas — podes adicionar depois.</p>
            )}
          </div>
          <p className="pt-1 text-xs font-medium uppercase tracking-wide text-violet-800">3. Primeiro projeto</p>
          <input
            value={firstProjectName}
            onChange={(e) => setFirstProjectName(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            placeholder="Ex.: Fase 1 · Diagnóstico"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            placeholder="Notas do serviço"
          />
          <button
            type="button"
            disabled={saving || title.trim().length < 2}
            onClick={create}
            className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-50"
          >
            {saving ? 'A criar…' : 'Criar serviço e abrir'}
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[24vh] items-center justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-violet-600/30 border-t-violet-600" />
        </div>
      ) : (
        <>
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <Inbox className="h-4 w-4 text-violet-700" />
                Inbox / agenda
              </h2>
              <div className="flex flex-wrap gap-1">
                {(
                  [
                    ['all', `Todos (${inbox.length})`],
                    ['overdue', `Atrasados (${agenda.overdue.length})`],
                    ['today', `Hoje (${agenda.today.length})`],
                    ['week', `Semana (${agenda.week.length})`],
                    ['noDate', `Sem prazo (${agenda.noDate.length})`],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setInboxTab(key)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                      inboxTab === key
                        ? 'bg-violet-700 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {key === 'today' || key === 'week' ? (
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        {label}
                      </span>
                    ) : (
                      label
                    )}
                  </button>
                ))}
              </div>
            </div>
            {visibleInbox.length === 0 ? (
              <p className="rounded-xl border border-dashed border-gray-200 bg-white px-4 py-6 text-sm text-gray-500">
                Nada nesta vista. Abre um serviço e cria casos com prazo para alimentar a agenda.
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

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-900">Serviços</h2>
            {services.map((s) => {
              const clients = s.members.filter((m) => m.memberRole !== 'operator');
              return (
                <Link
                  key={s.id}
                  href={`/hub/nexus/at/${s.id}`}
                  className="block rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-violet-300 hover:bg-violet-50/40"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-gray-900">{s.title}</p>
                    <div className="flex items-center gap-2">
                      {s.openCaseCount > 0 && (
                        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-900">
                          {s.openCaseCount} aberto{s.openCaseCount === 1 ? '' : 's'}
                        </span>
                      )}
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">{s.status}</span>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {kindLabel(s.kind)}
                    {s.contractRef ? ` · ${s.contractRef}` : ''} ·{' '}
                    {s.operatorCompany.shortName || s.operatorCompany.name}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-3 text-sm text-gray-700">
                    <span className="inline-flex items-center gap-1">
                      <FolderKanban className="h-3.5 w-3.5 text-violet-600" />
                      {s.projectCount} projeto{s.projectCount === 1 ? '' : 's'}
                    </span>
                    <span>
                      {clients.length === 0
                        ? 'Sem empresas'
                        : clients.map((m) => m.company.shortName || m.company.name).join(' · ')}
                    </span>
                  </div>
                </Link>
              );
            })}
            {services.length === 0 && (
              <p className="text-sm text-gray-500">Ainda não há serviços. Cria o primeiro.</p>
            )}
          </section>
        </>
      )}

      {msg && <p className="text-sm text-red-700">{msg}</p>}
    </div>
  );
}
