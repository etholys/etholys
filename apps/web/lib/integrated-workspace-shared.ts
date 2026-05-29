/** Tipos e helpers do workspace integrado — seguros para Client Components. */

export const WORKSPACE_SYSTEM_KEYS = ['ATLAS', 'SIEP', 'FUNDHUB', 'NEXUS', 'FORGE', 'PRISM'] as const;
export type WorkspaceSystemKey = (typeof WORKSPACE_SYSTEM_KEYS)[number];

const KEY_SET = new Set<string>(WORKSPACE_SYSTEM_KEYS);

export function parseSystemsJson(raw: unknown): WorkspaceSystemKey[] {
  if (!raw || !Array.isArray(raw)) return [];
  const out: WorkspaceSystemKey[] = [];
  for (const x of raw) {
    if (typeof x === 'string' && KEY_SET.has(x)) out.push(x as WorkspaceSystemKey);
  }
  return out;
}

export function normalizeSystemsInput(input: unknown): WorkspaceSystemKey[] {
  if (!Array.isArray(input)) return [];
  const out: WorkspaceSystemKey[] = [];
  for (const x of input) {
    if (typeof x === 'string' && KEY_SET.has(x)) out.push(x as WorkspaceSystemKey);
  }
  return [...new Set(out)];
}

export type WorkspaceAccessState =
  | { ok: true; systems: WorkspaceSystemKey[]; recordId: string }
  | { ok: false; reason: 'no_record' | 'disabled' | 'no_systems' };

export function hasSystem(access: WorkspaceAccessState, key: WorkspaceSystemKey): boolean {
  return access.ok && access.systems.includes(key);
}
