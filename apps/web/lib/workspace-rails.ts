/** Rails do cockpit Centro integrado — client-safe. */

import type { WorkspaceSystemKey } from '@/lib/integrated-workspace-shared';
import type { SystemAccent } from '@/lib/system-shell';

/** Identificadores de rail (NEXUS expande-se em três produtos). */
export type WorkspaceRailId =
  | WorkspaceSystemKey
  | 'AURORA'
  | 'POLARIS'
  | 'RADAR'
  | 'WORK'
  | 'MEET'
  | 'STUDIO';

export type WorkspaceRailDef = {
  id: WorkspaceRailId;
  label: string;
  /** Chave de grant/sistema, se aplicável */
  systemKey?: WorkspaceSystemKey;
  href: string;
  accent: SystemAccent;
  kind: 'system' | 'nexus-family' | 'tool';
};

const BASE_SYSTEM_RAILS: WorkspaceRailDef[] = [
  { id: 'ATLAS', label: 'ATLAS', systemKey: 'ATLAS', href: '/dashboard', accent: 'teal', kind: 'system' },
  { id: 'SIEP', label: 'SIEP', systemKey: 'SIEP', href: '/siep', accent: 'indigo', kind: 'system' },
  {
    id: 'FUNDHUB',
    label: 'FundHub',
    systemKey: 'FUNDHUB',
    href: '/hub/fundhub',
    accent: 'amber',
    kind: 'system',
  },
  { id: 'FORGE', label: 'FORGE', systemKey: 'FORGE', href: '/hub/forge', accent: 'violet', kind: 'system' },
  { id: 'PRISM', label: 'PRISM', systemKey: 'PRISM', href: '/hub/prism', accent: 'teal', kind: 'system' },
];

const NEXUS_FAMILY: WorkspaceRailDef[] = [
  {
    id: 'AURORA',
    label: 'AURORA',
    systemKey: 'NEXUS',
    href: '/hub/aurora',
    accent: 'amber',
    kind: 'nexus-family',
  },
  {
    id: 'POLARIS',
    label: 'POLARIS',
    systemKey: 'NEXUS',
    href: '/hub/polaris',
    accent: 'amber',
    kind: 'nexus-family',
  },
  {
    id: 'RADAR',
    label: 'RADAR',
    systemKey: 'NEXUS',
    href: '/hub/radar',
    accent: 'amber',
    kind: 'nexus-family',
  },
];

const TOOL_RAILS: WorkspaceRailDef[] = [
  { id: 'WORK', label: 'Work', href: '/hub/work', accent: 'teal', kind: 'tool' },
  { id: 'MEET', label: 'Chorus', href: '/hub/meet', accent: 'indigo', kind: 'tool' },
  { id: 'STUDIO', label: 'Studio', href: '/hub/studio', accent: 'violet', kind: 'tool' },
];

export function buildWorkspaceRails(opts: {
  systems: WorkspaceSystemKey[];
  tools?: { work?: boolean; meet?: boolean; studio?: boolean };
}): WorkspaceRailDef[] {
  const set = new Set(opts.systems);
  const out: WorkspaceRailDef[] = [];

  for (const r of BASE_SYSTEM_RAILS) {
    if (r.systemKey && set.has(r.systemKey)) out.push(r);
  }
  if (set.has('NEXUS')) {
    out.push(...NEXUS_FAMILY);
  }
  if (opts.tools?.work) out.push(TOOL_RAILS[0]);
  if (opts.tools?.meet !== false) out.push(TOOL_RAILS[1]);
  if (opts.tools?.studio) out.push(TOOL_RAILS[2]);

  return out;
}

export function railOpenLabel(rail: WorkspaceRailDef, locale: string): string {
  const name = rail.label;
  if (locale === 'pt') return `Abrir ${name}`;
  if (locale === 'es') return `Abrir ${name}`;
  return `Open ${name}`;
}

export const SPLIT_STORAGE_PREFIX = 'etholys_workspace_split:';
export const FOCUS_STORAGE_PREFIX = 'etholys_workspace_focus:';
