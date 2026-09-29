import { prisma } from './prisma';
import { llmCompleteJsonText, publicLlmErrorMessage } from './llm-client';
import { loadDossier, upsertDossier } from './business-dossier';
import type { AuroraLocale } from './aurora-interview';
import {
  applyDiagTurn,
  auroraDiagSystemPrompt,
  auroraDiagUserPayload,
  auroraDiagnosticPatch,
  confirmDiagBlock,
  diagProgress,
  getDiagBlockDef,
  nextEmptyBlockId,
  normalizeDiagPending,
  parseAuroraDiagJson,
  readAuroraDiagnostic,
  startDiagBlock,
  type AuroraDiagBlockId,
  type AuroraDiagnosticState,
  type AuroraMaturity,
} from './aurora-diagnostic';

export async function loadAuroraDiagnostic(companyId: string) {
  const [data, company] = await Promise.all([
    loadDossier(companyId),
    prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true, businessActivity: true },
    }),
  ]);
  const diagnostic = readAuroraDiagnostic(data.dossier?.interviewJson);
  return {
    companyName: company?.name || '',
    activity: String(company?.businessActivity || '').slice(0, 500),
    diagnostic,
    progress: diagProgress(diagnostic),
    dossier: data.dossier,
  };
}

export async function openAuroraDiagBlock(opts: {
  companyId: string;
  userId: string;
  blockId: AuroraDiagBlockId;
  locale: AuroraLocale;
}) {
  const loaded = await loadAuroraDiagnostic(opts.companyId);
  const diagnostic = startDiagBlock(loaded.diagnostic, opts.blockId, opts.locale);
  await upsertDossier(opts.companyId, opts.userId, {
    interviewJson: auroraDiagnosticPatch(diagnostic),
  });
  return {
    companyName: loaded.companyName,
    diagnostic,
    progress: diagProgress(diagnostic),
  };
}

export async function runAuroraDiagTurn(opts: {
  companyId: string;
  userId: string;
  blockId: AuroraDiagBlockId;
  message: string;
  locale: AuroraLocale;
}) {
  const message = opts.message.trim().slice(0, 4000);
  if (message.length < 1) throw new Error('aurora-diag:empty');

  const loaded = await loadAuroraDiagnostic(opts.companyId);
  let diagnostic = loaded.diagnostic;
  if (diagnostic.blocks[opts.blockId]?.status !== 'active') {
    diagnostic = startDiagBlock(diagnostic, opts.blockId, opts.locale);
  }
  const block = diagnostic.blocks[opts.blockId];
  const def = getDiagBlockDef(opts.blockId);

  let raw = '';
  try {
    raw = await llmCompleteJsonText(
      auroraDiagSystemPrompt(opts.locale),
      auroraDiagUserPayload({
        companyName: loaded.companyName,
        activity: loaded.activity,
        locale: opts.locale,
        block: def,
        blockState: block,
        message,
      }),
      { maxOutputTokens: 1024 },
    );
  } catch (e) {
    console.error('[aurora-diag] turn failed', e);
    throw new Error(publicLlmErrorMessage(e));
  }

  let pending = normalizeDiagPending({ reply: '' }, opts.locale);
  try {
    pending = normalizeDiagPending(parseAuroraDiagJson(raw), opts.locale);
  } catch (e) {
    console.error('[aurora-diag] parse failed', e);
  }

  diagnostic = applyDiagTurn(diagnostic, opts.blockId, message, pending);
  await upsertDossier(opts.companyId, opts.userId, {
    interviewJson: auroraDiagnosticPatch(diagnostic),
  });

  return {
    companyName: loaded.companyName,
    diagnostic,
    progress: diagProgress(diagnostic),
    pending,
  };
}

export async function confirmAuroraDiagBlock(opts: {
  companyId: string;
  userId: string;
  blockId: AuroraDiagBlockId;
  level: AuroraMaturity;
  situation: string;
  gap: string;
  potential: string;
  locale: AuroraLocale;
  autoNext?: boolean;
}) {
  const loaded = await loadAuroraDiagnostic(opts.companyId);
  let diagnostic = confirmDiagBlock(loaded.diagnostic, opts.blockId, {
    level: opts.level,
    situation: opts.situation,
    gap: opts.gap,
    potential: opts.potential,
  });

  const progress = diagProgress(diagnostic);
  const gaps = progress.gaps.map((text) => ({ text, evidence: 'diagnóstico' }));
  const potentials = progress.potentials.map((text) => ({ text, evidence: 'diagnóstico' }));

  let nextId: AuroraDiagBlockId | null = null;
  if (opts.autoNext !== false) {
    nextId = nextEmptyBlockId(diagnostic);
    if (nextId) diagnostic = startDiagBlock(diagnostic, nextId, opts.locale);
  }

  await upsertDossier(opts.companyId, opts.userId, {
    gaps: gaps.length ? gaps : undefined,
    potentials: potentials.length ? potentials : undefined,
    interviewJson: auroraDiagnosticPatch(diagnostic),
  });

  return {
    companyName: loaded.companyName,
    diagnostic,
    progress: diagProgress(diagnostic),
    nextBlockId: nextId,
  };
}

export function summarizeDiagnosticForPortfolio(diagnostic: AuroraDiagnosticState) {
  const progress = diagProgress(diagnostic);
  return {
    diagnosticDone: progress.done,
    diagnosticTotal: progress.total,
    diagnosticComplete: progress.complete,
    diagnosticAvg: progress.avgLevel,
  };
}
