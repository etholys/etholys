import 'server-only';

import { mergeBasesParts } from '@/lib/opportunity/bases-text';
import { isSafePublicHttpUrl } from '@/lib/opportunity/call-evidence';
import { isAggregatorFundingUrl } from '@/lib/opportunity/official-url';
import { extractTextFromBuffer } from '@/lib/siep/extract-file-text';
import type { CallDocument, ScanCandidate } from '@/lib/opportunity/scan-types';

const FETCH_MS = 18_000;
const MAX_FILE = 8 * 1024 * 1024;
const MAX_DOCS = 3;

async function fetchOfficialBytes(url: string): Promise<{ name: string; buf: Buffer; type: string } | null> {
  if (!isSafePublicHttpUrl(url) || isAggregatorFundingUrl(url)) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'Etholys-FundHub/1.0 (+https://etholys.com)' },
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > MAX_FILE) return null;
    const type = res.headers.get('content-type') || 'application/octet-stream';
    const name = decodeURIComponent(url.split('/').pop()?.split('?')[0] || 'documento');
    return { name, buf, type };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function extractOfficialBases(documents: CallDocument[] | undefined): Promise<string> {
  const docs = (documents ?? []).slice(0, MAX_DOCS);
  const parts: Array<{ title: string; text: string }> = [];
  for (const doc of docs) {
    const file = await fetchOfficialBytes(doc.url);
    if (!file) continue;
    try {
      const text = await extractTextFromBuffer(file.buf, doc.title || file.name, file.type);
      if (text.trim()) parts.push({ title: doc.title || file.name, text });
    } catch {
      /* skip unreadable attachment */
    }
  }
  return mergeBasesParts(parts);
}

export async function attachBasesText(c: ScanCandidate): Promise<ScanCandidate> {
  if (c.basesText && c.basesText.length > 200) return c;
  const basesText = await extractOfficialBases(c.documents);
  if (!basesText) return c;
  return { ...c, basesText };
}
