import { z } from 'zod';
import { FORGE_GAME_ENGINES } from '@/lib/forge/types';

const cardSchema = z.object({
  id: z.string().min(1).max(64),
  type: z.enum(['challenge', 'event', 'bonus', 'penalty']).default('challenge'),
  prompt: z.string().min(1).max(2000),
  xp: z.number().min(0).max(500).optional(),
  reflection: z.string().max(2000).optional(),
});

export const gameSpecV1Schema = z.object({
  schemaVersion: z.literal(1),
  engine: z.enum(FORGE_GAME_ENGINES),
  locale: z.string().max(8).default('pt'),
  title: z.string().min(1).max(300),
  theme: z.string().max(120).optional(),
  learningObjectives: z.array(z.string().max(500)).min(1).max(12),
  estimatedMinutes: z.number().int().min(5).max(480).optional(),
  narrative: z.string().max(4000).optional(),
  board: z
    .object({
      spaces: z.number().int().min(4).max(64),
      loops: z.boolean().optional(),
      startSpace: z.number().int().min(0).optional(),
      goalSpace: z.number().int().min(0).optional(),
    })
    .optional(),
  cards: z.array(cardSchema).max(80).optional(),
  questions: z
    .array(
      z.object({
        id: z.string().min(1).max(64),
        prompt: z.string().min(1).max(2000),
        options: z.array(z.string().min(1).max(500)).min(2).max(6),
        correctIndex: z.number().int().min(0),
        explanation: z.string().max(2000).optional(),
      })
    )
    .max(40)
    .optional(),
  rules: z
    .object({
      maxTurns: z.number().int().min(1).max(200).optional(),
      diceSides: z.number().int().min(2).max(20).optional(),
      winCondition: z.string().max(120).optional(),
      minInsights: z.number().int().min(0).max(20).optional(),
    })
    .optional(),
  scoring: z
    .object({
      xpPerInsight: z.number().min(0).max(500).optional(),
      quizWeight: z.number().min(0).max(1).optional(),
      completionThreshold: z.number().min(0).max(1).optional(),
    })
    .optional(),
  branches: z
    .array(
      z.object({
        id: z.string().min(1).max(64),
        prompt: z.string().min(1).max(2000),
        choices: z
          .array(
            z.object({
              id: z.string().min(1).max(64),
              label: z.string().min(1).max(500),
              nextId: z.string().min(1).max(64),
              feedback: z.string().max(2000).optional(),
            })
          )
          .min(1)
          .max(6),
      })
    )
    .max(30)
    .optional(),
  aiMetadata: z.record(z.unknown()).optional(),
});

export type GameSpecV1 = z.infer<typeof gameSpecV1Schema>;

export function parseGameSpecV1(raw: unknown): GameSpecV1 {
  return gameSpecV1Schema.parse(raw);
}

export function safeParseGameSpecV1(raw: unknown) {
  return gameSpecV1Schema.safeParse(raw);
}
