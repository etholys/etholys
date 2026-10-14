const MAX_LEGAL_COUNTRIES = 20;

function key(value: string): string {
  return value.trim().toLowerCase();
}

/** Junta países novos sem duplicar. Aceita um nome ou vários separados por vírgula. */
export function mergeLegalCountries(current: string[], raw: string, max = MAX_LEGAL_COUNTRIES): string[] {
  const next = current.map((c) => c.trim()).filter(Boolean).slice(0, max);
  const seen = new Set(next.map(key));
  for (const part of raw.split(/[,;\n]+/)) {
    const name = part.trim().replace(/\s+/g, ' ');
    if (!name || seen.has(key(name))) continue;
    if (next.length >= max) break;
    seen.add(key(name));
    next.push(name);
  }
  return next;
}

/** Lista persistida: array, texto com vírgulas, ou um único elemento que ainda traz vários países. */
export function normalizeLegalCountries(raw: unknown, max = MAX_LEGAL_COUNTRIES): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.reduce<string[]>(
      (acc, item) => mergeLegalCountries(acc, String(item ?? ''), max),
      [],
    );
  }
  return mergeLegalCountries([], String(raw), max);
}
