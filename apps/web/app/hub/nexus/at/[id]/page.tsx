'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Plus, Search, X } from 'lucide-react';
import { useApp } from '@/app/providers';
import { NexusAtCaseCard, type AtCaseCardModel } from '@/components/nexus/NexusAtCaseCard';
import { AT_CASE_KIND_LABELS, type AtCaseKind } from '@/lib/nexus-at-shared';

type Company = { id: string; name: string; shortName: string };
type Member = {
  id: string;
  companyId: string;
  memberRole: string;
  company: { id: string; name: string; shortName: string };
};
type AtProject = {
  id: string;
  name: string;
  status: string;
  description: string | null;
  siepProject: { id: string; name: string } | null;
};
type Service = {
  id: string;
  title: string;
  kind: string;
  status: string;
  contractRef: string | null;
  description: string | null;
  operatorCompanyId: string;
  operatorCompany: { id: string; name: string; shortName: string };
  sponsorCompany?: { id: string; name: string; shortName: string } | null;
  siepProject?: { id: string; name: string; code?: string | null } | null;
  members: Member[];
  projects: AtProject[];
};

export default function NexusAtServicePage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';
  const { locale } = useApp();
  const es = locale === 'es';

  const CASE_KINDS = (Object.keys(AT_CASE_KIND_LABELS) as AtCaseKind[]).map((kid) => ({
    id: kid,
    label: AT_CASE_KIND_LABELS[kid][es ? 'es' : 'pt'],
  }));

  const [service, setService] = useState<Service | null>(null);
  const [cases, setCases] = useState<AtCaseCardModel[]>([]);
  const [isOperator, setIsOperator] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [showClosed, setShowClosed] = useState(false);

  const [newProjectName, setNewProjectName] = useState('');
  const [savingProject, setSavingProject] = useState(false);

  const [caseKind, setCaseKind] = useState<AtCaseKind>('visit');
  const [brief, setBrief] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [assignToMe, setAssignToMe] = useState(true);
  const [savingCase, setSavingCase] = useState(false);
  const [showNewCase, setShowNewCase] = useState(false);

  const [addQuery, setAddQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Company[]>([]);
  const [addingMember, setAddingMember] = useState(false);
  const [showAddCompany, setShowAddCompany] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/nexus/at/engagements/${encodeURIComponent(id)}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || (es ? 'No encontrado' : 'Não encontrado'));
      const eng = d.engagement as Service;
      setService(eng);
      setCases(d.cases || []);
      setIsOperator(Boolean(d.isOperator));

      setSelectedProjectId((prev) => {
        if (prev && eng.projects.some((p) => p.id === prev)) return prev;
        return eng.projects[0]?.id || '';
      });
      const clients = eng.members.filter((m) => m.memberRole !== 'operator');
      setSelectedCompanyId((prev) => {
        if (prev && clients.some((m) => m.companyId === prev)) return prev;
        return clients[0]?.companyId || '';
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
      setService(null);
    } finally {
      setLoading(false);
    }
  }, [id, es]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!showAddCompany) return;
    const q = addQuery.trim();
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/nexus/at/client-companies?q=${encodeURIComponent(q)}&take=20`);
        const d = await r.json();
        if (!cancelled && r.ok) setSuggestions(d.companies || []);
      } catch {
        if (!cancelled) setSuggestions([]);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [addQuery, showAddCompany]);

  const clients = useMemo(
    () => (service?.members || []).filter((m) => m.memberRole !== 'operator'),
    [service]
  );

  const presentIds = useMemo(() => new Set((service?.members || []).map((m) => m.companyId)), [service]);

  const companyLabel = useCallback(
    (companyId: string | null | undefined) => {
      if (!companyId) return null;
      const m = service?.members.find((x) => x.companyId === companyId);
      return m ? m.company.shortName || m.company.name : companyId;
    },
    [service]
  );

  const projectLabel = useCallback(
    (projectId: string | null | undefined) => {
      if (!projectId || !service) return null;
      return service.projects.find((p) => p.id === projectId)?.name || null;
    },
    [service]
  );

  const openByProject = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of cases) {
      if (!c.isOpen || !c.projectId) continue;
      m.set(c.projectId, (m.get(c.projectId) || 0) + 1);
    }
    return m;
  }, [cases]);

  const openByCompany = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of cases) {
      if (!c.isOpen || !c.companyId) continue;
      if (selectedProjectId && c.projectId !== selectedProjectId) continue;
      m.set(c.companyId, (m.get(c.companyId) || 0) + 1);
    }
    return m;
  }, [cases, selectedProjectId]);

  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      if (selectedProjectId && c.projectId !== selectedProjectId) return false;
      if (selectedCompanyId && c.companyId !== selectedCompanyId) return false;
      if (!showClosed && !c.isOpen) return false;
      return true;
    });
  }, [cases, selectedProjectId, selectedCompanyId, showClosed]);

  const selectedProject = service?.projects.find((p) => p.id === selectedProjectId) || null;

  const createProject = async () => {
    if (!newProjectName.trim()) return;
    setSavingProject(true);
    setError(null);
    try {
      const r = await fetch(`/api/nexus/at/engagements/${encodeURIComponent(id)}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newProjectName.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Error');
      setNewProjectName('');
      setSelectedProjectId(d.project.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setSavingProject(false);
    }
  };

  const createCase = async () => {
    if (!selectedProjectId || !selectedCompanyId) return;
    setSavingCase(true);
    setError(null);
    try {
      const r = await fetch(`/api/nexus/at/engagements/${encodeURIComponent(id)}/cases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedProjectId,
          companyId: selectedCompanyId,
          caseKind,
          brief,
          priority,
          dueDate: dueDate || undefined,
          assignToMe,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Error');
      setBrief('');
      setDueDate('');
      setShowNewCase(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setSavingCase(false);
    }
  };

  const addMemberById = async (companyId: string) => {
    setAddingMember(true);
    setError(null);
    try {
      const r = await fetch(`/api/nexus/at/engagements/${encodeURIComponent(id)}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Error');
      setAddQuery('');
      setShowAddCompany(false);
      setSelectedCompanyId(companyId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setAddingMember(false);
    }
  };

  const addMemberByName = async () => {
    const name = addQuery.trim();
    if (name.length < 2) return;
    setAddingMember(true);
    setError(null);
    try {
      const r = await fetch(`/api/nexus/at/engagements/${encodeURIComponent(id)}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Error');
      setAddQuery('');
      setShowAddCompany(false);
      if (d.member?.companyId) setSelectedCompanyId(d.member.companyId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setAddingMember(false);
    }
  };

  const removeMember = async (companyId: string) => {
    setError(null);
    try {
      const r = await fetch(
        `/api/nexus/at/engagements/${encodeURIComponent(id)}/members?companyId=${encodeURIComponent(companyId)}`,
        { method: 'DELETE' }
      );
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Error');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    }
  };

  const filteredSuggestions = suggestions.filter((c) => !presentIds.has(c.id));

  if (loading) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-300 border-t-slate-800" />
      </div>
    );
  }

  if (!service) {
    return (
      <div className="space-y-3">
        <Link href="/hub/nexus/at" className="inline-flex items-center gap-1 text-sm text-slate-600">
          <ArrowLeft className="h-4 w-4" /> {es ? 'Volver' : 'Voltar'}
        </Link>
        <p className="text-sm text-red-600">{error || (es ? 'No encontrado' : 'Não encontrado')}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <Link href="/hub/nexus/at" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" /> {es ? 'Contratos' : 'Contratos'}
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{service.title}</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {service.contractRef ? `${service.contractRef} · ` : ''}
              {es ? 'Opera' : 'Opera'}: {service.operatorCompany.shortName || service.operatorCompany.name}
              {service.sponsorCompany
                ? ` · ${es ? 'Contrata' : 'Contrata'}: ${service.sponsorCompany.shortName || service.sponsorCompany.name}`
                : ''}
              {service.siepProject
                ? ` · ${service.siepProject.code ? `${service.siepProject.code} · ` : ''}${service.siepProject.name}`
                : ''}
            </p>
          </div>
          {isOperator && selectedProjectId && selectedCompanyId && (
            <button
              type="button"
              onClick={() => setShowNewCase(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" />
              {es ? 'Nuevo caso' : 'Novo caso'}
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid gap-5 lg:grid-cols-[200px_1fr]">
        <aside className="space-y-1">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            {es ? 'Proyectos' : 'Projetos'}
          </p>
          {service.projects.map((p) => {
            const n = openByProject.get(p.id) || 0;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedProjectId(p.id)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${
                  selectedProjectId === p.id
                    ? 'bg-slate-900 font-medium text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="truncate">{p.name}</span>
                {n > 0 && (
                  <span
                    className={`ml-2 rounded-full px-1.5 text-[10px] font-semibold ${
                      selectedProjectId === p.id ? 'bg-white/20' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {n}
                  </span>
                )}
              </button>
            );
          })}
          {isOperator && (
            <div className="pt-3">
              <input
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') createProject();
                }}
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-slate-400"
                placeholder={es ? 'Nuevo proyecto…' : 'Novo projeto…'}
              />
              <button
                type="button"
                disabled={savingProject || newProjectName.trim().length < 2}
                onClick={createProject}
                className="mt-1.5 w-full rounded-lg border border-slate-200 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                {es ? 'Añadir proyecto' : 'Adicionar projeto'}
              </button>
            </div>
          )}
        </aside>

        <div className="space-y-4">
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                {es ? 'Empresas atendidas' : 'Empresas atendidas'}
              </p>
              {isOperator && (
                <button
                  type="button"
                  onClick={() => setShowAddCompany((v) => !v)}
                  className="text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  {showAddCompany ? (es ? 'Cerrar' : 'Fechar') : es ? '+ Empresa' : '+ Empresa'}
                </button>
              )}
            </div>
            {clients.length === 0 ? (
              <p className="text-sm text-slate-400">
                {es
                  ? 'Añade las empresas que entran en este contrato.'
                  : 'Adiciona as empresas deste contrato.'}
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {clients.map((m) => {
                  const n = openByCompany.get(m.companyId) || 0;
                  const active = selectedCompanyId === m.companyId;
                  return (
                    <button
                      key={m.companyId}
                      type="button"
                      onClick={() => setSelectedCompanyId(m.companyId)}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm ${
                        active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                      }`}
                    >
                      {m.company.shortName || m.company.name}
                      {n > 0 && (
                        <span className={`text-[10px] font-semibold ${active ? 'text-white/80' : 'text-slate-500'}`}>
                          {n}
                        </span>
                      )}
                      {isOperator && (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            removeMember(m.companyId);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.stopPropagation();
                              removeMember(m.companyId);
                            }
                          }}
                          className={`ml-0.5 ${active ? 'text-white/60 hover:text-white' : 'text-slate-400 hover:text-slate-700'}`}
                        >
                          <X className="h-3 w-3" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
            {showAddCompany && isOperator && (
              <div className="relative mt-3">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  value={addQuery}
                  onChange={(e) => setAddQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (filteredSuggestions[0]) addMemberById(filteredSuggestions[0].id);
                      else addMemberByName();
                    }
                  }}
                  disabled={addingMember}
                  className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-3 text-sm outline-none focus:border-slate-400"
                  placeholder={
                    es ? 'Buscar o crear empresa…' : 'Pesquisar ou criar empresa…'
                  }
                />
                {addQuery.trim().length > 0 && (
                  <ul className="absolute z-10 mt-1 max-h-44 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                    {filteredSuggestions.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => addMemberById(c.id)}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                        >
                          {c.shortName || c.name}
                        </button>
                      </li>
                    ))}
                    {addQuery.trim().length >= 2 && (
                      <li>
                        <button
                          type="button"
                          onClick={addMemberByName}
                          className="w-full px-3 py-2 text-left text-sm font-medium text-emerald-800 hover:bg-slate-50"
                        >
                          + {es ? 'Crear' : 'Criar'} «{addQuery.trim()}»
                        </button>
                      </li>
                    )}
                  </ul>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-y border-slate-100 py-2 text-sm">
            <span className="text-slate-700">
              <span className="font-medium">{selectedProject?.name || '—'}</span>
              <span className="mx-1.5 text-slate-300">/</span>
              <span className="font-medium">{companyLabel(selectedCompanyId) || '—'}</span>
            </span>
            <label className="flex items-center gap-1.5 text-xs text-slate-500">
              <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} />
              {es ? 'Incluir cerrados' : 'Incluir concluídos'}
            </label>
          </div>

          {showNewCase && (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">
                  {es ? 'Nuevo caso' : 'Novo caso'}
                </h3>
                <button type="button" onClick={() => setShowNewCase(false)} className="text-slate-400 hover:text-slate-700">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <select
                  value={caseKind}
                  onChange={(e) => setCaseKind(e.target.value as AtCaseKind)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  {CASE_KINDS.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.label}
                    </option>
                  ))}
                </select>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="LOW">{es ? 'Prioridad baja' : 'Prioridade baixa'}</option>
                  <option value="MEDIUM">{es ? 'Media' : 'Média'}</option>
                  <option value="HIGH">{es ? 'Alta' : 'Alta'}</option>
                  <option value="CRITICAL">{es ? 'Crítica' : 'Crítica'}</option>
                </select>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                />
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={assignToMe} onChange={(e) => setAssignToMe(e.target.checked)} />
                  {es ? 'Asignarme' : 'Atribuir a mim'}
                </label>
                <textarea
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  rows={3}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm sm:col-span-2"
                  placeholder={
                    es
                      ? 'Qué hay que hacer en esta empresa…'
                      : 'O que fazer nesta empresa…'
                  }
                />
                <button
                  type="button"
                  disabled={savingCase || brief.trim().length < 8}
                  onClick={createCase}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40 sm:col-span-2"
                >
                  {savingCase ? (es ? 'Guardando…' : 'A guardar…') : es ? 'Abrir caso' : 'Abrir caso'}
                </button>
              </div>
            </div>
          )}

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-900">
              {es ? 'Cola' : 'Fila'} · {filteredCases.length}
            </h2>
            {filteredCases.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">
                {es
                  ? 'Sin casos para este proyecto + empresa.'
                  : 'Sem casos neste projeto + empresa.'}
              </p>
            ) : (
              filteredCases.map((c) => (
                <NexusAtCaseCard
                  key={c.id}
                  caseItem={{
                    ...c,
                    companyLabel: companyLabel(c.companyId),
                    projectName: projectLabel(c.projectId),
                  }}
                  onUpdated={(updated) => {
                    setCases((prev) => prev.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)));
                  }}
                />
              ))
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
