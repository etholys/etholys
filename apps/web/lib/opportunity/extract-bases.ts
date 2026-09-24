import 'server-only';

import { mergeBasesParts } from '@/lib/opportunity/bases-text';
import { fetchOfficialResource } from '@/lib/opportunity/official-fetch';
import { extractTextFromBuffer } from '@/lib/siep/extract-file-text';
import type { CallDocument, ScanCandidate } from '@/lib/opportunity/scan-types';

const MAX_DOCS = 3;

async function fetchOfficialBytes(url: string): Promise<{ name: string; buf: Buffer; type: string } | null> {
  const file = await fetchOfficialResource(url, { asFile: true, timeoutMs: 22_000 });
  if (!file.ok || !file.bytes) return null;
  const name = decodeURIComponent(file.finalUrl.split('/').pop()?.split('?')[0] || 'documento');
  return { name, buf: file.bytes, type: file.type || 'application/octet-stream' };
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
