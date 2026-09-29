/** Secções da central de controlo Etholys (`/hub/admin?s=`). */
export const ADMIN_SECTIONS = [
  'overview',
  'companies',
  'org-profile',
  'areas',
  'users',
  'access',
  'billing',
  'account',
] as const;

export type AdminSection = (typeof ADMIN_SECTIONS)[number];

export function parseAdminSection(raw: string | null | undefined): AdminSection {
  const v = String(raw || '').trim().toLowerCase();
  if ((ADMIN_SECTIONS as readonly string[]).includes(v)) return v as AdminSection;
  return 'overview';
}

export function adminHref(section: AdminSection) {
  return section === 'overview' ? '/hub/admin' : `/hub/admin?s=${section}`;
}
