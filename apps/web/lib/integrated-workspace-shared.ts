/** Tipos e helpers do workspace integrado — seguros para Client Components. */

export const WORKSPACE_SYSTEM_KEYS = ['ATLAS', 'SIEP', 'FUNDHUB', 'NEXUS', 'FORGE', 'PRISM'] as const;
export type WorkspaceSystemKey = (typeof WORKSPACE_SYSTEM_KEYS)[number];

/**
 * Etholys Tools — grants por utilizador (paralelo aos sistemas).
 * CHORUS = produto Chorus; rotas continuam em `/hub/meet`.
 * PRISM permanece sistema (`WORKSPACE_SYSTEM_KEYS`), não tool grant.
 */
export const WORKSPACE_TOOL_KEYS = ['ADVISOR', 'STUDIO', 'WORK', 'CHORUS'] as const;
export type WorkspaceToolKey = (typeof WORKSPACE_TOOL_KEYS)[number];

/** Nome comercial — chaves de licença/API continuam em maiúsculas (FUNDHUB). */
export const WORKSPACE_SYSTEM_DISPLAY: Record<WorkspaceSystemKey, string> = {
  ATLAS: 'ATLAS',
  SIEP: 'SIEP',
  FUNDHUB: 'FundHub',
  NEXUS: 'NEXUS',
  FORGE: 'FORGE',
  PRISM: 'PRISM',
};

export const WORKSPACE_TOOL_DISPLAY: Record<WorkspaceToolKey, string> = {
  ADVISOR: 'Advisor',
  STUDIO: 'Studio',
  WORK: 'Work',
  CHORUS: 'Chorus',
};

export function systemDisplayName(key: string): string {
  return WORKSPACE_SYSTEM_DISPLAY[key as WorkspaceSystemKey] ?? key;
}

export function toolDisplayName(key: string): string {
  return WORKSPACE_TOOL_DISPLAY[key as WorkspaceToolKey] ?? key;
}

const KEY_SET = new Set<string>(WORKSPACE_SYSTEM_KEYS);
const TOOL_SET = new Set<string>(WORKSPACE_TOOL_KEYS);

/** Hub card id / alias → chave de grant. */
export function hubIdToToolKey(systemId: string): WorkspaceToolKey | null {
  const id = systemId.trim().toUpperCase();
  if (id === 'MEET') return 'CHORUS';
  if (TOOL_SET.has(id)) return id as WorkspaceToolKey;
  return null;
}

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

export function parseToolsJson(raw: unknown): WorkspaceToolKey[] {
  if (!raw || !Array.isArray(raw)) return [];
  const out: WorkspaceToolKey[] = [];
  for (const x of raw) {
    if (typeof x !== 'string') continue;
    const key = hubIdToToolKey(x);
    if (key) out.push(key);
  }
  return [...new Set(out)];
}

export function normalizeToolsInput(input: unknown): WorkspaceToolKey[] {
  return parseToolsJson(input);
}

export type WorkspaceAccessState =
  | { ok: true; systems: WorkspaceSystemKey[]; tools: WorkspaceToolKey[]; recordId: string }
  | { ok: false; reason: 'no_record' | 'disabled' | 'no_systems' };

export function hasSystem(access: WorkspaceAccessState, key: WorkspaceSystemKey): boolean {
  return access.ok && access.systems.includes(key);
}

export function hasTool(access: WorkspaceAccessState, key: WorkspaceToolKey): boolean {
  return access.ok && access.tools.includes(key);
}
