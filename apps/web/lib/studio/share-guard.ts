/**
 * Guard edge-safe para convidados Studio (acesso só ao partilhado).
 */

export type StudioShareTargetRef = {
  type: 'folder' | 'document';
  id: string;
};

export function isStudioShareOnlyPublicOrAuthPage(pathname: string): boolean {
  if (pathname === '/login' || pathname.startsWith('/login/')) return true;
  if (pathname.startsWith('/api/auth')) return true;
  if (pathname === '/studio/shared' || pathname.startsWith('/studio/shared/')) return true;
  return false;
}

export function isPageAllowedForStudioShareOnly(
  pathname: string,
  targets: StudioShareTargetRef[],
): boolean {
  if (isStudioShareOnlyPublicOrAuthPage(pathname)) return true;

  // Lista das partilhas do convidado
  if (pathname === '/studio' || pathname === '/studio/') return true;

  // Documentos: a API valida acesso real (inclui docs criados dentro de pastas partilhadas)
  if (/^\/hub\/studio\/[^/]+\/?$/.test(pathname)) return true;

  // Pastas: convidado usa /studio/shared ou /studio/f/[folderId]
  // A API valida; permitir a rota para não bloquear docs/subpastas após o login.
  if (/^\/studio\/f\/[^/]+\/?$/.test(pathname)) return true;

  return false;
}

export function isApiAllowedForStudioShareOnly(pathname: string): boolean {
  if (!pathname.startsWith('/api/')) return true;
  if (pathname.startsWith('/api/auth')) return true;
  if (pathname.startsWith('/api/internal/')) return true;
  if (pathname.startsWith('/api/studio')) return true;
  if (pathname.startsWith('/api/notifications')) return true;
  if (pathname === '/api/users/me') return true;
  return false;
}

export function defaultStudioShareOnlyHome(targets: StudioShareTargetRef[]): string {
  if (targets.length === 1) {
    const t = targets[0];
    if (t.type === 'document') return `/hub/studio/${t.id}`;
    return `/studio/f/${t.id}`;
  }
  return '/studio/shared';
}
