'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useApp } from '@/app/providers';
import { WorkspaceTopBar } from '@/components/workspace/WorkspaceTopBar';
import { useHubWorkspaceRoute } from '@/components/hub/HubWorkspaceShell';
import { WORKSPACE_SYSTEM_KEYS, systemDisplayName, type WorkspaceSystemKey } from '@/lib/integrated-workspace-shared';
import { Lock, Shield, UserPlus, Users, X } from 'lucide-react';
import { getSiepPermissionGroups, type SiepPermissionKey } from '@/lib/siep/permissions-shared';
import type { Locale } from '@/lib/i18n';
import { cn, isLikelyDbId } from '@/lib/utils';
import { StateEmpty, StateError, StateLoading } from '@/components/ui/StateBlocks';
import { EtholysInviteWizard } from '@/components/etholys-invite/EtholysInviteWizard';

type Member = { userId: string; email: string; name: string; role: string };
type Grant = { userId: string; email: string; name: string; systems: string[]; enabled: boolean };

const SYSTEM_CHIP: Record<WorkspaceSystemKey, string> = {
  ATLAS: 'bg-teal-50 text-teal-800 border-teal-200',
  SIEP: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  FUNDHUB: 'bg-amber-50 text-amber-900 border-amber-200',
  NEXUS: 'bg-violet-50 text-violet-800 border-violet-200',
  FORGE: 'bg-sky-50 text-sky-800 border-sky-200',
  PRISM: 'bg-rose-50 text-rose-800 border-rose-200',
};

function emptySystemSel(): Record<WorkspaceSystemKey, boolean> {
  return Object.fromEntries(WORKSPACE_SYSTEM_KEYS.map((k) => [k, false])) as Record<
    WorkspaceSystemKey,
    boolean
  >;
}

export default function WorkspaceTeamPage() {
  const { data: session } = useSession();
  const { activeCompanyId, locale } = useApp();
  const { companiesReady, hasCompanies, companiesLoadError, reloadCompanies, companies } = useHubWorkspaceRoute();
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
        setGrants(a.grants || []);
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
    if (grant?.enabled && Array.isArray(grant.systems)) {
      for (const k of grant.systems) {
        if (k in next) next[k as WorkspaceSystemKey] = true;
      }
    } else {
      next.ATLAS = true;
      next.SIEP = true;
    }
    setSel(next);
  };

  const clearSelection = () => {
    setTargetUser('');
    setMsg(null);
    setSiepMsg(null);
    setSel(emptySystemSel());
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
    const member = members.find((m) => m.userId === targetUser);
    const nextSystems = Array.isArray(d.grant?.systems) ? d.grant.systems : systems;
    setGrants((prev) => {
      const rest = prev.filter((g) => g.userId !== targetUser);
      return [
        {
          userId: targetUser,
          email: member?.email || '',
          name: member?.name || '',
          systems: nextSystems,
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
        <WorkspaceTopBar locale={locale} canManage={false} active="team" />
        <div className="mx-auto max-w-lg p-6">
          <StateError
            tone="amber"
            message={t(
              'Apenas o administrador da empresa pode configurar acessos.',
              'Solo el administrador de la empresa puede configurar accesos.',
              'Only a company admin can manage workspace access.',
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
      <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
        <header className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-700">
                {t('Administração', 'Administración', 'Administration')}
              </p>
              <h1 className="mt-1 flex items-center gap-2 text-xl font-bold text-slate-900 sm:text-2xl">
                <Shield className="h-6 w-6 shrink-0 text-teal-700" />
                {t('Equipa e acessos', 'Equipo y accesos', 'Team & access')}
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">
                {t(
                  'Convide pessoas, atribua sistemas do centro integrado e defina permissões SIEP — num fluxo claro.',
                  'Invite personas, asigne sistemas del centro integrado y defina permisos SIEP — en un flujo claro.',
                  'Invite people, grant integrated workspace systems, and set SIEP permissions — in a clear flow.',
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowInviteWizard((v) => !v);
                setInviteMsg(null);
              }}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition',
                showInviteWizard
                  ? 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  : 'bg-teal-700 text-white hover:bg-teal-800',
              )}
            >
              <UserPlus className="h-4 w-4" />
              {showInviteWizard
                ? t('Fechar convite', 'Cerrar invitación', 'Close invite')
                : t('Convidar pessoa', 'Invitar persona', 'Invite person')}
            </button>
          </div>
        </header>

        {/* 1. Invite */}
        {(showInviteWizard || inviteMsg) && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 text-xs font-bold text-teal-800">
                1
              </span>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  {t('Convidar pessoa', 'Invitar persona', 'Invite person')}
                </h2>
                <p className="text-xs text-slate-500">
                  {t(
                    'Novo vínculo por email — não vê o Hub completo, só as funções marcadas.',
                    'Nuevo vínculo por email — no ve el Hub completo, solo las funciones marcadas.',
                    'New email invite — function access only, not the full Hub.',
                  )}
                </p>
              </div>
            </div>
            {inviteMsg && (
              <p className="mb-3 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-900">
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

        {/* 2. Members */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-700">
                2
              </span>
              <div>
                <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Users className="h-4 w-4 text-slate-600" />
                  {t('Membros da empresa', 'Miembros de la empresa', 'Company members')}
                </h2>
                <p className="text-xs text-slate-500">
                  {t(
                    'Escolha alguém para configurar sistemas e permissões SIEP.',
                    'Elija a alguien para configurar sistemas y permisos SIEP.',
                    'Pick someone to configure systems and SIEP permissions.',
                  )}
                </p>
              </div>
            </div>
            {meId && members.some((m) => m.userId === meId) && (
              <button
                type="button"
                onClick={() => selectMember(meId)}
                className="text-xs font-medium text-teal-700 hover:underline"
              >
                {t('Usar a minha conta', 'Usar mi cuenta', 'Use my account')}
              </button>
            )}
          </div>

          {members.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              {t(
                'Ainda sem membros nesta empresa.',
                'Aún sin miembros en esta empresa.',
                'No members in this company yet.',
              )}
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
              {members.map((m) => {
                const grant = grants.find((g) => g.userId === m.userId);
                const active = targetUser === m.userId;
                return (
                  <li
                    key={m.userId}
                    className={cn(
                      'flex flex-wrap items-center justify-between gap-3 px-3 py-3 transition sm:px-4',
                      active ? 'bg-teal-50/70' : 'bg-white hover:bg-slate-50/80',
                    )}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">{m.name || m.email}</p>
                      <p className="truncate text-xs text-slate-500">{m.email}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                          {m.role}
                        </span>
                        {grant?.enabled && grant.systems.length > 0 ? (
                          grant.systems.map((sys) => (
                            <span
                              key={sys}
                              className={cn(
                                'rounded-md border px-1.5 py-0.5 text-[10px] font-medium',
                                SYSTEM_CHIP[sys as WorkspaceSystemKey] ||
                                  'border-slate-200 bg-slate-50 text-slate-600',
                              )}
                            >
                              {systemDisplayName(sys as WorkspaceSystemKey)}
                            </span>
                          ))
                        ) : (
                          <span className="text-[11px] text-slate-400">
                            {t('Sem sistemas', 'Sin sistemas', 'No systems')}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => (active ? clearSelection() : selectMember(m.userId))}
                      className={cn(
                        'shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                        active
                          ? 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          : 'bg-teal-700 text-white hover:bg-teal-800',
                      )}
                    >
                      {active
                        ? t('Fechar', 'Cerrar', 'Close')
                        : t('Configurar', 'Configurar', 'Configure')}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* 3. Per-user access + SIEP */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-700">
                3
              </span>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  {t('Acesso por utilizador', 'Acceso por usuario', 'Per-user access')}
                </h2>
                <p className="text-xs text-slate-500">
                  {selectedMember
                    ? t(
                        `A configurar: ${selectedMember.name || selectedMember.email}`,
                        `Configurando: ${selectedMember.name || selectedMember.email}`,
                        `Configuring: ${selectedMember.name || selectedMember.email}`,
                      )
                    : t(
                        'Selecione um membro na lista acima.',
                        'Seleccione un miembro en la lista de arriba.',
                        'Select a member from the list above.',
                      )}
                </p>
              </div>
            </div>
            {targetUser && (
              <button
                type="button"
                onClick={clearSelection}
                className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800"
              >
                <X className="h-3.5 w-3.5" />
                {t('Limpar seleção', 'Limpiar selección', 'Clear selection')}
              </button>
            )}
          </div>

          {!targetUser ? (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              {t(
                'Nenhum utilizador selecionado. Clique em «Configurar» num membro.',
                'Ningún usuario seleccionado. Pulse «Configurar» en un miembro.',
                'No user selected. Click “Configure” on a member.',
              )}
            </p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  {t('Sistemas', 'Sistemas', 'Systems')}
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  {t(
                    'Quais produtos do centro integrado esta pessoa pode abrir.',
                    'Qué productos del centro integrado puede abrir esta persona.',
                    'Which integrated workspace products this person can open.',
                  )}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {WORKSPACE_SYSTEM_KEYS.map((k) => (
                    <label
                      key={k}
                      className={cn(
                        'flex cursor-pointer items-center gap-2 rounded-lg border bg-white px-2.5 py-2 text-sm transition',
                        sel[k]
                          ? 'border-teal-300 ring-1 ring-teal-400/40'
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
                      className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                      {t('Remover acesso', 'Quitar acceso', 'Remove access')}
                    </button>
                  )}
                </div>
                {msg && <p className="mt-2 text-sm text-slate-700">{msg}</p>}
              </div>

              <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4">
                <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-indigo-900">
                  <Lock className="h-3.5 w-3.5" />
                  {t('Permissões SIEP', 'Permisos SIEP', 'SIEP permissions')}
                </h3>
                <p className="mt-1 text-xs text-indigo-900/70">
                  {t(
                    'O que vê no SIEP: orçamento, extrato, reportes de campo, etc.',
                    'Qué ve en SIEP: montos, extracto, reportes de campo, etc.',
                    'What they see in SIEP: budget, ledger, field reports, etc.',
                  )}
                </p>
                {!siepSelected ? (
                  <p className="mt-4 rounded-lg border border-dashed border-indigo-200 bg-white/70 px-3 py-4 text-sm text-indigo-900/70">
                    {t(
                      'Marque SIEP nos sistemas à esquerda para editar estas permissões.',
                      'Marque SIEP en los sistemas a la izquierda para editar estos permisos.',
                      'Enable SIEP in systems on the left to edit these permissions.',
                    )}
                  </p>
                ) : (
                  <div className="mt-3 max-h-[22rem] space-y-3 overflow-y-auto pr-1">
                    {siepPermGroups.map((group) => (
                      <div key={group.id}>
                        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-800">
                          {group.label}
                        </p>
                        <div className="grid gap-1.5">
                          {group.permissions.map((perm) => (
                            <label
                              key={perm.key}
                              className="flex cursor-pointer items-start gap-2 rounded-lg border border-white bg-white/90 px-2.5 py-2 text-sm shadow-sm hover:border-indigo-200"
                            >
                              <input
                                type="checkbox"
                                checked={siepPerms[perm.key]}
                                onChange={(e) =>
                                  setSiepPerms((s) => ({ ...s, [perm.key]: e.target.checked }))
                                }
                                className="mt-0.5 rounded border-slate-300 text-indigo-700 focus:ring-indigo-600"
                              />
                              <span>
                                <span className="font-medium text-slate-800">{perm.label}</span>
                                {perm.description && (
                                  <span className="mt-0.5 block text-[11px] text-slate-500">
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
                      className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800 disabled:opacity-50"
                    >
                      {siepSaving
                        ? t('A guardar…', 'Guardando…', 'Saving…')
                        : t('Guardar permissões SIEP', 'Guardar permisos SIEP', 'Save SIEP permissions')}
                    </button>
                  </div>
                )}
                {siepMsg && <p className="mt-2 text-sm text-slate-700">{siepMsg}</p>}
              </div>
            </div>
          )}
        </section>

        {/* 4. Active grants */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-700">
              4
            </span>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                {t('Acessos activos', 'Accesos activos', 'Active grants')}
              </h2>
              <p className="text-xs text-slate-500">
                {t(
                  'Quem já tem sistemas no centro integrado.',
                  'Quién ya tiene sistemas en el centro integrado.',
                  'Who already has systems in the integrated workspace.',
                )}
              </p>
            </div>
          </div>
          {grants.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              {t('Ainda sem atribuições.', 'Aún sin asignaciones.', 'No grants yet.')}
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
              {grants.map((g) => (
                <li
                  key={g.userId}
                  className="flex flex-wrap items-center justify-between gap-3 bg-white px-3 py-3 sm:px-4"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{g.name || g.email}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {g.systems.map((sys) => (
                        <span
                          key={sys}
                          className={cn(
                            'rounded-md border px-1.5 py-0.5 text-[10px] font-medium',
                            SYSTEM_CHIP[sys as WorkspaceSystemKey] ||
                              'border-slate-200 bg-slate-50 text-slate-600',
                          )}
                        >
                          {systemDisplayName(sys as WorkspaceSystemKey)}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => selectMember(g.userId)}
                      className="text-xs font-medium text-teal-700 hover:underline"
                    >
                      {t('Editar', 'Editar', 'Edit')}
                    </button>
                    <button
                      type="button"
                      onClick={() => void remove(g.userId)}
                      className="text-xs font-medium text-red-600 hover:underline"
                    >
                      {t('Remover', 'Quitar', 'Remove')}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
