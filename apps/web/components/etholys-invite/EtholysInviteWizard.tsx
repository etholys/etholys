'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Building2,
  Calendar,
  Check,
  Mail,
  Shield,
  User,
  Users,
} from 'lucide-react';
import { useApp } from '@/app/providers';
import type { Locale } from '@/lib/i18n';
import {
  WORKSPACE_SYSTEM_KEYS,
  type WorkspaceSystemKey,
} from '@/lib/integrated-workspace-shared';
import {
  buildInviteSummaryLines,
  defaultSiepPermsForKind,
  defaultSystemsForKind,
  inviteKindHint,
  inviteKindLabel,
  type CompanyPowerRole,
  type InviteEntryContext,
  type InviteKind,
} from '@/lib/etholys-invite';
import {
  getSiepPermissionGroups,
  type SiepPermissionKey,
} from '@/lib/siep/permissions-shared';
import { cn } from '@/lib/utils';

type CompanyOpt = { id: string; name: string; shortName?: string };
type ProjectOpt = { id: string; name: string };

type Props = {
  /** Onde o wizard foi aberto — só muda defaults / campos ocultos */
  context: InviteEntryContext;
  companies: CompanyOpt[];
  /** Prefill empresa (workspace / siep) */
  defaultCompanyId?: string;
  /** Prefill projecto + força aliado (SIEP equipa) */
  defaultProjectId?: string;
  defaultProjectName?: string;
  /** Se true, esconde selector de empresa */
  lockCompany?: boolean;
  /** Se true, força tipo aliado e esconde os outros cards */
  lockAlly?: boolean;
  allowedSystems?: WorkspaceSystemKey[];
  onCancel?: () => void;
  onSuccess?: (result: { code?: string; alreadyAccepted?: boolean; email: string }) => void;
  className?: string;
};

export function EtholysInviteWizard({
  context,
  companies,
  defaultCompanyId,
  defaultProjectId,
  defaultProjectName,
  lockCompany,
  lockAlly,
  allowedSystems,
  onCancel,
  onSuccess,
  className,
}: Props) {
  const { locale } = useApp();
  const loc = (locale as Locale) || 'es';
  const t = (pt: string, es: string, en: string) => (loc === 'pt' ? pt : loc === 'en' ? en : es);

  const systemOptions = allowedSystems?.length ? allowedSystems : [...WORKSPACE_SYSTEM_KEYS];
  const siepGroups = useMemo(() => getSiepPermissionGroups(loc), [loc]);

  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [companyId, setCompanyId] = useState(
    () => defaultCompanyId || companies[0]?.id || '',
  );
  const [email, setEmail] = useState('');
  const [inviteKind, setInviteKind] = useState<InviteKind>(() =>
    lockAlly || context === 'siep_project' ? 'ally' : 'employee',
  );
  const [jobTitle, setJobTitle] = useState('');
  const [accessUntil, setAccessUntil] = useState('');
  const [powerRole, setPowerRole] = useState<CompanyPowerRole>('COLLABORATOR');
  const [systems, setSystems] = useState<Record<WorkspaceSystemKey, boolean>>(() => {
    const init = Object.fromEntries(WORKSPACE_SYSTEM_KEYS.map((k) => [k, false])) as Record<
      WorkspaceSystemKey,
      boolean
    >;
    const defs = defaultSystemsForKind(lockAlly || context === 'siep_project' ? 'ally' : 'employee');
    for (const k of defs) init[k] = true;
    return init;
  });
  const [projectId, setProjectId] = useState(defaultProjectId || '');
  const [projects, setProjects] = useState<ProjectOpt[]>(
    defaultProjectId && defaultProjectName
      ? [{ id: defaultProjectId, name: defaultProjectName }]
      : [],
  );
  const [siepPerms, setSiepPerms] = useState<Record<string, boolean>>(() => {
    const keys = defaultSiepPermsForKind(lockAlly || context === 'siep_project' ? 'ally' : 'employee');
    const map: Record<string, boolean> = {};
    for (const g of getSiepPermissionGroups('es')) {
      for (const p of g.permissions) map[p.key] = keys.includes(p.key);
    }
    return map;
  });

  useEffect(() => {
    if (defaultCompanyId) setCompanyId(defaultCompanyId);
  }, [defaultCompanyId]);

  const loadProjects = useCallback(async () => {
    if (!companyId || (lockAlly && defaultProjectId)) return;
    try {
      const r = await fetch(`/api/projects?companyId=${encodeURIComponent(companyId)}`);
      const d = await r.json();
      const list = (d?.projects || d || []) as Array<{ id: string; name: string }>;
      if (Array.isArray(list)) {
        setProjects(list.map((p) => ({ id: p.id, name: p.name })));
      }
    } catch {
      /* ignore */
    }
  }, [companyId, lockAlly, defaultProjectId]);

  useEffect(() => {
    if (inviteKind === 'ally' && !lockAlly) void loadProjects();
  }, [inviteKind, loadProjects, lockAlly]);

  const selectedSystems = WORKSPACE_SYSTEM_KEYS.filter((k) => systems[k] && systemOptions.includes(k));
  const needsSiepDetail = selectedSystems.includes('SIEP') || inviteKind === 'ally';
  const selectedSiepKeys = Object.entries(siepPerms)
    .filter(([, v]) => v)
    .map(([k]) => k as SiepPermissionKey);

  const projectName =
    projects.find((p) => p.id === projectId)?.name || defaultProjectName || null;

  const applyKindDefaults = (kind: InviteKind) => {
    setInviteKind(kind);
    const defs = defaultSystemsForKind(kind);
    setSystems((prev) => {
      const next = { ...prev };
      for (const k of WORKSPACE_SYSTEM_KEYS) next[k] = defs.includes(k);
      return next;
    });
    const permKeys = defaultSiepPermsForKind(kind);
    setSiepPerms((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(next)) next[k] = permKeys.includes(k as SiepPermissionKey);
      return next;
    });
    if (kind !== 'temporary') setAccessUntil('');
    if (kind === 'ally') setPowerRole('COLLABORATOR');
  };

  const validateStep0 = (): string | null => {
    if (!companyId) return t('Escolha a empresa.', 'Elija la empresa.', 'Choose a company.');
    if (!email.includes('@')) return t('Email inválido.', 'Email inválido.', 'Invalid email.');
    if (inviteKind === 'temporary' && !accessUntil) {
      return t('Indique a data de fim.', 'Indique la fecha de fin.', 'Enter the end date.');
    }
    if (inviteKind === 'ally' && !projectId) {
      return t('Escolha o projecto.', 'Elija el proyecto.', 'Choose the project.');
    }
    return null;
  };

  const validateStep1 = (): string | null => {
    if (inviteKind === 'ally') return null;
    if (powerRole !== 'ADMIN' && selectedSystems.length === 0) {
      return t(
        'Marque pelo menos um sistema, ou Administrador.',
        'Marque al menos un sistema, o Administrador.',
        'Select at least one system, or Administrator.',
      );
    }
    return null;
  };

  const goNext = () => {
    setError(null);
    if (step === 0) {
      const err = validateStep0();
      if (err) {
        setError(err);
        return;
      }
      setStep(1);
      return;
    }
    if (step === 1) {
      const err = validateStep1();
      if (err) {
        setError(err);
        return;
      }
      setStep(needsSiepDetail ? 2 : 3);
      return;
    }
    if (step === 2) setStep(3);
  };

  const goBack = () => {
    setError(null);
    if (step === 3 && !needsSiepDetail) setStep(1);
    else setStep((s) => Math.max(0, s - 1));
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const body = {
        companyId,
        email: email.trim().toLowerCase(),
        inviteKind,
        jobTitle: jobTitle.trim() || undefined,
        role: inviteKind === 'ally' ? 'COLLABORATOR' : powerRole,
        accessUntil: inviteKind === 'temporary' ? accessUntil : null,
        systems: inviteKind === 'ally' ? ['SIEP'] : selectedSystems,
        projectId: inviteKind === 'ally' ? projectId : null,
        projectPermissions: inviteKind === 'ally' ? selectedSiepKeys : undefined,
        companySiepPermissions:
          inviteKind !== 'ally' && selectedSystems.includes('SIEP') ? selectedSiepKeys : undefined,
      };
      const r = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Error');
      onSuccess?.({
        code: d.invitation?.code,
        alreadyAccepted: d.invitation?.alreadyAccepted,
        email: email.trim().toLowerCase(),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(false);
    }
  };

  const kinds: InviteKind[] = lockAlly ? ['ally'] : ['employee', 'temporary', 'ally'];
  const stepLabels = [
    t('Vínculo', 'Vínculo', 'Link'),
    t('Sistemas', 'Sistemas', 'Systems'),
    t('SIEP', 'SIEP', 'SIEP'),
    t('Revisão', 'Revisión', 'Review'),
  ];
  const visibleSteps = needsSiepDetail || step >= 2 ? [0, 1, 2, 3] : [0, 1, 3];

  const summary = buildInviteSummaryLines(
    {
      email: email.trim() || '—',
      inviteKind,
      jobTitle,
      role: powerRole,
      accessUntil: accessUntil || null,
      systems: inviteKind === 'ally' ? ['SIEP'] : selectedSystems,
      projectName,
      siepPermCount: needsSiepDetail ? selectedSiepKeys.length : undefined,
    },
    loc,
  );

  return (
    <div className={cn('rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5', className)}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {visibleSteps.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && <span className="text-slate-300">/</span>}
            <span
              className={cn(
                'text-xs font-semibold uppercase tracking-wide',
                step === s ? 'text-teal-700' : 'text-slate-400',
              )}
            >
              {stepLabels[s]}
            </span>
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {step === 0 && (
        <div className="space-y-4">
          {!lockCompany && companies.length > 1 && (
            <label className="block text-sm">
              <span className="mb-1 flex items-center gap-1.5 font-medium text-slate-700">
                <Building2 className="h-3.5 w-3.5" />
                {t('Empresa', 'Empresa', 'Company')}
              </span>
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="block text-sm">
            <span className="mb-1 flex items-center gap-1.5 font-medium text-slate-700">
              <Mail className="h-3.5 w-3.5" />
              Email
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="pessoa@org.com"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>

          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">
              {t('Tipo de vínculo', 'Tipo de vínculo', 'Link type')}
            </p>
            <div className={cn('grid gap-2', kinds.length === 1 ? 'grid-cols-1' : 'sm:grid-cols-3')}>
              {kinds.map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => applyKindDefaults(kind)}
                  className={cn(
                    'rounded-xl border p-3 text-left transition',
                    inviteKind === kind
                      ? 'border-teal-500 bg-teal-50 ring-1 ring-teal-500'
                      : 'border-slate-200 hover:border-slate-300',
                  )}
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    {kind === 'employee' && <User className="h-4 w-4 text-teal-700" />}
                    {kind === 'temporary' && <Calendar className="h-4 w-4 text-amber-600" />}
                    {kind === 'ally' && <Users className="h-4 w-4 text-indigo-600" />}
                    {inviteKindLabel(kind, loc)}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{inviteKindHint(kind, loc)}</p>
                </button>
              ))}
            </div>
          </div>

          {(inviteKind === 'employee' || inviteKind === 'temporary') && (
            <label className="block text-sm">
              <span className="mb-1 flex items-center gap-1.5 font-medium text-slate-700">
                <Briefcase className="h-3.5 w-3.5" />
                {t('Cargo', 'Cargo', 'Job title')}
              </span>
              <input
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder={t(
                  'Ex.: Coordenador financeiro',
                  'Ej.: Coordinador financiero',
                  'e.g. Finance coordinator',
                )}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
          )}

          {inviteKind === 'temporary' && (
            <label className="block text-sm">
              <span className="mb-1 font-medium text-slate-700">
                {t('Acesso até', 'Acceso hasta', 'Access until')}
              </span>
              <input
                type="date"
                value={accessUntil}
                onChange={(e) => setAccessUntil(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
          )}

          {inviteKind === 'ally' && !lockAlly && (
            <label className="block text-sm">
              <span className="mb-1 font-medium text-slate-700">
                {t('Projecto', 'Proyecto', 'Project')}
              </span>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">—</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {inviteKind === 'ally' && lockAlly && projectName && (
            <p className="rounded-lg bg-indigo-50 px-3 py-2 text-sm text-indigo-900">
              {t('Projecto', 'Proyecto', 'Project')}: <strong>{projectName}</strong>
            </p>
          )}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          {inviteKind !== 'ally' ? (
            <>
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-slate-700">
                  <Shield className="h-3.5 w-3.5" />
                  {t('Poder na empresa', 'Poder en la empresa', 'Company power')}
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(
                    [
                      {
                        id: 'COLLABORATOR' as const,
                        label: t('Membro', 'Miembro', 'Member'),
                        hint: t(
                          'Usa só os sistemas marcados',
                          'Usa solo los sistemas marcados',
                          'Only marked systems',
                        ),
                      },
                      {
                        id: 'ADMIN' as const,
                        label: t('Administrador', 'Administrador', 'Administrator'),
                        hint: t(
                          'Hub completo + gerir acessos',
                          'Hub completo + gestionar accesos',
                          'Full Hub + manage access',
                        ),
                      },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setPowerRole(opt.id)}
                      className={cn(
                        'rounded-xl border p-3 text-left',
                        powerRole === opt.id
                          ? 'border-teal-500 bg-teal-50 ring-1 ring-teal-500'
                          : 'border-slate-200',
                      )}
                    >
                      <div className="text-sm font-semibold">{opt.label}</div>
                      <p className="mt-0.5 text-xs text-slate-500">{opt.hint}</p>
                    </button>
                  ))}
                </div>
              </div>

              {powerRole !== 'ADMIN' && (
                <div>
                  <p className="mb-2 text-sm font-medium text-slate-700">
                    {t('Sistemas', 'Sistemas', 'Systems')}
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {systemOptions.map((k) => (
                      <label key={k} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={!!systems[k]}
                          onChange={(e) => setSystems((s) => ({ ...s, [k]: e.target.checked }))}
                        />
                        {k}
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {powerRole === 'ADMIN' && (
                <p className="text-sm text-slate-600">
                  {t(
                    'Administradores têm Hub completo; sistemas individuais são opcionais.',
                    'Los administradores tienen Hub completo; sistemas individuales son opcionales.',
                    'Administrators get the full Hub; individual systems are optional.',
                  )}
                </p>
              )}
            </>
          ) : (
            <p className="rounded-lg bg-indigo-50 px-3 py-3 text-sm text-indigo-950">
              {t(
                'Aliado: acesso só a SIEP no projecto escolhido. Não entra como funcionário da empresa.',
                'Aliado: acceso solo a SIEP en el proyecto elegido. No entra como empleado.',
                'Ally: SIEP access only on the selected project. Not added as a company employee.',
              )}
            </p>
          )}
        </div>
      )}

      {step === 2 && needsSiepDetail && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            {t(
              'O que esta pessoa vê no SIEP (default fechado).',
              'Qué ve esta persona en SIEP (por defecto cerrado).',
              'What this person sees in SIEP (closed by default).',
            )}
          </p>
          {siepGroups.map((group) => (
            <div key={group.id}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-indigo-800">
                {group.label}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {group.permissions.map((p) => (
                  <label
                    key={p.key}
                    className="flex items-start gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-2 py-1.5 text-sm"
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={!!siepPerms[p.key]}
                      onChange={(e) =>
                        setSiepPerms((s) => ({ ...s, [p.key]: e.target.checked }))
                      }
                    />
                    <span>
                      <span className="font-medium text-slate-800">{p.label}</span>
                      {p.description && (
                        <span className="block text-xs text-slate-500">{p.description}</span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-800">
            {t('Resumo antes de enviar', 'Resumen antes de enviar', 'Review before sending')}
          </p>
          <ul className="space-y-1.5 rounded-xl border border-teal-200 bg-teal-50/50 p-4 text-sm text-teal-950">
            {summary.map((line) => (
              <li key={line} className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
        <div>
          {step > 0 ? (
            <button
              type="button"
              onClick={goBack}
              className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
            >
              <ArrowLeft className="h-4 w-4" />
              {t('Voltar', 'Volver', 'Back')}
            </button>
          ) : onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
            >
              {t('Cancelar', 'Cancelar', 'Cancel')}
            </button>
          ) : null}
        </div>
        <div>
          {step < 3 ? (
            <button
              type="button"
              onClick={goNext}
              className="inline-flex items-center gap-1 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
            >
              {t('Continuar', 'Continuar', 'Continue')}
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => void submit()}
              className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
            >
              {busy
                ? t('A enviar…', 'Enviando…', 'Sending…')
                : t('Enviar convite', 'Enviar invitación', 'Send invite')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
