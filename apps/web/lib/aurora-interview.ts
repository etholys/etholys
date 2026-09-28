/**
 * AURORA — conversa do técnico com o negócio.
 * O LLM propõe a próxima pergunta e um rascunho; o técnico corrige e aceita.
 * Não é o POLARIS (a pessoa sozinha) nem o quiz NEXUS.
 */

export const AURORA_THREAD_KEY = '__auroraThread';
export const AURORA_DRAFT_KEY = '__auroraDraft';
export const AURORA_TECH_KEY = '__auroraTech';
export const AURORA_SUGGESTIONS_KEY = '__auroraSuggestions';

export type AuroraLocale = 'es' | 'pt' | 'en';
export type AuroraMessage = { role: 'user' | 'assistant'; text: string };
export type AuroraGap = { text: string; evidence?: string };
export type AuroraBetDraft = { title: string; why: string; indicator: string };
export type AuroraTech = { userId: string; name: string; claimedAt: string };

export type AuroraDraft = {
  reply: string;
  ready: boolean;
  portraitText: string;
  hypothesis: string;
  gaps: AuroraGap[];
  potentials: AuroraGap[];
  bets: AuroraBetDraft[];
};

const THREAD_CAP = 40;

export function auroraOpening(locale: AuroraLocale): string {
  if (locale === 'es') {
    return 'Pegá lo que dijeron, en sus palabras. Yo te digo la próxima pregunta — no es un cuestionario.';
  }
  if (locale === 'en') {
    return 'Paste what they said, in their words. I will give you the next question — this is not a questionnaire.';
  }
  return 'Cola o que disseram, nas palavras deles. Eu digo-te a próxima pergunta — isto não é um questionário.';
}

export function auroraRetryReply(locale: AuroraLocale): string {
  if (locale === 'es') return 'Pegá una frase de ellos: qué hacen, o qué está trabado.';
  if (locale === 'en') return 'Paste one sentence from them: what they do, or what is stuck.';
  return 'Cola uma frase deles: o que fazem, ou o que está travado.';
}

export function auroraSystemPrompt(locale: AuroraLocale): string {
  const lang = locale === 'es' ? 'espanhol' : locale === 'en' ? 'inglês' : 'português';
  return `És o entrevistador do AURORA, incubadora virtual Etholys. Falas com o TÉCNICO, não com o negócio.

O técnico está à frente da pessoa (ou no telefone). Cola o que ouviu. Tu:
- Dás UMA próxima pergunta para o técnico fazer, em ${lang}. Reply no máximo 50 palavras.
- Nunca fazes quiz, Likert, dimensões, notas, percentagens, "diagnóstico 360", catálogo.
- Não percorres o negócio inteiro "para ter o quadro". Segues o método: o que fazem → dinheiro → entrega → o que trava → o que já puxa.
- Máximo 5 brechas e 3 potenciais, só com evidência da conversa.
- Retrato: 4–8 linhas de prosa, o negócio como está. Hipótese: uma frase (travão e puxão).
- 2 a 4 apostas só quando já há retrato e hipótese úteis. Cada aposta: título, porquê, indicador visível esta semana.
- Não inventes clientes, números, prazos.
- ready=true quando o técnico já pode ler o retrato em voz alta e aceitar a hipótese. Até lá ready=false e retrato pode ir incompleto.

JSON só:
{"reply":"","ready":false,"portraitText":"","hypothesis":"","gaps":[{"text":"","evidence":""}],"potentials":[{"text":"","evidence":""}],"bets":[{"title":"","why":"","indicator":""}]}`;
}

export function auroraUserPayload(input: {
  companyName: string;
  activity: string;
  technicianName: string;
  hypothesisAccepted: boolean;
  portraitText: string;
  hypothesis: string;
  stage: string;
  gaps: AuroraGap[];
  potentials: AuroraGap[];
  bets: { title: string; status: string }[];
  lastRhythm: { happened: string; blocked: string; nextStep: string } | null;
  thread: AuroraMessage[];
}): string {
  const talk = input.thread
    .map((m) => `${m.role === 'assistant' ? 'AURORA' : 'Técnico'}: ${m.text}`)
    .join('\n');
  const rhythm = input.lastRhythm
    ? `Aconteceu: ${input.lastRhythm.happened}\nTrava: ${input.lastRhythm.blocked}\nPasso: ${input.lastRhythm.nextStep}`
    : '';
  return [
    `Empresa: ${input.companyName || '—'}`,
    input.technicianName ? `Técnico: ${input.technicianName}` : '',
    `Etapa: ${input.stage}`,
    input.activity ? `Atividade registada: ${input.activity}` : '',
    `Hipótese aceite pelo técnico: ${input.hypothesisAccepted ? 'sim' : 'não'}`,
    input.portraitText ? `Retrato actual:\n${input.portraitText}` : 'Retrato actual: (vazio — o técnico ainda não aceitou rascunho)',
    input.hypothesis ? `Hipótese actual:\n${input.hypothesis}` : '',
    input.gaps.length ? `Brechas: ${input.gaps.map((g) => g.text).join('; ')}` : '',
    input.potentials.length ? `Potenciais: ${input.potentials.map((g) => g.text).join('; ')}` : '',
    input.bets.length
      ? `Apostas: ${input.bets.map((b) => `${b.title} [${b.status}]`).join('; ')}`
      : 'Apostas: (nenhuma)',
    rhythm ? `Última semana:\n${rhythm}` : '',
    `Conversa:\n${talk}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

function clip(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export function looksLikeCatalogScore(text: string): boolean {
  return /\b\d{1,3}\s*\/\s*100\b/.test(text) || /\blikert\b/i.test(text) || /diagn[oó]stico\s+nexus/i.test(text);
}

function asGaps(raw: unknown, max: number): AuroraGap[] {
  if (!Array.isArray(raw)) return [];
  const out: AuroraGap[] = [];
  for (const item of raw) {
    if (out.length >= max) break;
    const text = clip(typeof item === 'string' ? item : (item as { text?: unknown })?.text, 280);
    if (!text || looksLikeCatalogScore(text)) continue;
    const evidence = clip((item as { evidence?: unknown })?.evidence, 180);
    out.push(evidence ? { text, evidence } : { text });
  }
  return out;
}

function asBets(raw: unknown): AuroraBetDraft[] {
  if (!Array.isArray(raw)) return [];
  const out: AuroraBetDraft[] = [];
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

function asMessage(raw: unknown): AuroraMessage | null {
  if (!raw || typeof raw !== 'object') return null;
  const role = (raw as { role?: unknown }).role;
  const text = clip((raw as { text?: unknown }).text, 4000);
  if ((role !== 'user' && role !== 'assistant') || !text) return null;
  return { role, text };
}

export function parseAuroraModelJson(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/gi, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('invalid');
  return JSON.parse(cleaned.slice(start, end + 1));
}

export function normalizeAuroraDraft(raw: unknown, locale: AuroraLocale): AuroraDraft {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const portraitText = clip(o.portraitText, 4000);
  const hypothesis = clip(o.hypothesis, 800);
  const ready = o.ready === true && portraitText.length >= 40 && hypothesis.length >= 12;
  return {
    reply: clip(o.reply, 800) || auroraRetryReply(locale),
    ready,
    portraitText,
    hypothesis,
    gaps: asGaps(o.gaps, 5),
    potentials: asGaps(o.potentials, 3),
    bets: ready ? asBets(o.bets) : [],
  };
}

export function readAuroraThread(interviewJson: unknown): AuroraMessage[] {
  if (!interviewJson || typeof interviewJson !== 'object' || Array.isArray(interviewJson)) return [];
  const raw = (interviewJson as Record<string, unknown>)[AURORA_THREAD_KEY];
  if (!Array.isArray(raw)) return [];
  return raw.map(asMessage).filter((m): m is AuroraMessage => Boolean(m)).slice(-THREAD_CAP);
}

export function readAuroraDraft(interviewJson: unknown): AuroraDraft | null {
  if (!interviewJson || typeof interviewJson !== 'object' || Array.isArray(interviewJson)) return null;
  const raw = (interviewJson as Record<string, unknown>)[AURORA_DRAFT_KEY];
  if (!raw || typeof raw !== 'object') return null;
  const draft = normalizeAuroraDraft(raw, 'pt');
  if (!draft.portraitText && !draft.hypothesis) return null;
  return draft;
}

export function readAuroraTech(interviewJson: unknown): AuroraTech | null {
  if (!interviewJson || typeof interviewJson !== 'object' || Array.isArray(interviewJson)) return null;
  const raw = (interviewJson as Record<string, unknown>)[AURORA_TECH_KEY];
  if (!raw || typeof raw !== 'object') return null;
  const userId = clip((raw as { userId?: unknown }).userId, 80);
  const name = clip((raw as { name?: unknown }).name, 120);
  const claimedAt = clip((raw as { claimedAt?: unknown }).claimedAt, 40);
  if (!userId) return null;
  return { userId, name: name || userId, claimedAt };
}

export function readAuroraSuggestions(interviewJson: unknown): AuroraBetDraft[] {
  if (!interviewJson || typeof interviewJson !== 'object' || Array.isArray(interviewJson)) return [];
  return asBets((interviewJson as Record<string, unknown>)[AURORA_SUGGESTIONS_KEY]);
}

export function auroraInterviewPatch(input: {
  messages?: AuroraMessage[];
  draft?: AuroraDraft | null;
  suggestions?: AuroraBetDraft[];
  tech?: AuroraTech | null;
}): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (input.messages) patch[AURORA_THREAD_KEY] = input.messages.slice(-THREAD_CAP);
  if (input.draft) patch[AURORA_DRAFT_KEY] = input.draft;
  if (input.suggestions) patch[AURORA_SUGGESTIONS_KEY] = input.suggestions.slice(0, 4);
  if (input.tech) patch[AURORA_TECH_KEY] = input.tech;
  return patch;
}

export function titleKey(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function selectAuroraBets(
  existingTitles: string[],
  proposed: AuroraBetDraft[],
  openCount: number,
): AuroraBetDraft[] {
  const room = Math.max(0, 4 - openCount);
  if (!room) return [];
  const seen = new Set(existingTitles.map(titleKey).filter(Boolean));
  const out: AuroraBetDraft[] = [];
  for (const bet of proposed) {
    if (out.length >= room) break;
    const key = titleKey(bet.title);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(bet);
  }
  return out;
}
