/**
 * Mapeia "Falante 1/2" → nomes reais (participantes + vocativos no texto).
 * Sem LLM.
 */

export type NamedLine = {
  speaker: string;
  text: string;
  startSec?: number;
  endSec?: number;
};

const FALANTE_RE = /^(falante|speaker|participante|pessoa)\s*(\d+)$/i;

function normalizeName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function isGenericSpeaker(label: string): boolean {
  return FALANTE_RE.test(label.trim()) || /^(desconhecido|unknown)$/i.test(label.trim());
}

function falanteKey(label: string): string | null {
  const m = label.trim().match(FALANTE_RE);
  return m ? `F${m[2]}` : null;
}

function firstNames(participants: string[]): Array<{ full: string; first: string; norm: string }> {
  return participants
    .map((full) => {
      const parts = full.trim().split(/\s+/).filter(Boolean);
      const first = parts[0] || full;
      return { full: full.trim(), first, norm: normalizeName(first) };
    })
    .filter((p) => p.full.length >= 2);
}

/**
 * Conta vezes em que um Falante X se dirige a um nome → esse nome é o OUTRO falante.
 */
export function resolveGenericSpeakers(
  lines: NamedLine[],
  participants: string[],
): NamedLine[] {
  const people = firstNames(participants);
  if (people.length === 0 || lines.length === 0) return lines;

  const hasGeneric = lines.some((l) => isGenericSpeaker(l.speaker));
  if (!hasGeneric) return lines;

  /** votes[falanteKey][personNorm] = score that THIS falante IS that person */
  const votes = new Map<string, Map<string, number>>();

  function addVote(fkey: string, personNorm: string, w: number) {
    if (!votes.has(fkey)) votes.set(fkey, new Map());
    const m = votes.get(fkey)!;
    m.set(personNorm, (m.get(personNorm) || 0) + w);
  }

  for (const line of lines) {
    const fkey = falanteKey(line.speaker);
    const textNorm = normalizeName(line.text);
    for (const p of people) {
      // Vocativo / menção: "gracias, Thiago" / "Beatriz, entonces"
      const mentioned =
        new RegExp(`(?:^|[^a-z])${p.norm}(?:[^a-z]|$)`, 'i').test(textNorm) ||
        new RegExp(`(?:^|[^a-z])${normalizeName(p.full)}(?:[^a-z]|$)`, 'i').test(textNorm);
      if (!mentioned) continue;

      if (fkey) {
        // Quem fala menciona o nome → o nome é o OUTRO interlocutor
        for (const other of lines) {
          const ok = falanteKey(other.speaker);
          if (ok && ok !== fkey) addVote(ok, p.norm, 3);
        }
      } else if (!isGenericSpeaker(line.speaker)) {
        // Já tem nome real a falar de outro
        continue;
      }
    }
  }

  // Também: se só há 2 participantes e 2 falantes genéricos, mapear por votos + resto
  const genericKeys = [
    ...new Set(lines.map((l) => falanteKey(l.speaker)).filter((x): x is string => Boolean(x))),
  ];

  const mapping = new Map<string, string>(); // F1 -> full name

  for (const fkey of genericKeys) {
    const m = votes.get(fkey);
    if (!m || m.size === 0) continue;
    let best: { norm: string; score: number } | null = null;
    for (const [norm, score] of m) {
      if (!best || score > best.score) best = { norm, score };
    }
    if (best && best.score >= 3) {
      const person = people.find((p) => p.norm === best!.norm);
      if (person) mapping.set(fkey, person.full);
    }
  }

  // Completar o segundo com o nome restante
  if (people.length === 2 && genericKeys.length >= 1) {
    const used = new Set([...mapping.values()].map(normalizeName));
    const remaining = people.filter((p) => !used.has(p.norm));
    for (const fkey of genericKeys) {
      if (mapping.has(fkey)) continue;
      if (remaining.length === 1) {
        mapping.set(fkey, remaining[0]!.full);
        remaining.shift();
      }
    }
  }

  // Se ainda falha e há exactamente 2 participantes + F1/F2: ordem heurística
  // Falante 1 costuma ser o anfitrião (primeiro da lista) — só se zero votos
  if (mapping.size === 0 && people.length >= 2 && genericKeys.length >= 2) {
    const sorted = [...genericKeys].sort();
    mapping.set(sorted[0]!, people[0]!.full);
    mapping.set(sorted[1]!, people[1]!.full);
  }

  if (mapping.size === 0) return lines;

  return lines.map((l) => {
    const fkey = falanteKey(l.speaker);
    if (fkey && mapping.has(fkey)) {
      return { ...l, speaker: mapping.get(fkey)! };
    }
    return l;
  });
}

/**
 * Estima minutagem quando o STT não trouxe timestamps (ex. Gemini blob).
 * ~13 caracteres/segundo de fala.
 */
export function estimateLineTimestamps(
  lines: NamedLine[],
  opts?: { charsPerSec?: number; startOffsetSec?: number },
): NamedLine[] {
  const cps = opts?.charsPerSec ?? 13;
  let t = opts?.startOffsetSec ?? 0;
  return lines.map((l) => {
    const hasReal =
      typeof l.startSec === 'number' &&
      l.startSec > 0 &&
      typeof l.endSec === 'number' &&
      l.endSec > l.startSec;
    if (hasReal) {
      t = Math.max(t, l.endSec!);
      return l;
    }
    const dur = Math.max(2, Math.round(l.text.length / cps));
    const startSec = t;
    const endSec = t + dur;
    t = endSec + 0.4;
    return { ...l, startSec, endSec };
  });
}
