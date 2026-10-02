/**
 * Helpers puros — cooldown de hosts (sem Prisma / server-only).
 */

function envInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export function sourceCooldownDays(): number {
  return envInt('FUNDHUB_SOURCE_COOLDOWN_DAYS', 7);
}

/** Normaliza host canónico (sem www., lowercase). */
export function canonicalizeDiscoveryHost(input: string | null | undefined): string | null {
  if (!input?.trim()) return null;
  let raw = input.trim().toLowerCase();
  try {
    if (!/^https?:\/\//i.test(raw)) {
      if (raw.includes('/') || raw.includes(' ')) {
        const m = raw.match(/https?:\/\/[^\s)]+/i);
        if (!m) return null;
        raw = m[0];
      } else if (raw.includes('.')) {
        raw = `https://${raw}`;
      } else {
        return null;
      }
    }
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\./, '');
    if (!host || host === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(host)) return null;
    return host.slice(0, 190);
  } catch {
    return null;
  }
}

export function extractHostsFromText(text: string): string[] {
  const out = new Set<string>();
  const re = /https?:\/\/[^\s)"'<>]+/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const host = canonicalizeDiscoveryHost(m[0]);
    if (host) out.add(host);
  }
  return [...out];
}

export function extractHostsFromCandidates(
  items: Array<{ callUrl?: string | null; linkOficial?: string | null; institutionUrl?: string | null }>,
): string[] {
  const out = new Set<string>();
  for (const c of items) {
    for (const u of [c.callUrl, c.linkOficial, c.institutionUrl]) {
      const h = canonicalizeDiscoveryHost(u);
      if (h) out.add(h);
    }
  }
  return [...out];
}

export function formatCooldownPromptBlock(hosts: Set<string> | string[], days = sourceCooldownDays()): string {
  const list = [...hosts].filter(Boolean).slice(0, 60);
  if (!list.length) return '';
  return [
    `\nSOURCE COOLDOWN (${days} days): do NOT spend web searches re-opening these hosts — they were already visited this week for this org.`,
    `Prefer NEW official domains and portals. If a hit only exists on a cooldown host, skip unless it is the sole official source and clearly newly published.`,
    list.map((h) => `- ${h}`).join('\n'),
  ].join('\n');
}

/** Filtra queries site:host quando o host está em cooldown. */
export function filterQueriesAgainstCooldown(queries: string[], cooled: Set<string>): string[] {
  if (!cooled.size) return queries;
  return queries.filter((q) => {
    const site = q.match(/site:([a-z0-9.-]+)/i);
    if (!site?.[1]) return true;
    const host = canonicalizeDiscoveryHost(`https://${site[1]}`);
    if (!host) return true;
    return !cooled.has(host);
  });
}
