export function searchLibroOcrText(
  text: string | null | undefined,
  query: string,
  limit = 12
): { snippet: string; index: number }[] {
  if (!text?.trim() || !query.trim()) return [];
  const q = query.trim().toLowerCase();
  const lower = text.toLowerCase();
  const hits: { snippet: string; index: number }[] = [];
  let pos = 0;
  while (hits.length < limit) {
    const idx = lower.indexOf(q, pos);
    if (idx === -1) break;
    const start = Math.max(0, idx - 80);
    const end = Math.min(text.length, idx + q.length + 120);
    hits.push({
      index: idx,
      snippet: `${start > 0 ? '…' : ''}${text.slice(start, end).replace(/\s+/g, ' ')}${end < text.length ? '…' : ''}`,
    });
    pos = idx + q.length;
  }
  return hits;
}
