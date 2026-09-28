/**
 * POLARIS — mapa de autodesenvolvimento.
 * Conversa com IA → retrato editável → hipótese aceite → 2–4 apostas → ritmo.
 * Sem carteira de técnico e sem consola de operação.
 */

export const POLARIS_THREAD_KEY = '__polarisThread';
export const POLARIS_SUGGESTIONS_KEY = '__polarisSuggestions';

export type PolarisLocale = 'es' | 'pt' | 'en';

export type PolarisMessage = { role: 'user' | 'assistant'; text: string };

export type PolarisGap = { text: string; evidence?: string };

export type PolarisBetDraft = { title: string; why: string; indicator: string };

export type PolarisRhythmSuggestion = { happened: string; blocked: string; nextStep: string };

export type PolarisDraft = {
  reply: string;
  ready: boolean;
  revise: boolean;
  portraitText: string;
  hypothesis: string;
  gaps: PolarisGap[];
  potentials: PolarisGap[];
  bets: PolarisBetDraft[];
  rhythmSuggestion: PolarisRhythmSuggestion | null;
};

const THREAD_CAP = 30;

export function polarisOpening(locale: PolarisLocale): string {
  if (locale === 'es') return '¿Qué no puede quedar así esta semana?';
  if (locale === 'en') return "What can't stay like this this week?";
  return 'O que não pode ficar assim esta semana?';
}

export function polarisRetryReply(locale: PolarisLocale): string {
  if (locale === 'es') return 'Decilo en una frase: qué está trabado ahora.';
  if (locale === 'en') return "Say it in one sentence: what's stuck right now.";
  return 'Diz numa frase: o que está travado agora.';
}

export function polarisSystemPrompt(locale: PolarisLocale): string {
  const lang = locale === 'es' ? 'espanhol' : locale === 'en' ? 'inglês' : 'português';
  return `És o POLARIS. A pessoa está sozinha, no meio da semana. Não há técnico. Não és um diagnóstico.

Proibido:
- Questionário, catálogo, dimensões, Likert, notas, percentagens, "completar o diagnóstico".
- Perguntas que não mudam o que ela faz na segunda-feira.
- Percorrer o negócio inteiro "para ter o quadro completo".
- WhatsApp, sensores, campo, consola de operação.
- Inventar factos, clientes, números, prazos.

Como falas:
- Uma coisa de cada vez. Reply no máximo 45 palavras, em ${lang}.
- No máximo duas perguntas seguidas sem devolver retrato.
- Só perguntas se a resposta for usada já: no retrato, numa aposta, ou no passo desta semana.
- Começa pelo vivo: o que trava agora, ou o que já puxa. O que fazem e de onde entra dinheiro só se faltar para uma aposta concreta.

O que escreves no JSON (a pessoa não preenche isto):
- Retrato: 4–8 linhas de prosa, o negócio como está. Sem título de secção.
- Hipótese: uma frase — o travão e o puxão.
- Até 5 brechas e 3 potenciais, só do que ela disse.
- 2 a 4 apostas para as próximas semanas, cada uma com um indicador visível. Sem hipótese aceite, ficam no JSON; o reply pede só se o retrato está certo.
- Hipótese aceite: não reescrevas retrato salvo revise=true. Move uma aposta já aberta. rhythmSuggestion só com o que ela acabou de dizer.

ready=true quando retrato e hipótese já servem para a semana. revise=true só se ela corrigiu o que estava escrito.

Responde só JSON:
{"reply":"","ready":false,"revise":false,"portraitText":"","hypothesis":"","gaps":[{"text":"","evidence":""}],"potentials":[{"text":"","evidence":""}],"bets":[{"title":"","why":"","indicator":""}],"rhythmSuggestion":{"happened":"","blocked":"","nextStep":""}}`;
}

export function polarisUserPayload(input: {
  locale: PolarisLocale;
  companyName: string;
  activity: string;
  hypothesisAccepted: boolean;
  portraitText: string;
  hypothesis: string;
  gaps: PolarisGap[];
  potentials: PolarisGap[];
  bets: { title: string; status: string }[];
  lastRhythm: PolarisRhythmSuggestion | null;
  stage: 'talk' | 'portrait' | 'bets' | 'rhythm' | 'steady';
  thread: PolarisMessage[];
}): string {
  const gaps = input.gaps.map((g) => g.text).filter(Boolean).join('; ');
  const pots = input.potentials.map((g) => g.text).filter(Boolean).join('; ');
  const bets = input.bets.map((b) => `${b.title} [${b.status}]`).join('; ');
  const rhythm = input.lastRhythm
    ? `Aconteceu: ${input.lastRhythm.happened}\nTrava: ${input.lastRhythm.blocked}\nPasso: ${input.lastRhythm.nextStep}`
    : '';
  const talk = input.thread.map((m) => `${m.role === 'assistant' ? 'Mapa' : 'Pessoa'}: ${m.text}`).join('\n');
  return [
    `Empresa: ${input.companyName || '—'}`,
    `Etapa: ${input.stage} (não uses isto como guião de entrevista)`,
    input.activity ? `Atividade registada: ${input.activity}` : '',
    `Hipótese aceite: ${input.hypothesisAccepted ? 'sim' : 'não'}`,
    input.portraitText ? `Retrato actual:\n${input.portraitText}` : 'Retrato actual: (vazio)',
    input.hypothesis ? `Hipótese actual:\n${input.hypothesis}` : 'Hipótese actual: (vazia)',
    gaps ? `Brechas: ${gaps}` : '',
    pots ? `Potenciais: ${pots}` : '',
    bets ? `Apostas: ${bets}` : 'Apostas: (nenhuma)',
    rhythm ? `Última semana:\n${rhythm}` : '',
    `Conversa:\n${talk}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

function clip(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function looksLikeCatalogScore(text: string): boolean {
  return /\b\d{1,3}\s*\/\s*100\b/.test(text) || /\blikert\b/i.test(text);
}

/** Retrato colado do questionário NEXUS — o POLARIS não o mostra nem o alimenta. */
export function isCatalogPortrait(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (/diagn[oó]stico\s+nexus/i.test(t)) return true;
  if (looksLikeCatalogScore(t)) return true;
  return false;
}

function stripScoreLines(text: string): string {
  return text
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() && !looksLikeCatalogScore(line))
    .join('\n')
    .trim();
}

function asGapList(raw: unknown, max: number): PolarisGap[] {
  if (!Array.isArray(raw)) return [];
  const out: PolarisGap[] = [];
  for (const item of raw) {
    if (out.length >= max) break;
    const text = stripScoreLines(
      clip(typeof item === 'string' ? item : (item as { text?: unknown })?.text, 280),
    );
    if (!text || looksLikeCatalogScore(text)) continue;
    const evidence = clip((item as { evidence?: unknown })?.evidence, 180);
    out.push(evidence && !looksLikeCatalogScore(evidence) ? { text, evidence } : { text });
  }
  return out;
}

function asBets(raw: unknown): PolarisBetDraft[] {
  if (!Array.isArray(raw)) return [];
  const out: PolarisBetDraft[] = [];
  for (const item of raw) {
    if (out.length >= 4) break;
    if (!item || typeof item !== 'object') continue;
    const title = clip((item as { title?: unknown }).title, 200);
    if (title.length < 3 || looksLikeCatalogScore(title)) continue;
    out.push({
      title,
      why: clip((item as { why?: unknown }).why, 500),
      indicator: clip((item as { indicator?: unknown }).indicator, 160),
    });
  }
  return out;
}

function asRhythm(raw: unknown): PolarisRhythmSuggestion | null {
  if (!raw || typeof raw !== 'object') return null;
  const happened = clip((raw as { happened?: unknown }).happened, 500);
  const blocked = clip((raw as { blocked?: unknown }).blocked, 500);
  const nextStep = clip((raw as { nextStep?: unknown }).nextStep, 500);
  if (!happened && !blocked && !nextStep) return null;
  return { happened, blocked, nextStep };
}

export function parsePolarisModelJson(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/gi, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('invalid');
  return JSON.parse(cleaned.slice(start, end + 1));
}

export function normalizePolarisDraft(raw: unknown, locale: PolarisLocale): PolarisDraft {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const reply = clip(o.reply, 800) || polarisRetryReply(locale);
  const portraitText = stripScoreLines(clip(o.portraitText, 4000));
  const hypothesis = stripScoreLines(clip(o.hypothesis, 800));
  const ready = o.ready === true && portraitText.length >= 40 && hypothesis.length >= 12;
  return {
    reply,
    ready,
    revise: o.revise === true,
    portraitText,
    hypothesis,
    gaps: asGapList(o.gaps, 5),
    potentials: asGapList(o.potentials, 3),
    bets: ready ? asBets(o.bets) : [],
    rhythmSuggestion: asRhythm(o.rhythmSuggestion),
  };
}

function asMessage(raw: unknown): PolarisMessage | null {
  if (!raw || typeof raw !== 'object') return null;
  const role = (raw as { role?: unknown }).role;
  const text = clip((raw as { text?: unknown }).text, 4000);
  if ((role !== 'user' && role !== 'assistant') || !text) return null;
  return { role, text };
}

export function readPolarisThread(interviewJson: unknown): PolarisMessage[] {
  if (!interviewJson || typeof interviewJson !== 'object' || Array.isArray(interviewJson)) return [];
  const raw = (interviewJson as Record<string, unknown>)[POLARIS_THREAD_KEY];
  if (!Array.isArray(raw)) return [];
  return raw.map(asMessage).filter((m): m is PolarisMessage => Boolean(m)).slice(-THREAD_CAP);
}

export function readPolarisSuggestions(interviewJson: unknown): PolarisBetDraft[] {
  if (!interviewJson || typeof interviewJson !== 'object' || Array.isArray(interviewJson)) return [];
  return asBets((interviewJson as Record<string, unknown>)[POLARIS_SUGGESTIONS_KEY]);
}

export function polarisInterviewPatch(messages: PolarisMessage[], suggestions?: PolarisBetDraft[]): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    [POLARIS_THREAD_KEY]: messages.slice(-THREAD_CAP),
  };
  if (suggestions && suggestions.length) patch[POLARIS_SUGGESTIONS_KEY] = suggestions.slice(0, 4);
  return patch;
}

export function titleKey(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Apostas novas que ainda cabem nas 4 abertas, sem repetir título. */
export function selectNewBets(
  existingTitles: string[],
  proposed: PolarisBetDraft[],
  openCount: number,
): PolarisBetDraft[] {
  const room = Math.max(0, 4 - openCount);
  if (!room) return [];
  const seen = new Set(existingTitles.map(titleKey).filter(Boolean));
  const out: PolarisBetDraft[] = [];
  for (const bet of proposed) {
    if (out.length >= room) break;
    const key = titleKey(bet.title);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(bet);
  }
  return out;
}
