/**
 * NEXUS híbrido: desenvolvimento (trilha, IA, diagnóstico) + gestão (módulos Etholys vinculados).
 * Uma narrativa; rotas reais; add-ons/integração são produto, não “novo menu de produtos”.
 */

export type NexusHybridLocale = 'pt' | 'es' | 'en';

export function nexusHybridLocale(raw: string | undefined): NexusHybridLocale {
  if (raw === 'es' || raw === 'en') return raw;
  return 'pt';
}

export type NexusHybridCopy = {
  /** Visão geral unificada (um fluxo, sem dois pilares) */
  unifiedTagline: string;
  stepsHeading: string;
  chatHeading: string;
  oneFlowNote: string;
  pageTitle: string;
  pageSubtitle: string;
  devTitle: string;
  devSubtitle: string;
  opsTitle: string;
  opsSubtitle: string;
  footnote: string;
  linkLabels: {
    coach: string;
    journey: string;
    diagnosis: string;
    roadmap: string;
    workspace: string;
    atlas: string;
    siep: string;
    fundhub: string;
    nexusServices: string;
    hub: string;
  };
  /** Ritmo com assessor humano (sem bloqueio automático de fase) */
  humanRhythmTitle: string;
  humanRhythmBody: string;
  humanRhythmCta: string;
  /** Teaser de conversa na visão geral */
  chatTeaserTitle: string;
  chatTeaserOpenFull: string;
  chatTeaserPlaceholder: string;
  /** Um passo destacado na visão geral (condutor) */
  conductorEyebrow: string;
  conductorWhyLabel: string;
};

const COPY: Record<NexusHybridLocale, NexusHybridCopy> = {
  pt: {
    unifiedTagline: 'Acompanhe o negócio por fase, com diagnóstico, rota e copiloto.',
    stepsHeading: 'Hoje',
    chatHeading: 'Conversa',
    oneFlowNote: 'Passos, conversa e progresso no mesmo sítio.',
    pageTitle: 'NEXUS',
    pageSubtitle: 'Diagnóstico, rota de desenvolvimento e acompanhamento.',
    devTitle: 'Desenvolver o negócio',
    devSubtitle: 'Fase, diagnóstico, rota e conversa.',
    opsTitle: 'Gerir a operação',
    opsSubtitle: 'Tarefas, finanças, projetos e fundos.',
    footnote: '',
    linkLabels: {
      coach: 'Assistente IA',
      journey: 'Fase e metas',
      diagnosis: 'Diagnóstico',
      roadmap: 'Rota viva',
      workspace: 'Centro hoje (Workspace)',
      atlas: 'ATLAS (ERP)',
      siep: 'SIEP (projetos)',
      fundhub: 'FundHub (fundos)',
      nexusServices: 'Serviços internos (NEXUS)',
      hub: 'Outros produtos no Hub',
    },
    humanRhythmTitle: 'Acompanhamento humano, no teu ritmo',
    humanRhythmBody: 'O diagnóstico ajuda a preparar o acompanhamento.',
    humanRhythmCta: 'Ajustar fase e metas',
    chatTeaserTitle: 'Conversa com o assistente (continua aqui)',
    chatTeaserOpenFull: 'Abrir ecrã completo',
    chatTeaserPlaceholder: 'Escrevem uma dúvida ou colam um excerto do negócio…',
    conductorEyebrow: 'O próximo passo',
    conductorWhyLabel: 'Porquê',
  },
  es: {
    unifiedTagline: 'Acompañá el negocio por fase, con diagnóstico, ruta y copiloto.',
    stepsHeading: 'Hoy',
    chatHeading: 'Conversación',
    oneFlowNote: 'Pasos, conversación y progreso en el mismo lugar.',
    pageTitle: 'NEXUS',
    pageSubtitle: 'Diagnóstico, ruta de desarrollo y acompañamiento.',
    devTitle: 'Desarrollar el negocio',
    devSubtitle: 'Fase, diagnóstico, ruta y conversación.',
    opsTitle: 'Gestionar la operación',
    opsSubtitle: 'Tareas, finanzas, proyectos y fondos.',
    footnote: '',
    linkLabels: {
      coach: 'Asistente IA',
      journey: 'Fase y metas',
      diagnosis: 'Diagnóstico',
      roadmap: 'Ruta viva',
      workspace: 'Centro hoy (Workspace)',
      atlas: 'ATLAS (ERP)',
      siep: 'SIEP (proyectos)',
      fundhub: 'FundHub (fondos)',
      nexusServices: 'Servicios internos (NEXUS)',
      hub: 'Más en el Hub',
    },
    humanRhythmTitle: 'Acompañamiento humano, a vuestro ritmo',
    humanRhythmBody: 'El diagnóstico ayuda a preparar el acompañamiento.',
    humanRhythmCta: 'Ajustar fase y metas',
    chatTeaserTitle: 'Hablá con el asistente (sigue acá)',
    chatTeaserOpenFull: 'Pantalla completa',
    chatTeaserPlaceholder: 'Escribid una duda o pegad un resumen del negocio…',
    conductorEyebrow: 'El siguiente paso',
    conductorWhyLabel: 'Por qué',
  },
  en: {
    unifiedTagline: 'Follow the business by phase, with diagnosis, roadmap, and copilot.',
    stepsHeading: 'Today',
    chatHeading: 'Conversation',
    oneFlowNote: 'Steps, chat, and progress in one place.',
    pageTitle: 'NEXUS',
    pageSubtitle: 'Diagnosis, development roadmap, and follow-up.',
    devTitle: 'Develop the business',
    devSubtitle: 'Phase, diagnosis, roadmap, and conversation.',
    opsTitle: 'Run the operation',
    opsSubtitle: 'Tasks, finance, projects, and funds.',
    footnote: '',
    linkLabels: {
      coach: 'AI coach',
      journey: 'Phase & goals',
      diagnosis: 'Diagnosis',
      roadmap: 'Live roadmap',
      workspace: 'Today (Workspace)',
      atlas: 'ATLAS (ERP)',
      siep: 'SIEP (projects)',
      fundhub: 'FundHub (funding)',
      nexusServices: 'Internal services (NEXUS)',
      hub: 'More in Hub',
    },
    humanRhythmTitle: 'Human check-ins, on your schedule',
    humanRhythmBody: 'Diagnosis helps prepare the follow-up.',
    humanRhythmCta: 'Adjust phase & goals',
    chatTeaserTitle: 'Talk with the assistant (continues here)',
    chatTeaserOpenFull: 'Open full screen',
    chatTeaserPlaceholder: 'Type a question or paste a business snippet…',
    conductorEyebrow: 'Your next step',
    conductorWhyLabel: 'Why',
  },
};

export function getNexusHybridCopy(locale: string | undefined): NexusHybridCopy {
  return COPY[nexusHybridLocale(locale)];
}
