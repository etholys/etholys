/** Recupera JSON truncado por MAX_TOKENS (ex.: array de candidates cortado a meio). */
export function salvageJsonText(raw: string): string {
  let t = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/i.exec(t);
  if (fence) t = fence[1].trim();
  if (!t) return t;
  try {
    JSON.parse(t);
    return t;
  } catch {
    /* continue */
  }

  // Fecha o último objecto completo dentro de "candidates": [ ... ]
  const candidatesIdx = t.search(/"candidates"\s*:\s*\[/);
  if (candidatesIdx >= 0) {
    const after = t.slice(candidatesIdx);
    const bracket = after.indexOf('[');
    const arrStart = candidatesIdx + bracket;
    let depth = 0;
    let lastComplete = -1;
    let inString = false;
    let escape = false;
    for (let i = arrStart; i < t.length; i += 1) {
      const ch = t[i];
      if (inString) {
        if (escape) escape = false;
        else if (ch === '\\') escape = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') {
        inString = true;
        continue;
      }
      if (ch === '{') depth += 1;
      else if (ch === '}') {
        depth -= 1;
        if (depth === 0) lastComplete = i;
      } else if (ch === '[' && i === arrStart) depth += 1;
      else if (ch === ']' && depth === 1) {
        lastComplete = i;
        break;
      }
    }
    if (lastComplete > arrStart) {
      const sliced = `${t.slice(0, lastComplete + 1)}]`;
      // Se cortámos no meio do array, garantir fecho do objecto raiz
      const fixed = sliced.includes('{') && !sliced.trim().endsWith('}')
        ? `${sliced.trim().replace(/,\s*$/, '')}\n}`
        : sliced;
      try {
        JSON.parse(fixed);
        return fixed;
      } catch {
        const wrapped = `{"candidates":${t.slice(arrStart, lastComplete + 1)}]}`;
        try {
          JSON.parse(wrapped);
          return wrapped;
        } catch {
          /* fall through */
        }
      }
    }
  }

  // Última tentativa: cortar no último } e fechar
  const lastBrace = t.lastIndexOf('}');
  if (lastBrace > 0) {
    let candidate = t.slice(0, lastBrace + 1);
    const opens = (candidate.match(/\[/g) || []).length;
    const closes = (candidate.match(/\]/g) || []).length;
    candidate += ']'.repeat(Math.max(0, opens - closes));
    const openObj = (candidate.match(/\{/g) || []).length;
    const closeObj = (candidate.match(/\}/g) || []).length;
    candidate += '}'.repeat(Math.max(0, openObj - closeObj));
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      /* ignore */
    }
  }
  return t;
}

export function truncateForStructure(research: string, maxChars = 28_000): string {
  if (research.length <= maxChars) return research;
  return `${research.slice(0, maxChars)}\n\n[…truncated for token budget…]`;
}
