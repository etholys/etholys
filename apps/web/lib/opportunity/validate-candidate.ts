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
import {
  recordOpportunityFeedback,
  type LearningAction,
  type LikeReason,
  type RejectReason,
} from '@/lib/opportunity/learning-feedback';

function parseDeadline(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export type ValidateAction = 'save' | 'not_now' | 'reject_type' | 'discard' | 'later';

export async function validateScanCandidate(opts: {
  companyId: string;
  userId: string;
  runId: string;
  tempId: string;
  action: ValidateAction;
  reasons?: string[];
  note?: string;
}): Promise<{ ok: true; fundId?: string; pending: number; learning?: LearningAction }> {
  const payload = await readScanResults(opts.companyId, opts.runId);
  const candidate = payload.candidates.find((c) => c.tempId === opts.tempId);
  if (!candidate) {
    throw new Error('Candidato não encontrado nesta varredura');
  }

  // Normalizar acções legadas
  const action: ValidateAction =
    opts.action === 'discard' ? 'not_now' : opts.action === 'later' ? 'not_now' : opts.action;

  let fundId: string | undefined;
  let learning: LearningAction | undefined;

  if (action === 'save') {
    fundId = await upsertFundFromCandidate(opts.companyId, candidate, opts.runId);
    await prisma.userFundStatus.upsert({
      where: { fundId_userId: { fundId, userId: opts.userId } },
      update: { status: 'saved', notes: opts.note || 'Validado na varredura' },
      create: {
        fundId,
        userId: opts.userId,
        status: 'saved',
        notes: opts.note || 'Validado na varredura',
      },
    });
    if (!payload.savedTempIds.includes(opts.tempId)) {
      payload.savedTempIds.push(opts.tempId);
    }
    learning = 'like';
    await recordOpportunityFeedback({
      companyId: opts.companyId,
      userId: opts.userId,
      candidate,
      action: 'like',
      reasons: (opts.reasons as LikeReason[] | undefined) ?? ['more_like_this'],
      note: opts.note,
    });
  } else if (action === 'reject_type') {
    if (!payload.discardedTempIds.includes(opts.tempId)) {
      payload.discardedTempIds.push(opts.tempId);
    }
    learning = 'reject_type';
    await recordOpportunityFeedback({
      companyId: opts.companyId,
      userId: opts.userId,
      candidate,
      action: 'reject_type',
      reasons: (opts.reasons as RejectReason[] | undefined) ?? ['other'],
      note: opts.note,
    });
  } else {
    // not_now — some nesta ocasião; não ensina a odiar o tipo
    if (!payload.laterTempIds.includes(opts.tempId)) {
      payload.laterTempIds.push(opts.tempId);
    }
    learning = 'not_now';
    await recordOpportunityFeedback({
      companyId: opts.companyId,
      userId: opts.userId,
      candidate,
      action: 'not_now',
      reasons: opts.reasons,
      note: opts.note,
    });
  }

  await writeScanResults(opts.companyId, payload, `validate:${opts.userId}`);

  if (action === 'save' && candidate.deadline) {
    void syncDeadlineNotifications(opts.companyId, opts.userId);
  }

  return {
    ok: true,
    fundId,
    pending: pendingCandidates(payload).length,
    learning,
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
  const links = sanitizeFundingLinks(c.callUrl || c.linkOficial, c.sourceUrl);
  const eligibilityCriteria =
    [c.whoCanApply, c.eligibility, c.requirements].filter(Boolean).join('\n\n') ||
    c.applicationWindow ||
    null;
  const noteParts = [
    c.applicationWindow ? `Janela: ${c.applicationWindow}` : '',
    c.howToApply ? `Candidatura: ${c.howToApply}` : '',
    c.risksCaveats ? `Avisos: ${c.risksCaveats}` : '',
    c.availabilityNote ? c.availabilityNote : '',
    c.opensAt ? `Abre: ${c.opensAt}` : '',
    c.callUrl ? `Convocatória: ${c.callUrl}` : '',
    c.institutionUrl && c.institutionUrl !== c.callUrl ? `Instituição: ${c.institutionUrl}` : '',
    c.documents?.length
      ? `Documentos: ${c.documents.map((d) => `${d.title} ${d.url}`).join(' | ')}`
      : '',
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
    eligibilityCriteria,
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
      notes: [`Descoberto na varredura ${runId}`, ...noteParts].filter(Boolean).join(' · ') || null,
    },
  });
  return created.id;
}
