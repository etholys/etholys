import { getForgeDb } from '@/lib/forge/db';

/** Curso híbrido de demonstração: aula + quiz + jogo tabuleiro */
export async function seedForgeDemoCourse(companyId: string, userId: string) {
  const existing = await getForgeDb().forgeCourse.findFirst({
    where: { companyId, title: 'Inovação Aberta — Trilha Demo FORGE' },
  });
  if (existing) return existing.id;

  const gameSpec = await getForgeDb().forgeGameSpec.create({
    data: {
      companyId,
      engine: 'board',
      title: 'Jornada no ecossistema',
      status: 'published',
      definition: {
        schemaVersion: 1,
        engine: 'board',
        locale: 'pt',
        title: 'Jornada no ecossistema',
        theme: 'inovação aberta',
        learningObjectives: [
          'Mapear stakeholders do ecossistema',
          'Priorizar uma hipótese de valor',
          'Definir próximo experimento',
        ],
        estimatedMinutes: 25,
        narrative: 'A sua equipa avança no tabuleiro do ecossistema local.',
        board: { spaces: 20, loops: false, startSpace: 0, goalSpace: 19 },
        cards: [
          {
            id: 'c1',
            type: 'challenge',
            prompt: 'Nomeie dois parceiros potenciais e o valor que trazem.',
            reflection: 'Como validaria o interesse deles em 48h?',
            xp: 30,
          },
          {
            id: 'c2',
            type: 'challenge',
            prompt: 'Qual risco principal do seu modelo atual?',
            reflection: 'Que sinal observável reduziria esse risco?',
            xp: 30,
          },
          {
            id: 'c3',
            type: 'bonus',
            prompt: 'Descreva um experimento de baixo custo para esta semana.',
            xp: 20,
          },
        ],
        rules: { maxTurns: 25, diceSides: 6, minInsights: 2 },
        scoring: { xpPerInsight: 40, completionThreshold: 0.7 },
      },
    },
  });

  const course = await getForgeDb().forgeCourse.create({
    data: {
      companyId,
      createdById: userId,
      title: 'Inovação Aberta — Trilha Demo FORGE',
      description:
        'Trilha híbrida de demonstração: conteúdo tradicional + quiz + jogo de tabuleiro com IA.',
      status: 'published',
      coverEmoji: '🚀',
      estimatedHours: 2,
      modules: {
        create: [
          {
            title: 'Fundamentos',
            sortOrder: 0,
            activities: {
              create: [
                {
                  type: 'lesson',
                  title: 'O que é inovação aberta',
                  sortOrder: 0,
                  xpWeight: 1,
                  config: {
                    body: 'Inovação aberta combina recursos internos e externos: parceiros, clientes, startups e comunidade.',
                    durationMinutes: 10,
                  },
                },
                {
                  type: 'quiz',
                  title: 'Checkpoint — conceitos',
                  sortOrder: 1,
                  xpWeight: 1.2,
                  config: {
                    questions: [
                      {
                        id: 'q1',
                        prompt: 'Inovação aberta prioriza principalmente:',
                        options: [
                          'Apenas P&D interno',
                          'Colaboração com atores externos',
                          'Reduzir custos sem parceiros',
                        ],
                        correctIndex: 1,
                      },
                    ],
                  },
                },
              ],
            },
          },
          {
            title: 'Prática gamificada',
            sortOrder: 1,
            activities: {
              create: [
                {
                  type: 'game',
                  title: 'Tabuleiro — ecossistema',
                  sortOrder: 0,
                  xpWeight: 2,
                  gameSpecId: gameSpec.id,
                  config: {},
                },
              ],
            },
          },
        ],
      },
    },
  });

  return course.id;
}
