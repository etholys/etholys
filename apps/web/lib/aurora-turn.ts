import { prisma } from './prisma';
import { llmCompleteJsonText, publicLlmErrorMessage } from './llm-client';
import { auroraMethodStage } from './aurora-portfolio';
import { loadDossier, upsertDossier } from './business-dossier';
import {
  auroraInterviewPatch,
  auroraOpening,
  auroraRetryReply,
  auroraSystemPrompt,
  auroraUserPayload,
  looksLikeCatalogScore,
  normalizeAuroraDraft,
  parseAuroraModelJson,
  readAuroraDraft,
  readAuroraSuggestions,
  readAuroraTech,
  readAuroraThread,
  selectAuroraBets,
  type AuroraBetDraft,
  type AuroraLocale,
  type AuroraMessage,
  type AuroraTech,
} from './aurora-interview';

function openBet(status: string): boolean {
  return status !== 'done' && status !== 'dropped';
}

function cleanPortrait(text: string): string {
  const t = text.trim();
  if (!t || looksLikeCatalogScore(t)) return '';
  return t
    .split('\n')
    .filter((line) => line.trim() && !looksLikeCatalogScore(line))
    .join('\n')
    .trim();
}

export async function materializeAuroraBets(companyId: string, proposed: AuroraBetDraft[]) {
  if (!proposed.length) return 0;
  const existing = await prisma.businessBet.findMany({
    where: { companyId },
    select: { title: true, status: true, sortOrder: true },
  });
  const picks = selectAuroraBets(
    existing.map((b) => b.title),
    proposed,
    existing.filter((b) => openBet(b.status)).length,
  );
  if (!picks.length) return 0;
  const start = existing.reduce((max, b) => Math.max(max, b.sortOrder), -1) + 1;
  await prisma.businessBet.createMany({
    data: picks.map((bet, i) => ({
      companyId,
      title: bet.title,
      why: bet.why,
      indicator: bet.indicator || null,
      status: 'proposed',
      sortOrder: start + i,
    })),
  });
  return picks.length;
}

export async function claimAuroraBusiness(opts: {
  companyId: string;
  userId: string;
  userName: string;
}): Promise<AuroraTech> {
  const tech: AuroraTech = {
    userId: opts.userId,
    name: opts.userName.slice(0, 120) || opts.userId,
    claimedAt: new Date().toISOString(),
  };
  await upsertDossier(opts.companyId, opts.userId, {
    interviewJson: auroraInterviewPatch({ tech }),
  });
  return tech;
}

export async function applyAuroraDraft(opts: { companyId: string; userId: string }) {
  const loaded = await loadDossier(opts.companyId);
  const draft = readAuroraDraft(loaded.dossier?.interviewJson);
  if (!draft?.portraitText || !draft.hypothesis) {
    throw new Error('aurora:no-draft');
  }
  await upsertDossier(opts.companyId, opts.userId, {
    portraitText: draft.portraitText,
    hypothesis: draft.hypothesis,
    hypothesisAccepted: false,
    gaps: draft.gaps,
    potentials: draft.potentials,
    interviewJson: auroraInterviewPatch({ suggestions: draft.bets }),
  });
  return loadDossier(opts.companyId);
}

export async function runAuroraTurn(opts: {
  companyId: string;
  userId: string;
  message: string;
  locale: AuroraLocale;
  screenPortrait?: string;
  screenHypothesis?: string;
}) {
  const message = opts.message.trim().slice(0, 4000);
  if (message.length < 1) throw new Error('aurora:empty');

  const [company, loaded, user] = await Promise.all([
    prisma.company.findUnique({
      where: { id: opts.companyId },
      select: { name: true, businessActivity: true },
    }),
    loadDossier(opts.companyId),
    prisma.user.findUnique({ where: { id: opts.userId }, select: { name: true, email: true } }),
  ]);

  const tech =
    readAuroraTech(loaded.dossier?.interviewJson) ||
    ({
      userId: opts.userId,
      name: (user?.name || user?.email || '').slice(0, 120),
      claimedAt: new Date().toISOString(),
    } satisfies AuroraTech);

  const prior = readAuroraThread(loaded.dossier?.interviewJson);
  const thread: AuroraMessage[] = [
    ...(prior.length ? prior : [{ role: 'assistant' as const, text: auroraOpening(opts.locale) }]),
    { role: 'user', text: message },
  ].slice(-40);

  const last = loaded.rhythm[0];
  const screenPortrait = cleanPortrait(
    opts.screenPortrait != null ? opts.screenPortrait : loaded.dossier?.portraitText || '',
  );
  const screenHypothesis = screenPortrait
    ? opts.screenHypothesis != null
      ? opts.screenHypothesis
      : loaded.dossier?.hypothesis || ''
    : '';
  const stage = auroraMethodStage({
    hasPortrait: Boolean(screenPortrait),
    hypothesisAccepted: Boolean(loaded.dossier?.hypothesisAccepted),
    openBetCount: loaded.bets.filter((b) => openBet(b.status)).length,
    lastRhythmAt: last?.createdAt ?? null,
  });

  let raw = '';
  try {
    raw = await llmCompleteJsonText(
      auroraSystemPrompt(opts.locale),
      auroraUserPayload({
        companyName: company?.name || '',
        activity: String(company?.businessActivity || '').slice(0, 500),
        technicianName: tech.name,
        hypothesisAccepted: Boolean(loaded.dossier?.hypothesisAccepted),
        portraitText: screenPortrait,
        hypothesis: screenHypothesis,
        stage,
        gaps: loaded.dossier?.gaps || [],
        potentials: loaded.dossier?.potentials || [],
        bets: loaded.bets.map((b) => ({ title: b.title, status: b.status })),
        lastRhythm: last
          ? { happened: last.happened, blocked: last.blocked, nextStep: last.nextStep }
          : null,
        thread,
      }),
      { maxOutputTokens: 2048 },
    );
  } catch (e) {
    console.error('[aurora] turn failed', e);
    throw new Error(publicLlmErrorMessage(e));
  }

  let draft = normalizeAuroraDraft({ reply: auroraRetryReply(opts.locale) }, opts.locale);
  try {
    draft = normalizeAuroraDraft(parseAuroraModelJson(raw), opts.locale);
  } catch (e) {
    console.error('[aurora] draft parse failed', e);
  }

  const messages: AuroraMessage[] = [...thread, { role: 'assistant', text: draft.reply }].slice(-40);
  await upsertDossier(opts.companyId, opts.userId, {
    interviewJson: auroraInterviewPatch({
      messages,
      draft,
      suggestions: draft.bets,
      tech,
    }),
  });

  const fresh = await loadDossier(opts.companyId);
  return {
    ok: true as const,
    reply: draft.reply,
    ready: draft.ready,
    messages,
    draft,
    suggestions: readAuroraSuggestions(fresh.dossier?.interviewJson),
    tech: readAuroraTech(fresh.dossier?.interviewJson),
    companyName: company?.name || '',
    portraitText: cleanPortrait(fresh.dossier?.portraitText || ''),
    hypothesis: fresh.dossier?.hypothesis || '',
    hypothesisAccepted: Boolean(fresh.dossier?.hypothesisAccepted),
    gaps: fresh.dossier?.gaps || [],
    potentials: fresh.dossier?.potentials || [],
    bets: fresh.bets,
    rhythm: fresh.rhythm,
  };
}
