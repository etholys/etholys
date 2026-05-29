import type { GameSpecV1 } from '@/lib/forge/schemas/game-spec-v1';

export const FORGE_GAME_TEMPLATES: Record<string, { label: string; spec: GameSpecV1 }> = {
  'design-thinking-board': {
    label: 'Design Thinking (tabuleiro)',
    spec: {
      schemaVersion: 1,
      engine: 'board',
      locale: 'pt',
      title: 'Jornada Design Thinking',
      learningObjectives: ['Empatizar', 'Definir problema', 'Idear soluções'],
      board: { spaces: 18, startSpace: 0, goalSpace: 17 },
      cards: [
        { id: 'e1', type: 'challenge', prompt: 'Descreva um utilizador tipo em 2 frases.', reflection: 'Que dor é mais urgente?' },
        { id: 'e2', type: 'challenge', prompt: 'Reformule o problema como pergunta "Como podemos...?"' },
        { id: 'i1', type: 'challenge', prompt: 'Liste 3 ideias rápidas (brainstorm).' },
      ],
      rules: { maxTurns: 20, minInsights: 2 },
      scoring: { xpPerInsight: 45, completionThreshold: 0.7 },
    },
  },
  'negotiation-cards': {
    label: 'Negociação (cartas)',
    spec: {
      schemaVersion: 1,
      engine: 'cards',
      locale: 'pt',
      title: 'Cartas de negociação',
      learningObjectives: ['Preparar concessões', 'Definir BATNA'],
      cards: [
        { id: 'n1', type: 'challenge', prompt: 'Qual é o seu BATNA nesta negociação?' },
        { id: 'n2', type: 'challenge', prompt: 'Que concessão de baixo custo pode oferecer?' },
        { id: 'n3', type: 'bonus', prompt: 'Reformule o pedido em benefício mútuo.' },
      ],
      rules: { minInsights: 2 },
    },
  },
  'leadership-branching': {
    label: 'Liderança (simulação)',
    spec: {
      schemaVersion: 1,
      engine: 'branching',
      locale: 'pt',
      title: 'Decisões de liderança',
      learningObjectives: ['Feedback', 'Priorização'],
      branches: [
        {
          id: 's1',
          prompt: 'Um colaborador entrega atrasado pela 3ª vez. O que faz primeiro?',
          choices: [
            { id: 's1a', label: 'Conversa 1:1 imediata', nextId: 's2', feedback: 'Diálogo direto reduz ruído.' },
            { id: 's1b', label: 'Ignorar mais uma semana', nextId: 'end', feedback: 'Risco de normalizar o atraso.' },
          ],
        },
        {
          id: 's2',
          prompt: 'Na 1:1, qual foco?',
          choices: [
            { id: 's2a', label: 'Clarificar prioridades e bloqueios', nextId: 'end' },
            { id: 's2b', label: 'Apenas registar falta', nextId: 'end' },
          ],
        },
      ],
      rules: { minInsights: 2 },
    },
  },
  'okr-quiz': {
    label: 'OKRs (quiz race)',
    spec: {
      schemaVersion: 1,
      engine: 'quiz_race',
      locale: 'pt',
      title: 'Quiz OKR',
      learningObjectives: ['Diferenciar objetivo e resultado-chave', 'Escrever KR mensurável'],
      questions: [
        {
          id: 'q1',
          prompt: 'Um Key Result deve ser:',
          options: ['Vago e qualitativo', 'Mensurável e com prazo', 'Igual ao objetivo'],
          correctIndex: 1,
          explanation: 'KR = evidência mensurável de progresso.',
        },
        {
          id: 'q2',
          prompt: 'Quantos OKRs focados recomenda-se por ciclo?',
          options: ['1-3', '10-15', 'Sem limite'],
          correctIndex: 0,
        },
        {
          id: 'q3',
          prompt: 'Objectivo responde principalmente:',
          options: ['O quê e porquê', 'O número exato', 'A ferramenta de software'],
          correctIndex: 0,
        },
      ],
      scoring: { completionThreshold: 0.66 },
    },
  },
};
