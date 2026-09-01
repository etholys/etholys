/** Ignore async Studio fetch results after navigation or a newer load started. */
export function shouldApplyStudioDocumentFetch(
  requestedDocId: string,
  currentDocId: string,
  epochAtStart: number,
  currentEpoch: number,
): boolean {
  return requestedDocId === currentDocId && epochAtStart === currentEpoch;
}

/**
 * Usar canvas do cliente só quando há edições locais não guardadas.
 * Sem dirty, o servidor usa sempre `doc.canvasState` (evita POST gigante + OOM).
 * Com dirty + revisão desfasada, rejeita canvas do cliente (troca rápida de documento).
 */
export function shouldTrustClientStudioCanvas(
  clientDirty: boolean,
  clientRevision: string | null | undefined,
  serverUpdatedAt: Date | string,
): boolean {
  if (!clientDirty) return false;
  if (!clientRevision) return true;
  const serverIso =
    serverUpdatedAt instanceof Date ? serverUpdatedAt.toISOString() : String(serverUpdatedAt);
  return clientRevision === serverIso;
}

/** Abort persist/copilot when navigation changed document or a newer load started. */
export function shouldPersistStudioDocument(
  docId: string,
  epochAtStart: number,
  currentDocId: string,
  currentEpoch: number,
): boolean {
  return docId === currentDocId && epochAtStart === currentEpoch;
}

/** Heurística: título do doc vs. texto principal — avisa mistura Kumiai/Nanobio-style. */
export function detectStudioContentMismatch(
  docTitle: string,
  canvas: { pages: Array<{ blocks: Array<{ kind?: string; text?: string }> }> },
): string | null {
  const title = docTitle.trim();
  if (!title || title.length < 4) return null;
  const blocks = canvas.pages.flatMap((p) => p.blocks || []);
  const heading =
    blocks.find((b) => b.kind === 'heading' && String(b.text || '').trim().length > 4)?.text ||
    blocks.find((b) => String(b.text || '').trim().length > 20)?.text ||
    '';
  const head = String(heading).replace(/^#+\s*/, '').trim().slice(0, 120);
  if (!head) return null;
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ');
  const titleN = norm(title);
  const headN = norm(head);
  const titleTokens = titleN.split(/\s+/).filter((w) => w.length > 3);
  if (!titleTokens.length) return null;
  const overlap = titleTokens.filter((t) => headN.includes(t)).length;
  if (overlap >= Math.max(1, Math.ceil(titleTokens.length * 0.4))) return null;
  if (headN.length >= 8 && !titleN.includes(headN.slice(0, 12)) && !headN.includes(titleN.slice(0, 12))) {
    return head;
  }
  return null;
}
