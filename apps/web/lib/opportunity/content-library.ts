/** R3 — biblioteca de conteúdo da org (voz / wins / snippets) para propostas. */

export type ContentLibrarySnippet = {
  id: string;
  title: string;
  body: string;
  kind: 'mission' | 'win' | 'capacity' | 'indicator' | 'other';
  updatedAt: string;
};

export type ContentLibrary = {
  snippets: ContentLibrarySnippet[];
  voiceNotes?: string;
};

export function emptyContentLibrary(): ContentLibrary {
  return { snippets: [] };
}

export function parseContentLibrary(raw: unknown): ContentLibrary {
  if (!raw || typeof raw !== 'object') return emptyContentLibrary();
  const o = raw as Record<string, unknown>;
  const snippets = Array.isArray(o.snippets)
    ? o.snippets
        .filter((s): s is Record<string, unknown> => Boolean(s) && typeof s === 'object')
        .map((s, i) => ({
          id: typeof s.id === 'string' ? s.id.slice(0, 80) : `snip_${i}`,
          title: String(s.title ?? '').slice(0, 200),
          body: String(s.body ?? '').slice(0, 8000),
          kind:
            s.kind === 'mission' ||
            s.kind === 'win' ||
            s.kind === 'capacity' ||
            s.kind === 'indicator' ||
            s.kind === 'other'
              ? s.kind
              : ('other' as const),
          updatedAt: typeof s.updatedAt === 'string' ? s.updatedAt : new Date().toISOString(),
        }))
        .filter((s) => s.title && s.body)
        .slice(0, 40)
    : [];
  return {
    snippets,
    voiceNotes: typeof o.voiceNotes === 'string' ? o.voiceNotes.slice(0, 4000) : undefined,
  };
}

export function newSnippet(
  title: string,
  body: string,
  kind: ContentLibrarySnippet['kind'] = 'other',
): ContentLibrarySnippet {
  return {
    id: `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    title: title.trim().slice(0, 200),
    body: body.trim().slice(0, 8000),
    kind,
    updatedAt: new Date().toISOString(),
  };
}
