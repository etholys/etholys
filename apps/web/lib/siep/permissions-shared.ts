/**
 * Permissões SIEP — tipos e helpers seguros para cliente e servidor.
 */

import type { Locale } from '@/lib/i18n';
import { SIEP_PERM_GROUP_I18N, SIEP_PERM_I18N, siepT } from '@/lib/siep/i18n';
import type { BuiltInInformeDomain, InformeDomain } from '@/lib/siep/informe-domains';

export type SiepPermissionKey =
  | 'siep.project.view'
  | 'siep.project.edit'
  | 'siep.budget.view_lines'
  | 'siep.budget.view_amounts'
  | 'siep.budget.view_project_total'
  | 'siep.budget.edit'
  | 'siep.transactions.view'
  | 'siep.transactions.view_amounts'
  | 'siep.transactions.edit'
  | 'siep.logframe.view'
  | 'siep.logframe.edit'
  | 'siep.tasks.view'
  | 'siep.tasks.edit'
  /** @deprecated Use view_narrative / view_me / view_budget / view_field — expandido em parseSiepPermissions */
  | 'siep.reports.view'
  | 'siep.reports.view_narrative'
  | 'siep.reports.view_me'
  | 'siep.reports.view_budget'
  | 'siep.reports.view_field'
  | 'siep.reports.edit'
  | 'siep.activities.report'
  | 'siep.activities.view_all_reports'
  | 'siep.activities.approve_reports'
  | 'siep.team.view'
  | 'siep.team.manage_members'
  | 'siep.team.manage_permissions';

export type SiepPermissionGroup = {
  id: string;
  label: string;
  permissions: { key: SiepPermissionKey; label: string; description?: string }[];
};

export const INFORME_DOMAIN_VIEW_PERMISSION: Record<BuiltInInformeDomain, SiepPermissionKey> = {
  narrative: 'siep.reports.view_narrative',
  me: 'siep.reports.view_me',
  budget: 'siep.reports.view_budget',
  field: 'siep.reports.view_field',
};

export const ALL_INFORME_DOMAIN_VIEW_PERMISSIONS: SiepPermissionKey[] = [
  'siep.reports.view_narrative',
  'siep.reports.view_me',
  'siep.reports.view_budget',
  'siep.reports.view_field',
];

const SIEP_PERMISSION_STRUCTURE: { id: string; permissions: SiepPermissionKey[] }[] = [
  {
    id: 'project',
    permissions: ['siep.project.view', 'siep.project.edit', 'siep.budget.view_project_total'],
  },
  {
    id: 'budget',
    permissions: [
      'siep.budget.view_lines',
      'siep.budget.view_amounts',
      'siep.budget.edit',
      'siep.transactions.view',
      'siep.transactions.view_amounts',
      'siep.transactions.edit',
    ],
  },
  {
    id: 'content',
    permissions: [
      'siep.logframe.view',
      'siep.logframe.edit',
      'siep.tasks.view',
      'siep.tasks.edit',
      'siep.reports.view_narrative',
      'siep.reports.view_me',
      'siep.reports.view_budget',
      'siep.reports.view_field',
      'siep.reports.edit',
    ],
  },
  {
    id: 'activities',
    permissions: [
      'siep.activities.report',
      'siep.activities.view_all_reports',
      'siep.activities.approve_reports',
    ],
  },
  {
    id: 'admin',
    permissions: ['siep.team.view', 'siep.team.manage_members', 'siep.team.manage_permissions'],
  },
];

export function getSiepPermissionGroups(locale: Locale = 'es'): SiepPermissionGroup[] {
  return SIEP_PERMISSION_STRUCTURE.map((g) => ({
    id: g.id,
    label: siepT(SIEP_PERM_GROUP_I18N[g.id] ?? g.id, locale),
    permissions: g.permissions.map((key) => {
      const i18n = SIEP_PERM_I18N[key];
      return {
        key,
        label: siepT(i18n?.label ?? key, locale),
        description: i18n?.desc ? siepT(i18n.desc, locale) : undefined,
      };
    }),
  }));
}

/** @deprecated Use getSiepPermissionGroups(locale) — defaults to Spanish */
export const SIEP_PERMISSION_GROUPS: SiepPermissionGroup[] = getSiepPermissionGroups('es');

export const ALL_SIEP_PERMISSIONS: SiepPermissionKey[] = [
  ...SIEP_PERMISSION_GROUPS.flatMap((g) => g.permissions.map((p) => p.key)),
  // legado (não aparece na UI, mas parseia e expande)
  'siep.reports.view',
];

/** Perfil técnico de terreno: M&E + actividades + reportes de avance (sem finanzas / informes al donante). */
export const FIELD_TECHNICIAN_PERMISSIONS: SiepPermissionKey[] = [
  'siep.project.view',
  'siep.logframe.view',
  'siep.tasks.view',
  'siep.activities.report',
];

/** Perfil por defeito para colaborador de campo (empresa). */
export const DEFAULT_FIELD_PERMISSIONS: SiepPermissionKey[] = [
  ...FIELD_TECHNICIAN_PERMISSIONS,
  'siep.team.view',
];

/** Perfil gestor de projecto. */
export const DEFAULT_PM_PERMISSIONS: SiepPermissionKey[] = [
  ...ALL_SIEP_PERMISSIONS.filter(
    (k) => k !== 'siep.team.manage_permissions' && k !== 'siep.reports.view',
  ),
];

/** Perfil mínimo para convidado externo só de projecto (técnico). */
export const DEFAULT_PROJECT_GUEST_PERMISSIONS: SiepPermissionKey[] = [
  ...FIELD_TECHNICIAN_PERMISSIONS,
];

function expandLegacyKeys(keys: SiepPermissionKey[]): SiepPermissionKey[] {
  const set = new Set(keys);
  if (set.has('siep.reports.view')) {
    for (const k of ALL_INFORME_DOMAIN_VIEW_PERMISSIONS) set.add(k);
  }
  return [...set];
}

export function parseSiepPermissions(raw: unknown): SiepPermissionKey[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    const filtered = raw.filter((k): k is SiepPermissionKey =>
      typeof k === 'string' && ALL_SIEP_PERMISSIONS.includes(k as SiepPermissionKey),
    );
    return expandLegacyKeys(filtered);
  }
  return [];
}

export function hasSiepPermission(
  permissions: Set<string> | string[],
  key: SiepPermissionKey,
): boolean {
  const set = permissions instanceof Set ? permissions : new Set(permissions);
  if (set.has(key)) return true;
  // Legado: siep.reports.view cobre qualquer domínio
  if (
    key.startsWith('siep.reports.view_') &&
    set.has('siep.reports.view')
  ) {
    return true;
  }
  return false;
}

export function canViewInformeDomain(
  permissions: Set<string> | string[],
  domain: InformeDomain | string,
): boolean {
  const set = permissions instanceof Set ? permissions : new Set(permissions);
  if (set.has('siep.reports.view') || set.has('siep.reports.edit')) return true;
  if (typeof domain === 'string' && domain.startsWith('custom:')) {
    // Tipos custom: qualquer visão de informe ao doador (excepto só field-tech sem reports.*)
    return ALL_INFORME_DOMAIN_VIEW_PERMISSIONS.some((k) => set.has(k));
  }
  const builtIn = domain as BuiltInInformeDomain;
  const key = INFORME_DOMAIN_VIEW_PERMISSION[builtIn];
  return key ? set.has(key) : false;
}

export function canViewAnyDonorInforme(permissions: Set<string> | string[]): boolean {
  const set = permissions instanceof Set ? permissions : new Set(permissions);
  if (set.has('siep.reports.view') || set.has('siep.reports.edit')) return true;
  return ALL_INFORME_DOMAIN_VIEW_PERMISSIONS.some((k) => set.has(k));
}

export function canAccessReportsTab(permissions: Set<string> | string[]): boolean {
  const set = permissions instanceof Set ? permissions : new Set(permissions);
  return (
    canViewAnyDonorInforme(set) ||
    set.has('siep.activities.report') ||
    set.has('siep.activities.view_all_reports') ||
    set.has('siep.activities.approve_reports')
  );
}

export function permissionsToApi(perms: Set<SiepPermissionKey>) {
  return {
    permissions: Array.from(perms),
    canViewBudgetAmounts: perms.has('siep.budget.view_amounts'),
    canViewProjectTotal: perms.has('siep.budget.view_project_total'),
    canViewTransactions: perms.has('siep.transactions.view'),
    canViewTransactionAmounts: perms.has('siep.transactions.view_amounts'),
    canEditBudget: perms.has('siep.budget.edit'),
    canEditProject: perms.has('siep.project.edit'),
    canEditLogframe: perms.has('siep.logframe.edit'),
    canEditTasks: perms.has('siep.tasks.edit'),
    canEditReports: perms.has('siep.reports.edit'),
    canViewReportNarrative: canViewInformeDomain(perms, 'narrative'),
    canViewReportMe: canViewInformeDomain(perms, 'me'),
    canViewReportBudget: canViewInformeDomain(perms, 'budget'),
    canViewReportField: canViewInformeDomain(perms, 'field'),
    canViewAnyDonorInforme: canViewAnyDonorInforme(perms),
    canAccessReportsTab: canAccessReportsTab(perms),
    canReportActivities: perms.has('siep.activities.report'),
    canApproveReports: perms.has('siep.activities.approve_reports'),
    canViewAllReports: perms.has('siep.activities.view_all_reports'),
    canManageMembers: perms.has('siep.team.manage_members'),
    canManagePermissions: perms.has('siep.team.manage_permissions'),
  };
}
