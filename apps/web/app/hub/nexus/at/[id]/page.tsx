'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { ArrowLeft, FileSpreadsheet, Plus, Search, X } from 'lucide-react';
import { useApp } from '@/app/providers';
import { NexusAtCaseCard, type AtCaseCardModel } from '@/components/nexus/NexusAtCaseCard';
import { NexusAtSectorPlaybook, sectorBadgeLabel } from '@/components/nexus/NexusAtSectorPlaybook';
import { NexusAtClientDossier } from '@/components/nexus/NexusAtClientDossier';
import { NexusAtBulkImport } from '@/components/nexus/NexusAtBulkImport';
import { NexusAtProcessRail } from '@/components/nexus/NexusAtProcessRail';
import { NexusSectorMultiSelect } from '@/components/nexus/NexusSectorMultiSelect';
import { loadDiagnosisHistory } from '@/lib/nexus-diagnosis-history';
import { AT_CASE_KIND_LABELS, AT_DELIVERY_MODEL_LABELS, type AtCaseKind, type AtDeliveryModel } from '@/lib/nexus-at-shared';
import {
  buildAtBriefTemplate,
  buildSectorCaseChecklist,
  clearAtCaseDraft,
  loadAtCaseDraft,
} from '@/lib/nexus-at-sector-playbook';
import { hasDeepSectorMatrix } from '@/lib/nexus-sector-matrices';

type Company = { id: string; name: string; shortName: string };
type Member = {
  id: string;
  companyId: string;
  memberRole: string;
  sectorId?: string | null;
  sectorIds?: string[] | null;
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
  deliveryModel?: string | null;
  operatorCompany: { id: string; name: string; shortName: string };
  sponsorCompany?: { id: string; name: string; shortName: string } | null;
  siepProject?: { id: string; name: string; code?: string | null } | null;
  primarySectorId?: string | null;
  members: Member[];
  projects: AtProject[];
};

export default function NexusAtServicePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = typeof params.id === 'string' ? params.id : '';
  const { locale } = useApp();
  const es = locale === 'es';
  const loc = (es ? 'es' : locale === 'pt' ? 'pt' : 'en') as 'es' | 'pt' | 'en';

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
  const [checklistPreview, setChecklistPreview] = useState<string[]>([]);

  const [addQuery, setAddQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Company[]>([]);
  const [addingMember, setAddingMember] = useState(false);
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [addSectorIds, setAddSectorIds] = useState<string[]>([]);
  const [addMemberRole, setAddMemberRole] = useState<'client' | 'principal' | 'affiliate'>('client');
  const [clientFilter, setClientFilter] = useState('');
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [bulkSectorIds, setBulkSectorIds] = useState<string[]>([]);
  const [draftSectorIds, setDraftSectorIds] = useState<string[]>([]);
  const [savingBulkSector, setSavingBulkSector] = useState(false);

  const [sectorCatalog, setSectorCatalog] = useState<
    Array<{ id: string; label: { es: string; pt: string; en: string } }>
  >([]);
  const [savingSectorFor, setSavingSectorFor] = useState<string | null>(null);

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
      const clients = eng.members.filter((m) =>
        ['client', 'principal', 'affiliate'].includes(m.memberRole)
      );
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
    if (searchParams.get('import') === '1') setShowBulkImport(true);
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/nexus/at/sectors');
        const d = await r.json();
        if (!cancelled && r.ok) setSectorCatalog(d.sectors || []);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
    () =>
      (service?.members || []).filter((m) =>
        ['client', 'principal', 'affiliate'].includes(m.memberRole)
      ),
    [service]
  );

  const memberSectorIds = (m: Member | null | undefined): string[] => {
    if (!m) return [];
    if (m.sectorIds && m.sectorIds.length > 0) return m.sectorIds;
    return m.sectorId ? [m.sectorId] : [];
  };

  const sectorChipsLabel = (ids: string[]) => {
    if (ids.length === 0) return null;
    return ids
      .map((sid) => sectorBadgeLabel(sid, loc))
      .filter(Boolean)
      .join(' · ');
  };

  const filteredClients = useMemo(() => {
    const q = clientFilter.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((m) => {
      const name = (m.company.name || '').toLowerCase();
      const short = (m.company.shortName || '').toLowerCase();
      const sector = (sectorChipsLabel(memberSectorIds(m)) || '').toLowerCase();
      return name.includes(q) || short.includes(q) || sector.includes(q);
    });
  }, [clients, clientFilter, loc]);

  const selectedMember = useMemo(
    () => clients.find((m) => m.companyId === selectedCompanyId) || null,
    [clients, selectedCompanyId]
  );

  const selectedSectorIds = memberSectorIds(selectedMember);
  const selectedSectorId = selectedSectorIds[0] || service?.primarySectorId || null;

  useEffect(() => {
    setDraftSectorIds(selectedSectorIds);
  }, [selectedCompanyId, selectedSectorIds.join('|')]);

  const diagnosisHref = selectedCompanyId
    ? `/hub/nexus/diagnosis?company=${encodeURIComponent(selectedCompanyId)}&engagement=${encodeURIComponent(id)}`
    : null;
  const continuePlanHref = diagnosisHref ? `${diagnosisHref}&resume=plan` : null;

  const isCollective = service?.deliveryModel === 'COLLECTIVE';

  const [hasLocalDx, setHasLocalDx] = useState(false);
  const [hasLocalPlanDraft, setHasLocalPlanDraft] = useState(false);
  useEffect(() => {
    if (!selectedCompanyId) {
      setHasLocalDx(false);
      setHasLocalPlanDraft(false);
      return;
    }
    const hist = loadDiagnosisHistory({ companyId: selectedCompanyId });
    let dx = hist.length > 0;
    let plan = false;
    try {
      const key = `nexus-sector-dx-v6:${selectedCompanyId}:${id}:`;
      const raw = localStorage.getItem(key);
      if (raw) {
        const draft = JSON.parse(raw) as { phase?: string; analyze?: unknown };
        plan =
          Boolean(draft.analyze) || draft.phase === 'map' || draft.phase === 'workplan' || draft.phase === 'summary';
      }
    } catch {
      plan = false;
    }
    setHasLocalDx(dx);
    setHasLocalPlanDraft(plan);

    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch(
          `/api/nexus/incubation/run?companyId=${encodeURIComponent(selectedCompanyId)}&engagementId=${encodeURIComponent(id)}`,
          { cache: 'no-store' },
        );
        const d = (await r.json()) as {
          run?: { diagnosis?: unknown; committedAt?: string | null };
          progress?: { tasksTotal?: number };
        };
        if (cancelled || !r.ok || !d.run) return;
        if (d.run.diagnosis) setHasLocalDx(true);
        if (d.run.committedAt || (d.progress?.tasksTotal || 0) > 0) setHasLocalPlanDraft(true);
      } catch {
        /* o rascunho local já ficou aplicado */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedCompanyId, id, cases.length]);

  useEffect(() => {
    if (!isCollective) {
      setAddMemberRole('client');
      return;
    }
    const hasPrincipal = (service?.members || []).some((m) => m.memberRole === 'principal');
    setAddMemberRole(hasPrincipal ? 'affiliate' : 'principal');
  }, [isCollective, service?.members]);

  useEffect(() => {
    if (!loading && isOperator && clients.length === 0) setShowBulkImport(true);
  }, [loading, isOperator, clients.length]);

  useEffect(() => {
    const allowed = new Set(clients.map((m) => m.companyId));
    setCheckedIds((prev) => {
      const next = prev.filter((cid) => allowed.has(cid));
      return next.length === prev.length ? prev : next;
    });
  }, [clients]);

  const playbookSectorId = useMemo(() => {
    if (!service) return null;
    const selected = clients.find((m) => m.companyId === selectedCompanyId);
    const ids = selected
      ? selected.sectorIds && selected.sectorIds.length > 0
        ? selected.sectorIds
        : selected.sectorId
          ? [selected.sectorId]
          : []
      : [];
    return ids[0] || service.primarySectorId || null;
  }, [service, clients, selectedCompanyId]);

  const updateClientSectors = async (companyId: string, sectorIds: string[]) => {
    setSavingSectorFor(companyId);
    setError(null);
    try {
      const r = await fetch(`/api/nexus/at/client-companies/${encodeURIComponent(companyId)}/sector`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectorIds }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Error');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setSavingSectorFor(null);
    }
  };

  const updateBulkSectors = async (sectorIds: string[], companyIds: string[]) => {
    const ids = [...new Set(companyIds.filter(Boolean))];
    if (sectorIds.length === 0 || ids.length === 0) return;
    setSavingBulkSector(true);
    setError(null);
    try {
      const r = await fetch('/api/nexus/at/client-companies/sectors', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ engagementId: id, companyIds: ids, sectorIds }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Error');
      setBulkSectorIds([]);
      setCheckedIds([]);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setSavingBulkSector(false);
    }
  };

  const toggleChecked = (companyId: string) => {
    setCheckedIds((prev) =>
      prev.includes(companyId) ? prev.filter((x) => x !== companyId) : [...prev, companyId]
    );
  };

  const allFilteredChecked =
    filteredClients.length > 0 && filteredClients.every((m) => checkedIds.includes(m.companyId));

  const toggleCheckAllFiltered = () => {
    if (allFilteredChecked) {
      const drop = new Set(filteredClients.map((m) => m.companyId));
      setCheckedIds((prev) => prev.filter((cid) => !drop.has(cid)));
    } else {
      setCheckedIds((prev) => [
        ...new Set([...prev, ...filteredClients.map((m) => m.companyId)]),
      ]);
    }
  };

  const sectorOptions = useMemo(
    () => sectorCatalog.map((s) => ({ id: s.id, label: s.label[loc] })),
    [sectorCatalog, loc]
  );

  const bulkMode = checkedIds.length > 0;

  const presentIds = useMemo(() => new Set((service?.members || []).map((m) => m.companyId)), [service]);

  const companyLabel = useCallback(
    (companyId: string | null | undefined) => {
      if (!companyId) return null;
      const m = service?.members.find((x) => x.companyId === companyId);
      if (!m) return companyId;
      const full = m.company.name?.trim();
      const short = m.company.shortName?.trim();
      if (full && short && full.toLowerCase() !== short.toLowerCase()) return `${full} (${short})`;
      return full || short || companyId;
    },
    [service]
  );

  const applyBriefTemplate = useCallback(
    (kind: AtCaseKind, focusAreaIndex?: number) => {
      const name = companyLabel(selectedCompanyId) || undefined;
      const nextBrief = buildAtBriefTemplate(playbookSectorId, kind, loc, {
        companyName: name,
        focusAreaIndex,
      });
      setBrief(nextBrief);
      setChecklistPreview(buildSectorCaseChecklist(playbookSectorId, kind, loc));
    },
    [playbookSectorId, loc, selectedCompanyId, companyLabel]
  );

  const suggestCaseKind = (kind: AtCaseKind) => {
    setCaseKind(kind);
    applyBriefTemplate(kind);
    setShowNewCase(true);
  };

  const suggestFocusArea = (focusIndex: number, kind: AtCaseKind) => {
    setCaseKind(kind);
    applyBriefTemplate(kind, focusIndex);
    setShowNewCase(true);
  };

  useEffect(() => {
    if (!selectedCompanyId) return;
    const draft = loadAtCaseDraft(selectedCompanyId);
    if (!draft) return;
    setCaseKind(draft.caseKind);
    setBrief(draft.brief);
    setChecklistPreview(draft.checklistItems || buildSectorCaseChecklist(playbookSectorId, draft.caseKind, loc));
    setShowNewCase(true);
    clearAtCaseDraft();
  }, [selectedCompanyId, playbookSectorId, loc]);

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
          checklistItems: checklistPreview,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Error');
      setBrief('');
      setDueDate('');
      setChecklistPreview([]);
      setShowNewCase(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setSavingCase(false);
    }
  };

  const addMemberById = async (companyId: string) => {
    if (addSectorIds.length === 0) {
      setError(es ? 'Elige al menos una temática del emprendimiento.' : 'Escolhe pelo menos uma temática do empreendimento.');
      return;
    }
    setAddingMember(true);
    setError(null);
    try {
      const r = await fetch(`/api/nexus/at/engagements/${encodeURIComponent(id)}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          sectorIds: addSectorIds,
          memberRole: isCollective ? addMemberRole : 'client',
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Error');
      setAddQuery('');
      setShowAddCompany(false);
      setSelectedCompanyId(companyId);
      setAddSectorIds([]);
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
    if (addSectorIds.length === 0) {
      setError(es ? 'Elige al menos una temática del emprendimiento.' : 'Escolhe pelo menos uma temática do empreendimento.');
      return;
    }
    setAddingMember(true);
    setError(null);
    try {
      const r = await fetch(`/api/nexus/at/engagements/${encodeURIComponent(id)}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          sectorIds: addSectorIds,
          memberRole: isCollective ? addMemberRole : 'client',
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Error');
      setAddQuery('');
      setShowAddCompany(false);
      if (d.member?.companyId) setSelectedCompanyId(d.member.companyId);
      setAddSectorIds([]);
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
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-teal-400/25 border-t-teal-400" />
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
    <div className="mx-auto max-w-6xl space-y-4">
      <div>
        <Link href="/hub/nexus/at" className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" /> {es ? 'Contratos' : 'Contratos'}
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{service.title}</h1>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {service.deliveryModel && service.deliveryModel in AT_DELIVERY_MODEL_LABELS && (
                <span className="inline-block rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-800">
                  {AT_DELIVERY_MODEL_LABELS[service.deliveryModel as AtDeliveryModel][loc]}
                </span>
              )}
              {service.primarySectorId && (
                <span className="inline-block rounded-md bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-900">
                  {es ? 'Ámbito' : 'Âmbito'}: {sectorBadgeLabel(service.primarySectorId, loc)}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-500">
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
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <NexusAtProcessRail
        engagementId={id}
        clientCount={clients.length}
        selectedCompanyId={selectedCompanyId}
        sectorId={selectedSectorId}
        hasOpenCases={cases.some((c) => c.isOpen !== false && !['DONE', 'CANCELLED'].includes(c.status))}
        hasDiagnosisHint={hasLocalDx}
        es={es}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(240px,300px)_minmax(0,1fr)] lg:items-start">
        {/* Lista de MIPYMEs — coluna fixa com scroll */}
        <aside className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white lg:sticky lg:top-3 lg:max-h-[calc(100vh-5.5rem)]">
          <div className="shrink-0 space-y-2 border-b border-slate-100 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {es ? 'MIPYMEs' : 'MIPYMEs'} · {clients.length}
              </p>
              {isOperator && (
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setShowBulkImport((v) => !v);
                      setShowAddCompany(false);
                    }}
                    className="rounded-md p-1 text-teal-800 hover:bg-teal-50"
                    title={es ? 'Importar lista' : 'Importar lista'}
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddCompany((v) => !v);
                      setShowBulkImport(false);
                    }}
                    className="rounded-md p-1 text-slate-600 hover:bg-slate-100"
                    title={es ? 'Añadir empresa' : 'Adicionar empresa'}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
            {clients.length > 0 && (
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-2 h-3.5 w-3.5 text-slate-400" />
                <input
                  value={clientFilter}
                  onChange={(e) => setClientFilter(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 py-1.5 pl-7 pr-2 text-xs outline-none focus:border-slate-400"
                  placeholder={es ? 'Buscar nombre o temática…' : 'Buscar nome ou temática…'}
                />
              </div>
            )}
            {isOperator && clients.length > 0 && (
              <label className="flex items-center gap-2 text-[11px] text-slate-600">
                <input
                  type="checkbox"
                  checked={allFilteredChecked}
                  onChange={toggleCheckAllFiltered}
                  className="rounded border-slate-300"
                />
                {es
                  ? `Seleccionar visibles (${filteredClients.length})`
                  : `Selecionar visíveis (${filteredClients.length})`}
              </label>
            )}
          </div>

          {isOperator && showBulkImport && (
            <div className="shrink-0 border-b border-slate-100 p-3">
              <NexusAtBulkImport
                engagementId={id}
                es={es}
                defaultSectorId={service.primarySectorId}
                onDone={() => {
                  setShowBulkImport(false);
                  void load();
                }}
              />
            </div>
          )}

          {showAddCompany && isOperator && (
            <div className="shrink-0 space-y-2 border-b border-slate-100 bg-slate-50 p-3">
              <p className="text-[11px] font-medium text-slate-700">
                {es ? 'Temáticas (una o varias)' : 'Temáticas (uma ou várias)'}
              </p>
              <NexusSectorMultiSelect
                options={sectorOptions}
                value={addSectorIds}
                onChange={setAddSectorIds}
                placeholder={es ? 'Elegir temáticas…' : 'Escolher temáticas…'}
                emptyLabel={es ? 'Ninguna' : 'Nenhuma'}
              />
              {isCollective && (
                <select
                  value={addMemberRole}
                  onChange={(e) =>
                    setAddMemberRole(e.target.value as 'client' | 'principal' | 'affiliate')
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
                >
                  <option value="principal">{es ? 'Principal' : 'Principal'}</option>
                  <option value="affiliate">{es ? 'Filial' : 'Filha'}</option>
                  <option value="client">{es ? 'Miembro' : 'Membro'}</option>
                </select>
              )}
              <div className="relative">
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
                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-slate-400"
                  placeholder={es ? 'Nombre…' : 'Nome…'}
                />
                {addQuery.trim().length > 0 && (
                  <ul className="absolute z-20 mt-1 max-h-36 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                    {filteredSuggestions.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => addMemberById(c.id)}
                          className="w-full px-2 py-1.5 text-left text-xs hover:bg-slate-50"
                        >
                          {c.name}
                        </button>
                      </li>
                    ))}
                    {addQuery.trim().length >= 2 && (
                      <li>
                        <button
                          type="button"
                          onClick={addMemberByName}
                          className="w-full px-2 py-1.5 text-left text-xs font-medium text-emerald-800 hover:bg-slate-50"
                        >
                          + {es ? 'Crear' : 'Criar'} «{addQuery.trim()}»
                        </button>
                      </li>
                    )}
                  </ul>
                )}
              </div>
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {clients.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-slate-500">
                {es
                  ? 'Importa o añade MIPYMEs. La temática se elige por empresa.'
                  : 'Importa ou adiciona MIPYMEs. A temática escolhe-se por empresa.'}
              </p>
            ) : filteredClients.length === 0 ? (
              <p className="px-2 py-4 text-center text-xs text-slate-400">
                {es ? 'Sin coincidencias' : 'Sem resultados'}
              </p>
            ) : (
              <ul className="space-y-0.5">
                {filteredClients.map((m) => {
                  const n = openByCompany.get(m.companyId) || 0;
                  const active = selectedCompanyId === m.companyId;
                  const checked = checkedIds.includes(m.companyId);
                  const fullName = m.company.name?.trim() || m.company.shortName || m.companyId;
                  const sectorLbl = sectorChipsLabel(memberSectorIds(m));
                  return (
                    <li key={m.companyId}>
                      <div
                        className={`group flex w-full items-start gap-1.5 rounded-lg px-1.5 py-1.5 ${
                          active
                            ? 'bg-slate-900 text-white'
                            : checked
                              ? 'bg-teal-50 text-slate-800'
                              : 'text-slate-800 hover:bg-slate-100'
                        }`}
                      >
                        {isOperator && (
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleChecked(m.companyId)}
                            onClick={(e) => e.stopPropagation()}
                            className="mt-1.5 shrink-0 rounded border-slate-300"
                            title={es ? 'Seleccionar para temática en lote' : 'Selecionar para temática em lote'}
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => setSelectedCompanyId(m.companyId)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <span className="block truncate text-sm font-medium leading-snug">{fullName}</span>
                          <span
                            className={`mt-0.5 flex flex-wrap items-center gap-1 text-[10px] ${
                              active ? 'text-white/70' : 'text-slate-500'
                            }`}
                          >
                            {m.memberRole === 'principal' && (
                              <span className={active ? 'text-amber-200' : 'text-amber-800'}>
                                principal
                              </span>
                            )}
                            {m.memberRole === 'affiliate' && (
                              <span>{es ? 'filial' : 'filha'}</span>
                            )}
                            {sectorLbl ? (
                              <span>{sectorLbl}</span>
                            ) : (
                              <span className={active ? 'text-amber-200' : 'text-amber-700'}>
                                {es ? 'sin temática' : 'sem temática'}
                              </span>
                            )}
                            {n > 0 && <span>· {n}</span>}
                          </span>
                        </button>
                        {isOperator && (
                          <button
                            type="button"
                            title={es ? 'Quitar' : 'Remover'}
                            onClick={() => removeMember(m.companyId)}
                            className={`mt-0.5 shrink-0 rounded p-0.5 opacity-0 group-hover:opacity-100 ${
                              active ? 'hover:bg-white/15' : 'hover:bg-slate-200'
                            }`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {isOperator && checkedIds.length > 0 && (
            <div className="shrink-0 border-t border-teal-200 bg-teal-50/80 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-teal-950">
                  {es
                    ? `${checkedIds.length} seleccionada(s) — usa el selector de temáticas a la derecha`
                    : `${checkedIds.length} selecionada(s) — usa o seletor de temáticas à direita`}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setCheckedIds([]);
                    setBulkSectorIds([]);
                  }}
                  className="shrink-0 text-[11px] font-medium text-teal-800 underline"
                >
                  {es ? 'Limpiar' : 'Limpar'}
                </button>
              </div>
            </div>
          )}
        </aside>

        {/* Workspace da empresa selecionada */}
        <div className="min-w-0 space-y-4">
          {!selectedCompanyId || !selectedMember ? (
            <div className="rounded-xl border border-dashed border-slate-200 px-4 py-16 text-center text-sm text-slate-500">
              {es
                ? 'Selecciona una MIPYME a la izquierda para trabajar su temática y diagnóstico.'
                : 'Seleciona uma MIPYME à esquerda para trabalhar a temática e o diagnóstico.'}
            </div>
          ) : (
            <>
              <div className="sticky top-3 z-10 space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                      {es ? 'Empresa seleccionada' : 'Empresa selecionada'}
                    </p>
                    <h2 className="mt-0.5 truncate text-lg font-semibold text-slate-900">
                      {selectedMember.company.name}
                    </h2>
                    {selectedMember.company.shortName &&
                      selectedMember.company.shortName !== selectedMember.company.name && (
                        <p className="text-xs text-slate-500">{selectedMember.company.shortName}</p>
                      )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {hasLocalPlanDraft && continuePlanHref && (
                      <Link
                        href={continuePlanHref}
                        className="inline-flex items-center rounded-lg bg-teal-800 px-3.5 py-2 text-sm font-medium text-white hover:bg-teal-900"
                      >
                        {es ? 'Continuar plan' : 'Continuar plano'}
                      </Link>
                    )}
                    {diagnosisHref && (
                      <Link
                        href={diagnosisHref}
                        className={`inline-flex items-center rounded-lg px-3.5 py-2 text-sm font-medium ${
                          hasLocalPlanDraft
                            ? 'border border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                            : 'bg-teal-800 text-white hover:bg-teal-900'
                        }`}
                      >
                        {hasLocalDx || hasLocalPlanDraft
                          ? es
                            ? 'Reabrir diagnóstico'
                            : 'Reabrir diagnóstico'
                          : es
                            ? 'Iniciar diagnóstico'
                            : 'Iniciar diagnóstico'}
                      </Link>
                    )}
                    {isOperator && selectedProjectId && (
                      <button
                        type="button"
                        onClick={() => {
                          applyBriefTemplate(caseKind);
                          setShowNewCase(true);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
                      >
                        <Plus className="h-4 w-4" />
                        {es ? 'Nuevo caso' : 'Novo caso'}
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs font-medium text-slate-600">
                    {bulkMode
                      ? es
                        ? `Temáticas → ${checkedIds.length} seleccionadas`
                        : `Temáticas → ${checkedIds.length} selecionadas`
                      : es
                        ? 'Temáticas'
                        : 'Temáticas'}
                    <div className="mt-1">
                      <NexusSectorMultiSelect
                        options={sectorOptions}
                        value={bulkMode ? bulkSectorIds : draftSectorIds}
                        disabled={
                          !isOperator ||
                          savingBulkSector ||
                          savingSectorFor === selectedCompanyId
                        }
                        deferApply
                        applying={savingBulkSector || savingSectorFor === selectedCompanyId}
                        applyLabel={
                          bulkMode
                            ? es
                              ? `Aplicar a ${checkedIds.length}`
                              : `Aplicar a ${checkedIds.length}`
                            : es
                              ? 'Guardar'
                              : 'Guardar'
                        }
                        onChange={(next) => {
                          if (bulkMode) setBulkSectorIds(next);
                          else setDraftSectorIds(next);
                        }}
                        onApply={(ids) => {
                          if (bulkMode) void updateBulkSectors(ids, checkedIds);
                          else void updateClientSectors(selectedCompanyId, ids);
                        }}
                        placeholder={
                          bulkMode
                            ? es
                              ? 'Marcar temáticas y aplicar…'
                              : 'Marcar temáticas e aplicar…'
                            : es
                              ? 'Elegir temáticas…'
                              : 'Escolher temáticas…'
                        }
                        emptyLabel={es ? 'Ninguna' : 'Nenhuma'}
                      />
                    </div>
                    {bulkMode ? (
                      <span className="mt-1 block text-[11px] font-normal text-slate-500">
                        {es
                          ? 'Marca empresas a la izquierda; elige temáticas aquí y aplica.'
                          : 'Marca empresas à esquerda; escolhe temáticas aqui e aplica.'}
                      </span>
                    ) : selectedSectorIds.length > 1 ? (
                      <span className="mt-1 block text-[11px] font-normal text-slate-500">
                        {es
                          ? 'Primera temática = principal para el diagnóstico CMM.'
                          : 'Primeira temática = principal para o diagnóstico CMM.'}
                      </span>
                    ) : null}
                  </label>
                  <label className="block text-xs font-medium text-slate-600">
                    {es ? 'Proyecto / fase' : 'Projeto / fase'}
                    <select
                      value={selectedProjectId}
                      onChange={(e) => setSelectedProjectId(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
                    >
                      {service.projects.map((p) => {
                        const n = openByProject.get(p.id) || 0;
                        return (
                          <option key={p.id} value={p.id}>
                            {p.name}
                            {n > 0 ? ` (${n})` : ''}
                          </option>
                        );
                      })}
                    </select>
                  </label>
                </div>

                {isOperator && (
                  <div className="flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
                    <input
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') createProject();
                      }}
                      className="min-w-[12rem] flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-slate-400"
                      placeholder={es ? 'Nuevo proyecto…' : 'Novo projeto…'}
                    />
                    <button
                      type="button"
                      disabled={savingProject || newProjectName.trim().length < 2}
                      onClick={createProject}
                      className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                    >
                      {es ? 'Añadir' : 'Adicionar'}
                    </button>
                  </div>
                )}
              </div>

              <NexusAtClientDossier
                companyId={selectedCompanyId}
                companyName={companyLabel(selectedCompanyId) || '—'}
                sectorId={selectedSectorId}
                sectorIds={selectedSectorIds}
                locale={loc}
                es={es}
                engagementId={id}
                hideDiagnosisCta
              />

              {hasLocalDx ? (
                <NexusAtSectorPlaybook
                  sectorId={playbookSectorId}
                  locale={loc}
                  compact
                  onSuggestCaseKind={
                    isOperator && selectedProjectId && selectedCompanyId ? suggestCaseKind : undefined
                  }
                  onSuggestFocusArea={
                    isOperator && selectedProjectId && selectedCompanyId ? suggestFocusArea : undefined
                  }
                />
              ) : null}

              {showNewCase && (
                <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-900">
                      {es ? 'Nuevo caso' : 'Novo caso'}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowNewCase(false)}
                      className="text-slate-400 hover:text-slate-700"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <select
                      value={caseKind}
                      onChange={(e) => {
                        const kind = e.target.value as AtCaseKind;
                        setCaseKind(kind);
                        applyBriefTemplate(kind);
                      }}
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
                      <input
                        type="checkbox"
                        checked={assignToMe}
                        onChange={(e) => setAssignToMe(e.target.checked)}
                      />
                      {es ? 'Asignarme' : 'Atribuir a mim'}
                    </label>
                    <textarea
                      value={brief}
                      onChange={(e) => setBrief(e.target.value)}
                      rows={8}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs leading-relaxed sm:col-span-2"
                      placeholder={
                        es
                          ? 'Plano de intervenção… (use o quadro AT por sector)'
                          : 'Plano de intervenção… (use o quadro AT por setor)'
                      }
                    />
                    {checklistPreview.length > 0 && (
                      <div className="rounded-lg border border-teal-100 bg-teal-50/50 px-3 py-2 sm:col-span-2">
                        <p className="text-[11px] font-medium uppercase text-teal-900">
                          {es ? 'Checklist sectorial' : 'Checklist sectorial'}
                        </p>
                        <ul className="mt-1 space-y-0.5 text-xs text-teal-950">
                          {checklistPreview.map((line, i) => (
                            <li key={i}>· {line}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <button
                      type="button"
                      disabled={savingCase || brief.trim().length < 8}
                      onClick={createCase}
                      className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40 sm:col-span-2"
                    >
                      {savingCase
                        ? es
                          ? 'Guardando…'
                          : 'A guardar…'
                        : es
                          ? 'Abrir caso'
                          : 'Abrir caso'}
                    </button>
                  </div>
                </div>
              )}

              <section className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-slate-900">
                    {es ? 'Cola de casos' : 'Fila de casos'} · {filteredCases.length}
                  </h2>
                  <label className="flex items-center gap-1.5 text-xs text-slate-500">
                    <input
                      type="checkbox"
                      checked={showClosed}
                      onChange={(e) => setShowClosed(e.target.checked)}
                    />
                    {es ? 'Incluir cerrados' : 'Incluir concluídos'}
                  </label>
                </div>
                {filteredCases.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
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
                        setCases((prev) =>
                          prev.map((x) => (x.id === updated.id ? { ...x, ...updated } : x))
                        );
                      }}
                    />
                  ))
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
