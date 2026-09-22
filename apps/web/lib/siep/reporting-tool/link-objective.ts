import type { ReportingToolSeedLine } from '@/lib/siep/reporting-tool/impulsa-los-santos-v-agust';

function norm(s: string) {
  return String(s || '')
    .toLowerCase()
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractEgCode(s: string): string | null {
  const m = norm(s).match(/eg\.?\s*[\d.]+-?\d*[a-z]?/i);
  if (!m) return null;
  return m[0].replace(/\s+/g, '').replace(/eg\.?/i, 'eg.').toLowerCase();
}

export type LinkableObjective = {
  id: string;
  type: string;
  title: string;
  indicator: string | null;
};

/** Tenta ligar uma linha da Reporting Tool a um indicador do logframe (sem fundir). */
export function findLinkedObjectiveId(
  line: Pick<ReportingToolSeedLine, 'indicatorText' | 'matchHints' | 'tag'>,
  objectives: LinkableObjective[],
): string | null {
  const indicators = objectives.filter((o) => o.type === 'indicator');
  if (!indicators.length) return null;

  const eg = extractEgCode(line.indicatorText);
  if (eg) {
    const hit = indicators.find((o) => {
      const code = extractEgCode(`${o.title} ${o.indicator || ''}`);
      return code && code === eg;
    });
    if (hit) return hit.id;
  }

  for (const hint of line.matchHints) {
    const h = norm(hint);
    if (h.length < 6) continue;
    const hit = indicators.find((o) => {
      const blob = norm(`${o.title} ${o.indicator || ''}`);
      return blob.includes(h);
    });
    if (hit) return hit.id;
  }

  // same_essence: fallback por sobreposição de tokens
  if (line.tag === 'same_essence') {
    const tokens = norm(line.indicatorText)
      .replace(/[^\w\s.%\-]/g, ' ')
      .split(' ')
      .filter((t) => t.length > 3);
    let best: { id: string; score: number } | null = null;
    for (const o of indicators) {
      const blob = norm(`${o.title} ${o.indicator || ''}`);
      const score = tokens.filter((t) => blob.includes(t)).length / Math.max(tokens.length, 1);
      if (score >= 0.45 && (!best || score > best.score)) best = { id: o.id, score };
    }
    if (best) return best.id;
  }

  return null;
}
