import type { WorkspaceSystemKey } from '@/lib/integrated-workspace-shared';

/** Prefixos de API protegidos por licença de sistema. Ordem: mais específico primeiro. */
const API_LICENSE_RULES: Array<{
  match: (pathname: string) => boolean;
  system: WorkspaceSystemKey;
}> = [
  {
    match: (p) => p.startsWith('/api/company-memory/prism-ledger'),
    system: 'PRISM',
  },
  {
    match: (p) => p.startsWith('/api/nexus'),
    system: 'NEXUS',
  },
  {
    match: (p) =>
      p.startsWith('/api/proposals') ||
      p.startsWith('/api/funds') ||
      p.startsWith('/api/fundhub'),
    system: 'FUNDHUB',
  },
  {
    match: (p) =>
      p.startsWith('/api/projects') ||
      p.startsWith('/api/activity-reports') ||
      p.startsWith('/api/stakeholders') ||
      p.startsWith('/api/stakeholder-interactions') ||
      p.startsWith('/api/siep') ||
      p.startsWith('/api/import'),
    system: 'SIEP',
  },
  {
    match: (p) => matchForgeOrgApi(p),
    system: 'FORGE',
  },
  {
    match: (p) =>
      p.startsWith('/api/tasks') ||
      p.startsWith('/api/transactions') ||
      p.startsWith('/api/invoices') ||
      p.startsWith('/api/inventory') ||
      p.startsWith('/api/stock-movements') ||
      p.startsWith('/api/departments') ||
      p.startsWith('/api/roles') ||
      p.startsWith('/api/finance') ||
      p.startsWith('/api/budgets') ||
      p.startsWith('/api/suppliers') ||
      p.startsWith('/api/clients') ||
      p.startsWith('/api/hr') ||
      p.startsWith('/api/time-entries') ||
      p.startsWith('/api/leave-requests') ||
      p.startsWith('/api/checklist') ||
      p.startsWith('/api/comments') ||
      p.startsWith('/api/task-templates') ||
      p.startsWith('/api/task-dependencies'),
    system: 'ATLAS',
  },
];

const FORGE_LEARNER_OR_PUBLIC_SEGMENTS = [
  '/my-journey',
  '/invite/',
  '/invite-',
  '/certificates/verify/',
  '/play-groups/join',
  '/progress/complete',
  '/shared-game-rooms',
  '/game-sessions',
  '/health',
  '/cron/',
  '/e2e/',
  '/seed-demo',
  '/seed-expedicion',
  '/libro/expedicion',
  '/access-context',
  '/my-programs',
  '/my-account',
  '/leaderboard',
  '/notify-learners',
];

const FORGE_ORG_PREFIXES = [
  '/api/forge/overview',
  '/api/forge/programs',
  '/api/forge/at-risk-summary',
  '/api/forge/courses',
  '/api/forge/modules',
  '/api/forge/activities',
  '/api/forge/game-specs',
  '/api/forge/games/',
  '/api/forge/enrollments',
  '/api/forge/certificates',
  '/api/forge/live-sessions',
  '/api/forge/play-groups',
];

function matchForgeOrgApi(pathname: string): boolean {
  if (!pathname.startsWith('/api/forge')) return false;
  if (FORGE_LEARNER_OR_PUBLIC_SEGMENTS.some((seg) => pathname.includes(seg))) return false;
  return FORGE_ORG_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function apiPathToLicensedSystem(pathname: string): WorkspaceSystemKey | null {
  for (const rule of API_LICENSE_RULES) {
    if (rule.match(pathname)) return rule.system;
  }
  return null;
}

/** Rotas de API sempre isentas (core Etholys, auth, gestão de licenças). */
export function isApiLicenseExempt(pathname: string): boolean {
  if (!pathname.startsWith('/api/')) return true;
  return (
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/signup') ||
    pathname.startsWith('/api/internal/') ||
    pathname.startsWith('/api/workspace/access') ||
    pathname.startsWith('/api/workspace/entry-route') ||
    pathname.startsWith('/api/companies') ||
    pathname.startsWith('/api/notifications') ||
    pathname.startsWith('/api/chat') ||
    pathname.startsWith('/api/users/me') ||
    pathname.startsWith('/api/public/') ||
    pathname === '/api/health'
  );
}
