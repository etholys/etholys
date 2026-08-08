/**
 * Acesso pré-comercial Etholys (edge-safe — sem Prisma).
 * Em produção: só platform admins vêem hub/home completa;
 * convidados entram só nas funções (sistemas) concedidas.
 */

import type { WorkspaceSystemKey } from '@/lib/integrated-workspace-shared';
import { LICENSE_KEY_TO_HREF } from '@/lib/hub-system-license';

/** Default: tiago + emails em ETHOLYS_PLATFORM_ADMIN_EMAILS */
const DEFAULT_PLATFORM_ADMINS = ['tiagorezende@ruralcommerceglobal.com'];

export function isPrecommercialMode(): boolean {
  const v = (process.env.ETHOLYS_PRECOMMERCIAL ?? process.env.NEXT_PUBLIC_ETHOLYS_PRECOMMERCIAL ?? '')
    .trim()
    .toLowerCase();
  if (v === '0' || v === 'false' || v === 'off' || v === 'no') return false;
  if (v === '1' || v === 'true' || v === 'on' || v === 'yes') return true;
  // Sem flag: fechar em produção, abrir em local
  return process.env.NODE_ENV === 'production';
}

export function parsePlatformAdminEmails(): string[] {
  const raw = process.env.ETHOLYS_PLATFORM_ADMIN_EMAILS?.trim() || '';
  const fromEnv = raw
    .split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes('@'));
  const set = new Set([...DEFAULT_PLATFORM_ADMINS, ...fromEnv]);
  return [...set];
}

export function isPlatformAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return parsePlatformAdminEmails().includes(email.trim().toLowerCase());
}

/** User.role global ADMIN ou email allowlist. */
export function isPlatformFullAccess(opts: {
  email?: string | null;
  role?: string | null;
}): boolean {
  if (opts.role === 'ADMIN') return true;
  return isPlatformAdminEmail(opts.email);
}

export type WorkspaceAccessMode = 'full' | 'function_only' | 'none';

export function homePathForSystems(systems: WorkspaceSystemKey[]): string {
  if (systems.length === 0) return '/acesso';
  if (systems.length === 1) return LICENSE_KEY_TO_HREF[systems[0]] || '/acesso';
  return '/acesso';
}

/** Prefixos de página permitidos por sistema (function_only). */
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

/** Hub root e cartões isentos (Meet/Carta/Advisor). Studio tem regra própria no middleware (atalho). */
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
