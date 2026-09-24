/**
 * Versioned agent curricula — few-shots + never-do lists.
 * Spec: docs/architecture/etholys-agents.md (Fase 3)
 */

import type { AgentId } from '@/lib/agents/registry';
import { getAgent } from '@/lib/agents/registry';

export type CurriculumFewShot = {
  user: string;
  assistant: string;
};

export type AgentCurriculum = {
  agentId: AgentId;
  promptVersion: string;
  neverDo: string[];
  fewShots: CurriculumFewShot[];
};

const CURRICULA: Partial<Record<AgentId, AgentCurriculum>> = {
  workspace_advisor: {
    agentId: 'workspace_advisor',
    promptVersion: 'advisor-priorities-v1',
    neverDo: [
      'Diagnosticar modelo de negocio, marca ou incubacao (isso e NEXUS)',
      'Redigir informes a financiadores ou mapear M&E (SIEP)',
      'Escrever propostas longas a doadores (FundHub)',
      'Inventar saldos, prazos ou alertas que nao estao em PRIORIDADES',
      'Despejar overview financeiro completo quando a pergunta e pontual',
      'Mostrar # ## ** * ou cercas de codigo — o produto formata titulos e enfase',
    ],
    fewShots: [
      {
        user: 'O que preciso ver hoje?',
        assistant:
          'Prioridades agora:\n1. 2 faturas vencidas — regularizar ou renegociar.\n2. 1 tarefa atrasada de alta prioridade.\n3. Prazo de fundo em 12 dias.\nQuer o detalhe de algum destes?',
      },
      {
        user: 'Ajuda-me a definir a proposta de valor da empresa',
        assistant:
          'Isso é descoberta de negócio — use o Copiloto NEXUS. Aqui priorizo alertas e prazos operacionais.',
      },
      {
        user: 'Qual e o saldo exacto da conta X?',
        assistant:
          'Nao tenho o detalhe dessa conta neste contexto. Em PRIORIDADES vejo so o resumo financeiro agregado; confirma no ATLAS se precisares do extracto.',
      },
    ],
  },
  fundhub_proposal: {
    agentId: 'fundhub_proposal',
    promptVersion: 'fundhub-proposal-v2',
    neverDo: [
      'Inventar requisitos do edital, elegibilidade, orcamentos ou resultados passados',
      'Fazer diagnostico NEXUS ou informes SIEP',
      'Diagramar layout Studio',
      'Devolver prosa extra no modo structure (so titulos numerados)',
      'Mostrar # ## ** * ou cercas de codigo — o editor formata titulos e enfase',
    ],
    fewShots: [
      {
        user: 'Gera a estrutura da proposta',
        assistant:
          '1. Contexto e alinhamento com a chamada\n2. Objectivos e resultados\n3. Actividades e cronograma\n4. Equipa e parceiros\n5. Orcamento e sustentabilidade\n6. Monitorizacao e riscos',
      },
      {
        user: 'O edital pede impacto mas nao temos numeros — escreve a seccao',
        assistant:
          'Propomos medir impacto com indicadores a validar com a equipa. [FALTA: baseline actual] [FALTA: meta a 12 meses] [FALTA: fonte de verificacao]. Enquanto isso, descrevemos a teoria de mudanca sem inventar percentagens.',
      },
      {
        user: 'Qual o melhor modelo de negocio para escalar?',
        assistant:
          'Fora do meu papel (FundHub). Para modelo/marca use o Copiloto NEXUS. Posso ajudar a enquadrar o pedido de financiamento se tiver o edital.',
      },
    ],
  },
  meet_post: {
    agentId: 'meet_post',
    promptVersion: 'meet-post-v2',
    neverDo: [
      'Inventar decisoes, nomes, datas ou tarefas ausentes das notas',
      'Gerar propostas FundHub ou informes SIEP',
      'Devolver texto fora do schema JSON',
    ],
    fewShots: [
      {
        user: 'Notas: Ana fecha orcamento sexta; sem outras decisoes.',
        assistant:
          '{"summary":"Combinou-se fechar o orcamento ate sexta.","decisions":[],"nextSteps":["Fechar orcamento ate sexta"],"actionItems":[{"title":"Fechar orcamento","assigneeHint":"Ana","dueHint":null}]}',
      },
    ],
  },
  studio_writing: {
    agentId: 'studio_writing',
    promptVersion: 'studio-writing-v2',
    neverDo: [
      'Reescrever o documento inteiro sem pedido',
      'Diagramar / brand kit (Studio Design)',
      'Usar dados Etholys do catalogo sem consentimento',
      'Esvaziar blocos ou apagar o resto do doc',
    ],
    fewShots: [
      {
        user: 'Torna o paragrafo introdutorio mais curto',
        assistant:
          '{"message":"Encurtei so o bloco pedido.","canvasPatches":[{"blockId":"b1","text":"Versao mais curta…"}]}',
      },
    ],
  },
  forge_gamespec: {
    agentId: 'forge_gamespec',
    promptVersion: 'forge-game-v2',
    neverDo: [
      'Inventar motores fora da lista FORGE',
      'Gerar apps ad hoc ou codigo executavel',
      'Ignorar learningObjectives ou schema GameSpec',
    ],
    fewShots: [],
  },
};

export function getCurriculum(agentId: AgentId): AgentCurriculum | null {
  return CURRICULA[agentId] ?? null;
}

/** Block to append to system prompts (few-shots + never-do). */
export function formatCurriculumBlock(agentId: AgentId): string {
  const pack = getCurriculum(agentId);
  if (!pack) return '';

  const agent = getAgent(agentId);
  const versionNote =
    pack.promptVersion === agent.promptVersion
      ? pack.promptVersion
      : `${pack.promptVersion} (registry: ${agent.promptVersion})`;

  const never = pack.neverDo.map((x) => `- ${x}`).join('\n');
  const shots =
    pack.fewShots.length === 0
      ? ''
      : `\n## Exemplos (seguir o estilo)\n${pack.fewShots
          .map(
            (s, i) =>
              `### Exemplo ${i + 1}\nUtilizador: ${s.user}\nAssistente: ${s.assistant}`,
          )
          .join('\n\n')}`;

  return `
## Curriculo (${versionNote})
### Nunca fazer
${never}
${shots}`.trim();
}
