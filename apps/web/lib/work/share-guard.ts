/** Paths allowed for external Work folder guests (share_only). */

export function defaultWorkShareOnlyHome(folderIds: string[]): string {
  const first = folderIds[0];
  if (!first) return '/hub/work';
  return `/hub/work?nav=folder&id=${encodeURIComponent(first)}&view=table`;
}

export function isApiAllowedForWorkShareOnly(pathname: string): boolean {
  if (pathname.startsWith('/api/auth')) return true;
  if (pathname === '/api/internal/work-scope') return true;
  if (pathname.startsWith('/api/work-folders')) return true;
  if (pathname.startsWith('/api/tasks')) return true;
  if (pathname.startsWith('/api/task-groups')) return true;
  if (pathname === '/api/users') return true;
  if (pathname === '/api/companies' || pathname.startsWith('/api/companies')) return true;
  if (pathname.startsWith('/api/notifications')) return true;
  return false;
}

export function isPageAllowedForWorkShareOnly(pathname: string, folderIds: string[]): boolean {
  if (pathname === '/work/shared' || pathname.startsWith('/work/shared/')) return true;
  if (pathname === '/hub/work' || pathname.startsWith('/hub/work')) return true;
  if (pathname === '/login' || pathname.startsWith('/login')) return true;
  if (folderIds.length && pathname.startsWith('/hub/work')) return true;
  return false;
}

export function isPublicWorkSharePath(pathname: string): boolean {
  return pathname === '/work/shared' || pathname.startsWith('/work/shared/');
}
