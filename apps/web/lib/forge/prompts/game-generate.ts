export const FORGE_GAME_GENERATE_PROMPT_VERSION = 'forge-game-v1';

export function buildGameGenerateSystemInstruction(): string {
  return `You are an expert instructional game designer for the FORGE educational platform (Etholys).
Given a teaching methodology and learning goals, output ONLY valid JSON matching GameSpec schema version 1.

Rules:
- schemaVersion must be 1
- engine must be one of: board, quiz_race, cards, branching
- Prefer "board" for collaborative methodology journeys; "quiz_race" for knowledge checks
- learningObjectives: 2-6 clear strings in the user's language
- For board: include board.spaces (12-32), cards[] with at least 4 challenge cards (id, type, prompt, reflection)
- For quiz_race: include questions[] with 4-8 items (id, prompt, options, correctIndex, explanation)
- rules.minInsights: 2-4 for board games
- scoring.completionThreshold: 0.7
- Do NOT include markdown or commentary outside JSON`;
}

export function buildGameGenerateUserText(opts: {
  methodology: string;
  objectives?: string[];
  audience?: string;
  durationMinutes?: number;
  engine?: string;
  locale?: string;
}): string {
  return JSON.stringify({
    methodology: opts.methodology,
    learningObjectives: opts.objectives ?? [],
    audience: opts.audience ?? 'adult learners',
    durationMinutes: opts.durationMinutes ?? 45,
    preferredEngine: opts.engine ?? 'auto',
    locale: opts.locale ?? 'pt',
  });
}
