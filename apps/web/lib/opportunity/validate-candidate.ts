import 'server-only';

import { prisma } from '@/lib/prisma';
import { syncDeadlineNotifications } from '@/lib/opportunity/deadline-alerts';
import {
  pendingCandidates,
  readScanResults,
  writeScanResults,
} from '@/lib/opportunity/candidate-store';
import type { ScanCandidate } from '@/lib/opportunity/scan-types';
import { fundStatusFromAvailability } from '@/lib/opportunity/availability';
import { sanitizeFundingLinks } from '@/lib/opportunity/official-url';

function parseDeadline(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function validateScanCandidate(opts: {
  companyId: string;
  userId: string;
  runId: string;
  tempId: string;
  action: 'save' | 'discard' | 'later';
}): Promise<{ ok: true; fundId?: string; pending: number }> {
  const payload = await readScanResults(opts.companyId, opts.runId);
  const candidate = payload.candidates.find((c) => c.tempId === opts.tempId);
  if (!candidate) {
    throw new Error('Candidato não encontrado nesta varredura');
  }

  let fundId: string | undefined;

  if (opts.action === 'save') {
    fundId = await upsertFundFromCandidate(opts.companyId, candidate, opts.runId);
    await prisma.userFundStatus.upsert({
      where: { fundId_userId: { fundId, userId: opts.userId } },
      update: { status: 'saved', notes: 'Validado na varredura' },
      create: { fundId, userId: opts.userId, status: 'saved', notes: 'Validado na varredura' },
    });
    if (!payload.savedTempIds.includes(opts.tempId)) {
      payload.savedTempIds.push(opts.tempId);
    }
  } else if (opts.action === 'discard') {
    if (!payload.discardedTempIds.includes(opts.tempId)) {
      payload.discardedTempIds.push(opts.tempId);
    }
  } else {
    if (!payload.laterTempIds.includes(opts.tempId)) {
      payload.laterTempIds.push(opts.tempId);
    }
  }

  await writeScanResults(opts.companyId, payload, `validate:${opts.userId}`);

  if (opts.action === 'save' && candidate.deadline) {
    void syncDeadlineNotifications(opts.companyId, opts.userId);
  }

  return {
    ok: true,
    fundId,
    pending: pendingCandidates(payload).length,
  };
}

async function upsertFundFromCandidate(
  companyId: string,
  c: ScanCandidate,
  runId: string,
): Promise<string> {
  const existing = await prisma.fund.findFirst({
    where: {
      companyId,
      name: c.name,
      institution: c.institution,
      isActive: true,
    },
    select: { id: true },
  });

  const closesAt = c.closesAt ?? c.deadline;
  const countries = c.eligibleCountries ?? c.countries ?? null;
  const links = sanitizeFundingLinks(c.linkOficial, c.sourceUrl);
  const noteParts = [
    c.applicationWindow ? `Janela: ${c.applicationWindow}` : '',
    c.availabilityNote ? c.availabilityNote : '',
    c.opensAt ? `Abre: ${c.opensAt}` : '',
  ].filter(Boolean);

  const data = {
    name: c.name,
    institution: c.institution,
    description: c.description ?? null,
    linkOficial: links.linkOficial ?? null,
    type: c.type,
    category: c.category ?? null,
    amount: c.amount ?? null,
    currency: c.currency ?? 'USD',
    deadline: parseDeadline(closesAt),
    status: fundStatusFromAvailability(c.availabilityStatus),
    countries,
    sectors: c.sectors ?? null,
    matchScore: c.matchScore ?? null,
    matchJustification: c.matchJustification ?? null,
    sourceOfInformation: links.sourceUrl ?? links.linkOficial ?? null,
    eligibilityCriteria: c.applicationWindow ?? null,
    notes: noteParts.length ? noteParts.join(' · ') : null,
    lastReviewedAt: new Date(),
  };

  if (existing) {
    await prisma.fund.update({ where: { id: existing.id }, data });
    return existing.id;
  }

  const created = await prisma.fund.create({
    data: {
      companyId,
      ...data,
      notes: `Descoberto na varredura ${runId}`,
    },
  });
  return created.id;
}
