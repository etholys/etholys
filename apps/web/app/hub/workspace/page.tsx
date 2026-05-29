'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/app/providers';
import { WorkspaceTopBar } from '@/components/workspace/WorkspaceTopBar';
import { useHubWorkspaceRoute } from '@/components/hub/HubWorkspaceShell';
import {
  BarChart3,
  Sprout,
  HandCoins,
  GraduationCap,
  Bell,
  CheckCircle2,
  ExternalLink,
  Cpu,
  Target,
  Package,
  AlertTriangle,
  RefreshCw,
  ScanSearch,
  ListTodo,
  BrainCircuit,
} from 'lucide-react';
import { cn, isLikelyDbId } from '@/lib/utils';
import { StateError, StateLoading } from '@/components/ui/StateBlocks';

type OverviewPayload = {
  meta?: { freshAt: string };
  company?: { name: string; shortName: string; currency: string };
  access: { systems: string[] };
  blocks: {
    ATLAS: {
      balance: number;
      currency: string;
      incomeTotal: number;
      expenseTotal: number;
      tasksOpen: Array<{
        id: string;
        title: string;
        status: string;
        dueDate: string | null;
        projectId: string | null;
        project: { id: string; name: string } | null;
      }>;
      invoicesOverdue: number;
      purchaseOrdersInFlight: number;
      productsLowStock: number;
      links: { dashboard: string; invoices: string; inventory: string; suppliers: string };
    } | null;
    SIEP: {
      projects: Array<{ id: string; name: string; status: string; progress: number; href: string }>;
      siepDeadlines?: Array<{ id: string; name: string; endDate: string; href: string; overdue: boolean }>;
      link: string;
    } | null;
    FUNDHUB: {
      proposals: Array<{ id: string; title: string; status: string; editorHref: string }>;
      link: string;
      proposalsList: string;
      discovery: {
        id: string;
        status: string;
        startedAt: string;
        finishedAt: string | null;
        scanned: number;
        created: number;
        updated: number;
        errorCount: number;
        link: string;
      } | null;
    } | null;
    NEXUS: {
      networkCount: number;
      pendingRoadmap: number;
      link: string;
      networksLink: string;
      roadmapLink: string;
    } | null;
    FORGE: { link: string } | null;
    PRISM: { link: string } | null;
  };
  notifications: Array<{
    id: string;
    title: string;
    message: string;
    read: boolean;
    createdAt: string;
    link?: string | null;
    type?: string;
  }>;
  advisor?: {
    alerts: Array<{
      id: string;
      type: string;
      severity: string;
      title: string;
      message: string;
      read: boolean;
      link: string | null;
      createdAt: string;
    }>;
  };
};

type AccessInfo = { canManage: boolean; me: { systems: unknown; enabled: boolean } | null };

export default function IntegratedWorkspacePage() {
  const { activeCompanyId, locale } = useApp();
  const { companiesReady, hasCompanies, companiesLoadError, reloadCompanies } = useHubWorkspaceRoute();
  const companyId = useMemo(() => {
    const s = String(activeCompanyId ?? '').trim();
    return isLikelyDbId(s) ? s : '';
  }, [activeCompanyId]);
  const [accessInfo, setAccessInfo] = useState<AccessInfo | null>(null);
  const [overview, setOverview] = useState<OverviewPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [notifBusy, setNotifBusy] = useState<string | null>(null);
  const [advisorAlertBusy, setAdvisorAlertBusy] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const t = (pt: string, es: string, en: string) =>
    locale === 'pt' ? pt : locale === 'es' ? es : en;

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!companyId) {
      setLoading(false);
      setErr(
        activeCompanyId
          ? 'ID de empresa inválido no contexto. Escolha de novo a empresa no menu (ou limpe o localStorage se persistir).'
          : 'Selecione uma empresa no seletor do Hub.'
      );
      return;
    }
    const silent = Boolean(opts?.silent);
    if (silent) setRefreshing(true);
    else setLoading(true);
    setErr(null);
    try {
      const [accessRes, overviewRes] = await Promise.all([
        fetch(`/api/workspace/access?companyId=${encodeURIComponent(companyId)}`),
        fetch(`/api/workspace/overview?companyId=${encodeURIComponent(companyId)}`),
      ]);
      const parse = async (r: Response) => {
        const text = await r.text();
        try {
          return text ? (JSON.parse(text) as Record<string, unknown>) : {};
        } catch {
          return { error: r.status >= 500 ? 'Servidor (500). Verifique se as migrações Prisma estão aplicadas.' : r.statusText };
        }
      };
      const a = (await parse(accessRes)) as { canManage?: boolean; me?: AccessInfo['me']; error?: string };
      const o = (await parse(overviewRes)) as Record<string, unknown> & { error?: string; code?: string; blocks?: unknown };
      if (accessRes.ok) {
        setAccessInfo({ canManage: a.canManage === true, me: a.me ?? null });
      } else {
        setAccessInfo(null);
        setOverview(null);
        setErr(String(a.error || `Acesso: ${accessRes.status}`));
        return;
      }

      if (overviewRes.status === 403 && o.code === 'WORKSPACE_FORBIDDEN') {
        setOverview(null);
        const forAdmin =
          locale === 'pt'
            ? 'Ainda ninguém tem acesso configurado, ou o seu utilizador não está na lista. Use a secção «Equipa».'
            : locale === 'es'
              ? 'Aún no hay accesos configurados, o su usuario no está en la lista. Use «Equipo».'
              : 'No workspace access is configured yet, or your user is not on the list. Use Team to fix this.';
        const forUser =
          locale === 'pt'
            ? 'O administrador da empresa ainda não lhe atribuiu acesso a este centro integrado.'
            : locale === 'es'
              ? 'El administrador de la empresa aún no le ha asignado acceso a este centro.'
              : 'Your company admin has not assigned integrated workspace access yet.';
        setErr(a.canManage ? forAdmin : forUser);
        return;
      }

      if (!overviewRes.ok) {
        setOverview(null);
        setErr(
          String(
            o.error || `Resposta ${overviewRes.status} (overview). Tente de novo.`
          )
        );
        return;
      }

      const validBlocks = o.blocks && typeof o.blocks === 'object' && o.blocks !== null;
      if (!validBlocks) {
        setOverview(null);
        setErr('Resposta do servidor inválida (falta blocos). Reveja a consola de rede e migrações.');
        return;
      }

      setOverview(o as unknown as OverviewPayload);
      setErr(null);
    } catch {
      setErr('Erro ao carregar.');
    } finally {
      if (silent) setRefreshing(false);
      else setLoading(false);
    }
  }, [companyId, locale, activeCompanyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const markTaskDone = async (taskId: string) => {
    setSaving(taskId);
    try {
      const r = await fetch(
        `/api/workspace/quick/task/${taskId}?companyId=${encodeURIComponent(companyId)}`,
        { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'DONE' }) }
      );
      if (!r.ok) throw new Error();
      await load();
    } catch {
      setErr(t('Não foi possível atualizar a tarefa.', 'No se pudo actualizar la tarea.', 'Could not update the task.'));
    } finally {
      setSaving(null);
    }
  };

  const markNotifRead = async (id: string) => {
    setNotifBusy(id);
    try {
      const r = await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (r.ok) await load();
    } finally {
      setNotifBusy(null);
    }
  };

  const markAllNotifsRead = async () => {
    setNotifBusy('all');
    try {
      const r = await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllRead: true }),
      });
      if (r.ok) await load();
    } finally {
      setNotifBusy(null);
    }
  };

  const markAiAlertRead = async (alertId: string) => {
    if (!companyId) return;
    setAdvisorAlertBusy(alertId);
    try {
      const r = await fetch('/api/ai/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: alertId, action: 'read', companyId }),
      });
      if (r.ok) await load();
    } finally {
      setAdvisorAlertBusy(null);
    }
  };

  if (!companiesReady) {
    return (
      <div className="min-h-[45vh] px-4">
        <StateLoading className="h-full" />
      </div>
    );
  }

  if (companiesLoadError) {
    return (
      <div className="mx-auto max-w-lg p-6 sm:p-10">
        <StateError
          title={t('Erro ao carregar empresas', 'Error al cargar empresas', 'Could not load companies')}
          message={companiesLoadError}
          onRetry={() => reloadCompanies()}
          retryLabel={t('Tentar de novo', 'Reintentar', 'Retry')}
        />
        <div className="mt-3">
          <Link href="/settings" className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-800 hover:bg-slate-50">
            {t('Configuração (empresas)', 'Configuración (empresas)', 'Settings (companies)')}
          </Link>
        </div>
      </div>
    );
  }

  if (!hasCompanies) {
    return (
      <div className="mx-auto max-w-2xl p-6 sm:p-10">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-gradient-to-r from-teal-50/80 to-slate-50 px-5 py-4">
            <h2 className="text-lg font-semibold text-slate-900">
              {t('Antes de usar o centro integrado', 'Antes de usar el centro integrado', 'Before using the integrated workspace')}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {t(
                'Precisa de uma empresa (organização) na sua conta. Crie a primeira em Configuração ou peça a um admin para o adicionar à equipa.',
                'Necesita una empresa (organización) en su cuenta. Créela en Configuración o pida a un administrador que le invite.',
                'You need a company (organization) on your account. Create one in Settings, or ask an admin to add you to their team.'
              )}
            </p>
          </div>
          <div className="space-y-3 p-5">
            <Link
              href="/settings"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-teal-700"
            >
              {t('Ir a Configuração — empresas', 'Ir a Configuración — empresas', 'Go to Settings — companies')}
            </Link>
            <Link
              href="/dashboard"
              className="flex w-full items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 hover:bg-slate-100"
            >
              {t('Abrir o painel (ATLAS, etc.)', 'Abrir el panel (ATLAS, etc.)', 'Open dashboard (ATLAS, etc.)')}
            </Link>
            <p className="text-center text-xs text-slate-500">
              {t(
                'O Hub não mostra menu lateral aqui: o seletor de empresa fica no topo, quando houver empresas.',
                'El Hub no muestra menú lateral aquí: el selector de empresa arriba, cuando existan empresas.',
                "The Hub doesn't use a side menu on this page; the company selector will appear in the header once you have companies."
              )}
            </p>
            <p className="text-center text-xs text-amber-800">
              {t(
                'O FundHub e o painel usam a mesma lista (/api/companies). Se aí vê as empresas e aqui não, clique em recarregar.',
                'El FundHub y el panel usan la misma API. Si allí ve empresas y aquí no, use recargar.',
                'FundHub and the workspace use the same /api/companies. If you see companies there but not here, use reload.'
              )}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={() => void reloadCompanies()}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
              >
                {t('Recarregar empresas', 'Recargar empresas', 'Reload company list')}
              </button>
            </div>
            <div className="pt-1 text-center">
              <Link href="/hub" className="text-sm text-teal-700 hover:underline">
                ← Hub
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!companyId) {
    return (
      <div className="mx-auto max-w-lg p-6 sm:p-10">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-700">
            {t(
              'A carregar o contexto da empresa. Use o seletor com o ícone de edifício no cabeçalho, acima, se necessário.',
              'Cargando el contexto. Use el selector con el icono de edificio en la cabecera si hace falta.',
              'Loading company context. Use the building icon selector in the header if needed.'
            )}
          </p>
          <div className="mt-4 h-1 w-32 overflow-hidden rounded bg-slate-200">
            <div className="h-full w-1/2 animate-pulse bg-teal-500" />
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div>
        <WorkspaceTopBar locale={locale} canManage={accessInfo?.canManage === true} active="main" />
        <div className="min-h-[40vh] px-4">
          <StateLoading />
        </div>
      </div>
    );
  }

  const companyLine =
    overview?.company && overview?.access
      ? `${overview.company.name} · ${overview.access.systems.join(' · ')}`
      : null;

  return (
    <div>
      <WorkspaceTopBar
        locale={locale}
        canManage={accessInfo?.canManage === true}
        active="main"
        showCompanyLine={companyLine}
      />

      <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
        {overview && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
            <span>
              {t('Dados: ', 'Datos: ', 'Data: ')}
              {overview.meta?.freshAt
                ? new Date(overview.meta.freshAt).toLocaleString(
                    locale === 'pt' ? 'pt-PT' : locale === 'es' ? 'es' : 'en',
                    { dateStyle: 'short', timeStyle: 'short' }
                  )
                : '—'}
            </span>
            <button
              type="button"
              disabled={refreshing}
              onClick={() => void load({ silent: true })}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-800 hover:bg-slate-100 disabled:opacity-50"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
              {t('Atualizar', 'Actualizar', 'Refresh')}
            </button>
          </div>
        )}
        {overview?.blocks && !err && (
          <section
            className="rounded-2xl border-2 border-teal-200/90 bg-gradient-to-br from-teal-50/90 via-white to-slate-50/80 p-4 shadow-sm sm:p-5"
            aria-label={t('Hoje', 'Hoy', 'Today')}
          >
            <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                  <ListTodo className="h-5 w-5 text-teal-600" />
                  {t('Hoje', 'Hoy', 'Today')}
                </h2>
                <p className="mt-0.5 text-xs text-slate-600">
                  {t(
                    'Concentração operacional: alertas, tarefas e prazos. O impacto e relatórios a financiadores estão no PRISM.',
                    'Concentración operativa: alertas, tareas y plazos. El impacto e informes a financiadores están en PRISM.',
                    'Operational focus: alerts, tasks, and deadlines. Impact and donor reports live under PRISM.'
                  )}
                </p>
              </div>
            </div>
            <div className="mb-4 flex flex-wrap gap-2">
              {overview.blocks.ATLAS && overview.blocks.ATLAS.invoicesOverdue > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-950">
                  {overview.blocks.ATLAS.invoicesOverdue} {t('faturas atraso', 'facturas atraso', 'invoices overdue')}
                </span>
              )}
              {overview.blocks.ATLAS && overview.blocks.ATLAS.productsLowStock > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-medium text-rose-900">
                  {overview.blocks.ATLAS.productsLowStock} {t('stock baixo', 'stock bajo', 'low stock')}
                </span>
              )}
              {overview.blocks.ATLAS && overview.blocks.ATLAS.purchaseOrdersInFlight > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-800">
                  {overview.blocks.ATLAS.purchaseOrdersInFlight} {t('encomendas abertas', 'pedidos abiertos', 'POs in flight')}
                </span>
              )}
              {overview.blocks.NEXUS && overview.blocks.NEXUS.pendingRoadmap > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-1 text-xs font-medium text-violet-900">
                  {overview.blocks.NEXUS.pendingRoadmap} {t('acções NEXUS', 'acciones NEXUS', 'NEXUS actions')}
                </span>
              )}
            </div>
            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-violet-700">
                  {t('Etholys Advisor (inbox)', 'Etholys Advisor (inbox)', 'Etholys Advisor (inbox)')}
                </p>
                <ul className="min-h-[3rem] space-y-1.5 text-sm text-slate-800">
                  {(overview.advisor?.alerts ?? []).length > 0 ? (
                    (overview.advisor?.alerts ?? []).slice(0, 4).map((a) => (
                      <li
                        key={a.id}
                        className={cn(
                          'flex items-start justify-between gap-2 rounded-lg border bg-white/80 px-2 py-1.5',
                          a.severity === 'critical' && 'border-red-200',
                          a.severity === 'warning' && 'border-amber-200',
                          a.severity === 'info' && 'border-violet-100',
                          !['critical', 'warning', 'info'].includes(a.severity) && 'border-slate-100'
                        )}
                      >
                        <span className="min-w-0">
                          <span className="inline-flex items-center gap-1 font-medium text-slate-900">
                            <BrainCircuit className="h-3.5 w-3.5 shrink-0 text-violet-600" />
                            {a.link ? (
                              <Link href={a.link} className="text-violet-800 hover:underline">
                                {a.title}
                              </Link>
                            ) : (
                              a.title
                            )}
                          </span>
                          <span className="block text-[11px] leading-snug text-slate-600">{a.message}</span>
                        </span>
                        <button
                          type="button"
                          disabled={advisorAlertBusy === a.id}
                          onClick={() => void markAiAlertRead(a.id)}
                          className="shrink-0 text-[11px] text-violet-600 hover:underline disabled:opacity-50"
                        >
                          {t('Lida', 'Leída', 'Read')}
                        </button>
                      </li>
                    ))
                  ) : (
                    <li className="rounded-lg border border-dashed border-violet-200/80 bg-violet-50/30 px-2 py-2 text-xs text-slate-600">
                      {t(
                        'Sem alertas do Advisor. Use «Analisar» no botão roxo (canto) ou o painel completo.',
                        'Sin alertas del Advisor. Use Analizar en el botón violeta o el panel.',
                        'No Advisor alerts. Use Analyze on the purple floating button, or the full panel.'
                      )}{' '}
                      <Link href="/hub/advisor" className="font-medium text-violet-700 hover:underline">
                        /hub/advisor
                      </Link>
                    </li>
                  )}
                </ul>
              </div>
              {overview.notifications.filter((n) => !n.read).length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t('Notificações por ler', 'Notificaciones sin leer', 'Unread notifications')}
                  </p>
                  <ul className="space-y-1.5 text-sm text-slate-800">
                    {overview.notifications
                      .filter((n) => !n.read)
                      .slice(0, 4)
                      .map((n) => (
                        <li key={n.id} className="flex items-start justify-between gap-2 rounded-lg border border-slate-100 bg-white/80 px-2 py-1.5">
                          <span className="min-w-0">
                            {n.link ? (
                              <Link href={n.link} className="font-medium text-teal-800 hover:underline">
                                {n.title}
                              </Link>
                            ) : (
                              <span className="font-medium">{n.title}</span>
                            )}
                            <span className="text-slate-600">: {n.message}</span>
                          </span>
                          <button
                            type="button"
                            disabled={notifBusy === n.id}
                            onClick={() => void markNotifRead(n.id)}
                            className="shrink-0 text-xs text-teal-600 hover:underline disabled:opacity-50"
                          >
                            {t('Lida', 'Leída', 'Read')}
                          </button>
                        </li>
                      ))}
                  </ul>
                </div>
              )}
              {overview.blocks.ATLAS && overview.blocks.ATLAS.tasksOpen.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t('Tarefas abertas (ATLAS)', 'Tareas abiertas (ATLAS)', 'Open tasks (ATLAS)')}
                  </p>
                  <ul className="space-y-1.5 text-sm">
                    {overview.blocks.ATLAS.tasksOpen.slice(0, 5).map((task) => (
                      <li
                        key={task.id}
                        className="flex items-start justify-between gap-2 rounded-lg border border-slate-100 bg-white/80 px-2 py-1.5 text-slate-800"
                      >
                        <div className="min-w-0">
                          <span className="font-medium">{task.title}</span>
                          {task.dueDate && (
                            <span className="ml-1 text-xs text-slate-500">
                              ·{' '}
                              {new Date(task.dueDate).toLocaleDateString(
                                locale === 'pt' ? 'pt-PT' : locale === 'es' ? 'es' : 'en',
                                { dateStyle: 'short' }
                              )}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          disabled={saving === task.id}
                          onClick={() => void markTaskDone(task.id)}
                          className="shrink-0 text-teal-600 hover:text-teal-800 disabled:opacity-50"
                          title={t('Concluir', 'Completar', 'Done')}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            {overview.blocks.SIEP && (overview.blocks.SIEP.siepDeadlines?.length ?? 0) > 0 && (
              <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-indigo-800">
                  {t('Prazos de projecto (SIEP)', 'Plazos de proyecto (SIEP)', 'Project deadlines (SIEP)')}
                </p>
                <ul className="flex flex-wrap gap-2 text-sm">
                  {overview.blocks.SIEP.siepDeadlines!.map((d) => (
                    <li key={d.id}>
                      <Link
                        href={d.href}
                        className={cn(
                          'inline-flex max-w-full items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-medium transition hover:opacity-90',
                          d.overdue
                            ? 'border-red-200 bg-red-50 text-red-900'
                            : 'border-indigo-200 bg-white text-indigo-950'
                        )}
                      >
                        <span className="truncate">{d.name}</span>
                        <span className="shrink-0 text-[10px] opacity-80">
                          {d.overdue ? ' · ' + t('atraso', 'atraso', 'overdue') : ''}{' '}
                          {new Date(d.endDate).toLocaleDateString(
                            locale === 'pt' ? 'pt-PT' : locale === 'es' ? 'es' : 'en',
                            { dateStyle: 'short' }
                          )}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(() => {
              const unread = overview.notifications.filter((n) => !n.read).length;
              const taskN = overview.blocks.ATLAS?.tasksOpen.length ?? 0;
              const advN = overview.advisor?.alerts?.length ?? 0;
              const siepD = overview.blocks.SIEP?.siepDeadlines?.length ?? 0;
              const pills =
                (overview.blocks.ATLAS?.invoicesOverdue ?? 0) > 0 ||
                (overview.blocks.ATLAS?.productsLowStock ?? 0) > 0 ||
                (overview.blocks.ATLAS?.purchaseOrdersInFlight ?? 0) > 0 ||
                (overview.blocks.NEXUS?.pendingRoadmap ?? 0) > 0;
              if (pills || unread > 0 || taskN > 0 || advN > 0 || siepD > 0) return null;
              return (
                <p className="mt-2 text-sm text-slate-500">
                  {t(
                    'Sem itens urgentes na fila. Use «Atualizar» ou abra os módulos abaixo.',
                    'Sin elementos urgentes. Use «Actualizar» o abra los módulos.',
                    'Nothing urgent in queue. Use Refresh or open the modules below.'
                  )}
                </p>
              );
            })()}
          </section>
        )}

        {err && (
          <div className="space-y-2">
            <StateError
              tone="amber"
              message={err}
              onRetry={() => void load({ silent: false })}
              retryLabel={t('Tentar de novo', 'Reintentar', 'Retry')}
            />
            {accessInfo?.canManage && (
              <p className="text-sm text-slate-600">
                <Link href="/hub/workspace/team" className="font-medium text-teal-800 underline">
                  {t('Abrir configuração de acessos (Equipa)', 'Abrir accesos (Equipo)', 'Open team access settings')}
                </Link>
              </p>
            )}
          </div>
        )}

        {overview?.blocks && (
          <div className="grid gap-4 lg:grid-cols-2">
            {overview.blocks.ATLAS && (
              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="mb-2 flex items-center gap-2 font-semibold text-slate-900">
                  <BarChart3 className="h-5 w-5 text-teal-600" /> ATLAS
                </h2>
                <p className="text-2xl font-bold text-slate-800">
                  {overview.blocks.ATLAS.balance.toFixed(0)} {overview.blocks.ATLAS.currency}
                </p>
                <p className="text-xs text-slate-500">
                  {t(
                    'Saldo (receitas − despesas) · mesmos dados do painel',
                    'Saldo (ingresos − gastos) · mismos datos que el panel',
                    'Balance (income − expense) — same as dashboard'
                  )}
                </p>
                {overview.blocks.ATLAS.invoicesOverdue > 0 && (
                  <p className="mt-2 text-sm text-amber-800">
                    {overview.blocks.ATLAS.invoicesOverdue}{' '}
                    {t('faturas em atraso', 'facturas vencidas', 'invoices overdue')}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-600">
                  {overview.blocks.ATLAS.purchaseOrdersInFlight > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <Package className="h-3.5 w-3.5 text-slate-500" />
                      <Link href={overview.blocks.ATLAS.links.suppliers} className="font-medium text-teal-800 hover:underline">
                        {overview.blocks.ATLAS.purchaseOrdersInFlight}{' '}
                        {t('encomendas por receber', 'pedidos por recibir', 'purchase orders in flight')}
                      </Link>
                    </span>
                  )}
                  {overview.blocks.ATLAS.productsLowStock > 0 && (
                    <span className="inline-flex items-center gap-1 text-rose-800">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      <Link href={overview.blocks.ATLAS.links.inventory} className="font-medium hover:underline">
                        {overview.blocks.ATLAS.productsLowStock}{' '}
                        {t('produtos abaixo do mínimo', 'productos bajo mínimo', 'products below min. stock')}
                      </Link>
                    </span>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={overview.blocks.ATLAS.links.dashboard}
                    className="inline-flex items-center gap-1 rounded-md bg-teal-600 px-3 py-1.5 text-sm text-white hover:bg-teal-700"
                  >
                    {t('Abrir ATLAS', 'Abrir ATLAS', 'Open ATLAS')} <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                  <Link href={overview.blocks.ATLAS.links.invoices} className="text-sm text-teal-700 hover:underline">
                    {t('Faturas', 'Facturas', 'Invoices')}
                  </Link>
                  <Link href={overview.blocks.ATLAS.links.inventory} className="text-sm text-teal-700 hover:underline">
                    {t('Inventário', 'Inventario', 'Inventory')}
                  </Link>
                </div>
                <ul className="mt-3 space-y-1 border-t border-slate-100 pt-2">
                  {overview.blocks.ATLAS.tasksOpen.length === 0 && (
                    <li className="text-sm text-slate-500">
                      {t('Sem tarefas abertas.', 'Sin tareas abiertas.', 'No open tasks.')}
                    </li>
                  )}
                  {overview.blocks.ATLAS.tasksOpen.map((task) => (
                    <li key={task.id} className="flex items-start justify-between gap-2 text-sm">
                      <div className="min-w-0 flex-1">
                        <span className="text-slate-800">{task.title}</span>
                        {task.project && (
                          <div>
                            <Link
                              href={`/siep/projects/${task.project.id}`}
                              className="text-xs text-indigo-700 hover:underline"
                            >
                              SIEP · {task.project.name}
                            </Link>
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={saving === task.id}
                        onClick={() => void markTaskDone(task.id)}
                        className="flex-shrink-0 text-teal-600 hover:text-teal-800 disabled:opacity-50"
                        title="ATLAS"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {overview.blocks.SIEP && (
              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="mb-2 flex items-center gap-2 font-semibold text-slate-900">
                  <Sprout className="h-5 w-5 text-indigo-600" /> SIEP
                </h2>
                <ul className="space-y-1 text-sm text-slate-700">
                  {overview.blocks.SIEP.projects.length === 0 && (
                    <li className="text-slate-500">—</li>
                  )}
                  {overview.blocks.SIEP.projects.map((p) => (
                    <li key={p.id}>
                      <Link href={p.href} className="font-medium text-indigo-800 hover:underline">
                        {p.name}
                      </Link>{' '}
                      <span className="text-slate-500">
                        · {p.status} · {p.progress}%
                      </span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={overview.blocks.SIEP.link}
                  className="mt-3 inline-flex items-center gap-1 text-sm text-indigo-700 hover:underline"
                >
                  {t('Abrir SIEP', 'Abrir SIEP', 'Open SIEP')} <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </section>
            )}

            {overview.blocks.FUNDHUB && (
              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="mb-2 flex items-center gap-2 font-semibold text-slate-900">
                  <HandCoins className="h-5 w-5 text-amber-600" /> FundHub
                </h2>
                {overview.blocks.FUNDHUB.discovery && (
                  <div className="mb-3 flex flex-col gap-2 rounded-lg border border-amber-100 bg-amber-50/90 p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 font-medium text-amber-950">
                        <ScanSearch className="h-4 w-4 text-amber-700" />
                        {t('Descoberta de fundos', 'Descubrimiento de fondos', 'Fund discovery')}
                      </span>
                      <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium uppercase text-amber-900">
                        {overview.blocks.FUNDHUB.discovery.status}
                      </span>
                    </div>
                    <p className="text-xs text-amber-950/85">
                      {t('Início: ', 'Inicio: ', 'Started: ')}
                      {new Date(overview.blocks.FUNDHUB.discovery.startedAt).toLocaleString(
                        locale === 'pt' ? 'pt-PT' : locale === 'es' ? 'es' : 'en',
                        { dateStyle: 'short', timeStyle: 'short' }
                      )}
                    </p>
                    <p className="text-xs text-amber-900/80">
                      {overview.blocks.FUNDHUB.discovery.scanned} {t('URLs analisadas', 'URLs analizadas', 'URLs scanned')} · +
                      {overview.blocks.FUNDHUB.discovery.created} {t('novos', 'nuevos', 'new')} · ~
                      {overview.blocks.FUNDHUB.discovery.updated} {t('atualizados', 'actualizados', 'updated')}
                      {overview.blocks.FUNDHUB.discovery.errorCount > 0 &&
                        ` · ${overview.blocks.FUNDHUB.discovery.errorCount} ${t('erros', 'errores', 'errors')}`}
                    </p>
                    <Link
                      href={overview.blocks.FUNDHUB.discovery.link}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-amber-900 hover:underline"
                    >
                      {t('Ver estado completo', 'Ver estado completo', 'View full status')}{' '}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                )}
                <ul className="space-y-1.5 text-sm">
                  {overview.blocks.FUNDHUB.proposals.length === 0 && <li className="text-slate-500">—</li>}
                  {overview.blocks.FUNDHUB.proposals.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-2">
                      <span>
                        <Link href={p.editorHref} className="font-medium text-amber-900 hover:underline">
                          {p.title}
                        </Link>{' '}
                        <span className="text-slate-500">({p.status})</span>
                      </span>
                      <Link href={p.editorHref} className="shrink-0 text-xs text-amber-700 hover:underline">
                        {t('Editor', 'Editor', 'Editor')}
                      </Link>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={overview.blocks.FUNDHUB.proposalsList}
                    className="inline-flex items-center gap-1 text-sm text-amber-800 hover:underline"
                  >
                    {t('Todas as propostas', 'Todas las propuestas', 'All proposals')} <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                  <span className="text-slate-300">|</span>
                  <Link href={overview.blocks.FUNDHUB.link} className="text-sm text-amber-800 hover:underline">
                    FundHub
                  </Link>
                </div>
              </section>
            )}

            {overview.blocks.NEXUS && (
              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="mb-2 flex items-center gap-2 font-semibold text-slate-900">
                  <GraduationCap className="h-5 w-5 text-violet-600" /> NEXUS
                </h2>
                <p className="text-sm text-slate-700">
                  {overview.blocks.NEXUS.networkCount}{' '}
                  {t('rede(s)', 'red(es)', 'network(s)')}
                  {': '}
                  {overview.blocks.NEXUS.pendingRoadmap}{' '}
                  {t(
                    'ações de rota pendentes (agregado)',
                    'acciones de ruta pendientes (agregado)',
                    'roadmap actions pending (aggregate)'
                  )}
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-sm">
                  <Link href={overview.blocks.NEXUS.link} className="inline-flex items-center gap-1 text-violet-800 hover:underline">
                    {t('NEXUS início', 'NEXUS inicio', 'NEXUS home')} <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                  <span className="text-slate-300">|</span>
                  <Link href={overview.blocks.NEXUS.networksLink} className="text-violet-700 hover:underline">
                    {t('Redes', 'Redes', 'Networks')}
                  </Link>
                  <span className="text-slate-300">|</span>
                  <Link href={overview.blocks.NEXUS.roadmapLink} className="text-violet-700 hover:underline">
                    {t('Roteiro', 'Ruta', 'Roadmap')}
                  </Link>
                </div>
              </section>
            )}

            {overview.blocks.FORGE && (
              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="mb-2 flex items-center gap-2 font-semibold text-slate-900">
                  <Cpu className="h-5 w-5 text-violet-600" /> FORGE
                </h2>
                <p className="text-sm text-slate-600">
                  {t(
                    'Inovação e prototipagem: entrada dedicada com atalhos para Lab, calculadora (ATLAS) e jornada (NEXUS).',
                    'Innovación y prototipado: entrada con atajos a Lab, calculadora (ATLAS) y jornada (NEXUS).',
                    'Innovation & prototyping: dedicated entry with shortcuts to Lab, calculator (ATLAS), and journey (NEXUS).'
                  )}
                </p>
                <Link
                  href={overview.blocks.FORGE.link}
                  className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-violet-800 hover:underline"
                >
                  {t('Abrir FORGE', 'Abrir FORGE', 'Open FORGE')}{' '}
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </section>
            )}

            {overview.blocks.PRISM && (
              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="mb-2 flex items-center gap-2 font-semibold text-slate-900">
                  <Target className="h-5 w-5 text-rose-600" /> PRISM
                </h2>
                <p className="text-sm text-slate-600">
                  {t(
                    'Impacto, evidência e relatórios (M&E) — não confundir com o bloco «Hoje» acima.',
                    'Impacto, evidencia e informes (M&E) — no confundir con «Hoy» arriba.',
                    'Impact, evidence & reporting (M&E) — not the same as the «Today» block above.'
                  )}
                </p>
                <Link
                  href={overview.blocks.PRISM.link}
                  className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-rose-800 hover:underline"
                >
                  {t('Abrir PRISM', 'Abrir PRISM', 'Open PRISM')} <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </section>
            )}

            {overview.notifications.length > 0 && (
              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="flex items-center gap-2 font-semibold text-slate-900">
                    <Bell className="h-5 w-5 text-slate-600" />{' '}
                    {t('Notificações', 'Notificaciones', 'Notifications')}
                  </h2>
                  {overview.notifications.some((n) => !n.read) && (
                    <button
                      type="button"
                      disabled={notifBusy === 'all'}
                      onClick={() => void markAllNotifsRead()}
                      className="text-xs font-medium text-teal-700 hover:underline disabled:opacity-50"
                    >
                      {t('Marcar todas como lidas', 'Marcar todas como leídas', 'Mark all as read')}
                    </button>
                  )}
                </div>
                <ul className="divide-y divide-slate-100">
                  {overview.notifications.map((n) => (
                    <li
                      key={n.id}
                      className={cn('flex flex-wrap items-start justify-between gap-2 py-2 text-sm', !n.read && 'font-medium text-slate-900')}
                    >
                      <div className="min-w-0">
                        {n.link ? (
                          n.link.startsWith('http') ? (
                            <a
                              href={n.link}
                              className="hover:underline"
                              target="_blank"
                              rel="noreferrer"
                              onClick={() => n.read === false && void markNotifRead(n.id)}
                            >
                              {n.title}: {n.message}
                            </a>
                          ) : (
                            <Link
                              href={n.link}
                              className="hover:underline"
                              onClick={() => n.read === false && void markNotifRead(n.id)}
                            >
                              {n.title}: {n.message}
                            </Link>
                          )
                        ) : (
                          <span>
                            {n.title}: {n.message}
                          </span>
                        )}
                      </div>
                      {n.read === false && (
                        <button
                          type="button"
                          disabled={notifBusy === n.id}
                          onClick={() => void markNotifRead(n.id)}
                          className="shrink-0 text-xs text-slate-500 hover:text-slate-800 disabled:opacity-50"
                        >
                          {t('Lida', 'Leída', 'Read')}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
