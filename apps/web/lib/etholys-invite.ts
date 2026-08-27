/**
 * Convite Etholys unificado — tipos e defaults partilhados (cliente + servidor).
 */

import {
  DEFAULT_FIELD_PERMISSIONS,
  DEFAULT_PROJECT_GUEST_PERMISSIONS,
  parseSiepPermissions,
  type SiepPermissionKey,
} from '@/lib/siep/permissions-shared';
import {
  WORKSPACE_SYSTEM_KEYS,
  normalizeSystemsInput,
  type WorkspaceSystemKey,
} from '@/lib/integrated-workspace-shared';
import type { Locale } from '@/lib/i18n';

export const INVITE_KINDS = ['employee', 'temporary', 'ally'] as const;
export type InviteKind = (typeof INVITE_KINDS)[number];

export type CompanyPowerRole = 'COLLABORATOR' | 'ADMIN';

export type EtholysInvitePayload = {
  companyId: string;
  email: string;
  inviteKind: InviteKind;
  /** Cargo (funcionário / temporário) */
  jobTitle?: string;
  /** Poder na empresa: Membro ou Administrador */
  role?: CompanyPowerRole;
  accessUntil?: string | null;
  systems?: WorkspaceSystemKey[];
  projectId?: string | null;
  projectPermissions?: SiepPermissionKey[];
  companySiepPermissions?: SiepPermissionKey[];
};

export type InviteEntryContext = 'admin' | 'workspace' | 'siep_project';

export function isInviteKind(v: unknown): v is InviteKind {
  return typeof v === 'string' && (INVITE_KINDS as readonly string[]).includes(v);
}

export function normalizeInviteKind(v: unknown): InviteKind {
  if (isInviteKind(v)) return v;
  return 'employee';
}

export function inviteKindLabel(kind: InviteKind, locale: Locale = 'es'): string {
  const map: Record<InviteKind, Record<Locale, string>> = {
    employee: { pt: 'Funcionário interno', es: 'Empleado interno', en: 'Internal employee' },
    temporary: { pt: 'Temporário / consultor', es: 'Temporal / consultor', en: 'Temporary / consultant' },
    ally: { pt: 'Aliado / externo', es: 'Aliado / externo', en: 'Ally / external' },
  };
  return map[kind][locale] ?? map[kind].es;
}

export function inviteKindHint(kind: InviteKind, locale: Locale = 'es'): string {
  const map: Record<InviteKind, Record<Locale, string>> = {
    employee: {
      pt: 'Membro da empresa. Só vê os sistemas que marcar.',
      es: 'Miembro de la empresa. Solo ve los sistemas que marque.',
      en: 'Company member. Only sees the systems you select.',
    },
    temporary: {
      pt: 'Membro com data de fim. Sem Hub completo (salvo Admin).',
      es: 'Miembro con fecha de fin. Sin Hub completo (salvo Admin).',
      en: 'Member with end date. No full Hub (unless Admin).',
    },
    ally: {
      pt: 'Só no projeto escolhido. Não entra como funcionário.',
      es: 'Solo en el proyecto elegido. No entra como empleado.',
      en: 'Only on the selected project. Not a company employee.',
    },
  };
  return map[kind][locale] ?? map[kind].es;
}

export function defaultSystemsForKind(kind: InviteKind): WorkspaceSystemKey[] {
  if (kind === 'ally') return ['SIEP'];
  return [];
}

export function defaultSiepPermsForKind(kind: InviteKind): SiepPermissionKey[] {
  if (kind === 'ally') return [...DEFAULT_PROJECT_GUEST_PERMISSIONS];
  return [...DEFAULT_FIELD_PERMISSIONS];
}

export function buildInviteSummaryLines(
  payload: {
    email: string;
    inviteKind: InviteKind;
    jobTitle?: string;
    role?: string;
    accessUntil?: string | null;
    systems: string[];
    projectName?: string | null;
    siepPermCount?: number;
  },
  locale: Locale = 'es',
): string[] {
  const lines: string[] = [];
  const kind = inviteKindLabel(payload.inviteKind, locale);
  lines.push(`${payload.email} — ${kind}`);
  if (payload.jobTitle?.trim()) {
    lines.push(
      locale === 'pt' ? `Cargo: ${payload.jobTitle}` : locale === 'en' ? `Title: ${payload.jobTitle}` : `Cargo: ${payload.jobTitle}`,
    );
  }
  if (payload.inviteKind !== 'ally') {
    const power =
      payload.role === 'ADMIN'
        ? locale === 'pt'
          ? 'Administrador (Hub completo)'
          : locale === 'en'
            ? 'Administrator (full Hub)'
            : 'Administrador (Hub completo)'
        : locale === 'pt'
          ? 'Membro (sem Hub completo)'
          : locale === 'en'
            ? 'Member (no full Hub)'
            : 'Miembro (sin Hub completo)';
    lines.push(power);
  }
  if (payload.inviteKind === 'temporary' && payload.accessUntil) {
    lines.push(
      locale === 'pt'
        ? `Acesso até: ${payload.accessUntil}`
        : locale === 'en'
          ? `Access until: ${payload.accessUntil}`
          : `Acceso hasta: ${payload.accessUntil}`,
    );
  }
  if (payload.inviteKind === 'ally' && payload.projectName) {
    lines.push(
      locale === 'pt'
        ? `Projecto: ${payload.projectName}`
        : locale === 'en'
          ? `Project: ${payload.projectName}`
          : `Proyecto: ${payload.projectName}`,
    );
  }
  if (payload.systems.length) {
    lines.push(`Sistemas: ${payload.systems.join(', ')}`);
  } else if (payload.inviteKind !== 'ally' && payload.role !== 'ADMIN') {
    lines.push(
      locale === 'pt'
        ? 'Sistemas: nenhum (não verá módulos até atribuir)'
        : locale === 'en'
          ? 'Systems: none (no modules until granted)'
          : 'Sistemas: ninguno (no verá módulos hasta asignar)',
    );
  }
  if (payload.systems.includes('SIEP') && typeof payload.siepPermCount === 'number') {
    lines.push(
      locale === 'pt'
        ? `Permissões SIEP: ${payload.siepPermCount} activas`
        : locale === 'en'
          ? `SIEP permissions: ${payload.siepPermCount} active`
          : `Permisos SIEP: ${payload.siepPermCount} activos`,
    );
  }
  return lines;
}

export function validateInvitePayload(raw: EtholysInvitePayload): { ok: true; data: EtholysInvitePayload } | { ok: false; error: string } {
  const companyId = String(raw.companyId || '').trim();
  const email = String(raw.email || '').trim().toLowerCase();
  const inviteKind = normalizeInviteKind(raw.inviteKind);
  if (!companyId || !email.includes('@')) {
    return { ok: false, error: 'companyId y email válidos requeridos' };
  }

  const jobTitle = raw.jobTitle?.trim() || undefined;
  const role: CompanyPowerRole = raw.role === 'ADMIN' ? 'ADMIN' : 'COLLABORATOR';
  let systems = normalizeSystemsInput(raw.systems);
  let projectId = raw.projectId?.trim() || null;
  let accessUntil = raw.accessUntil?.trim() || null;
  let projectPermissions = parseSiepPermissions(raw.projectPermissions);
  let companySiepPermissions = parseSiepPermissions(raw.companySiepPermissions);

  if (inviteKind === 'ally') {
    if (!projectId) {
      return { ok: false, error: 'Aliado requiere un proyecto (projectId).' };
    }
    systems = systems.length ? systems : ['SIEP'];
    if (!systems.includes('SIEP')) systems = ['SIEP', ...systems];
    if (projectPermissions.length === 0) {
      projectPermissions = [...DEFAULT_PROJECT_GUEST_PERMISSIONS];
    }
    return {
      ok: true,
      data: {
        companyId,
        email,
        inviteKind,
        jobTitle,
        role: 'COLLABORATOR',
        systems,
        projectId,
        projectPermissions,
        companySiepPermissions: undefined,
        accessUntil: null,
      },
    };
  }

  if (inviteKind === 'temporary') {
    if (!accessUntil) {
      return { ok: false, error: 'Temporal requiere fecha de fin (accessUntil).' };
    }
    const until = new Date(accessUntil);
    if (Number.isNaN(until.getTime()) || until.getTime() < Date.now()) {
      return { ok: false, error: 'accessUntil inválida o en el pasado.' };
    }
  } else {
    accessUntil = null;
  }

  // Admin de empresa: sistemas opcionais (Hub completo)
  if (role !== 'ADMIN' && systems.length === 0) {
    return { ok: false, error: 'Seleccione al menos un sistema, o marque Administrador.' };
  }

  if (systems.includes('SIEP') && companySiepPermissions.length === 0) {
    companySiepPermissions = [...DEFAULT_FIELD_PERMISSIONS];
  }
  if (!systems.includes('SIEP')) {
    companySiepPermissions = [];
  }

  return {
    ok: true,
    data: {
      companyId,
      email,
      inviteKind,
      jobTitle,
      role,
      accessUntil,
      systems,
      projectId: null,
      projectPermissions: undefined,
      companySiepPermissions: companySiepPermissions.length ? companySiepPermissions : undefined,
    },
  };
}

export { WORKSPACE_SYSTEM_KEYS };
