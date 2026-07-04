/**
 * Permissões SIEP — tipos e helpers seguros para cliente e servidor.
 */

import type { Locale } from '@/lib/i18n';
import { SIEP_PERM_GROUP_I18N, SIEP_PERM_I18N, siepT } from '@/lib/siep/i18n';

export type SiepPermissionKey =
  | 'siep.project.view'
  | 'siep.budget.view_lines'
  | 'siep.budget.view_amounts'
  | 'siep.budget.view_project_total'
  | 'siep.transactions.view'
  | 'siep.transactions.view_amounts'
  | 'siep.activities.report'
  | 'siep.activities.view_all_reports'
  | 'siep.activities.approve_reports'
  | 'siep.team.manage_permissions';

export type SiepPermissionGroup = {
  id: string;
  label: string;
  permissions: { key: SiepPermissionKey; label: string; description?: string }[];
};

const SIEP_PERMISSION_STRUCTURE: { id: string; permissions: SiepPermissionKey[] }[] = [
  { id: 'project', permissions: ['siep.project.view', 'siep.budget.view_project_total'] },
  {
    id: 'budget',
    permissions: [
      'siep.budget.view_lines',
      'siep.budget.view_amounts',
      'siep.transactions.view',
      'siep.transactions.view_amounts',
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
  { id: 'admin', permissions: ['siep.team.manage_permissions'] },
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

export const ALL_SIEP_PERMISSIONS: SiepPermissionKey[] = SIEP_PERMISSION_GROUPS.flatMap((g) =>
  g.permissions.map((p) => p.key),
);

/** Perfil por defeito para colaborador de campo. */
export const DEFAULT_FIELD_PERMISSIONS: SiepPermissionKey[] = [
  'siep.project.view',
  'siep.budget.view_lines',
  'siep.activities.report',
];

/** Perfil gestor de projecto. */
export const DEFAULT_PM_PERMISSIONS: SiepPermissionKey[] = [
  ...ALL_SIEP_PERMISSIONS.filter((k) => k !== 'siep.team.manage_permissions'),
];

export function parseSiepPermissions(raw: unknown): SiepPermissionKey[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.filter((k): k is SiepPermissionKey =>
      typeof k === 'string' && ALL_SIEP_PERMISSIONS.includes(k as SiepPermissionKey),
    );
  }
  return [];
}

export function hasSiepPermission(
  permissions: Set<string> | string[],
  key: SiepPermissionKey,
): boolean {
  const set = permissions instanceof Set ? permissions : new Set(permissions);
  return set.has(key);
}

export function permissionsToApi(perms: Set<SiepPermissionKey>) {
  return {
    permissions: Array.from(perms),
    canViewBudgetAmounts: perms.has('siep.budget.view_amounts'),
    canViewProjectTotal: perms.has('siep.budget.view_project_total'),
    canViewTransactions: perms.has('siep.transactions.view'),
    canViewTransactionAmounts: perms.has('siep.transactions.view_amounts'),
    canReportActivities: perms.has('siep.activities.report'),
    canApproveReports: perms.has('siep.activities.approve_reports'),
    canViewAllReports: perms.has('siep.activities.view_all_reports'),
  };
}
