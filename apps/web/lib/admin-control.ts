/** Secções da central de controlo Etholys (`/hub/admin?s=`). */
export const ADMIN_SECTIONS = [
  'overview',
  'companies',
  'org-profile',
  'areas',
  'users',
  /** @deprecated alias — redireciona para `users` (centro unificado) */
  'access',
  'billing',
  'account',
] as const;

export type AdminSection = (typeof ADMIN_SECTIONS)[number];

export function parseAdminSection(raw: string | null | undefined): AdminSection {
  const v = String(raw || '').trim().toLowerCase();
  // Permisos y sistemas fundiu-se no centro de utilizadores
  if (v === 'access') return 'users';
  if ((ADMIN_SECTIONS as readonly string[]).includes(v)) return v as AdminSection;
  return 'overview';
}

export function adminHref(section: AdminSection) {
  const resolved = section === 'access' ? 'users' : section;
  return resolved === 'overview' ? '/hub/admin' : `/hub/admin?s=${resolved}`;
}
