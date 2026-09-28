import { prisma } from './prisma';
import { llmCompleteJsonText, publicLlmErrorMessage } from './llm-client';
import { auroraMethodStage } from './aurora-portfolio';
import { loadDossier, upsertDossier } from './business-dossier';
import {
  isCatalogPortrait,
  parsePolarisModelJson,
  polarisInterviewPatch,
  polarisOpening,
  polarisRetryReply,
  polarisSystemPrompt,
  polarisUserPayload,
  normalizePolarisDraft,
  readPolarisSuggestions,
  readPolarisThread,
  selectNewBets,
  type PolarisBetDraft,
  type PolarisLocale,
  type PolarisMessage,
} from './polaris-map';

function openBet(status: string): boolean {
  return status !== 'done' && status !== 'dropped';
}

export async function materializePolarisSuggestions(companyId: string, interviewJson: unknown, also: PolarisBetDraft[] = []) {
  const proposed = [...readPolarisSuggestions(interviewJson), ...also];
  if (!proposed.length) return 0;
  const existing = await prisma.businessBet.findMany({
    where: { companyId },
    select: { title: true, status: true, sortOrder: true },
  });
  const openCount = existing.filter((b) => openBet(b.status)).length;
  const picks = selectNewBets(
    existing.map((b) => b.title),
    proposed,
    openCount,
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

export async function runPolarisTurn(opts: {
  companyId: string;
  userId: string;
  message: string;
  locale: PolarisLocale;
  screenPortrait?: string;
  screenHypothesis?: string;
}) {
  const message = opts.message.trim().slice(0, 4000);
  if (message.length < 1) throw new Error('polaris:empty');

  const [company, loaded] = await Promise.all([
    prisma.company.findUnique({
      where: { id: opts.companyId },
      select: { name: true, businessActivity: true },
    }),
    loadDossier(opts.companyId),
  ]);

  const prior = readPolarisThread(loaded.dossier?.interviewJson);
  const thread: PolarisMessage[] = [
    ...(prior.length ? prior : [{ role: 'assistant' as const, text: polarisOpening(opts.locale) }]),
    { role: 'user', text: message },
  ].slice(-30);

  const last = loaded.rhythm[0];
  const rawPortrait = opts.screenPortrait != null ? opts.screenPortrait : loaded.dossier?.portraitText || '';
  const screenPortrait = isCatalogPortrait(rawPortrait) ? '' : rawPortrait;
  const screenHypothesis = isCatalogPortrait(rawPortrait)
    ? ''
    : opts.screenHypothesis != null
      ? opts.screenHypothesis
      : loaded.dossier?.hypothesis || '';
  const stage = auroraMethodStage({
    hasPortrait: Boolean(screenPortrait.trim()),
    hypothesisAccepted: Boolean(loaded.dossier?.hypothesisAccepted),
    openBetCount: loaded.bets.filter((b) => openBet(b.status)).length,
    lastRhythmAt: last?.createdAt ?? null,
  });
  let raw = '';
  try {
    raw = await llmCompleteJsonText(
      polarisSystemPrompt(opts.locale),
      polarisUserPayload({
        locale: opts.locale,
        companyName: company?.name || '',
        activity: String(company?.businessActivity || '').slice(0, 500),
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
    console.error('[polaris] turn failed', e);
    throw new Error(publicLlmErrorMessage(e));
  }

  let draft = normalizePolarisDraft({ reply: polarisRetryReply(opts.locale) }, opts.locale);
  try {
    draft = normalizePolarisDraft(parsePolarisModelJson(raw), opts.locale);
  } catch (e) {
    console.error('[polaris] draft parse failed', e);
  }

  const messages: PolarisMessage[] = [...thread, { role: 'assistant', text: draft.reply }].slice(-30);
  const accepted = Boolean(loaded.dossier?.hypothesisAccepted);
  const writeMap = draft.ready && (!accepted || draft.revise);

  await upsertDossier(opts.companyId, opts.userId, {
    interviewJson: polarisInterviewPatch(messages, draft.bets),
    portraitText: writeMap && draft.portraitText ? draft.portraitText : undefined,
    hypothesis: writeMap && draft.hypothesis ? draft.hypothesis : undefined,
    gaps: writeMap && draft.gaps.length ? draft.gaps : undefined,
    potentials: writeMap && draft.potentials.length ? draft.potentials : undefined,
  });

  if (accepted && draft.bets.length) {
    const saved = await loadDossier(opts.companyId);
    await materializePolarisSuggestions(opts.companyId, saved.dossier?.interviewJson, draft.bets);
  }

  const fresh = await loadDossier(opts.companyId);
  return {
    ok: true as const,
    reply: draft.reply,
    ready: writeMap,
    messages,
    suggestions: readPolarisSuggestions(fresh.dossier?.interviewJson),
    rhythmSuggestion: draft.rhythmSuggestion,
    portraitText: fresh.dossier?.portraitText || '',
    hypothesis: fresh.dossier?.hypothesis || '',
    hypothesisAccepted: Boolean(fresh.dossier?.hypothesisAccepted),
    gaps: fresh.dossier?.gaps || [],
    potentials: fresh.dossier?.potentials || [],
    bets: fresh.bets,
    rhythm: fresh.rhythm,
  };
}
