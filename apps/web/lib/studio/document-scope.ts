/** Ignore async Studio fetch results after navigation or a newer load started. */
export function shouldApplyStudioDocumentFetch(
  requestedDocId: string,
  currentDocId: string,
  epochAtStart: number,
  currentEpoch: number,
): boolean {
  return requestedDocId === currentDocId && epochAtStart === currentEpoch;
}

/** Prefer server canvas when the client revision does not match (cross-document leak guard). */
export function shouldTrustClientStudioCanvas(
  clientDirty: boolean,
  clientRevision: string | null | undefined,
  serverUpdatedAt: Date | string,
): boolean {
  if (clientDirty) return true;
  if (!clientRevision) return true;
  const serverIso =
    serverUpdatedAt instanceof Date ? serverUpdatedAt.toISOString() : String(serverUpdatedAt);
  return clientRevision === serverIso;
}
