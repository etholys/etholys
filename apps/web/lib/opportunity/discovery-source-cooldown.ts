import 'server-only';

import { prisma } from '@/lib/prisma';
import {
  canonicalizeDiscoveryHost,
  sourceCooldownDays,
} from '@/lib/opportunity/discovery-source-cooldown-core';

export {
  canonicalizeDiscoveryHost,
  extractHostsFromCandidates,
  extractHostsFromText,
  filterQueriesAgainstCooldown,
  formatCooldownPromptBlock,
  sourceCooldownDays,
} from '@/lib/opportunity/discovery-source-cooldown-core';

export async function loadCooldownHosts(
  companyId: string,
  days = sourceCooldownDays(),
): Promise<Set<string>> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  try {
    const rows = await prisma.fundhubSourceVisit.findMany({
      where: { companyId, lastSeenAt: { gte: since } },
      select: { host: true },
      take: 400,
    });
    return new Set(rows.map((r) => r.host));
  } catch (e) {
    console.warn('[fundhub] loadCooldownHosts failed (migration pending?):', e);
    return new Set();
  }
}

export async function recordSourceVisits(opts: {
  companyId: string;
  hosts: string[];
  runId?: string | null;
}): Promise<number> {
  const unique = [
    ...new Set(opts.hosts.map((h) => canonicalizeDiscoveryHost(h)).filter(Boolean)),
  ] as string[];
  if (!unique.length) return 0;
  const now = new Date();
  let n = 0;
  try {
    for (const host of unique.slice(0, 80)) {
      await prisma.fundhubSourceVisit.upsert({
        where: { companyId_host: { companyId: opts.companyId, host } },
        create: {
          companyId: opts.companyId,
          host,
          lastSeenAt: now,
          lastRunId: opts.runId ?? null,
          hitCount: 1,
        },
        update: {
          lastSeenAt: now,
          lastRunId: opts.runId ?? undefined,
          hitCount: { increment: 1 },
        },
      });
      n += 1;
    }
  } catch (e) {
    console.warn('[fundhub] recordSourceVisits failed:', e);
  }
  return n;
}
