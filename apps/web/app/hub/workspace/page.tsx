'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/app/providers';
import { WorkspaceTopBar } from '@/components/workspace/WorkspaceTopBar';
import { WorkspaceCockpit } from '@/components/workspace/WorkspaceCockpit';
import type { OverviewPayload } from '@/components/workspace/WorkspaceStagePanel';
import type { WorkspaceRailDef } from '@/lib/workspace-rails';
import { railOpenLabel } from '@/lib/workspace-rails';
import { useHubWorkspaceRoute } from '@/components/hub/HubWorkspaceShell';
import { adminHref } from '@/lib/admin-control';
import { cn, isLikelyDbId } from '@/lib/utils';
import { StateError, StateLoading } from '@/components/ui/StateBlocks';

type AccessInfo = { canManage: boolean; me: { systems: unknown; enabled: boolean } | null };

export default function IntegratedWorkspacePage() {
  const { activeCompanyId, locale } = useApp();
  const { companiesReady, hasCompanies, companiesLoadError, reloadCompanies, companies } =
    useHubWorkspaceRoute();
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
  const [focusRail, setFocusRail] = useState<WorkspaceRailDef | null>(null);

  const t = (pt: string, es: string, en: string) =>
    locale === 'pt' ? pt : locale === 'es' ? es : en;

  const companyLine = useMemo(() => {
    const c = companies.find((x) => x.id === companyId);
    return c ? c.name || c.shortName : null;
  }, [companies, companyId]);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!companyId) {
        setLoading(false);
        setErr(
          activeCompanyId
            ? t(
                'ID de empresa inválido. Escolha de novo a empresa no menu.',
                'ID de empresa inválido. Elija de nuevo la empresa en el menú.',
                'Invalid company ID. Pick the company again from the menu.',
              )
            : t(
                'Selecione uma empresa no seletor.',
                'Seleccione una empresa en el selector.',
                'Select a company from the picker.',
              )
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
            return {
              error:
                r.status >= 500
                  ? 'Servidor (500). Verifique se as migrações Prisma estão aplicadas.'
                  : r.statusText,
            };
          }
        };
        const a = (await parse(accessRes)) as {
          canManage?: boolean;
          me?: AccessInfo['me'];
          error?: string;
        };
        const o = (await parse(overviewRes)) as Record<string, unknown> & {
          error?: string;
          code?: string;
          blocks?: unknown;
        };
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
          setErr(
            a.canManage
              ? t(
                  'Ainda ninguém tem acesso configurado, ou o seu utilizador não está na lista. Use Administração → Permissões.',
                  'Aún no hay accesos configurados, o su usuario no está en la lista. Use Administración → Permisos.',
                  'No workspace access is configured yet, or your user is not on the list. Use Administration → Permissions.',
                )
              : t(
                  'O administrador da empresa ainda não lhe atribuiu acesso a este centro integrado.',
                  'El administrador de la empresa aún no le ha asignado acceso a este centro.',
                  'Your company admin has not assigned integrated workspace access yet.',
                )
          );
          return;
        }

        if (!overviewRes.ok) {
          setOverview(null);
          setErr(String(o.error || `Resposta ${overviewRes.status} (overview).`));
          return;
        }

        const validBlocks = o.blocks && typeof o.blocks === 'object' && o.blocks !== null;
        if (!validBlocks) {
          setOverview(null);
          setErr('Resposta do servidor inválida (falta blocos).');
          return;
        }

        setOverview(o as unknown as OverviewPayload);
        setErr(null);
      } catch {
        setErr(t('Erro ao carregar.', 'Error al cargar.', 'Failed to load.'));
      } finally {
        if (silent) setRefreshing(false);
        else setLoading(false);
      }
    },
    [companyId, locale, activeCompanyId]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const markTaskDone = async (taskId: string) => {
    setSaving(taskId);
    try {
      const r = await fetch(
        `/api/workspace/quick/task/${taskId}?companyId=${encodeURIComponent(companyId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'DONE' }),
        }
      );
      if (!r.ok) throw new Error();
      await load({ silent: true });
    } catch {
      setErr(
        t(
          'Não foi possível atualizar a tarefa.',
          'No se pudo actualizar la tarea.',
          'Could not update the task.',
        )
      );
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
      if (r.ok) await load({ silent: true });
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
      if (r.ok) await load({ silent: true });
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
      if (r.ok) await load({ silent: true });
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
      </div>
    );
  }

  if (!hasCompanies) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h2 className="font-[family-name:var(--font-etholys-display)] text-xl font-semibold text-[color:var(--sys-ink)]">
          {t('Antes de usar o centro integrado', 'Antes de usar el centro integrado', 'Before using the integrated workspace')}
        </h2>
        <p className="mt-3 text-sm text-[color:var(--sys-muted)]">
          {t(
            'Associe ou crie uma empresa no Hub / Administração.',
            'Asocie o cree una empresa en el Hub / Administración.',
            'Join or create a company in Hub / Administration.',
          )}
        </p>
        <Link
          href="/hub/admin?s=companies"
          className="mt-6 inline-flex rounded-lg border border-teal-400/30 bg-teal-500/15 px-4 py-2 text-sm font-medium text-teal-200"
        >
          {t('Ir à Administração', 'Ir a Administración', 'Go to Administration')}
        </Link>
      </div>
    );
  }

  const canManage = accessInfo?.canManage === true;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <WorkspaceTopBar
        locale={locale}
        canManage={canManage}
        showCompanyLine={companyLine}
        onRefresh={() => void load({ silent: true })}
        refreshing={refreshing}
        openSystemHref={focusRail?.href ?? null}
        openSystemLabel={focusRail ? railOpenLabel(focusRail, locale) : null}
        showShortcutHint
      />

      {loading ? (
        <div className="flex flex-1 items-center justify-center py-20">
          <StateLoading />
        </div>
      ) : err && !overview ? (
        <div className="mx-auto max-w-lg px-4 py-12">
          <StateError
            title={t('Sem acesso ao cockpit', 'Sin acceso al cockpit', 'No cockpit access')}
            message={err}
            onRetry={() => void load()}
            retryLabel={t('Tentar de novo', 'Reintentar', 'Retry')}
          />
          {canManage ? (
            <div className="mt-4 text-center">
              <Link
                href={adminHref('access')}
                className="text-sm font-medium text-teal-300 hover:underline"
              >
                {t('Gerir acessos na Administração', 'Gestionar accesos en Administración', 'Manage access in Administration')}
              </Link>
            </div>
          ) : null}
        </div>
      ) : overview ? (
        <WorkspaceCockpit
          companyId={companyId}
          overview={overview}
          locale={locale}
          canManage={canManage}
          saving={saving}
          notifBusy={notifBusy}
          advisorBusy={advisorAlertBusy}
          onMarkTaskDone={markTaskDone}
          onMarkNotif={markNotifRead}
          onMarkAllNotifs={markAllNotifsRead}
          onMarkAlert={markAiAlertRead}
          onFocusRailChange={setFocusRail}
          t={t}
        />
      ) : null}

      {err && overview ? (
        <p className={cn('px-4 pb-3 text-center text-xs text-amber-300/90 sm:px-6')}>{err}</p>
      ) : null}
    </div>
  );
}
