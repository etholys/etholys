/**
 * Espelho NEXUS ligado à sessão do assessor (AiAdvisorSession.nexusMirror).
 * A conversa deve ser a fonte de verdade — este JSON é atualizado quando o assessor formaliza etapas, resultados e acordos.
 */

export const NEXUS_ADVISOR_MIRROR_VERSION = 1 as const;

export type NexusAdvisorMirrorRouteLine = {
  id: string;
  title: string;
  detail?: string;
  status?: 'pending' | 'current' | 'done';
};

export type NexusAdvisorMirrorArtifact = {
  id: string;
  /** diagnóstico resumido, nota ou outro resultado produzido a partir da conversa */
  kind: 'diagnosis' | 'note' | 'deliverable';
  title: string;
  excerpt?: string;
  updatedAt?: string;
};

export type NexusAdvisorMirrorState = {
  version: typeof NEXUS_ADVISOR_MIRROR_VERSION;
  /** Quando foi escrito por servidor ou extracção IA */
  updatedAt?: string;
  /** Uma linha vista na coluna: foco atual do diálogo (opcional) */
  focalSummary?: string;
  routeAgreed?: NexusAdvisorMirrorRouteLine[];
  artifacts?: NexusAdvisorMirrorArtifact[];
};

function isObj(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

/** Valida formato mínimo; devolve estado normalizado ou null */
export function parseNexusAdvisorMirror(raw: unknown): NexusAdvisorMirrorState | null {
  if (!isObj(raw)) return null;
  if (raw.version !== NEXUS_ADVISOR_MIRROR_VERSION) return null;
  const state: NexusAdvisorMirrorState = { version: NEXUS_ADVISOR_MIRROR_VERSION };
  if (typeof raw.updatedAt === 'string') state.updatedAt = raw.updatedAt;
  if (typeof raw.focalSummary === 'string') state.focalSummary = raw.focalSummary;

  const routes = raw.routeAgreed;
  if (Array.isArray(routes)) {
    const lines: NexusAdvisorMirrorRouteLine[] = [];
    for (const r of routes) {
      if (!isObj(r)) continue;
      const id = typeof r.id === 'string' ? r.id : `r-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const title = typeof r.title === 'string' ? r.title : '';
      if (!title.trim()) continue;
      const line: NexusAdvisorMirrorRouteLine = {
        id,
        title: title.trim(),
        detail: typeof r.detail === 'string' ? r.detail : undefined,
        status:
          r.status === 'pending' || r.status === 'current' || r.status === 'done' ? r.status : undefined,
      };
      lines.push(line);
    }
    if (lines.length > 0) state.routeAgreed = lines;
  }

  const arts = raw.artifacts;
  if (Array.isArray(arts)) {
    const artifacts: NexusAdvisorMirrorArtifact[] = [];
    for (const a of arts) {
      if (!isObj(a)) continue;
      const id = typeof a.id === 'string' ? a.id : `a-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const title = typeof a.title === 'string' ? a.title : '';
      const kindRaw = typeof a.kind === 'string' ? a.kind : 'note';
      const kind =
        kindRaw === 'diagnosis' || kindRaw === 'note' || kindRaw === 'deliverable' ? kindRaw : 'note';
      if (!title.trim()) continue;
      artifacts.push({
        id,
        kind,
        title: title.trim(),
        excerpt: typeof a.excerpt === 'string' ? a.excerpt : undefined,
        updatedAt: typeof a.updatedAt === 'string' ? a.updatedAt : undefined,
      });
    }
    if (artifacts.length > 0) state.artifacts = artifacts;
  }

  return state;
}
