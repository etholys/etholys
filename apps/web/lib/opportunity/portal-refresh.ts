import 'server-only';

import { prisma } from '@/lib/prisma';
import { readOpportunityBriefing } from '@/lib/opportunity/briefing';
import { fetchSourceSnippets } from '@/lib/opportunity/fetch-sources';
import { listPortalRefreshSources } from '@/lib/opportunity/source-catalog';
import { syncWindowOpenNotifications } from '@/lib/opportunity/deadline-alerts';

const PREF_KEY = 'lastPortalRefresh';

export type PortalRefreshCompanyResult = {
  companyId: string;
  sources: number;
  fetched: number;
  errors: number;
  watchNotified: number;
  watchChecked: number;
};

async function readPrefs(companyId: string): Promise<Record<string, unknown>> {
  const profile = await prisma.fundingCaptureProfile.findUnique({
    where: { companyId },
    select: { preferencesJson: true },
  });
  if (!profile?.preferencesJson) return {};
  try {
    return JSON.parse(profile.preferencesJson) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function writePrefs(companyId: string, prefs: Record<string, unknown>) {
  const existing = await prisma.fundingCaptureProfile.findUnique({
    where: { companyId },
    select: { id: true },
  });
  const json = JSON.stringify(prefs);
  if (existing) {
    await prisma.fundingCaptureProfile.update({
      where: { companyId },
      data: { preferencesJson: json },
    });
  } else {
    await prisma.fundingCaptureProfile.create({
      data: { companyId, preferencesJson: json },
    });
  }
}

async function notifyUserId(companyId: string): Promise<string | null> {
  const member = await prisma.companyUser.findFirst({
    where: { companyId },
    orderBy: { createdAt: 'asc' },
    select: { userId: true },
  });
  return member?.userId ?? null;
}

/** Refresh leve de portais + sync do relógio (watch reopen) para uma empresa. */
export async function refreshPortalsForCompany(
  companyId: string,
): Promise<PortalRefreshCompanyResult> {
  const briefing = await readOpportunityBriefing(companyId);
  const sources = await listPortalRefreshSources({
    companyId,
    countries: briefing.countries,
    limit: 10,
  });
  const { snippets, fetched, errors } = await fetchSourceSnippets(sources);

  const prefs = await readPrefs(companyId);
  prefs[PREF_KEY] = {
    at: new Date().toISOString(),
    sources: sources.length,
    fetched,
    errors,
    hosts: sources.slice(0, 12).map((s) => ({ name: s.name, url: s.url, kind: s.kind })),
    sampleOk: snippets.filter((s) => s.ok).slice(0, 5).map((s) => s.url),
  };
  await writePrefs(companyId, prefs);

  let watchNotified = 0;
  let watchChecked = 0;
  const userId = await notifyUserId(companyId);
  if (userId) {
    const watch = await syncWindowOpenNotifications(companyId, userId);
    watchNotified = watch.created;
    watchChecked = watch.checked;
  }

  return {
    companyId,
    sources: sources.length,
    fetched,
    errors,
    watchNotified,
    watchChecked,
  };
}

/**
 * Batch cron: empresas com perfil de captação (ou companyId explícito).
 * Sem LLM — só HTTP nos portais + sync do relógio.
 */
export async function runPortalRefreshBatch(opts?: {
  companyId?: string;
  limitCompanies?: number;
}): Promise<{
  companies: number;
  results: PortalRefreshCompanyResult[];
}> {
  const limit = Math.min(Math.max(opts?.limitCompanies ?? 25, 1), 80);
  let companyIds: string[];

  if (opts?.companyId) {
    companyIds = [opts.companyId];
  } else {
    const profiles = await prisma.fundingCaptureProfile.findMany({
      select: { companyId: true },
      take: limit,
      orderBy: { updatedAt: 'desc' },
    });
    companyIds = profiles.map((p) => p.companyId);
  }

  const results: PortalRefreshCompanyResult[] = [];
  for (const companyId of companyIds) {
    try {
      results.push(await refreshPortalsForCompany(companyId));
    } catch (e) {
      console.error('[portal-refresh]', companyId, e);
      results.push({
        companyId,
        sources: 0,
        fetched: 0,
        errors: 1,
        watchNotified: 0,
        watchChecked: 0,
      });
    }
  }

  return { companies: results.length, results };
}
