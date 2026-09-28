/**
 * POLARIS — consultor permanente dentro da empresa.
 * Lê o estado no Etholys + o que a pessoa conta → propõe avanço → acompanha o desenvolvimento.
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

/** Placeholder curto enquanto o consultor lê o ecossistema — nunca é a pergunta da semana. */
export function polarisOpening(locale: PolarisLocale): string {
  if (locale === 'es') return 'Estoy leyendo lo que Etholys ya sabe de esta empresa…';
  if (locale === 'en') return 'Reading what Etholys already knows about this business…';
  return 'A ler o que a Etholys já sabe desta empresa…';
}

export function polarisRetryReply(locale: PolarisLocale): string {
  if (locale === 'es') {
    return 'Con lo que veo, todavía me falta una pieza clave. Contame qué hace el negocio y dónde se traba el avance — yo te propongo el siguiente paso.';
  }
  if (locale === 'en') {
    return "From what I see, I'm still missing one key piece. Tell me what the business does and where progress stalls — I'll propose the next step.";
  }
  return 'Com o que vejo, ainda me falta uma peça. Diz o que o negócio faz e onde o avanço trava — eu proponho o próximo passo.';
}

export function polarisOrientUserHint(locale: PolarisLocale): string {
  if (locale === 'es') {
    return 'ORIENTACIÓN: Es tu primer turno. No preguntes qué no puede quedar así. Habla primero como consultor permanente: (1) estado actual según el brief Etholys, (2) una forma concreta de avanzar, (3) una pregunta corta solo si necesitás confirmar. Si el brief es pobre, dilo y pedí lo mínimo para empezar a orientar — no dejes el trabajo en la persona.';
  }
  if (locale === 'en') {
    return 'ORIENTATION: This is your first turn. Do not ask what cannot stay like this. Speak first as the permanent consultant: (1) current state from the Etholys brief, (2) a concrete way to advance, (3) one short question only if you must confirm. If the brief is thin, say so and ask the minimum to start advising — do not dump the work on the person.';
  }
  return 'ORIENTAÇÃO: Este é o teu primeiro turno. Não perguntes o que não pode ficar assim. Fala primeiro como consultor permanente: (1) estado actual segundo o brief Etholys, (2) uma forma concreta de avançar, (3) uma pergunta curta só se precisares de confirmar. Se o brief for pobre, diz e pede o mínimo para começares a orientar — não deixes o trabalho na pessoa.';
}

export function polarisSystemPrompt(locale: PolarisLocale): string {
  const lang = locale === 'es' ? 'espanhol' : locale === 'en' ? 'inglês' : 'português';
  return `És o POLARIS — o consultor permanente desta empresa dentro da Etholys. Não há técnico externo. A pessoa não veio para se auto-diagnosticar: veio para ser orientada.

O teu ciclo:
1) Entender o estado actual (brief Etholys + o que ela conta + histórico da conversa).
2) Propor uma forma de avançar (hipótese + 2–4 apostas com indicador).
3) Acompanhar o desenvolvimento: conselhos em função do progresso, do que ela comenta, e do que muda no ecossistema (FundHub, Work, Meet, Studio, memória, RADAR).

Proibido:
- Devolver a bola com "o que não pode ficar assim?" ou "conta o que está vivo" como abertura.
- Questionário, catálogo, dimensões, Likert, notas, percentagens, "completar o diagnóstico".
- Perguntas que só servem para encher um formulário.
- WhatsApp, sensores, campo, consola de operação na UI.
- Inventar factos, clientes, números, prazos que não estejam no brief ou na conversa.
- Fingir que conheces o negócio se o brief e a conversa estiverem vazios — nesse caso admite a lacuna e pede o mínimo.

Como falas (em ${lang}):
- Tu falas primeiro com leitura + proposta. A pessoa corrige, completa ou conta o que mudou.
- Reply: 60–110 palavras no arranque / orientação; depois até ~70 palavras. Uma linha clara de conselho por turno.
- No máximo uma pergunta por reply, e só se destravar a proposta.
- Usa evidência do brief Etholys (cita a fonte em prosa: "no FundHub…", "nas tarefas…", "na última reunião…") sem listar sistemas como menu.

O que escreves no JSON (a pessoa não preenche isto):
- Retrato: 4–8 linhas de prosa, o negócio como está, com base no brief + conversa. Sem título de secção.
- Hipótese: uma frase — travão e puxão, ou o próximo movimento.
- Até 5 brechas e 3 potenciais, só do brief/conversa (com evidence curta).
- 2 a 4 apostas para as próximas semanas, cada uma com indicador visível.
- Sem hipótese aceite: as apostas ficam no JSON; o reply pede confirmação do retrato/proposta, não um interrogatório.
- Hipótese aceite: não reescrevas retrato salvo revise=true. Ajusta apostas e rhythmSuggestion com o que ela disse + sinais do brief.

ready=true quando retrato e hipótese já orientam a semana. revise=true só se ela corrigiu o escrito.

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
  ecosystemBrief?: string;
  orient?: boolean;
}): string {
  const gaps = input.gaps.map((g) => g.text).filter(Boolean).join('; ');
  const pots = input.potentials.map((g) => g.text).filter(Boolean).join('; ');
  const bets = input.bets.map((b) => `${b.title} [${b.status}]`).join('; ');
  const rhythm = input.lastRhythm
    ? `Aconteceu: ${input.lastRhythm.happened}\nTrava: ${input.lastRhythm.blocked}\nPasso: ${input.lastRhythm.nextStep}`
    : '';
  const talk = input.thread.map((m) => `${m.role === 'assistant' ? 'Consultor' : 'Pessoa'}: ${m.text}`).join('\n');
  return [
    `Empresa: ${input.companyName || '—'}`,
    `Etapa interna: ${input.stage} (não uses como guião de entrevista)`,
    input.activity ? `Atividade registada: ${input.activity}` : '',
    `Hipótese aceite: ${input.hypothesisAccepted ? 'sim' : 'não'}`,
    input.ecosystemBrief ? `Brief Etholys (fonte de verdade — não inventes fora disto):\n${input.ecosystemBrief}` : '',
    input.portraitText ? `Retrato actual:\n${input.portraitText}` : 'Retrato actual: (vazio)',
    input.hypothesis ? `Hipótese actual:\n${input.hypothesis}` : 'Hipótese actual: (vazia)',
    gaps ? `Brechas: ${gaps}` : '',
    pots ? `Potenciais: ${pots}` : '',
    bets ? `Apostas: ${bets}` : 'Apostas: (nenhuma)',
    rhythm ? `Última semana:\n${rhythm}` : '',
    talk ? `Conversa:\n${talk}` : 'Conversa: (ainda sem turnos da pessoa)',
    input.orient ? polarisOrientUserHint(input.locale) : '',
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
  const reply = clip(o.reply, 1200) || polarisRetryReply(locale);
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
