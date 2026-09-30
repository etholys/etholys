import 'server-only';

import { fundhubStructureJsonText } from '@/lib/opportunity/fundhub-llm';
import { salvageJsonText } from '@/lib/opportunity/json-salvage';
import {
  NARRATIVE_KEYS,
  candidateNeedsRelocalization,
  detectNarrativeLocale,
  looksLikePortuguese,
  looksLikeSpanish,
  relocalizePromptMeta,
} from '@/lib/opportunity/relocalize-candidate-locale';
import type { ScanCandidate } from '@/lib/opportunity/scan-types';

export {
  candidateNeedsRelocalization,
  detectNarrativeLocale,
  looksLikePortuguese,
  looksLikeSpanish,
} from '@/lib/opportunity/relocalize-candidate-locale';
export type { NarrativeKey } from '@/lib/opportunity/relocalize-candidate-locale';

/**
 * Reescreve campos narrativos do candidato no idioma do Hub.
 * Não inventa factos — só traduz / alinha idioma. Persistido via enrich.
 */
export async function relocalizeCandidateNarratives(
  c: ScanCandidate,
  hubLocaleRaw: unknown,
): Promise<ScanCandidate> {
  if (!candidateNeedsRelocalization(c, hubLocaleRaw)) return c;

  const { locale, lang, keys } = relocalizePromptMeta(hubLocaleRaw);
  const payload: Record<string, string> = {};
  for (const k of keys) {
    const v = c[k];
    if (typeof v === 'string' && v.trim()) payload[k] = v.trim().slice(0, 4000);
  }
  if (!Object.keys(payload).length) return c;

  try {
    const structured = await fundhubStructureJsonText(
      `You rewrite funding-call narrative fields into ${lang} (Hub UI locale: ${locale}).
Keep meaning identical. Do NOT invent eligibility, amounts, deadlines, or countries.
Return JSON only: same keys as input, values fully in ${lang}.`,
      JSON.stringify(payload),
      { maxOutputTokens: 6000, allowTruncated: true },
    );
    const parsed = JSON.parse(salvageJsonText(structured.text)) as Record<string, unknown>;
    const next: ScanCandidate = { ...c };
    for (const k of NARRATIVE_KEYS) {
      const v = parsed[k];
      if (typeof v === 'string' && v.trim()) {
        (next as Record<string, unknown>)[k] = v.trim();
      }
    }
    return next;
  } catch (e) {
    console.warn('[fundhub] relocalize narratives failed:', e);
    return c;
  }
}
