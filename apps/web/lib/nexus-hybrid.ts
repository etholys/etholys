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
    unifiedTagline:
      'Desenvolver o negócio e gerir o dia a dia não são sítios diferentes: a mesma lição. A trilha, os dados e o assistente ligam-se ao teu plano e aos módulos Etholys no mesmo sítio.',
    stepsHeading: 'A tua lição de hoje (por ordem)',
    chatHeading: 'A seguir: fala com o guia (IA) — a mesma conversa, aqui e no ecrã completo',
    oneFlowNote:
      'Isto segue a ideia de “um jogo, um caminho”: passos, conversa e progresso, sem partires o cérebro por “módulo A vs módulo B”.',
    pageTitle: 'NEXUS: evolução e gestão, no mesmo processo',
    pageSubtitle:
      'Aqui acompanhas o teu negócio por nível. O assistente e a trilha puxam melhoras; tarefas, dados e serviços ligam-se a ATLAS, SIEP e resto do Etholys — por integração, no mesmo fluxo de trabalho.',
    devTitle: 'Desenvolver o negócio',
    devSubtitle: 'Fase, diagnóstico, rota e conversa com o assistente (ritmo e clareza).',
    opsTitle: 'Gerir a operação',
    opsSubtitle: 'Fila de hoje, finanças, projetos, fundos e tickets — a partir dos módulos que já usas no Etholys.',
    footnote:
      'A oferta comercial (base e add-ons) define que funções de cada módulo estão incluídas. O NEXUS orquestra o percurso; as capacidades concretas vivem nas apps integradas.',
    linkLabels: {
      coach: 'Assistente IA',
      journey: 'Fase e metas',
      diagnosis: 'Diagnóstico',
      roadmap: 'Rota viva',
      workspace: 'Centro hoje (Workspace)',
      atlas: 'ATLAS (ERP)',
      siep: 'SIEP (projetos)',
      fundhub: 'FundHub (fundos)',
      nexusServices: 'Pedidos à equipa (NEXUS)',
      hub: 'Outros produtos no Hub',
    },
    humanRhythmTitle: 'Acompanhamento humano, no teu ritmo',
    humanRhythmBody:
      'Num fecho de fase ou ponto mensal, o diagnóstico, os dados e o assistente alimentam a conversa com o assessor. Juntos definem o próximo passo — sem bloqueio automático por algoritmo.',
    humanRhythmCta: 'Pedir apoio / ticket',
    chatTeaserTitle: 'Conversa com o assistente (continua aqui)',
    chatTeaserOpenFull: 'Abrir ecrã completo',
    chatTeaserPlaceholder: 'Escrevem uma dúvida ou colam um excerto do negócio…',
    conductorEyebrow: 'O próximo passo',
    conductorWhyLabel: 'Porquê',
  },
  es: {
    unifiedTagline:
      'Desarrollar y gestionar el día a día no son dos productos: es la misma lección. La ruta, los datos y el asistente conectan vuestro plan y Etholys en un solo flujo.',
    stepsHeading: 'La lección de hoy (en orden)',
    chatHeading: 'Ahora: hablad con el guía (IA) — el mismo diálogo, acá o en pantalla completa',
    oneFlowNote:
      'Misma idea de “un juego, un camino”: pasos, charla y progreso, sin partir la cabeza en “módulo A vs módulo B”.',
    pageTitle: 'NEXUS: evolución y gestión, en el mismo proceso',
    pageSubtitle:
      'Aquí acompañás tu negocio por nivel. El asistente y la ruta empujan mejoras; tareas, datos y servicios se conectan a ATLAS, SIEP y el resto de Etholys: integrado, en el mismo flujo.',
    devTitle: 'Desarrollar el negocio',
    devSubtitle: 'Fase, diagnóstico, ruta y diálogo con el asistente: ritmo y claridad.',
    opsTitle: 'Gestionar la operación',
    opsSubtitle: 'Hoy, finanzas, proyectos, fondos y tickets — desde los módulos de Etholys que ya usás.',
    footnote:
      'La oferta (base y add-ons) define qué funciones de cada módulo están incluidas. NEXUS orquesta el recorrido; la capacidad concreta vive en las apps integradas.',
    linkLabels: {
      coach: 'Asistente IA',
      journey: 'Fase y metas',
      diagnosis: 'Diagnóstico',
      roadmap: 'Ruta viva',
      workspace: 'Centro hoy (Workspace)',
      atlas: 'ATLAS (ERP)',
      siep: 'SIEP (proyectos)',
      fundhub: 'FundHub (fondos)',
      nexusServices: 'Solicitar al equipo (NEXUS)',
      hub: 'Más en el Hub',
    },
    humanRhythmTitle: 'Acompañamiento humano, a vuestro ritmo',
    humanRhythmBody:
      'En cierre de fase o cita mensual, el diagnóstico, los datos y el asistente alimentan la charla con el asesor. Juntos definen el siguiente paso — sin bloqueo automático de un algoritmo.',
    humanRhythmCta: 'Pedir apoyo / ticket',
    chatTeaserTitle: 'Hablá con el asistente (sigue acá)',
    chatTeaserOpenFull: 'Pantalla completa',
    chatTeaserPlaceholder: 'Escribid una duda o pegad un resumen del negocio…',
    conductorEyebrow: 'El siguiente paso',
    conductorWhyLabel: 'Por qué',
  },
  en: {
    unifiedTagline:
      'Growing the business and running day-to-day aren’t two different products: it’s the same lesson. The path, data, and assistant connect your plan and Etholys in one flow.',
    stepsHeading: 'Today’s lesson (in order)',
    chatHeading: 'Next: talk to the guide (AI) — the same thread, here or full screen',
    oneFlowNote:
      'One game, one path: steps, chat, and progress—no mental split into “module A vs module B.”',
    pageTitle: 'NEXUS: growth and operations, one process',
    pageSubtitle:
      'Follow the business by level. The assistant and the path drive improvements; tasks, data, and services connect to ATLAS, SIEP, and the rest of Etholys—integrated, same workflow.',
    devTitle: 'Develop the business',
    devSubtitle: 'Phase, diagnosis, live roadmap, and the AI coach—pace and clarity.',
    opsTitle: 'Run the operation',
    opsSubtitle: "Today's queue, finance, projects, funds, and tickets—from the Etholys modules you already use.",
    footnote:
      'Plans (base and add-ons) define which features from each module are included. NEXUS orchestrates the journey; the actual capabilities live in the integrated apps.',
    linkLabels: {
      coach: 'AI coach',
      journey: 'Phase & goals',
      diagnosis: 'Diagnosis',
      roadmap: 'Live roadmap',
      workspace: 'Today (Workspace)',
      atlas: 'ATLAS (ERP)',
      siep: 'SIEP (projects)',
      fundhub: 'FundHub (funding)',
      nexusServices: 'Team requests (NEXUS)',
      hub: 'More in Hub',
    },
    humanRhythmTitle: 'Human check-ins, on your schedule',
    humanRhythmBody:
      'At a phase close or a monthly touchpoint, your diagnosis, data, and the AI context feed a conversation with a human advisor. You decide the next move together—no automatic algorithm block.',
    humanRhythmCta: 'Request support / ticket',
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
