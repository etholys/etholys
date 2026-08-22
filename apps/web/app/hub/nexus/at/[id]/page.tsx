'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Building2, FolderKanban, Headphones, Plus, UserPlus } from 'lucide-react';
import { NexusAtCaseCard, type AtCaseCardModel } from '@/components/nexus/NexusAtCaseCard';
import { AT_CASE_KIND_LABELS, type AtCaseKind } from '@/lib/nexus-at';

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
  members: Member[];
  projects: AtProject[];
};

const CASE_KINDS = (Object.keys(AT_CASE_KIND_LABELS) as AtCaseKind[]).map((id) => ({
  id,
  label: AT_CASE_KIND_LABELS[id].pt,
}));

export default function NexusAtServicePage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';

  const [service, setService] = useState<Service | null>(null);
  const [cases, setCases] = useState<AtCaseCardModel[]>([]);
  const [isOperator, setIsOperator] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [showClosed, setShowClosed] = useState(false);

  const [newProjectName, setNewProjectName] = useState('');
  const [savingProject, setSavingProject] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editProjectName, setEditProjectName] = useState('');

  const [caseKind, setCaseKind] = useState<AtCaseKind>('visit');
  const [brief, setBrief] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [assignToMe, setAssignToMe] = useState(true);
  const [savingCase, setSavingCase] = useState(false);

  const [addCompanyId, setAddCompanyId] = useState('');
  const [addingMember, setAddingMember] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setMsg(null);
    try {
      const [r, cRes] = await Promise.all([
        fetch(`/api/nexus/at/engagements/${encodeURIComponent(id)}`),
        fetch('/api/companies'),
      ]);
      const d = await r.json();
      const cJson = await cRes.json();
      if (!r.ok) throw new Error(d.error || 'Não encontrado');
      const eng = d.engagement as Service;
      setService(eng);
      setCases(d.cases || []);
      setIsOperator(Boolean(d.isOperator));
      setCompanies(cJson.companies || []);

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
      setMsg(e instanceof Error ? e.message : 'Erro');
      setService(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const clients = useMemo(
    () => (service?.members || []).filter((m) => m.memberRole !== 'operator'),
    [service]
  );

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

  const availableToAdd = useMemo(() => {
    const present = new Set((service?.members || []).map((m) => m.companyId));
    return companies.filter((c) => !present.has(c.id));
  }, [companies, service]);

  const createProject = async () => {
    if (!newProjectName.trim()) return;
    setSavingProject(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/nexus/at/engagements/${encodeURIComponent(id)}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newProjectName.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha ao criar projeto');
      setNewProjectName('');
      setSelectedProjectId(d.project.id);
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erro');
    } finally {
      setSavingProject(false);
    }
  };

  const renameProject = async () => {
    if (!editingProjectId || editProjectName.trim().length < 2) return;
    setSavingProject(true);
    setMsg(null);
    try {
      const r = await fetch(
        `/api/nexus/at/engagements/${encodeURIComponent(id)}/projects/${encodeURIComponent(editingProjectId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: editProjectName.trim() }),
        }
      );
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha ao renomear');
      setEditingProjectId(null);
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erro');
    } finally {
      setSavingProject(false);
    }
  };

  const archiveProject = async (projectId: string) => {
    if (!confirm('Arquivar este projeto? Os casos mantêm-se, mas o projeto sai da lista.')) return;
    setMsg(null);
    try {
      const r = await fetch(
        `/api/nexus/at/engagements/${encodeURIComponent(id)}/projects/${encodeURIComponent(projectId)}`,
        { method: 'DELETE' }
      );
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha ao arquivar');
      if (selectedProjectId === projectId) setSelectedProjectId('');
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erro');
    }
  };

  const createCase = async () => {
    if (!selectedProjectId || !selectedCompanyId) {
      setMsg('Seleciona projeto e empresa.');
      return;
    }
    setSavingCase(true);
    setMsg(null);
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
      if (!r.ok) throw new Error(d.error || 'Falha ao abrir caso');
      setBrief('');
      setDueDate('');
      setMsg('Caso aberto.');
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erro');
    } finally {
      setSavingCase(false);
    }
  };

  const addMember = async () => {
    if (!addCompanyId) return;
    setAddingMember(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/nexus/at/engagements/${encodeURIComponent(id)}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: addCompanyId }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha ao adicionar');
      const added = addCompanyId;
      setAddCompanyId('');
      setSelectedCompanyId(added);
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erro');
    } finally {
      setAddingMember(false);
    }
  };

  const removeMember = async (companyId: string) => {
    setMsg(null);
    try {
      const r = await fetch(
        `/api/nexus/at/engagements/${encodeURIComponent(id)}/members?companyId=${encodeURIComponent(companyId)}`,
        { method: 'DELETE' }
      );
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha ao remover');
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erro');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-600/30 border-t-violet-600" />
      </div>
    );
  }

  if (!service) {
    return (
      <div className="space-y-3">
        <Link href="/hub/nexus/at" className="inline-flex items-center gap-1 text-sm text-violet-700">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
        <p className="text-sm text-red-700">{msg || 'Serviço não encontrado.'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <Link href="/hub/nexus/at" className="mb-2 inline-flex items-center gap-1 text-sm text-violet-700">
          <ArrowLeft className="h-4 w-4" /> Serviços de AT
        </Link>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-gray-900">
          <Headphones className="h-5 w-5 text-violet-700" />
          {service.title}
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Serviço · {service.kind}
          {service.contractRef ? ` · ${service.contractRef}` : ''} · Operador:{' '}
          {service.operatorCompany.shortName || service.operatorCompany.name}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <aside className="space-y-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
          <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <FolderKanban className="h-3.5 w-3.5" /> Projetos
          </h2>
          <div className="space-y-1">
            {service.projects.map((p) => {
              const n = openByProject.get(p.id) || 0;
              if (editingProjectId === p.id) {
                return (
                  <div key={p.id} className="space-y-1 rounded-lg bg-violet-50 p-2">
                    <input
                      value={editProjectName}
                      onChange={(e) => setEditProjectName(e.target.value)}
                      className="w-full rounded border border-violet-200 px-2 py-1 text-sm"
                      autoFocus
                    />
                    <div className="flex gap-1">
                      <button
                        type="button"
                        disabled={savingProject}
                        onClick={renameProject}
                        className="flex-1 rounded bg-violet-700 px-2 py-1 text-[10px] font-semibold text-white"
                      >
                        Guardar
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingProjectId(null)}
                        className="rounded px-2 py-1 text-[10px] text-gray-600"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                );
              }
              return (
                <div key={p.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => setSelectedProjectId(p.id)}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm ${
                      selectedProjectId === p.id
                        ? 'bg-violet-100 font-medium text-violet-900'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span className="truncate">{p.name}</span>
                    {n > 0 && (
                      <span className="rounded-full bg-violet-700 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        {n}
                      </span>
                    )}
                  </button>
                  {isOperator && (
                    <div className="absolute right-1 top-1 hidden gap-0.5 group-hover:flex">
                      <button
                        type="button"
                        title="Renomear"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingProjectId(p.id);
                          setEditProjectName(p.name);
                        }}
                        className="rounded bg-white/90 px-1 text-[10px] text-violet-700 shadow"
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        title="Arquivar"
                        onClick={(e) => {
                          e.stopPropagation();
                          archiveProject(p.id);
                        }}
                        className="rounded bg-white/90 px-1 text-[10px] text-red-600 shadow"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            {service.projects.length === 0 && (
              <p className="px-1 text-xs text-amber-800">Cria o primeiro projeto.</p>
            )}
          </div>
          {isOperator && (
            <div className="space-y-2 border-t border-gray-100 pt-3">
              <input
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                placeholder="Novo projeto…"
              />
              <button
                type="button"
                disabled={savingProject || newProjectName.trim().length < 2}
                onClick={createProject}
                className="inline-flex w-full items-center justify-center gap-1 rounded-lg bg-violet-700 px-2 py-1.5 text-xs font-semibold text-white hover:bg-violet-800 disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" /> Projeto
              </button>
            </div>
          )}
        </aside>

        <div className="space-y-4">
          <section className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
            <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <Building2 className="h-3.5 w-3.5" /> Empresas
            </h2>
            {clients.length === 0 ? (
              <p className="text-sm text-amber-800">Adiciona empresas ao serviço.</p>
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
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm ${
                        active ? 'bg-violet-700 text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                      }`}
                    >
                      {m.company.shortName || m.company.name}
                      {n > 0 && (
                        <span
                          className={`rounded-full px-1.5 text-[10px] font-semibold ${
                            active ? 'bg-white/20 text-white' : 'bg-violet-200 text-violet-900'
                          }`}
                        >
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
                          className={`ml-0.5 text-xs ${active ? 'text-violet-200' : 'text-gray-400'} hover:underline`}
                          title="Remover"
                        >
                          ×
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
            {isOperator && availableToAdd.length > 0 && (
              <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-gray-100 pt-3">
                <select
                  value={addCompanyId}
                  onChange={(e) => setAddCompanyId(e.target.value)}
                  className="min-w-[10rem] flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                >
                  <option value="">+ empresa…</option>
                  {availableToAdd.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.shortName || c.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!addCompanyId || addingMember}
                  onClick={addMember}
                  className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-900 disabled:opacity-50"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Adicionar
                </button>
              </div>
            )}
          </section>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-950">
            <span>
              <strong>{selectedProject?.name || '—'}</strong>
              {' · '}
              <strong>{companyLabel(selectedCompanyId) || '—'}</strong>
            </span>
            <label className="flex items-center gap-1.5 text-xs text-violet-800">
              <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} />
              Mostrar concluídos
            </label>
          </div>

          <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900">Novo caso</h2>
            {!selectedProjectId || !selectedCompanyId ? (
              <p className="text-sm text-amber-800">Seleciona projeto e empresa.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                <select
                  value={caseKind}
                  onChange={(e) => setCaseKind(e.target.value as AtCaseKind)}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm sm:col-span-1"
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
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                >
                  <option value="LOW">Prioridade baixa</option>
                  <option value="MEDIUM">Média</option>
                  <option value="HIGH">Alta</option>
                  <option value="CRITICAL">Crítica</option>
                </select>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={assignToMe} onChange={(e) => setAssignToMe(e.target.checked)} />
                  Atribuir a mim
                </label>
                <textarea
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  rows={3}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm sm:col-span-2"
                  placeholder="O que fazer nesta empresa, neste projeto…"
                />
                <button
                  type="button"
                  disabled={savingCase || brief.trim().length < 8}
                  onClick={createCase}
                  className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-50 sm:col-span-2"
                >
                  {savingCase ? 'A abrir…' : 'Abrir caso'}
                </button>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-900">Fila ({filteredCases.length})</h2>
            {filteredCases.map((c) => (
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
            ))}
            {filteredCases.length === 0 && (
              <p className="text-sm text-gray-500">Sem casos nesta combinação projeto + empresa.</p>
            )}
          </section>
        </div>
      </div>

      {msg && <p className="text-sm text-gray-700">{msg}</p>}
    </div>
  );
}
