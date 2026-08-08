/**
 * Identidade de acesso Etholys (edge-safe — sem Prisma).
 *
 * Duas camadas:
 * 1) Empresa cliente (+ CompanyUser) — admin da empresa ≠ dono da plataforma
 * 2) System admin — allowlist ETHOLYS_PLATFORM_ADMIN_EMAILS (master do master)
 *
 * Lab / MUSE / ANVIL = só system admin (+ convites Lab/ANVIL).
 */

import type { WorkspaceSystemKey } from '@/lib/integrated-workspace-shared';
import { LICENSE_KEY_TO_HREF } from '@/lib/hub-system-license';

/**
 * Bootstrap mínimo se o env estiver vazio.
 * NÃO meter aqui emails de admins de empresas clientes (ex.: Rural Commerce) —
 * system admin ≠ CompanyUser.role=ADMIN. Fonte de verdade: ETHOLYS_PLATFORM_ADMIN_EMAILS.
 */
const DEFAULT_SYSTEM_ADMINS = ['etholys@gmail.com'];

export function isPrecommercialMode(): boolean {
  const v = (process.env.ETHOLYS_PRECOMMERCIAL ?? process.env.NEXT_PUBLIC_ETHOLYS_PRECOMMERCIAL ?? '')
    .trim()
    .toLowerCase();
  if (v === '0' || v === 'false' || v === 'off' || v === 'no') return false;
  if (v === '1' || v === 'true' || v === 'on' || v === 'yes') return true;
  return process.env.NODE_ENV === 'production';
}

export function parseSystemAdminEmails(): string[] {
  const raw = process.env.ETHOLYS_PLATFORM_ADMIN_EMAILS?.trim() || '';
  const fromEnv = raw
    .split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes('@'));
  // Env definido → só env (evita elevar emails de cliente por default hardcoded).
  if (fromEnv.length > 0) return [...new Set(fromEnv)];
  return [...DEFAULT_SYSTEM_ADMINS];
}

/** @deprecated use parseSystemAdminEmails */
export function parsePlatformAdminEmails(): string[] {
  return parseSystemAdminEmails();
}

/** Administrador do sistema Etholys (master). Só email allowlist — NÃO User.role. */
export function isSystemAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return parseSystemAdminEmails().includes(email.trim().toLowerCase());
}

/** @deprecated use isSystemAdmin */
export function isPlatformAdminEmail(email: string | null | undefined): boolean {
  return isSystemAdmin(email);
}

/**
 * Acesso completo de plataforma (Hub sem restrição pré-comercial, Lab factory, …).
 * Apenas system admin por email. User.role=ADMIN = admin de *alguma* conta, não isto.
 */
export function isPlatformFullAccess(opts: {
  email?: string | null;
  /** Ignorado — mantido por compat de call sites. */
  role?: string | null;
}): boolean {
  return isSystemAdmin(opts.email);
}

export type WorkspaceAccessMode = 'full' | 'function_only' | 'none';

export function homePathForSystems(systems: WorkspaceSystemKey[]): string {
  if (systems.length === 0) return '/acesso';
  if (systems.length === 1) return LICENSE_KEY_TO_HREF[systems[0]] || '/acesso';
  return '/acesso';
}

export function pagePrefixesForSystem(system: WorkspaceSystemKey): string[] {
  switch (system) {
    case 'ATLAS':
      return [
        '/dashboard',
        '/tasks',
        '/reports',
        '/settings',
        '/team',
        '/templates',
        '/finance',
        '/invoices',
        '/suppliers',
        '/hr',
        '/inventory',
        '/clients',
        '/planning',
        '/calculator',
        '/documents',
        '/chat',
        '/onboarding',
      ];
    case 'SIEP':
      return ['/siep'];
    case 'FUNDHUB':
      return ['/hub/fundhub', '/fundhub'];
    case 'NEXUS':
      return ['/hub/nexus'];
    case 'FORGE':
      return ['/hub/forge', '/expedicion', '/verificar-forge'];
    case 'PRISM':
      return ['/hub/prism'];
    default:
      return [];
  }
}

export function isPathAllowedForSystems(pathname: string, systems: WorkspaceSystemKey[]): boolean {
  if (pathname === '/acesso' || pathname.startsWith('/acesso/')) return true;
  if (pathname === '/login' || pathname.startsWith('/login/')) return true;
  if (pathname.startsWith('/api/auth')) return true;

  for (const sys of systems) {
    for (const prefix of pagePrefixesForSystem(sys)) {
      if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return true;
    }
  }
  return false;
}

export function isHubShellPath(pathname: string): boolean {
  if (pathname === '/hub' || pathname === '/hub/') return true;
  if (pathname === '/hub/workspace' || pathname.startsWith('/hub/workspace/')) return true;
  if (pathname === '/hub/admin' || pathname.startsWith('/hub/admin/')) return true;
  if (pathname === '/hub/setup' || pathname.startsWith('/hub/setup/')) return true;
  if (pathname === '/hub/meet' || pathname.startsWith('/hub/meet/')) return true;
  if (pathname === '/hub/carta' || pathname.startsWith('/hub/carta/')) return true;
  if (pathname === '/hub/advisor' || pathname.startsWith('/hub/advisor/')) return true;
  if (pathname === '/hub/work' || pathname.startsWith('/hub/work/')) return true;
  return false;
}
