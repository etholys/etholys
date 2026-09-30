import {
  fundhubLanguageName,
  normalizeFundhubLocale,
  type FundhubLocale,
} from '@/lib/agents/fundhub-proposal-prompt';
import type { ScanCandidate } from '@/lib/opportunity/scan-types';

const NARRATIVE_KEYS = [
  'description',
  'whoCanApply',
  'eligibility',
  'requirements',
  'howToApply',
  'risksCaveats',
  'availabilityNote',
  'matchJustification',
  'classificationNote',
] as const;

export type NarrativeKey = (typeof NARRATIVE_KEYS)[number];

/** Heurística leve: texto parece português (não espanhol). */
export function looksLikePortuguese(text: string): boolean {
  const t = text.toLowerCase();
  if (/[ãõç]/.test(t)) return true;
  return /\b(não|são|organizações|organização|também|você|através|após|elegibilidade|sem fins|lucrativos|atuação)\b/i.test(
    t,
  );
}

/** Heurística leve: texto parece espanhol. */
export function looksLikeSpanish(text: string): boolean {
  const t = text.toLowerCase();
  if (/[ñ¿¡]/.test(t)) return true;
  return /\b(organización|organizaciones|también|según|después|través|elegibilidad|sin fines|lucrativos|actuación|quién|puede)\b/i.test(
    t,
  );
}

export function detectNarrativeLocale(text: string): FundhubLocale | 'unknown' {
  const sample = text.trim();
  if (sample.length < 12) return 'unknown';
  const pt = looksLikePortuguese(sample);
  const es = looksLikeSpanish(sample);
  if (pt && !es) return 'pt';
  if (es && !pt) return 'es';
  if (/[ãõ]/.test(sample.toLowerCase())) return 'pt';
  if (/ñ/.test(sample.toLowerCase())) return 'es';
  if (pt && es) {
    const ptHits = (sample.match(/\b(não|são|você|através|após)\b/gi) || []).length;
    const esHits = (sample.match(/\b(según|después|quién|también)\b/gi) || []).length;
    if (ptHits > esHits) return 'pt';
    if (esHits > ptHits) return 'es';
  }
  return 'unknown';
}

function narrativeBlob(c: ScanCandidate): string {
  return NARRATIVE_KEYS.map((k) => c[k])
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .join('\n');
}

/** True se o texto narrativo do candidato não está no idioma do Hub. */
export function candidateNeedsRelocalization(c: ScanCandidate, hubLocaleRaw: unknown): boolean {
  const hub = normalizeFundhubLocale(hubLocaleRaw);
  const blob = narrativeBlob(c);
  if (blob.length < 24) return false;
  const detected = detectNarrativeLocale(blob);
  if (detected === 'unknown') return false;
  return detected !== hub;
}

export function relocalizePromptMeta(hubLocaleRaw: unknown): {
  locale: FundhubLocale;
  lang: string;
  keys: readonly NarrativeKey[];
} {
  const locale = normalizeFundhubLocale(hubLocaleRaw);
  return { locale, lang: fundhubLanguageName(locale), keys: NARRATIVE_KEYS };
}

export { NARRATIVE_KEYS };
