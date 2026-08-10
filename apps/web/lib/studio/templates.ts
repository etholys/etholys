import { emptyStudioCanvas, type StudioCanvasState, type StudioFormat } from '@/lib/studio/types';

/** Domínios Etholys para filtrar templates (F4). */
export const STUDIO_TEMPLATE_DOMAINS = [
  'general',
  'siep',
  'fundhub',
  'meet',
  'forge',
  'atlas',
  'nexus',
] as const;

export type StudioTemplateDomain = (typeof STUDIO_TEMPLATE_DOMAINS)[number];

export type StudioSystemTemplate = {
  key: string;
  format: StudioFormat;
  domain: StudioTemplateDomain;
  nameEs: string;
  namePt: string;
  nameEn: string;
  descriptionEs: string;
  descriptionPt: string;
  descriptionEn: string;
  sortOrder: number;
  buildCanvas: () => StudioCanvasState;
};

function page(
  blocks: StudioCanvasState['pages'][0]['blocks'],
  format: StudioFormat = 'report',
  title = 'Página 1',
): StudioCanvasState {
  const pageSize = format === 'presentation' ? 'Slide' : 'A4';
  return {
    version: 1,
    format,
    pageSize,
    pages: [
      {
        id: 'page-1',
        title,
        order: 0,
        pageSize,
        layoutMode: 'blank',
        blocks,
      },
    ],
  };
}

function block(
  id: string,
  kind: StudioCanvasState['pages'][0]['blocks'][0]['kind'],
  title: string,
  order: number,
  text = '',
  extra?: Partial<StudioCanvasState['pages'][0]['blocks'][0]>,
) {
  return { id, kind, title, text, order, ...extra };
}

/** Catálogo embutido — seed em memória; DB opcional para custom da empresa. */
export const STUDIO_SYSTEM_TEMPLATES: StudioSystemTemplate[] = [
  {
    key: 'blank-report',
    format: 'report',
    domain: 'general',
    nameEs: 'Informe en blanco',
    namePt: 'Relatório em branco',
    nameEn: 'Blank report',
    descriptionEs: 'Estructura libre con título y cuerpo.',
    descriptionPt: 'Estrutura livre com título e corpo.',
    descriptionEn: 'Free structure with title and body.',
    sortOrder: 10,
    buildCanvas: () => {
      const c = emptyStudioCanvas('report');
      c.format = 'report';
      return c;
    },
  },
  {
    key: 'project-one-pager',
    format: 'brief',
    domain: 'general',
    nameEs: 'One-pager de proyecto',
    namePt: 'One-pager de projeto',
    nameEn: 'Project one-pager',
    descriptionEs: 'Resumen ejecutivo: problema, solución, impacto.',
    descriptionPt: 'Resumo executivo: problema, solução, impacto.',
    descriptionEn: 'Executive summary: problem, solution, impact.',
    sortOrder: 20,
    buildCanvas: () =>
      page(
        [
          block('b1', 'heading', 'Título del proyecto', 0),
          block('b2', 'paragraph', 'Problema', 1),
          block('b3', 'paragraph', 'Solución / enfoque', 2),
          block('b4', 'bullets', 'Resultados esperados', 3),
          block('b5', 'callout', 'Llamado a la acción', 4),
        ],
        'brief',
      ),
  },
  {
    key: 'funding-proposal-outline',
    format: 'proposal',
    domain: 'fundhub',
    nameEs: 'Esquema de propuesta',
    namePt: 'Esquema de proposta',
    nameEn: 'Proposal outline',
    descriptionEs: 'Secciones típicas para captación / donante.',
    descriptionPt: 'Secções típicas para captação / doador.',
    descriptionEn: 'Typical sections for grant / donor proposals.',
    sortOrder: 30,
    buildCanvas: () =>
      page(
        [
          block('b1', 'heading', 'Título de la propuesta', 0),
          block('b2', 'paragraph', 'Resumen ejecutivo', 1),
          block('b3', 'paragraph', 'Contexto y justificación', 2),
          block('b4', 'paragraph', 'Objetivos', 3),
          block('b5', 'bullets', 'Actividades', 4),
          block('b6', 'paragraph', 'Presupuesto (narrativa)', 5),
          block('b7', 'paragraph', 'Impacto y sostenibilidad', 6),
        ],
        'proposal',
      ),
  },
  {
    key: 'fundhub-concept-note',
    format: 'brief',
    domain: 'fundhub',
    nameEs: 'Nota conceptual (FUNDHUB)',
    namePt: 'Nota conceptual (FUNDHUB)',
    nameEn: 'Concept note (FUNDHUB)',
    descriptionEs: 'Borrador corto para presentar una idea a un fondo.',
    descriptionPt: 'Rascunho curto para apresentar uma ideia a um fundo.',
    descriptionEn: 'Short draft to pitch an idea to a funder.',
    sortOrder: 32,
    buildCanvas: () =>
      page(
        [
          block('b1', 'heading', 'Título de la idea', 0),
          block('b2', 'paragraph', 'Problema / oportunidad', 1),
          block('b3', 'paragraph', 'Propuesta', 2),
          block('b4', 'bullets', 'Beneficiarios', 3),
          block('b5', 'paragraph', 'Presupuesto orientativo', 4),
          block('b6', 'callout', 'Próximo paso con el donante', 5),
        ],
        'brief',
      ),
  },
  {
    key: 'formal-letter',
    format: 'letter',
    domain: 'general',
    nameEs: 'Carta formal',
    namePt: 'Carta formal',
    nameEn: 'Formal letter',
    descriptionEs: 'Carta institucional con destinatario y cierre.',
    descriptionPt: 'Carta institucional com destinatário e fecho.',
    descriptionEn: 'Institutional letter with addressee and closing.',
    sortOrder: 40,
    buildCanvas: () =>
      page(
        [
          block('b1', 'paragraph', 'Destinatario', 0),
          block('b2', 'paragraph', 'Asunto', 1),
          block('b3', 'paragraph', 'Cuerpo', 2),
          block('b4', 'paragraph', 'Cierre / firma', 3),
        ],
        'letter',
      ),
  },
  {
    key: 'meeting-minutes',
    format: 'report',
    domain: 'meet',
    nameEs: 'Acta de reunión',
    namePt: 'Ata de reunião',
    nameEn: 'Meeting minutes',
    descriptionEs: 'Participantes, temas y acuerdos.',
    descriptionPt: 'Participantes, temas e acordos.',
    descriptionEn: 'Attendees, topics, and decisions.',
    sortOrder: 50,
    buildCanvas: () =>
      page(
        [
          block('b1', 'heading', 'Acta — título', 0),
          block('b2', 'bullets', 'Participantes', 1),
          block('b3', 'paragraph', 'Temas tratados', 2),
          block('b4', 'bullets', 'Acuerdos / próximos pasos', 3),
        ],
        'report',
      ),
  },
  {
    key: 'meet-post-brief',
    format: 'brief',
    domain: 'meet',
    nameEs: 'Resumen post-reunión',
    namePt: 'Resumo pós-reunião',
    nameEn: 'Post-meeting brief',
    descriptionEs: 'Resumen, decisiones y tareas para compartir.',
    descriptionPt: 'Resumo, decisões e tarefas para partilhar.',
    descriptionEn: 'Summary, decisions and tasks to share.',
    sortOrder: 52,
    buildCanvas: () =>
      page(
        [
          block('b1', 'heading', 'Reunión', 0),
          block('b2', 'paragraph', 'Resumen', 1),
          block('b3', 'bullets', 'Decisiones', 2),
          block('b4', 'bullets', 'Tareas / responsables', 3),
          block('b5', 'callout', 'Riesgos / pendientes', 4),
        ],
        'brief',
      ),
  },
  {
    key: 'siep-monthly-informe',
    format: 'report',
    domain: 'siep',
    nameEs: 'Informe mensual SIEP',
    namePt: 'Informe mensal SIEP',
    nameEn: 'SIEP monthly report',
    descriptionEs: 'Estructura típica de informe de seguimiento.',
    descriptionPt: 'Estrutura típica de informe de acompanhamento.',
    descriptionEn: 'Typical monitoring report outline.',
    sortOrder: 55,
    buildCanvas: () =>
      page(
        [
          block('b1', 'heading', 'Informe — período', 0),
          block('b2', 'paragraph', 'Resumen ejecutivo', 1),
          block('b3', 'paragraph', 'Avances del período', 2),
          block('b4', 'bullets', 'Indicadores / evidencias', 3),
          block('b5', 'paragraph', 'Desafíos y riesgos', 4),
          block('b6', 'bullets', 'Próximos pasos', 5),
          block('b7', 'callout', 'Solicitudes / decisiones', 6),
        ],
        'report',
      ),
  },
  {
    key: 'atlas-project-memo',
    format: 'brief',
    domain: 'atlas',
    nameEs: 'Memo de proyecto (ATLAS)',
    namePt: 'Memo de projeto (ATLAS)',
    nameEn: 'Project memo (ATLAS)',
    descriptionEs: 'Nota interna de estado del proyecto.',
    descriptionPt: 'Nota interna de estado do projeto.',
    descriptionEn: 'Internal project status note.',
    sortOrder: 58,
    buildCanvas: () =>
      page(
        [
          block('b1', 'heading', 'Proyecto', 0),
          block('b2', 'paragraph', 'Estado actual', 1),
          block('b3', 'bullets', 'Hitos', 2),
          block('b4', 'paragraph', 'Bloqueos', 3),
          block('b5', 'bullets', 'Decisiones necesarias', 4),
        ],
        'brief',
      ),
  },
  {
    key: 'forge-learning-note',
    format: 'brief',
    domain: 'forge',
    nameEs: 'Nota de aprendizaje (FORGE)',
    namePt: 'Nota de aprendizagem (FORGE)',
    nameEn: 'Learning note (FORGE)',
    descriptionEs: 'Objetivos, actividades y evaluación de un módulo.',
    descriptionPt: 'Objetivos, atividades e avaliação de um módulo.',
    descriptionEn: 'Objectives, activities and assessment for a module.',
    sortOrder: 59,
    buildCanvas: () =>
      page(
        [
          block('b1', 'heading', 'Módulo / curso', 0),
          block('b2', 'bullets', 'Objetivos de aprendizaje', 1),
          block('b3', 'paragraph', 'Contenido clave', 2),
          block('b4', 'bullets', 'Actividades / juego', 3),
          block('b5', 'paragraph', 'Evaluación', 4),
        ],
        'brief',
      ),
  },
  {
    key: 'nexus-strategy-brief',
    format: 'brief',
    domain: 'nexus',
    nameEs: 'Brief estratégico (NEXUS)',
    namePt: 'Brief estratégico (NEXUS)',
    nameEn: 'Strategy brief (NEXUS)',
    descriptionEs: 'Hipótesis, evidencia y siguiente experimento.',
    descriptionPt: 'Hipótese, evidência e próximo experimento.',
    descriptionEn: 'Hypothesis, evidence and next experiment.',
    sortOrder: 61,
    buildCanvas: () =>
      page(
        [
          block('b1', 'heading', 'Pregunta / oportunidad', 0),
          block('b2', 'paragraph', 'Contexto', 1),
          block('b3', 'bullets', 'Hipótesis', 2),
          block('b4', 'paragraph', 'Evidencia', 3),
          block('b5', 'callout', 'Próximo experimento', 4),
        ],
        'brief',
      ),
  },
  {
    key: 'process-diagram',
    format: 'diagram',
    domain: 'general',
    nameEs: 'Diagrama de proceso',
    namePt: 'Diagrama de processo',
    nameEn: 'Process diagram',
    descriptionEs: 'Bloque Mermaid editable con la IA.',
    descriptionPt: 'Bloco Mermaid editável com a IA.',
    descriptionEn: 'Mermaid block editable with AI.',
    sortOrder: 70,
    buildCanvas: () =>
      page(
        [
          block('b1', 'heading', 'Título del diagrama', 0),
          block(
            'b2',
            'diagram',
            'Flujo',
            1,
            'flowchart TD\n  A[Inicio] --> B[Paso 1]\n  B --> C[Paso 2]\n  C --> D[Fin]',
            { diagramLang: 'mermaid' },
          ),
          block('b3', 'paragraph', 'Notas', 2),
        ],
        'diagram',
      ),
  },
  {
    key: 'pitch-deck-outline',
    format: 'presentation',
    domain: 'general',
    nameEs: 'Guion de presentación',
    namePt: 'Guião de apresentação',
    nameEn: 'Pitch deck outline',
    descriptionEs: 'Estructura de diapositivas en texto.',
    descriptionPt: 'Estrutura de slides em texto.',
    descriptionEn: 'Slide outline in text form.',
    sortOrder: 80,
    buildCanvas: () =>
      page(
        [
          block('b1', 'heading', 'Slide 1 — Portada', 0),
          block('b2', 'paragraph', 'Slide 2 — Problema', 1),
          block('b3', 'paragraph', 'Slide 3 — Solución', 2),
          block('b4', 'paragraph', 'Slide 4 — Mercado / alcance', 3),
          block('b5', 'paragraph', 'Slide 5 — Modelo / impacto', 4),
          block('b6', 'paragraph', 'Slide 6 — Equipo y cierre', 5),
        ],
        'presentation',
      ),
  },
];

export function findSystemTemplate(key: string): StudioSystemTemplate | undefined {
  return STUDIO_SYSTEM_TEMPLATES.find((t) => t.key === key);
}

export function serializeStudioTemplate(t: StudioSystemTemplate) {
  return {
    key: t.key,
    format: t.format,
    domain: t.domain,
    nameEs: t.nameEs,
    namePt: t.namePt,
    nameEn: t.nameEn,
    descriptionEs: t.descriptionEs,
    descriptionPt: t.descriptionPt,
    descriptionEn: t.descriptionEn,
    sortOrder: t.sortOrder,
    isSystem: true,
  };
}

export function domainLabel(
  domain: StudioTemplateDomain,
  locale: string,
): string {
  const map: Record<StudioTemplateDomain, [string, string, string]> = {
    general: ['Geral', 'General', 'General'],
    siep: ['SIEP', 'SIEP', 'SIEP'],
    fundhub: ['FUNDHUB', 'FUNDHUB', 'FUNDHUB'],
    meet: ['Meet', 'Meet', 'Meet'],
    forge: ['FORGE', 'FORGE', 'FORGE'],
    atlas: ['ATLAS', 'ATLAS', 'ATLAS'],
    nexus: ['NEXUS', 'NEXUS', 'NEXUS'],
  };
  const [pt, es, en] = map[domain];
  return locale === 'pt' ? pt : locale === 'es' ? es : en;
}
