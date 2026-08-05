import type { LabAnvilAgentMeta } from './types';
import { writeProjectFile } from './sandbox-fs';

export type ArtifactToApply = {
  path: string;
  content: string;
  summary?: string;
  language?: string;
};

/** Extrai content de artefacts no meta; completa a partir de fences markdown no texto. */
export function resolveArtifactsToApply(
  meta: LabAnvilAgentMeta | null | undefined,
  assistantContent?: string,
): ArtifactToApply[] {
  const fromMeta = (meta?.artifacts || [])
    .filter((a) => a.path && typeof a.content === 'string' && a.content.length > 0)
    .map((a) => ({
      path: a.path,
      content: a.content as string,
      summary: a.summary,
      language: a.language,
    }));

  if (fromMeta.length > 0) return fromMeta;

  if (!assistantContent || !meta?.artifacts?.length) return [];

  const fences = [...assistantContent.matchAll(/```(\w+)?\n([\s\S]*?)```/g)].map((m) => ({
    lang: (m[1] || '').toLowerCase(),
    body: m[2].replace(/\n$/, ''),
  }));

  const out: ArtifactToApply[] = [];
  for (const art of meta.artifacts) {
    if (!art.path) continue;
    const ext = art.path.split('.').pop()?.toLowerCase() || '';
    const langHint = (art.language || '').toLowerCase();
    const match =
      fences.find((f) => langHint && f.lang === langHint) ||
      fences.find((f) => {
        if (ext === 'ts' || ext === 'tsx') return f.lang === 'ts' || f.lang === 'tsx' || f.lang === 'typescript';
        if (ext === 'js' || ext === 'jsx') return f.lang === 'js' || f.lang === 'jsx' || f.lang === 'javascript';
        if (ext === 'html') return f.lang === 'html';
        if (ext === 'css') return f.lang === 'css';
        if (ext === 'json') return f.lang === 'json';
        return false;
      });
    if (match) {
      out.push({
        path: art.path,
        content: match.body,
        summary: art.summary,
        language: art.language,
      });
      // remove used fence so next path gets next matching block
      const idx = fences.indexOf(match);
      if (idx >= 0) fences.splice(idx, 1);
    }
  }
  return out;
}

export async function applyArtifactsToSandbox(opts: {
  projectId: string;
  artifacts: ArtifactToApply[];
  updatedById?: string;
}) {
  const written: Array<{ path: string; size: number }> = [];
  const errors: Array<{ path: string; error: string }> = [];

  for (const art of opts.artifacts) {
    try {
      const file = await writeProjectFile({
        projectId: opts.projectId,
        path: art.path,
        content: art.content,
        updatedById: opts.updatedById,
      });
      written.push({ path: file.path, size: file.size });
    } catch (e) {
      errors.push({
        path: art.path,
        error: e instanceof Error ? e.message : 'Erro ao escrever',
      });
    }
  }

  return { written, errors };
}
