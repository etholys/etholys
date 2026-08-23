/** Constantes partilhadas (safe for client components). */

export const DOC_LINK_SYSTEMS = [
  'NEXUS',
  'SIEP',
  'FUNDHUB',
  'FORGE',
  'MEET',
  'ATLAS',
  'CORE',
] as const;

export type DocLinkSystemKey = (typeof DOC_LINK_SYSTEMS)[number];

export const DOC_LINK_ENTITY_TYPES = [
  'company',
  'project',
  'report',
  'proposal',
  'engagement',
  'course',
  'meet_session',
  'network',
] as const;

export type DocLinkEntityType = (typeof DOC_LINK_ENTITY_TYPES)[number];
export type DocLinkTargetType = 'studio' | 'core';

export function isDocLinkSystemKey(v: string): v is DocLinkSystemKey {
  return (DOC_LINK_SYSTEMS as readonly string[]).includes(v);
}

export function isDocLinkEntityType(v: string): v is DocLinkEntityType {
  return (DOC_LINK_ENTITY_TYPES as readonly string[]).includes(v);
}
