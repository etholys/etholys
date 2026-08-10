/**
 * Guard edge-safe para convidados só de projeto SIEP (project_guest).
 * Sem Prisma — usado no middleware.
 *
 * Estes utilizadores NÃO são CompanyUser: só vêem os projetos convidados
 * e as funções SIEP seleccionadas. Zero Hub / ATLAS / FORGE / Meet / etc.
 */

export function isProjectGuestPublicOrAuthPage(pathname: string): boolean {
  if (pathname === '/login' || pathname.startsWith('/login/')) return true;
  if (pathname.startsWith('/api/auth')) return true;
  return false;
}

/**
 * Páginas permitidas: lista de projetos convidados + detalhe/gantt desses projetos.
 * Qualquer /hub, /siep (portfolio, stakeholders…), lab, studio, work → bloqueado.
 */
export function isPageAllowedForProjectGuest(
  pathname: string,
  allowedProjectIds: string[],
): boolean {
  if (isProjectGuestPublicOrAuthPage(pathname)) return true;

  if (pathname === '/siep/projects' || pathname === '/siep/projects/') return true;

  const detail = pathname.match(/^\/siep\/projects\/([^/]+)(?:\/.*)?$/);
  if (detail) {
    const projectId = detail[1];
    // Se o JWT ainda não tem IDs (race), deixar a API validar; senão exigir match.
    if (!allowedProjectIds.length) return true;
    return allowedProjectIds.includes(projectId);
  }

  return false;
}

/**
 * APIs necessárias ao SIEP de projeto. Tudo o resto → 403.
 * A autorização fina (permissões por função) fica nas rotas com resolveProjectAccess.
 */
export function isApiAllowedForProjectGuest(pathname: string): boolean {
  if (!pathname.startsWith('/api/')) return true;
  if (pathname.startsWith('/api/auth')) return true;
  if (pathname === '/api/internal/siep-scope') return true;
  if (pathname === '/api/workspace/entry-route') return true;
  if (pathname === '/api/users/me') return true;
  if (pathname.startsWith('/api/notifications')) return true;

  // SIEP / projeto
  if (pathname.startsWith('/api/projects')) return true;
  if (pathname.startsWith('/api/members')) return true;
  if (pathname.startsWith('/api/tasks')) return true;
  if (pathname.startsWith('/api/milestones')) return true;
  if (pathname.startsWith('/api/objectives')) return true;
  if (pathname.startsWith('/api/budget-lines')) return true;
  if (pathname.startsWith('/api/indicator-measurements')) return true;
  if (pathname.startsWith('/api/activity-reports')) return true;
  if (pathname.startsWith('/api/task-dependencies')) return true;
  if (pathname.startsWith('/api/sow')) return true;
  if (pathname.startsWith('/api/me-reports')) return true;
  if (pathname.startsWith('/api/siep')) return true;
  if (pathname.startsWith('/api/risks')) return true;
  if (pathname.startsWith('/api/sync-project-budget')) return true;
  if (pathname.startsWith('/api/import')) return true;

  // Upload de anexos de informes / actividades (sem abrir o resto do storage)
  if (pathname.startsWith('/api/upload')) return true;

  return false;
}

export function defaultProjectGuestHome(allowedProjectIds: string[]): string {
  if (allowedProjectIds.length === 1) {
    return `/siep/projects/${allowedProjectIds[0]}`;
  }
  return '/siep/projects';
}
