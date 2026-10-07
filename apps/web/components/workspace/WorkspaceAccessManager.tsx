'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useApp } from '@/app/providers';
import {
  WORKSPACE_SYSTEM_KEYS,
  WORKSPACE_TOOL_KEYS,
  systemDisplayName,
  toolDisplayName,
  type WorkspaceSystemKey,
  type WorkspaceToolKey,
} from '@/lib/integrated-workspace-shared';
import { Lock, Shield, UserPlus, Users, X } from 'lucide-react';
import { getSiepPermissionGroups, type SiepPermissionKey } from '@/lib/siep/permissions-shared';
import type { Locale } from '@/lib/i18n';
import { cn, isLikelyDbId } from '@/lib/utils';
import { StateEmpty, StateError, StateLoading } from '@/components/ui/StateBlocks';
import { EtholysInviteWizard } from '@/components/etholys-invite/EtholysInviteWizard';

type Member = { userId: string; email: string; name: string; role: string };
type Grant = { userId: string; email: string; name: string; systems: string[]; tools: string[]; enabled: boolean };

const PANEL =
  'rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]';

/** Quiet chips — slate family only, teal when selected/active */
function SystemChip({ label, active }: { label: string; active?: boolean }) {
  return (
    <span
      className={cn(
        'rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        active
          ? 'border-teal-300 bg-teal-50 text-teal-900'
          : 'border-slate-200 bg-slate-50 text-slate-700',
      )}
    >
      {label}
    </span>
  );
}

function emptySystemSel(): Record<WorkspaceSystemKey, boolean> {
  return Object.fromEntries(WORKSPACE_SYSTEM_KEYS.map((k) => [k, false])) as Record<
    WorkspaceSystemKey,
    boolean
  >;
}
function emptyToolSel(): Record<WorkspaceToolKey, boolean> {
  return Object.fromEntries(WORKSPACE_TOOL_KEYS.map((k) => [k, false])) as Record<
    WorkspaceToolKey,
    boolean
  >;
}


export function WorkspaceAccessManager({ embedded = false }: { embedded?: boolean }) {
  const { data: session } = useSession();
  const { activeCompanyId, locale } = useApp();
  const [companies, setCompanies] = useState<Array<{ id: string; shortName: string; name?: string }>>([]);
  const [companiesReady, setCompaniesReady] = useState(false);
  const [companiesLoadError, setCompaniesLoadError] = useState<string | null>(null);
  const reloadCompanies = useCallback(() => {
    setCompaniesReady(false);
    fetch('/api/companies', { cache: 'no-store' })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'HTTP ' + r.status);
        setCompanies(Array.isArray(d.companies) ? d.companies : []);
        setCompaniesLoadError(null);
      })
      .catch((e) => {
        setCompanies([]);
        setCompaniesLoadError(e instanceof Error ? e.message : 'error');
      })
      .finally(() => setCompaniesReady(true));
  }, []);
  useEffect(() => { reloadCompanies(); }, [reloadCompanies]);
  const hasCompanies = companies.length > 0;
  const companyId = useMemo(() => {
    const s = String(activeCompanyId ?? '').trim();
    return isLikelyDbId(s) ? s : '';
  }, [activeCompanyId]);
  const meId = (session?.user as { id?: string } | undefined)?.id;

  const t = (pt: string, es: string, en: string) =>
    locale === 'pt' ? pt : locale === 'es' ? es : en;

  const companyOpts = useMemo(
    () =>
      companies
        .filter((c) => !companyId || c.id === companyId)
        .map((c) => ({
          id: c.id,
          name: c.name || c.shortName || c.id,
          shortName: c.shortName,
        })),
    [companies, companyId],
  );

  const [canManage, setCanManage] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [targetUser, setTargetUser] = useState('');
  const [saving, setSaving] = useState(false);
  const siepPermGroups = useMemo(() => getSiepPermissionGroups(locale as Locale), [locale]);
  const [siepPerms, setSiepPerms] = useState<Record<SiepPermissionKey, boolean>>(
    () =>
      Object.fromEntries(siepPermGroups.flatMap((g) => g.permissions.map((p) => [p.key, false]))) as Record<
        SiepPermissionKey,
        boolean
      >,
  );
  const [siepSaving, setSiepSaving] = useState(false);
  const [siepMsg, setSiepMsg] = useState<string | null>(null);
  const [sel, setSel] = useState<Record<WorkspaceSystemKey, boolean>>(emptySystemSel);
  const [toolSel, setToolSel] = useState<Record<WorkspaceToolKey, boolean>>(emptyToolSel);
  const [companyTools, setCompanyTools] = useState<WorkspaceToolKey[]>([...WORKSPACE_TOOL_KEYS]);
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);
  const [showInviteWizard, setShowInviteWizard] = useState(false);

  const selectedMember = useMemo(
    () => members.find((m) => m.userId === targetUser) || null,
    [members, targetUser],
  );
  const selectedGrant = useMemo(
    () => grants.find((g) => g.userId === targetUser) || null,
    [grants, targetUser],
  );
  const siepSelected = !!sel.SIEP;

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!companyId) {
        setLoading(false);
        return;
      }
      if (!opts?.silent) setLoading(true);
      try {
        const [a, m] = await Promise.all([
          fetch(`/api/workspace/access?companyId=${encodeURIComponent(companyId)}`).then((r) => r.json()),
          fetch(`/api/workspace/members?companyId=${encodeURIComponent(companyId)}`).then((r) => r.json()),
        ]);
        if (!a.canManage) {
          setCanManage(false);
          setGrants([]);
          setMembers([]);
          return;
        }
        setCanManage(true);
        setGrants(
          (a.grants || []).map((g: Grant) => ({
            ...g,
            tools: Array.isArray(g.tools) ? g.tools : [],
          })),
        );
        if (Array.isArray(a.companyTools) && a.companyTools.length) {
          setCompanyTools(a.companyTools as WorkspaceToolKey[]);
        }
        if (m.members) setMembers(m.members);
      } finally {
        setLoading(false);
      }
    },
    [companyId],
  );

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

  const selectMember = (userId: string) => {
    setTargetUser(userId);
    setMsg(null);
    setSiepMsg(null);
    const grant = grants.find((g) => g.userId === userId);
    const next = emptySystemSel();
    const nextTools = emptyToolSel();
    if (grant?.enabled && Array.isArray(grant.systems)) {
      for (const k of grant.systems) {
        if (k in next) next[k as WorkspaceSystemKey] = true;
      }
    } else {
      next.ATLAS = true;
      next.SIEP = true;
    }
    if (grant?.enabled && Array.isArray(grant.tools)) {
      for (const k of grant.tools) {
        if (k in nextTools) nextTools[k as WorkspaceToolKey] = true;
      }
    }
    setSel(next);
    setToolSel(nextTools);
  };

  useEffect(() => {
    if (!targetUser) return;
    const id = window.setTimeout(() => {
      document.getElementById('user-access-profile')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
    return () => window.clearTimeout(id);
  }, [targetUser]);

  const clearSelection = () => {
    setTargetUser('');
    setMsg(null);
    setSiepMsg(null);
    setSel(emptySystemSel());
    setToolSel(emptyToolSel());
  };

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
    const tools = WORKSPACE_TOOL_KEYS.filter((k) => toolSel[k] && companyTools.includes(k));
    if (systems.length === 0 && tools.length === 0) {
      setMsg(
        t(
          'Marque pelo menos um sistema ou uma ferramenta.',
          'Marque al menos un sistema o una herramienta.',
          'Select at least one system or tool.',
        ),
      );
      return;
    }
    setMsg(null);
    setSaving(true);
    const r = await fetch('/api/workspace/access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, userId: targetUser, systems, tools, enabled: true }),
    });
    const d = await r.json();
    setSaving(false);
    if (!r.ok) {
      setMsg(d.error || 'Erro');
      return;
    }
    const member = members.find((m) => m.userId === targetUser);
    const nextSystems = Array.isArray(d.grant?.systems) ? d.grant.systems : systems;
    const nextToolsList = Array.isArray(d.grant?.tools) ? d.grant.tools : tools;
    setGrants((prev) => {
      const rest = prev.filter((g) => g.userId !== targetUser);
      return [
        {
          userId: targetUser,
          email: member?.email || '',
          name: member?.name || '',
          systems: nextSystems,
          tools: nextToolsList,
          enabled: true,
        },
        ...rest,
      ];
    });
    setMsg(t('Acesso guardado.', 'Acceso guardado.', 'Access saved.'));
    void load({ silent: true });
  };

  const remove = async (userId: string) => {
    if (
      !confirm(
        t(
          'Remover acesso ao centro integrado?',
          '¿Quitar el acceso al centro integrado?',
          'Remove integrated workspace access?',
        ),
      )
    )
      return;
    setMsg(null);
    const r = await fetch(
      `/api/workspace/access?companyId=${encodeURIComponent(companyId)}&userId=${encodeURIComponent(userId)}`,
      { method: 'DELETE' },
    );
    if (!r.ok) {
      const d = await r.json();
      setMsg(d.error || 'Erro');
      return;
    }
    setGrants((prev) => prev.filter((g) => g.userId !== userId));
    if (targetUser === userId) clearSelection();
    void load({ silent: true });
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
            'Create an organization in Settings or request access from an admin.',
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
        {t(
          'A aguardar a empresa (use o seletor no cabeçalho).',
          'Esperando empresa (selector en la cabecera).',
          'Waiting for company (header selector).',
        )}
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
                <div className="mx-auto max-w-lg p-6">
          <StateError
            tone="amber"
            message={t(
              'Apenas o administrador da empresa pode configurar acessos.',
              'Solo el administrador de la empresa puede configurar accesos.',
              'Only a company admin can manage workspace access.',
            )}
          />
          <Link href="/hub/workspace" className="mt-4 inline-block text-sm font-medium text-teal-800 hover:underline">
            ← {t('Centro integrado', 'Centro integrado', 'Workspace')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={embedded ? 'space-y-4' : undefined}>
      <div className={cn(!embedded && 'mx-auto max-w-6xl space-y-5 p-4 sm:p-6', embedded && 'space-y-4')}>
        {!embedded && (
          <header className={cn(PANEL, 'px-5 py-4 sm:px-6')}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-800">
                  {t('Administração', 'Administración', 'Administration')}
                </p>
                <h1 className="mt-1 flex items-center gap-2 text-xl font-semibold tracking-tight text-slate-900">
                  <Shield className="h-5 w-5 shrink-0 text-teal-700" />
                  {t('Utilizadores', 'Usuarios', 'Users')}
                </h1>
                <p className="mt-1.5 max-w-2xl text-sm text-slate-600">
                  {t(
                    'Equipa, convites e permissões num só sítio.',
                    'Equipo, invitaciones y permisos en un solo lugar.',
                    'Team, invites and permissions in one place.',
                  )}
                </p>
              </div>
            </div>
          </header>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-slate-600">
            {members.length}{' '}
            {t('pessoas na empresa activa', 'personas en la empresa activa', 'people in the active company')}
          </p>
          <button
            type="button"
            onClick={() => {
              setShowInviteWizard((v) => !v);
              setInviteMsg(null);
            }}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition',
              showInviteWizard
                ? 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                : 'bg-teal-700 text-white hover:bg-teal-800',
            )}
          >
            <UserPlus className="h-3.5 w-3.5" />
            {showInviteWizard
              ? t('Fechar', 'Cerrar', 'Close')
              : t('Convidar', 'Invitar', 'Invite')}
          </button>
        </div>

        {(showInviteWizard || inviteMsg) && (
          <section className={cn(PANEL, 'p-4 sm:p-5')}>
            {inviteMsg && (
              <p className="mb-3 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-950">
                {inviteMsg}
              </p>
            )}
            {showInviteWizard && companyId && (
              <EtholysInviteWizard
                context="workspace"
                companies={companyOpts}
                defaultCompanyId={companyId}
                lockCompany
                className="border-slate-200 shadow-none"
                onCancel={() => setShowInviteWizard(false)}
                onSuccess={({ code, alreadyAccepted, email }) => {
                  setInviteMsg(
                    alreadyAccepted
                      ? t(
                          `Acesso atualizado para ${email} (já era membro).`,
                          `Acceso actualizado para ${email} (ya era miembro).`,
                          `Access updated for ${email} (already a member).`,
                        )
                      : t(
                          `Convite enviado a ${email}. Código: ${code || '—'}`,
                          `Invitación enviada a ${email}. Código: ${code || '—'}`,
                          `Invite sent to ${email}. Code: ${code || '—'}`,
                        ),
                  );
                  setShowInviteWizard(false);
                  void load({ silent: true });
                }}
              />
            )}
          </section>
        )}

        <section className={cn(PANEL, 'overflow-hidden')}>
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
              <Users className="h-4 w-4 text-slate-600" />
              {t('Equipa', 'Equipo', 'Team')}
            </h2>
          </div>
          {members.length === 0 ? (
            <p className="m-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-8 text-center text-sm text-slate-600">
              {t(
                'Ainda sem membros. Use Invitar para adicionar a primeira pessoa.',
                'Aún sin miembros. Use Invitar para añadir a la primera persona.',
                'No members yet. Use Invite to add the first person.',
              )}
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {members.map((m) => {
                const grant = grants.find((g) => g.userId === m.userId);
                const active = targetUser === m.userId;
                return (
                  <li
                    key={m.userId}
                    className={cn(
                      'flex flex-wrap items-center gap-3 px-4 py-3 transition',
                      active ? 'bg-teal-50/80' : 'bg-white hover:bg-slate-50/80',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => (active ? clearSelection() : selectMember(m.userId))}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {m.name || m.email}
                      </p>
                      <p className="truncate text-xs text-slate-600">{m.email}</p>
                      <span className="mt-1.5 flex flex-wrap items-center gap-1">
                        <SystemChip label={m.role} />
                        {grant?.enabled && grant.systems.length > 0 ? (
                          grant.systems.slice(0, 4).map((sys) => (
                            <SystemChip
                              key={sys}
                              label={systemDisplayName(sys as WorkspaceSystemKey)}
                              active
                            />
                          ))
                        ) : (
                          <span className="text-[11px] font-medium text-slate-500">
                            {t('Sem sistemas', 'Sin sistemas', 'No systems')}
                          </span>
                        )}
                        {grant?.enabled &&
                          Array.isArray(grant.tools) &&
                          grant.tools.slice(0, 3).map((tool) => (
                            <SystemChip key={tool} label={toolDisplayName(tool)} active />
                          ))}
                      </span>
                    </button>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => selectMember(m.userId)}
                        className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                      >
                        {t('Gerir', 'Gestionar', 'Manage')}
                      </button>
                      {grant?.enabled && (
                        <button
                          type="button"
                          onClick={() => void remove(m.userId)}
                          className="rounded-md px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                        >
                          {t('Remover', 'Quitar', 'Remove')}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {targetUser && selectedMember && (
          <section className={cn(PANEL, 'p-4 sm:p-5')} id="user-access-profile">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-4">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-800">
                  {t('Perfil de acesso', 'Perfil de acceso', 'Access profile')}
                </p>
                <h2 className="mt-0.5 truncate text-lg font-semibold text-slate-900">
                  {selectedMember.name || selectedMember.email}
                </h2>
                <p className="truncate text-sm text-slate-600">{selectedMember.email}</p>
              </div>
              <button
                type="button"
                onClick={clearSelection}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <X className="h-3.5 w-3.5" />
                {t('Fechar', 'Cerrar', 'Close')}
              </button>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-800">
                  {t('Sistemas', 'Sistemas', 'Systems')}
                </h3>
                <p className="mt-1 text-xs text-slate-600">
                  {t(
                    'Sistemas e Etholys Tools que esta pessoa pode abrir.',
                    'Sistemas y Etholys Tools que puede abrir esta persona.',
                    'Systems and Etholys Tools this person can open.',
                  )}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {WORKSPACE_SYSTEM_KEYS.map((k) => (
                    <label
                      key={k}
                      className={cn(
                        'flex cursor-pointer items-center gap-2 rounded-lg border bg-white px-2.5 py-2 text-sm transition',
                        sel[k]
                          ? 'border-teal-400 ring-1 ring-teal-400/50'
                          : 'border-slate-200 hover:border-slate-300',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={sel[k]}
                        onChange={(e) => setSel((s) => ({ ...s, [k]: e.target.checked }))}
                        className="rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                      />
                      <span className="font-medium text-slate-800">{systemDisplayName(k)}</span>
                    </label>
                  ))}
                </div>

                <div className="mt-5 border-t border-slate-200 pt-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-800">
                    {t('Etholys Tools', 'Etholys Tools', 'Etholys Tools')}
                  </h4>
                  <p className="mt-1 text-xs text-slate-600">
                    {t(
                      'Advisor, Studio, Work e Chorus — marque o que esta pessoa pode abrir.',
                      'Advisor, Studio, Work y Chorus — marque lo que esta persona puede abrir.',
                      'Advisor, Studio, Work and Chorus — mark what this person can open.',
                    )}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {WORKSPACE_TOOL_KEYS.map((k) => (
                      <label
                        key={k}
                        className={cn(
                          'flex cursor-pointer items-center gap-2 rounded-lg border bg-white px-2.5 py-2 text-sm transition',
                          toolSel[k]
                            ? 'border-teal-400 ring-1 ring-teal-400/50'
                            : 'border-slate-200 hover:border-slate-300',
                          !companyTools.includes(k) && 'opacity-50',
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={toolSel[k]}
                          disabled={!companyTools.includes(k)}
                          onChange={(e) => setToolSel((s) => ({ ...s, [k]: e.target.checked }))}
                          className="rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                        />
                        <span className="font-medium text-slate-800">{toolDisplayName(k)}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void save()}
                    className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
                  >
                    {saving
                      ? t('A guardar…', 'Guardando…', 'Saving…')
                      : t('Guardar acesso', 'Guardar acceso', 'Save access')}
                  </button>
                  {selectedGrant?.enabled && (
                    <button
                      type="button"
                      onClick={() => void remove(targetUser)}
                      className="rounded-lg border border-transparent px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                    >
                      {t('Remover acesso', 'Quitar acceso', 'Remove access')}
                    </button>
                  )}
                </div>
                {msg && <p className="mt-2 text-sm font-medium text-slate-800">{msg}</p>}
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-800">
                  <Lock className="h-3.5 w-3.5 text-slate-600" />
                  {t('Permissões SIEP', 'Permisos SIEP', 'SIEP permissions')}
                </h3>
                <p className="mt-1 text-xs text-slate-600">
                  {t(
                    'O que vê no SIEP: orçamento, extrato, reportes de campo, etc.',
                    'Qué ve en SIEP: montos, extracto, reportes de campo, etc.',
                    'What they see in SIEP: budget, ledger, field reports, etc.',
                  )}
                </p>
                {!siepSelected ? (
                  <p className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-600">
                    {t(
                      'Marque SIEP nos sistemas para editar estas permissões.',
                      'Marque SIEP en los sistemas para editar estos permisos.',
                      'Enable SIEP in systems to edit these permissions.',
                    )}
                  </p>
                ) : (
                  <div className="mt-3 max-h-[22rem] space-y-3 overflow-y-auto pr-1">
                    {siepPermGroups.map((group) => (
                      <div key={group.id}>
                        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                          {group.label}
                        </p>
                        <div className="grid gap-1.5">
                          {group.permissions.map((perm) => (
                            <label
                              key={perm.key}
                              className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 bg-slate-50/40 px-2.5 py-2 text-sm hover:border-slate-300"
                            >
                              <input
                                type="checkbox"
                                checked={siepPerms[perm.key]}
                                onChange={(e) =>
                                  setSiepPerms((s) => ({ ...s, [perm.key]: e.target.checked }))
                                }
                                className="mt-0.5 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                              />
                              <span>
                                <span className="font-medium text-slate-800">{perm.label}</span>
                                {perm.description && (
                                  <span className="mt-0.5 block text-[11px] text-slate-600">
                                    {perm.description}
                                  </span>
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
                      className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                    >
                      {siepSaving
                        ? t('A guardar…', 'Guardando…', 'Saving…')
                        : t('Guardar permissões SIEP', 'Guardar permisos SIEP', 'Save SIEP permissions')}
                    </button>
                  </div>
                )}
                {siepMsg && <p className="mt-2 text-sm font-medium text-slate-800">{siepMsg}</p>}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
