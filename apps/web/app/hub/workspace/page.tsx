'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
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
  ChevronDown,
  ChevronUp,
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

const PANEL =
  'rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]';
const PANEL_PAD = 'p-4 sm:p-5';
const INK = 'text-slate-700';
const INK_MUTED = 'text-slate-600';
const INK_SOFT = 'text-slate-500';
const CTA_PRIMARY =
  'inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-800';
const CTA_GHOST =
  'inline-flex items-center gap-1 text-sm font-medium text-teal-800 hover:underline';
const ROW =
  'flex items-start justify-between gap-2 rounded-lg border border-slate-200/80 bg-slate-50/50 px-2.5 py-2';

function truncate(s: string, n: number) {
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.length <= n) return t;
  return `${t.slice(0, n - 1)}…`;
}

function ModuleCard({
  title,
  icon,
  children,
  footer,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className={cn(PANEL, PANEL_PAD, 'flex flex-col')}>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-800">
        {icon}
        {title}
      </h2>
      <div className="min-h-0 flex-1 space-y-2">{children}</div>
      {footer ? <div className="mt-4 border-t border-slate-100 pt-3">{footer}</div> : null}
    </section>
  );
}

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
  const [notifsExpanded, setNotifsExpanded] = useState(false);

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
        <div className={cn(PANEL, 'overflow-hidden')}>
          <div className="border-b border-slate-100 bg-slate-50/80 px-5 py-4">
            <h2 className="text-lg font-semibold text-slate-900">
              {t('Antes de usar o centro integrado', 'Antes de usar el centro integrado', 'Before using the integrated workspace')}
            </h2>
            <p className={cn('mt-1 text-sm', INK)}>
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
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-800"
            >
              {t('Ir a Configuração — empresas', 'Ir a Configuración — empresas', 'Go to Settings — companies')}
            </Link>
            <Link
              href="/dashboard"
              className="flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              {t('Abrir o painel (ATLAS, etc.)', 'Abrir el panel (ATLAS, etc.)', 'Open dashboard (ATLAS, etc.)')}
            </Link>
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
              <Link href="/hub" className="text-sm font-medium text-teal-800 hover:underline">
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
        <div className={cn(PANEL, PANEL_PAD)}>
          <p className={cn('text-sm', INK)}>
            {t(
              'A carregar o contexto da empresa. Use o seletor com o ícone de edifício no cabeçalho, acima, se necessário.',
              'Cargando el contexto. Use el selector con el icono de edificio en la cabecera si hace falta.',
              'Loading company context. Use the building icon selector in the header if needed.'
            )}
          </p>
          <div className="mt-4 h-1 w-32 overflow-hidden rounded bg-slate-200">
            <div className="h-full w-1/2 animate-pulse bg-teal-600" />
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

  const companyLine = overview?.company?.name ?? null;
  const unreadNotifs = overview?.notifications.filter((n) => !n.read) ?? [];
  const atlasTasks = overview?.blocks.ATLAS?.tasksOpen ?? [];
  const advisorAlerts = overview?.advisor?.alerts ?? [];
  const notifVisible = notifsExpanded ? overview?.notifications ?? [] : (overview?.notifications ?? []).slice(0, 5);
  const notifHasMore = (overview?.notifications.length ?? 0) > 5;

  return (
    <div>
      <WorkspaceTopBar
        locale={locale}
        canManage={accessInfo?.canManage === true}
        active="main"
        showCompanyLine={companyLine}
      />

      <main className="mx-auto max-w-6xl space-y-8 p-4 sm:p-6">
        {overview && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className={INK_MUTED}>
              {t('Atualizado ', 'Actualizado ', 'Updated ')}
              <span className="font-medium text-slate-800">
                {overview.meta?.freshAt
                  ? new Date(overview.meta.freshAt).toLocaleString(
                      locale === 'pt' ? 'pt-PT' : locale === 'es' ? 'es' : 'en',
                      { dateStyle: 'short', timeStyle: 'short' }
                    )
                  : '—'}
              </span>
            </span>
            <button
              type="button"
              disabled={refreshing}
              onClick={() => void load({ silent: true })}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
              {t('Atualizar', 'Actualizar', 'Refresh')}
            </button>
          </div>
        )}

        {overview?.blocks && !err && (
          <section aria-label={t('Hoje', 'Hoy', 'Today')}>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-800">
                  {t('Prioridade', 'Prioridad', 'Priority')}
                </p>
                <h2 className="mt-0.5 flex items-center gap-2 text-lg font-semibold text-slate-900">
                  <ListTodo className="h-5 w-5 text-teal-700" />
                  {t('Hoje', 'Hoy', 'Today')}
                </h2>
              </div>
              {(overview.blocks.ATLAS?.invoicesOverdue ?? 0) +
                (overview.blocks.ATLAS?.productsLowStock ?? 0) +
                (overview.blocks.ATLAS?.purchaseOrdersInFlight ?? 0) +
                (overview.blocks.NEXUS?.pendingRoadmap ?? 0) >
                0 && (
                <div className="flex flex-wrap gap-1.5">
                  {overview.blocks.ATLAS && overview.blocks.ATLAS.invoicesOverdue > 0 && (
                    <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-950">
                      {overview.blocks.ATLAS.invoicesOverdue} {t('faturas', 'facturas', 'invoices')}
                    </span>
                  )}
                  {overview.blocks.ATLAS && overview.blocks.ATLAS.productsLowStock > 0 && (
                    <span className="rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-900">
                      {overview.blocks.ATLAS.productsLowStock} {t('stock', 'stock', 'stock')}
                    </span>
                  )}
                  {overview.blocks.ATLAS && overview.blocks.ATLAS.purchaseOrdersInFlight > 0 && (
                    <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-800">
                      {overview.blocks.ATLAS.purchaseOrdersInFlight} {t('encomendas', 'pedidos', 'POs')}
                    </span>
                  )}
                  {overview.blocks.NEXUS && overview.blocks.NEXUS.pendingRoadmap > 0 && (
                    <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-800">
                      {overview.blocks.NEXUS.pendingRoadmap} NEXUS
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className={cn(PANEL, 'overflow-hidden')}>
              <div className="grid divide-y divide-slate-100 lg:grid-cols-3 lg:divide-x lg:divide-y-0">
                {/* Advisor */}
                <div className="p-4 sm:p-5">
                  <p className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-800">
                    <BrainCircuit className="h-3.5 w-3.5 text-teal-700" />
                    Advisor
                  </p>
                  <ul className="space-y-1.5">
                    {advisorAlerts.length > 0 ? (
                      advisorAlerts.slice(0, 3).map((a) => (
                        <li key={a.id} className={ROW}>
                          <span className="min-w-0">
                            {a.link ? (
                              <Link href={a.link} className="line-clamp-1 text-sm font-medium text-slate-900 hover:text-teal-800">
                                {truncate(a.title, 72)}
                              </Link>
                            ) : (
                              <span className="line-clamp-1 text-sm font-medium text-slate-900">{truncate(a.title, 72)}</span>
                            )}
                            <span className={cn('mt-0.5 block line-clamp-1 text-xs', INK_MUTED)}>
                              {truncate(a.message, 90)}
                            </span>
                          </span>
                          <button
                            type="button"
                            disabled={advisorAlertBusy === a.id}
                            onClick={() => void markAiAlertRead(a.id)}
                            className="shrink-0 text-xs font-medium text-teal-800 hover:underline disabled:opacity-50"
                          >
                            {t('Lida', 'Leída', 'Read')}
                          </button>
                        </li>
                      ))
                    ) : (
                      <li className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-3 py-3 text-sm text-slate-600">
                        {t('Sem alertas.', 'Sin alertas.', 'No alerts.')}{' '}
                        <Link href="/hub/advisor" className="font-medium text-teal-800 hover:underline">
                          Advisor
                        </Link>
                      </li>
                    )}
                  </ul>
                </div>

                {/* Unread notifications — titles only */}
                <div className="p-4 sm:p-5">
                  <p className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-800">
                    <Bell className="h-3.5 w-3.5 text-slate-600" />
                    {t('Por ler', 'Sin leer', 'Unread')}
                    {unreadNotifs.length > 0 && (
                      <span className="ml-1 rounded-md bg-slate-200/80 px-1.5 py-0.5 text-[10px] font-bold text-slate-800">
                        {unreadNotifs.length}
                      </span>
                    )}
                  </p>
                  <ul className="space-y-1.5">
                    {unreadNotifs.length > 0 ? (
                      unreadNotifs.slice(0, 3).map((n) => (
                        <li key={n.id} className={ROW}>
                          <span className="min-w-0">
                            {n.link ? (
                              <Link href={n.link} className="line-clamp-2 text-sm font-medium text-slate-900 hover:text-teal-800">
                                {truncate(n.title, 80)}
                              </Link>
                            ) : (
                              <span className="line-clamp-2 text-sm font-medium text-slate-900">{truncate(n.title, 80)}</span>
                            )}
                          </span>
                          <button
                            type="button"
                            disabled={notifBusy === n.id}
                            onClick={() => void markNotifRead(n.id)}
                            className="shrink-0 text-xs font-medium text-teal-800 hover:underline disabled:opacity-50"
                          >
                            {t('Lida', 'Leída', 'Read')}
                          </button>
                        </li>
                      ))
                    ) : (
                      <li className={cn('rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-3 py-3 text-sm', INK_MUTED)}>
                        {t('Nada por ler.', 'Nada sin leer.', 'Nothing unread.')}
                      </li>
                    )}
                    {unreadNotifs.length > 3 && (
                      <li className={cn('pt-1 text-xs font-medium', INK_MUTED)}>
                        +{unreadNotifs.length - 3}{' '}
                        {t('mais abaixo', 'más abajo', 'more below')}
                      </li>
                    )}
                  </ul>
                </div>

                {/* Open tasks — compact */}
                <div className="p-4 sm:p-5">
                  <p className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-800">
                    <CheckCircle2 className="h-3.5 w-3.5 text-slate-600" />
                    {t('Tarefas ATLAS', 'Tareas ATLAS', 'ATLAS tasks')}
                  </p>
                  <ul className="space-y-1.5">
                    {atlasTasks.length > 0 ? (
                      atlasTasks.slice(0, 4).map((task) => (
                        <li key={task.id} className={ROW}>
                          <div className="min-w-0">
                            <span className="line-clamp-1 text-sm font-medium text-slate-900">
                              {truncate(task.title, 64)}
                            </span>
                            {task.dueDate && (
                              <span className={cn('mt-0.5 block text-xs', INK_MUTED)}>
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
                            className="shrink-0 text-teal-700 hover:text-teal-900 disabled:opacity-50"
                            title={t('Concluir', 'Completar', 'Done')}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </button>
                        </li>
                      ))
                    ) : (
                      <li className={cn('rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-3 py-3 text-sm', INK_MUTED)}>
                        {t('Sem tarefas abertas.', 'Sin tareas abiertas.', 'No open tasks.')}
                      </li>
                    )}
                  </ul>
                </div>
              </div>

              {overview.blocks.SIEP && (overview.blocks.SIEP.siepDeadlines?.length ?? 0) > 0 && (
                <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-3 sm:px-5">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-800">
                    {t('Prazos SIEP', 'Plazos SIEP', 'SIEP deadlines')}
                  </p>
                  <ul className="flex flex-wrap gap-2">
                    {overview.blocks.SIEP.siepDeadlines!.slice(0, 4).map((d) => (
                      <li key={d.id}>
                        <Link
                          href={d.href}
                          className={cn(
                            'inline-flex max-w-[16rem] items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-medium',
                            d.overdue
                              ? 'border-red-200 bg-red-50 text-red-900'
                              : 'border-slate-200 bg-white text-slate-800'
                          )}
                        >
                          <span className="truncate">{d.name}</span>
                          <span className={cn('shrink-0', INK_SOFT)}>
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
            </div>
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
              <p className={cn('text-sm', INK)}>
                <Link href="/hub/workspace/team" className="font-medium text-teal-800 underline">
                  {t('Abrir configuração de acessos (Equipa)', 'Abrir accesos (Equipo)', 'Open team access settings')}
                </Link>
              </p>
            )}
          </div>
        )}

        {overview?.blocks && (
          <>
            <section>
              <div className="mb-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-800">
                  {t('Sistemas', 'Sistemas', 'Systems')}
                </p>
                <h2 className="mt-0.5 text-lg font-semibold text-slate-900">
                  {t('Atalhos do centro', 'Atajos del centro', 'Workspace shortcuts')}
                </h2>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {overview.blocks.ATLAS && (
                  <ModuleCard
                    title="ATLAS"
                    icon={<BarChart3 className="h-4 w-4 text-teal-700" />}
                    footer={
                      <div className="flex flex-wrap items-center gap-3">
                        <Link href={overview.blocks.ATLAS.links.dashboard} className={CTA_PRIMARY}>
                          {t('Abrir ATLAS', 'Abrir ATLAS', 'Open ATLAS')} <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                        <Link href={overview.blocks.ATLAS.links.invoices} className={CTA_GHOST}>
                          {t('Faturas', 'Facturas', 'Invoices')}
                        </Link>
                        <Link href={overview.blocks.ATLAS.links.inventory} className={CTA_GHOST}>
                          {t('Inventário', 'Inventario', 'Inventory')}
                        </Link>
                      </div>
                    }
                  >
                    <p className="text-2xl font-semibold tracking-tight text-slate-900">
                      {overview.blocks.ATLAS.balance.toLocaleString(
                        locale === 'pt' ? 'pt-PT' : locale === 'es' ? 'es' : 'en',
                        { maximumFractionDigits: 0 }
                      )}{' '}
                      <span className="text-base font-medium text-slate-600">{overview.blocks.ATLAS.currency}</span>
                    </p>
                    <p className={cn('text-xs font-medium', INK_MUTED)}>
                      {t('Saldo', 'Saldo', 'Balance')}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs font-medium text-slate-700">
                      {overview.blocks.ATLAS.invoicesOverdue > 0 && (
                        <span className="text-amber-900">
                          {overview.blocks.ATLAS.invoicesOverdue}{' '}
                          {t('em atraso', 'vencidas', 'overdue')}
                        </span>
                      )}
                      {overview.blocks.ATLAS.purchaseOrdersInFlight > 0 && (
                        <Link href={overview.blocks.ATLAS.links.suppliers} className="inline-flex items-center gap-1 hover:underline">
                          <Package className="h-3.5 w-3.5 text-slate-500" />
                          {overview.blocks.ATLAS.purchaseOrdersInFlight}{' '}
                          {t('encomendas', 'pedidos', 'POs')}
                        </Link>
                      )}
                      {overview.blocks.ATLAS.productsLowStock > 0 && (
                        <Link href={overview.blocks.ATLAS.links.inventory} className="inline-flex items-center gap-1 text-rose-800 hover:underline">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          {overview.blocks.ATLAS.productsLowStock}{' '}
                          {t('stock baixo', 'stock bajo', 'low stock')}
                        </Link>
                      )}
                    </div>
                    {atlasTasks.length > 0 && (
                      <ul className="mt-3 space-y-1 border-t border-slate-100 pt-2">
                        {atlasTasks.slice(0, 3).map((task) => (
                          <li key={task.id} className="flex items-center justify-between gap-2 text-sm">
                            <span className="line-clamp-1 text-slate-800">{truncate(task.title, 56)}</span>
                            <button
                              type="button"
                              disabled={saving === task.id}
                              onClick={() => void markTaskDone(task.id)}
                              className="shrink-0 text-teal-700 hover:text-teal-900 disabled:opacity-50"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </button>
                          </li>
                        ))}
                        {atlasTasks.length > 3 && (
                          <li className={cn('text-xs font-medium', INK_MUTED)}>
                            +{atlasTasks.length - 3} {t('tarefas', 'tareas', 'tasks')}
                          </li>
                        )}
                      </ul>
                    )}
                  </ModuleCard>
                )}

                {overview.blocks.SIEP && (
                  <ModuleCard
                    title="SIEP"
                    icon={<Sprout className="h-4 w-4 text-teal-700" />}
                    footer={
                      <Link href={overview.blocks.SIEP.link} className={CTA_PRIMARY}>
                        {t('Abrir SIEP', 'Abrir SIEP', 'Open SIEP')} <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    }
                  >
                    <ul className="space-y-2">
                      {overview.blocks.SIEP.projects.length === 0 && (
                        <li className={cn('text-sm', INK_MUTED)}>—</li>
                      )}
                      {overview.blocks.SIEP.projects.slice(0, 4).map((p) => (
                        <li key={p.id} className="text-sm">
                          <Link href={p.href} className="font-medium text-slate-900 hover:text-teal-800 hover:underline">
                            {truncate(p.name, 48)}
                          </Link>
                          <span className={cn('mt-0.5 block text-xs', INK_MUTED)}>
                            {p.status} · {p.progress}%
                          </span>
                        </li>
                      ))}
                    </ul>
                  </ModuleCard>
                )}

                {overview.blocks.FUNDHUB && (
                  <ModuleCard
                    title="FundHub"
                    icon={<HandCoins className="h-4 w-4 text-teal-700" />}
                    footer={
                      <div className="flex flex-wrap items-center gap-3">
                        <Link href={overview.blocks.FUNDHUB.link} className={CTA_PRIMARY}>
                          FundHub <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                        <Link href={overview.blocks.FUNDHUB.proposalsList} className={CTA_GHOST}>
                          {t('Propostas', 'Propuestas', 'Proposals')}
                        </Link>
                      </div>
                    }
                  >
                    {overview.blocks.FUNDHUB.discovery && (
                      <div className="mb-2 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-900">
                            <ScanSearch className="h-4 w-4 text-slate-600" />
                            {t('Descoberta', 'Descubrimiento', 'Discovery')}
                          </span>
                          <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                            {overview.blocks.FUNDHUB.discovery.status}
                          </span>
                        </div>
                        <p className={cn('mt-1 text-xs', INK_MUTED)}>
                          {overview.blocks.FUNDHUB.discovery.scanned} URLs · +
                          {overview.blocks.FUNDHUB.discovery.created}{' '}
                          {t('novos', 'nuevos', 'new')}
                        </p>
                      </div>
                    )}
                    <ul className="space-y-1.5">
                      {overview.blocks.FUNDHUB.proposals.length === 0 && (
                        <li className={cn('text-sm', INK_MUTED)}>—</li>
                      )}
                      {overview.blocks.FUNDHUB.proposals.slice(0, 3).map((p) => (
                        <li key={p.id} className="flex items-baseline justify-between gap-2 text-sm">
                          <Link href={p.editorHref} className="line-clamp-1 font-medium text-slate-900 hover:text-teal-800 hover:underline">
                            {truncate(p.title, 40)}
                          </Link>
                          <span className={cn('shrink-0 text-xs', INK_MUTED)}>{p.status}</span>
                        </li>
                      ))}
                    </ul>
                  </ModuleCard>
                )}

                {overview.blocks.NEXUS && (
                  <ModuleCard
                    title="NEXUS"
                    icon={<GraduationCap className="h-4 w-4 text-teal-700" />}
                    footer={
                      <div className="flex flex-wrap items-center gap-3">
                        <Link href={overview.blocks.NEXUS.link} className={CTA_PRIMARY}>
                          {t('Abrir NEXUS', 'Abrir NEXUS', 'Open NEXUS')} <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                        <Link href={overview.blocks.NEXUS.networksLink} className={CTA_GHOST}>
                          {t('Redes', 'Redes', 'Networks')}
                        </Link>
                        <Link href={overview.blocks.NEXUS.roadmapLink} className={CTA_GHOST}>
                          {t('Roteiro', 'Ruta', 'Roadmap')}
                        </Link>
                      </div>
                    }
                  >
                    <p className={cn('text-sm', INK)}>
                      <span className="font-semibold text-slate-900">{overview.blocks.NEXUS.networkCount}</span>{' '}
                      {t('rede(s)', 'red(es)', 'network(s)')}
                      <span className="mx-1.5 text-slate-300">·</span>
                      <span className="font-semibold text-slate-900">{overview.blocks.NEXUS.pendingRoadmap}</span>{' '}
                      {t('ações pendentes', 'acciones pendientes', 'pending actions')}
                    </p>
                  </ModuleCard>
                )}

                {overview.blocks.FORGE && (
                  <ModuleCard
                    title="FORGE"
                    icon={<Cpu className="h-4 w-4 text-teal-700" />}
                    footer={
                      <Link href={overview.blocks.FORGE.link} className={CTA_PRIMARY}>
                        {t('Abrir FORGE', 'Abrir FORGE', 'Open FORGE')} <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    }
                  >
                    <p className={cn('text-sm', INK)}>
                      {t(
                        'Cursos, aprendizagem e atalhos para a jornada.',
                        'Cursos, aprendizaje y atajos para el recorrido.',
                        'Courses, learning, and shortcuts for the journey.'
                      )}
                    </p>
                  </ModuleCard>
                )}

                {overview.blocks.PRISM && (
                  <ModuleCard
                    title="PRISM"
                    icon={<Target className="h-4 w-4 text-teal-700" />}
                    footer={
                      <Link href={overview.blocks.PRISM.link} className={CTA_PRIMARY}>
                        {t('Abrir PRISM', 'Abrir PRISM', 'Open PRISM')} <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    }
                  >
                    <p className={cn('text-sm', INK)}>
                      {t(
                        'Impacto, evidência e relatórios.',
                        'Impacto, evidencia e informes.',
                        'Impact, evidence, and reporting.'
                      )}
                    </p>
                  </ModuleCard>
                )}
              </div>
            </section>

            {overview.notifications.length > 0 && (
              <section className={cn(PANEL, PANEL_PAD)}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-800">
                      {t('Actividade', 'Actividad', 'Activity')}
                    </p>
                    <h2 className="mt-0.5 flex items-center gap-2 text-base font-semibold text-slate-900">
                      <Bell className="h-4 w-4 text-slate-600" />
                      {t('Notificações', 'Notificaciones', 'Notifications')}
                    </h2>
                  </div>
                  {overview.notifications.some((n) => !n.read) && (
                    <button
                      type="button"
                      disabled={notifBusy === 'all'}
                      onClick={() => void markAllNotifsRead()}
                      className="text-xs font-semibold text-teal-800 hover:underline disabled:opacity-50"
                    >
                      {t('Marcar todas como lidas', 'Marcar todas como leídas', 'Mark all as read')}
                    </button>
                  )}
                </div>
                <ul className="divide-y divide-slate-100">
                  {notifVisible.map((n) => (
                    <li
                      key={n.id}
                      className={cn(
                        'flex items-start justify-between gap-3 py-2.5 text-sm',
                        !n.read ? 'text-slate-900' : INK
                      )}
                    >
                      <div className="min-w-0">
                        {n.link ? (
                          n.link.startsWith('http') ? (
                            <a
                              href={n.link}
                              className="hover:text-teal-800"
                              target="_blank"
                              rel="noreferrer"
                              onClick={() => n.read === false && void markNotifRead(n.id)}
                            >
                              <span className={cn('font-medium', !n.read && 'text-slate-900')}>
                                {truncate(n.title, 72)}
                              </span>
                              <span className={cn('mt-0.5 block line-clamp-1 text-xs', INK_MUTED)}>
                                {truncate(n.message, 100)}
                              </span>
                            </a>
                          ) : (
                            <Link
                              href={n.link}
                              className="hover:text-teal-800"
                              onClick={() => n.read === false && void markNotifRead(n.id)}
                            >
                              <span className={cn('font-medium', !n.read && 'text-slate-900')}>
                                {truncate(n.title, 72)}
                              </span>
                              <span className={cn('mt-0.5 block line-clamp-1 text-xs', INK_MUTED)}>
                                {truncate(n.message, 100)}
                              </span>
                            </Link>
                          )
                        ) : (
                          <span>
                            <span className="font-medium">{truncate(n.title, 72)}</span>
                            <span className={cn('mt-0.5 block line-clamp-1 text-xs', INK_MUTED)}>
                              {truncate(n.message, 100)}
                            </span>
                          </span>
                        )}
                      </div>
                      {n.read === false && (
                        <button
                          type="button"
                          disabled={notifBusy === n.id}
                          onClick={() => void markNotifRead(n.id)}
                          className="shrink-0 text-xs font-medium text-teal-800 hover:underline disabled:opacity-50"
                        >
                          {t('Lida', 'Leída', 'Read')}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
                {notifHasMore && (
                  <button
                    type="button"
                    onClick={() => setNotifsExpanded((v) => !v)}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-teal-800 hover:underline"
                  >
                    {notifsExpanded ? (
                      <>
                        <ChevronUp className="h-3.5 w-3.5" />
                        {t('Mostrar menos', 'Mostrar menos', 'Show less')}
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3.5 w-3.5" />
                        {t(
                          `Ver todas (${overview.notifications.length})`,
                          `Ver todas (${overview.notifications.length})`,
                          `Show all (${overview.notifications.length})`
                        )}
                      </>
                    )}
                  </button>
                )}
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
