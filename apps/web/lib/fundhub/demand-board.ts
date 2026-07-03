import 'server-only';

import { prisma } from '@/lib/prisma';

function splitTags(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[,;|]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);
}

export type DemandBoardPayload = {
  totals: {
    openFunds: number;
    deadlines14d: number;
    savedByTeam: number;
    avgMatchScore: number | null;
  };
  byCountry: Array<{ label: string; count: number; urgent: number }>;
  bySector: Array<{ label: string; count: number }>;
  byType: Array<{ label: string; count: number }>;
  hotspots: Array<{
    id: string;
    name: string;
    institution: string;
    deadline: string | null;
    countries: string[];
    sectors: string[];
    matchScore: number | null;
  }>;
};

export async function buildDemandBoard(companyId: string): Promise<DemandBoardPayload> {
  const now = new Date();
  const in14 = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const funds = await prisma.fund.findMany({
    where: { companyId, isActive: true, status: 'open' },
    select: {
      id: true,
      name: true,
      institution: true,
      countries: true,
      sectors: true,
      type: true,
      deadline: true,
      matchScore: true,
      userStatus: { select: { status: true } },
    },
    orderBy: [{ deadline: 'asc' }, { matchScore: 'desc' }],
    take: 200,
  });

  const countryMap = new Map<string, { count: number; urgent: number }>();
  const sectorMap = new Map<string, number>();
  const typeMap = new Map<string, number>();
  let deadlines14d = 0;
  let savedByTeam = 0;
  let matchSum = 0;
  let matchN = 0;

  for (const f of funds) {
    const countries = splitTags(f.countries);
    const sectors = splitTags(f.sectors);
    const urgent = f.deadline && f.deadline >= now && f.deadline <= in14;
    if (urgent) deadlines14d += 1;

    if (f.userStatus.some((s) => s.status === 'saved')) savedByTeam += 1;
    if (typeof f.matchScore === 'number') {
      matchSum += f.matchScore;
      matchN += 1;
    }

    for (const c of countries.length ? countries : ['—']) {
      const cur = countryMap.get(c) ?? { count: 0, urgent: 0 };
      cur.count += 1;
      if (urgent) cur.urgent += 1;
      countryMap.set(c, cur);
    }
    for (const s of sectors.length ? sectors : ['—']) {
      sectorMap.set(s, (sectorMap.get(s) ?? 0) + 1);
    }
    const t = f.type?.trim() || '—';
    typeMap.set(t, (typeMap.get(t) ?? 0) + 1);
  }

  const byCountry = [...countryMap.entries()]
    .map(([label, v]) => ({ label, count: v.count, urgent: v.urgent }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  const bySector = [...sectorMap.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  const byType = [...typeMap.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const hotspots = funds
    .filter((f) => f.deadline && f.deadline >= now)
    .slice(0, 8)
    .map((f) => ({
      id: f.id,
      name: f.name,
      institution: f.institution,
      deadline: f.deadline?.toISOString() ?? null,
      countries: splitTags(f.countries),
      sectors: splitTags(f.sectors),
      matchScore: f.matchScore,
    }));

  return {
    totals: {
      openFunds: funds.length,
      deadlines14d,
      savedByTeam,
      avgMatchScore: matchN > 0 ? Math.round((matchSum / matchN) * 10) / 10 : null,
    },
    byCountry,
    bySector,
    byType,
    hotspots,
  };
}
