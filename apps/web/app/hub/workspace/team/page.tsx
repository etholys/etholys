'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useApp } from '@/app/providers';
import { WorkspaceTopBar } from '@/components/workspace/WorkspaceTopBar';
import { useHubWorkspaceRoute } from '@/components/hub/HubWorkspaceShell';
import { WORKSPACE_SYSTEM_KEYS, type WorkspaceSystemKey } from '@/lib/integrated-workspace-shared';
import { Shield, Lock } from 'lucide-react';
import { getSiepPermissionGroups, type SiepPermissionKey } from '@/lib/siep/permissions-shared';
import type { Locale } from '@/lib/i18n';
import { isLikelyDbId } from '@/lib/utils';
import { StateEmpty, StateError, StateLoading } from '@/components/ui/StateBlocks';

type Member = { userId: string; email: string; name: string; role: string };
type Grant = { userId: string; email: string; name: string; systems: string[]; enabled: boolean };

export default function WorkspaceTeamPage() {
  const { data: session } = useSession();
  const { activeCompanyId, locale } = useApp();
  const { companiesReady, hasCompanies, companiesLoadError, reloadCompanies } = useHubWorkspaceRoute();
  const companyId = useMemo(() => {
    const s = String(activeCompanyId ?? '').trim();
    return isLikelyDbId(s) ? s : '';
  }, [activeCompanyId]);
  const meId = (session?.user as { id?: string } | undefined)?.id;

  const t = (pt: string, es: string, en: string) =>
    locale === 'pt' ? pt : locale === 'es' ? es : en;

  const [canManage, setCanManage] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [targetUser, setTargetUser] = useState('');
  const [saving, setSaving] = useState(false);
  const siepPermGroups = useMemo(() => getSiepPermissionGroups(locale as Locale), [locale]);
  const [siepPerms, setSiepPerms] = useState<Record<SiepPermissionKey, boolean>>(
    () => Object.fromEntries(siepPermGroups.flatMap((g) => g.permissions.map((p) => [p.key, false]))) as Record<SiepPermissionKey, boolean>,
  );
  const [siepSaving, setSiepSaving] = useState(false);
  const [siepMsg, setSiepMsg] = useState<string | null>(null);
  const [sel, setSel] = useState<Record<WorkspaceSystemKey, boolean>>(
    () =>
      Object.fromEntries(WORKSPACE_SYSTEM_KEYS.map((k) => [k, k === 'ATLAS' || k === 'SIEP'])) as Record<
        WorkspaceSystemKey,
        boolean
      >
  );

  const load = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const a = await fetch(`/api/workspace/access?companyId=${encodeURIComponent(companyId)}`).then((r) => r.json());
    if (!a.canManage) {
      setCanManage(false);
      setLoading(false);
      return;
    }
    setCanManage(true);
    setGrants(a.grants || []);
    const m = await fetch(`/api/workspace/members?companyId=${encodeURIComponent(companyId)}`).then((r) => r.json());
    if (m.members) setMembers(m.members);
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!companyId || !targetUser) return;
    void (async () => {
      const r = await fetch(
        `/api/workspace/members/permissions?companyId=${encodeURIComponent(companyId)}&userId=${encodeURIComponent(targetUser)}`,
      );
      const d = await r.json();
      const next = Object.fromEntries(
        siepPermGroups.flatMap((g) => g.permissions.map((p) => [p.key, false])),
      ) as Record<SiepPermissionKey, boolean>;
      if (r.ok && Array.isArray(d.permissions)) {
        for (const k of d.permissions as SiepPermissionKey[]) {
          if (k in next) next[k] = true;
        }
      }
      setSiepPerms(next);
    })();
  }, [companyId, targetUser, siepPermGroups]);

  const saveSiepPermissions = async () => {
    if (!targetUser) {
      setSiepMsg(t('Escolha um utilizador.', 'Elija un usuario.', 'Choose a user.'));
      return;
    }
    setSiepMsg(null);
    setSiepSaving(true);
    const permissions = (Object.entries(siepPerms) as [SiepPermissionKey, boolean][])
      .filter(([, on]) => on)
      .map(([k]) => k);
    const r = await fetch('/api/workspace/members/permissions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, userId: targetUser, permissions }),
    });
    const d = await r.json();
    setSiepSaving(false);
    if (!r.ok) {
      setSiepMsg(d.error || 'Erro');
      return;
    }
    setSiepMsg(t('Permissões SIEP guardadas.', 'Permisos SIEP guardados.', 'SIEP permissions saved.'));
  };

  const save = async () => {
    if (!targetUser) {
      setMsg(t('Escolha um utilizador.', 'Elija un usuario.', 'Choose a user.'));
      return;
    }
    const systems = WORKSPACE_SYSTEM_KEYS.filter((k) => sel[k]);
    if (systems.length === 0) {
      setMsg(t('Marque pelo menos um sistema.', 'Marque al menos un sistema.', 'Select at least one system.'));
      return;
    }
    setMsg(null);
    setSaving(true);
    const r = await fetch('/api/workspace/access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, userId: targetUser, systems, enabled: true }),
    });
    const d = await r.json();
    setSaving(false);
    if (!r.ok) {
      setMsg(d.error || 'Erro');
      return;
    }
    setMsg(t('Guardado.', 'Guardado.', 'Saved.'));
    setTargetUser('');
    await load();
  };

  const remove = async (userId: string) => {
    if (!confirm(t('Remover acesso ao centro integrado?', '¿Quitar el acceso al centro integrado?', 'Remove integrated workspace access?')))
      return;
    setMsg(null);
    const r = await fetch(
      `/api/workspace/access?companyId=${encodeURIComponent(companyId)}&userId=${encodeURIComponent(userId)}`,
      { method: 'DELETE' }
    );
    if (!r.ok) {
      const d = await r.json();
      setMsg(d.error || 'Erro');
      return;
    }
    await load();
  };

  const pickMyself = () => {
    if (!meId) {
      setMsg(t('Sessão sem ID de utilizador.', 'Sesión sin ID de usuario.', 'Session has no user id.'));
      return;
    }
    setTargetUser(meId);
    setMsg(null);
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
      <div className="mx-auto max-w-lg p-6">
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
      <div className="mx-auto max-w-lg p-6 sm:p-10">
        <StateEmpty
          title={t('Sem empresas', 'Sin empresas', 'No companies')}
          description={t(
            'Crie uma organização em Configuração ou peça acesso a um admin.',
            'Cree una organización en Configuración o pida acceso al admin.',
            'Create an organization in Settings or request access from an admin.'
          )}
          action={
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link href="/settings" className="text-sm font-medium text-teal-800 hover:underline">
                {t('Configuração', 'Configuración', 'Settings')}
              </Link>
              <Link href="/dashboard" className="text-sm text-slate-600 hover:underline">
                {t('Painel', 'Panel', 'Dashboard')}
              </Link>
            </div>
          }
        />
      </div>
    );
  }

  if (!companyId) {
    return (
      <div className="mx-auto max-w-lg p-6 text-sm text-slate-600">
        {t('A aguardar a empresa (use o seletor no cabeçalho).', 'Esperando empresa (selector en la cabecera).', 'Waiting for company (header selector).')}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-[40vh] px-4">
        <StateLoading className="h-full" />
      </div>
    );
  }

  if (!canManage && companyId) {
    return (
      <div>
        <WorkspaceTopBar locale={locale} canManage={false} active="team" />
        <div className="mx-auto max-w-lg p-6">
          <StateError
            tone="amber"
            message={t(
              'Apenas o administrador da empresa pode configurar acessos.',
              'Solo el administrador de la empresa puede configurar accesos.',
              'Only a company admin can manage workspace access.'
            )}
          />
          <Link href="/hub/workspace" className="mt-4 inline-block text-teal-700 hover:underline">
            ← {t('Centro integrado', 'Centro integrado', 'Workspace')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <WorkspaceTopBar locale={locale} canManage active="team" />
      <div className="mx-auto max-w-2xl p-4 sm:p-6">
        <h1 className="mt-2 flex items-center gap-2 text-xl font-bold text-slate-900">
          <Shield className="h-6 w-6 text-slate-700" />
          {t('Acessos ao centro integrado', 'Accesos al centro integrado', 'Integrated workspace access')}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {t(
            'Apenas os utilizadores abaixo veem o centro. Os dados mantêm-se em cada sistema (ATLAS, SIEP, …).',
            'Solo los usuarios listados abajo usan el centro. Los datos siguen en cada sistema.',
            'Only users you authorize see the center. Data stays in each system.'
          )}
        </p>

        <div className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div>
            <div className="flex flex-wrap items-end justify-between gap-2">
              <label className="text-sm font-medium text-slate-700">{t('Utilizador', 'Usuario', 'User')}</label>
              {meId && members.some((m) => m.userId === meId) && (
                <button
                  type="button"
                  onClick={pickMyself}
                  className="text-xs font-medium text-teal-700 hover:underline"
                >
                  {t('Usar a minha conta', 'Usar mi cuenta', 'Use my account')}
                </button>
              )}
            </div>
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm"
              value={targetUser}
              onChange={(e) => setTargetUser(e.target.value)}
            >
              <option value="">—</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name} ({m.email})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">{t('Sistemas', 'Sistemas', 'Systems')}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {WORKSPACE_SYSTEM_KEYS.map((k) => (
                <label key={k} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={sel[k]}
                    onChange={(e) => setSel((s) => ({ ...s, [k]: e.target.checked }))}
                  />
                  {k}
                </label>
              ))}
            </div>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {saving
              ? t('A guardar…', 'Guardando…', 'Saving…')
              : t('Guardar acesso', 'Guardar acceso', 'Save access')}
          </button>
        </div>

        {msg && <p className="mt-3 text-sm text-slate-800">{msg}</p>}

        <div className="mt-8 space-y-4 rounded-xl border border-indigo-200 bg-indigo-50/30 p-4 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Lock className="h-4 w-4 text-indigo-600" />
            {t('Permissões SIEP (casinhas)', 'Permisos SIEP (casillas)', 'SIEP permissions')}
          </h2>
          <p className="text-xs text-slate-600">
            {t(
              'Defina o que este utilizador vê no SIEP: valores do orçamento, extrato, reportes de campo, etc.',
              'Defina qué ve este usuario en SIEP: montos, extracto, reportes de campo, etc.',
              'Control what this user sees in SIEP: budget amounts, ledger, field reports, etc.',
            )}
          </p>
          {!targetUser ? (
            <p className="text-sm text-slate-500">{t('Selecione um utilizador acima.', 'Seleccione un usuario arriba.', 'Select a user above.')}</p>
          ) : (
            <div className="space-y-4">
              {siepPermGroups.map((group) => (
                <div key={group.id}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-indigo-800">{group.label}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {group.permissions.map((perm) => (
                      <label
                        key={perm.key}
                        className="flex cursor-pointer items-start gap-2 rounded-lg border border-white bg-white/80 p-2.5 text-sm shadow-sm hover:border-indigo-200"
                      >
                        <input
                          type="checkbox"
                          checked={siepPerms[perm.key]}
                          onChange={(e) => setSiepPerms((s) => ({ ...s, [perm.key]: e.target.checked }))}
                          className="mt-0.5"
                        />
                        <span>
                          <span className="font-medium text-slate-800">{perm.label}</span>
                          {perm.description && (
                            <span className="mt-0.5 block text-[11px] text-slate-500">{perm.description}</span>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <button
                type="button"
                disabled={siepSaving}
                onClick={() => void saveSiepPermissions()}
                className="rounded-lg bg-indigo-700 px-4 py-2 text-sm text-white hover:bg-indigo-800 disabled:opacity-50"
              >
                {siepSaving
                  ? t('A guardar…', 'Guardando…', 'Saving…')
                  : t('Guardar permissões SIEP', 'Guardar permisos SIEP', 'Save SIEP permissions')}
              </button>
            </div>
          )}
          {siepMsg && <p className="text-sm text-slate-800">{siepMsg}</p>}
        </div>

        <div className="mt-8">
          <h2 className="text-sm font-semibold text-slate-800">{t('Atribuídos', 'Asignados', 'Grants')}</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {grants.length === 0 && <li className="text-slate-500">—</li>}
            {grants.map((g) => (
              <li
                key={g.userId}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 py-2"
              >
                <span>
                  {g.name} — {g.systems.join(', ')}
                </span>
                <button type="button" onClick={() => void remove(g.userId)} className="text-red-600 hover:underline">
                  {t('Remover', 'Quitar', 'Remove')}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
