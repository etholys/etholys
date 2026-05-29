/**
 * Extracção opcional para `AiAdvisorSession.nexusMirror` após cada resposta do copiloto NEXUS.
 */
import type { CopilotLocale } from '@/lib/nexus-copilot-prompts';
import type { NexusAdvisorMirrorState, NexusAdvisorMirrorArtifact } from '@/lib/nexus-advisor-mirror';
import {
  NEXUS_ADVISOR_MIRROR_VERSION,
  parseNexusAdvisorMirror,
} from '@/lib/nexus-advisor-mirror';
import type { PrismaClient } from '@prisma/client';
import { geminiCompleteJsonText } from '@/lib/gemini-client';

type ExtractJson = {
  focalSummary?: string | null;
  artifacts?: Array<{ title?: string; excerpt?: string; kind?: string }>;
};

function mergeArtifacts(
  prev: NexusAdvisorMirrorArtifact[] | undefined,
  incoming: NexusAdvisorMirrorArtifact[],
): NexusAdvisorMirrorArtifact[] {
  const byTitle = new Map<string, NexusAdvisorMirrorArtifact>();
  for (const a of [...(prev ?? []), ...incoming]) {
    const k = `${a.kind}:${a.title}`.slice(0, 200);
    if (!byTitle.has(k)) byTitle.set(k, a);
    else byTitle.set(k, { ...byTitle.get(k)!, excerpt: a.excerpt ?? byTitle.get(k)!.excerpt });
  }
  return [...byTitle.values()].slice(-20);
}

function normExtract(e: ExtractJson): { focalSummary?: string; artifacts: NexusAdvisorMirrorArtifact[] } {
  const focal = typeof e.focalSummary === 'string' && e.focalSummary.trim() ? e.focalSummary.trim() : undefined;
  const artifacts: NexusAdvisorMirrorArtifact[] = [];
  const now = new Date().toISOString();
  for (const a of e.artifacts ?? []) {
    const title = typeof a.title === 'string' ? a.title.trim() : '';
    if (!title) continue;
    const kr = typeof a.kind === 'string' ? a.kind : 'note';
    const kind =
      kr === 'diagnosis' || kr === 'deliverable' || kr === 'note' ? kr : ('note' as const);
    artifacts.push({
      id: `x-${Math.random().toString(36).slice(2, 10)}`,
      kind,
      title: title.slice(0, 280),
      excerpt: typeof a.excerpt === 'string' ? a.excerpt.slice(0, 1000) : undefined,
      updatedAt: now,
    });
  }
  return { focalSummary: focal, artifacts };
}

export async function tryMergeNexusMirrorAfterCopilotReply(
  prisma: PrismaClient,
  sessionId: string,
  assistantText: string,
  locale: CopilotLocale,
): Promise<void> {
  if (!assistantText?.trim()) return;

  let system: string;
  if (locale === 'es') {
    system =
      'Extracción corta desde la ÚLTIMA respuesta del copiloto (no inventes datos). Devuelve SOLO JSON válido con esquema: {"focalSummary": string|null,"artifacts":[{"title":string,"excerpt"?:string,"kind":"note"|"deliverable"|"diagnosis"}]}. focalSummary máximo 280 caracteres. Máximo 5 artifacts. Sin markdown.';
  } else if (locale === 'en') {
    system =
      'Short extraction from the copilot LAST reply only (do not invent). Return ONLY JSON: {"focalSummary": string|null,"artifacts":[{"title":string,"excerpt"?:string,"kind":"note"|"deliverable"|"diagnosis"}]}. focalSummary max 280 chars. Max 5 artifacts. No markdown.';
  } else {
    system =
      'Extracção breve apenas da ÚLTIMA resposta do copiloto (não inventes dados). Devolve APENAS JSON válido: {"focalSummary": string|null,"artifacts":[{"title":string,"excerpt"?:string,"kind":"note"|"deliverable"|"diagnosis"}]}. focalSummary no máximo 280 caracteres. No máximo 5 artifacts. Sem markdown.';
  }

  let extracted: ExtractJson;
  try {
    const raw = await geminiCompleteJsonText(system, assistantText.slice(0, 24_000), { maxOutputTokens: 1536 });
    extracted = JSON.parse(raw) as ExtractJson;
  } catch {
    return;
  }

  const normed = normExtract(extracted);
  const row = await prisma.aiAdvisorSession.findUnique({
    where: { id: sessionId },
    select: { nexusMirror: true },
  });
  const prev = row?.nexusMirror ? parseNexusAdvisorMirror(row.nexusMirror as unknown) : null;

  const next: NexusAdvisorMirrorState = {
    version: NEXUS_ADVISOR_MIRROR_VERSION,
    updatedAt: new Date().toISOString(),
    focalSummary: normed.focalSummary ?? prev?.focalSummary,
    routeAgreed: prev?.routeAgreed,
    artifacts: mergeArtifacts(prev?.artifacts, normed.artifacts),
  };

  if (!next.focalSummary && !(next.artifacts?.length ?? 0)) return;

  await prisma.aiAdvisorSession.update({
    where: { id: sessionId },
    data: {
      nexusMirror: JSON.parse(JSON.stringify(next)) as object,
      updatedAt: new Date(),
    },
  });
}
