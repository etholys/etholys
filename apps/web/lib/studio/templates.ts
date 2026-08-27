import {
  DEFAULT_STUDIO_MARGINS_MM,
  emptyStudioCanvas,
  type StudioBlock,
  type StudioCanvasState,
  type StudioFormat,
} from '@/lib/studio/types';
import { STUDIO_PUBLIC_TEMPLATES } from '@/lib/studio/template-library/public-catalog';
import { applyLayoutPreset, designPageCanvas, writePageCanvas, type LayoutVariant } from '@/lib/studio/template-library/layout-presets';

/** Camada do Studio na galeria — Conteúdo (Word/Excel/PPT/PDF) vs Desenho (Canva/Gamma/InDesign). */
export type StudioStudioLayer = 'content' | 'design';

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

/** Tipos da galeria “Crear” — duas camadas (Conteúdo + Desenho), variedade Canva. */
export const STUDIO_GALLERY_KINDS = [
  'for_you',
  /* Conteúdo (Write) */
  'docs',
  'data',
  'slides',
  'pdf',
  'upload',
  /* Desenho (Design) */
  'presentations',
  'social',
  'photos',
  'videos',
  'print',
  'whiteboards',
  'web',
  'emails',
  'proposals',
  'letters',
  'company',
  'custom_size',
] as const;

export type StudioGalleryKind = (typeof STUDIO_GALLERY_KINDS)[number];

export type StudioGalleryContentKind = Exclude<
  StudioGalleryKind,
  'for_you' | 'company' | 'custom_size' | 'upload'
>;

export const STUDIO_CONTENT_GALLERY_KINDS = ['docs', 'data', 'slides', 'pdf'] as const;
export const STUDIO_DESIGN_GALLERY_KINDS = [
  'presentations',
  'social',
  'photos',
  'videos',
  'print',
  'whiteboards',
  'web',
  'emails',
  'proposals',
  'letters',
] as const;

export type StudioSystemTemplate = {
  key: string;
  format: StudioFormat;
  domain: StudioTemplateDomain;
  /** content = Redação; design = diagramação visual */
  studioLayer?: StudioStudioLayer;
  galleryKind?: StudioGalleryContentKind;
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
  blocks: StudioBlock[],
  format: StudioFormat = 'report',
  title = 'Página 1',
  layoutVariant: LayoutVariant = 'report',
): StudioCanvasState {
  const c = designPageCanvas(blocks, format, layoutVariant);
  if (c.pages[0]) c.pages[0].title = title;
  return c;
}

/** Texto visível no canvas (antes só ia para `title` e a folha parecia vazia). */
function block(
  id: string,
  kind: StudioBlock['kind'],
  label: string,
  order: number,
  text = '',
  extra?: Partial<StudioBlock>,
): StudioBlock {
  let body = text;
  if (!body) {
    if (kind === 'heading') body = label;
    else if (kind === 'bullets') body = `- ${label}\n- …\n- …`;
    else if (kind === 'callout') body = `**${label}** — completa este destaque.`;
    else if (kind === 'diagram') body = text;
    else body = `**${label}**\n\nEscribe aquí el contenido de esta sección…`;
  }
  return { id, kind, title: label, text: body, order, ...extra };
}

export function galleryKindForFormat(
  format: StudioFormat,
  domain?: StudioTemplateDomain,
): StudioSystemTemplate['galleryKind'] {
  if (format === 'presentation') return 'presentations';
  if (format === 'proposal' || domain === 'fundhub') return 'proposals';
  if (format === 'letter') return 'letters';
  if (format === 'diagram') return 'whiteboards';
  return 'docs';
}

export function galleryKindLabel(kind: StudioGalleryKind, locale: string): string {
  const map: Record<StudioGalleryKind, [string, string, string]> = {
    for_you: ['Para ti', 'Para vos', 'For you'],
    docs: ['Documentos / Word', 'Documentos / Word', 'Docs / Word'],
    data: ['Excel / dados', 'Excel / datos', 'Excel / data'],
    slides: ['Apresentações (guión)', 'Presentaciones (guión)', 'Slides (outline)'],
    pdf: ['PDF / relatório', 'PDF / informe', 'PDF / report'],
    upload: ['Carregar ficheiro', 'Subir archivo', 'Upload file'],
    presentations: ['Apresentações visuais', 'Presentaciones visuales', 'Visual decks'],
    social: ['Redes sociais', 'Redes sociales', 'Social media'],
    photos: ['Fotos', 'Fotos', 'Photos'],
    videos: ['Vídeos / storyboard', 'Vídeos / storyboard', 'Videos / storyboard'],
    print: ['Imprimir', 'Imprimir', 'Print'],
    whiteboards: ['Pizarras', 'Pizarras online', 'Whiteboards'],
    web: ['Sites / one-pager', 'Sitios web', 'Websites'],
    emails: ['Correos', 'Correos', 'Emails'],
    proposals: ['Propostas', 'Propuestas', 'Proposals'],
    letters: ['Cartas e briefs', 'Cartas y briefs', 'Letters & briefs'],
    company: ['As nossas', 'Las nuestras', 'Ours'],
    custom_size: ['Tamanho livre', 'Elegir el tamaño', 'Custom size'],
  };
  const [pt, es, en] = map[kind];
  return locale === 'pt' ? pt : locale === 'es' ? es : en;
}

export function studioLayerLabel(layer: StudioStudioLayer, locale: string): string {
  const map: Record<StudioStudioLayer, [string, string, string]> = {
    content: ['Conteúdo', 'Contenido', 'Content'],
    design: ['Desenho', 'Diseño', 'Design'],
  };
  const [pt, es, en] = map[layer];
  return locale === 'pt' ? pt : locale === 'es' ? es : en;
}

export function galleryKindLayer(kind: StudioGalleryKind): StudioStudioLayer | 'both' {
  if (kind === 'for_you' || kind === 'company') return 'both';
  if (kind === 'upload') return 'content';
  if (kind === 'custom_size') return 'design';
  if ((STUDIO_CONTENT_GALLERY_KINDS as readonly string[]).includes(kind)) return 'content';
  return 'design';
}

/** Catálogo embutido — seed em memória; DB opcional para custom da empresa. */
export const STUDIO_SYSTEM_TEMPLATES: StudioSystemTemplate[] = [
  {
    key: 'blank-report',
    format: 'report',
    domain: 'general',
    studioLayer: 'content',
    galleryKind: 'docs',
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
      c.studioMode = 'write';
      if (c.pages[0]?.blocks[0]) c.pages[0].blocks[0].text = 'Título del documento';
      if (c.pages[0]?.blocks[1]) c.pages[0].blocks[1].text = 'Empieza a escribir…';
      return c;
    },
  },
  {
    key: 'project-one-pager',
    format: 'brief',
    domain: 'general',
    studioLayer: 'design',
    galleryKind: 'docs',
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
    studioLayer: 'design',
    galleryKind: 'proposals',
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
    studioLayer: 'design',
    galleryKind: 'proposals',
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
    studioLayer: 'design',
    galleryKind: 'letters',
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
    studioLayer: 'content',
    galleryKind: 'docs',
    nameEs: 'Acta de reunión',
    namePt: 'Ata de reunião',
    nameEn: 'Meeting minutes',
    descriptionEs: 'Participantes, temas y acuerdos.',
    descriptionPt: 'Participantes, temas e acordos.',
    descriptionEn: 'Attendees, topics, and decisions.',
    sortOrder: 50,
    buildCanvas: () =>
      writePageCanvas([
        block('b1', 'heading', 'Acta — título', 0),
        block('b2', 'bullets', 'Participantes', 1),
        block('b3', 'paragraph', 'Temas tratados', 2),
        block('b4', 'bullets', 'Acuerdos / próximos pasos', 3),
      ]),
  },
  {
    key: 'meet-post-brief',
    format: 'brief',
    domain: 'meet',
    studioLayer: 'content',
    galleryKind: 'docs',
    nameEs: 'Resumen post-reunión',
    namePt: 'Resumo pós-reunião',
    nameEn: 'Post-meeting brief',
    descriptionEs: 'Resumen, decisiones y tareas para compartir.',
    descriptionPt: 'Resumo, decisões e tarefas para partilhar.',
    descriptionEn: 'Summary, decisions and tasks to share.',
    sortOrder: 52,
    buildCanvas: () =>
      writePageCanvas(
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
    studioLayer: 'content',
    galleryKind: 'pdf',
    nameEs: 'Informe mensual SIEP',
    namePt: 'Informe mensal SIEP',
    nameEn: 'SIEP monthly report',
    descriptionEs: 'Estructura típica de informe de seguimiento.',
    descriptionPt: 'Estrutura típica de informe de acompanhamento.',
    descriptionEn: 'Typical monitoring report outline.',
    sortOrder: 55,
    buildCanvas: () =>
      writePageCanvas([
        block('b1', 'heading', 'Informe — período', 0),
        block('b2', 'paragraph', 'Resumen ejecutivo', 1),
        block('b3', 'paragraph', 'Avances del período', 2),
        block('b4', 'bullets', 'Indicadores / evidencias', 3),
        block('b5', 'paragraph', 'Desafíos y riesgos', 4),
        block('b6', 'bullets', 'Próximos pasos', 5),
        block('b7', 'callout', 'Solicitudes / decisiones', 6),
      ]),
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
    studioLayer: 'design',
    galleryKind: 'whiteboards',
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
    studioLayer: 'design',
    galleryKind: 'presentations',
    nameEs: 'Guion de presentación',
    namePt: 'Guião de apresentação',
    nameEn: 'Pitch deck outline',
    descriptionEs: 'Diapositivas con layout Design (portada + secciones).',
    descriptionPt: 'Slides com layout Design (capa + secções).',
    descriptionEn: 'Slides with Design layout (cover + sections).',
    sortOrder: 80,
    buildCanvas: () => {
      const slides = [
        ['Portada', 'Subtítulo / organización'],
        ['Problema', 'Describe el problema que resuelves…'],
        ['Solución', 'Tu propuesta de valor…'],
        ['Alcance', 'Mercado, beneficiarios, escala…'],
        ['Impacto', 'Modelo / resultados esperados…'],
        ['Cierre', 'Equipo, contacto, llamada a la acción…'],
      ] as const;
      return {
        version: 1 as const,
        format: 'presentation' as const,
        pageSize: 'Slide' as const,
        orientation: 'landscape' as const,
        marginsMm: { ...DEFAULT_STUDIO_MARGINS_MM },
        studioMode: 'design' as const,
        pages: slides.map(([title, body], i) => ({
          id: `page-${i + 1}`,
          title: `Slide ${i + 1}`,
          order: i,
          pageSize: 'Slide' as const,
          layoutMode: 'blank' as const,
          blocks: applyLayoutPreset(
            [
              block(`h-${i}`, 'heading', title, 0),
              block(`p-${i}`, 'paragraph', 'Contenido', 1, body),
            ],
            i === 0 ? 'cover' : 'slide',
          ),
        })),
      };
    },
  },
];

/** Sistema + biblioteca pública embutida. */
export const ALL_STUDIO_TEMPLATES: StudioSystemTemplate[] = [
  ...STUDIO_SYSTEM_TEMPLATES,
  ...(STUDIO_PUBLIC_TEMPLATES as StudioSystemTemplate[]),
];

export function findSystemTemplate(key: string): StudioSystemTemplate | undefined {
  return ALL_STUDIO_TEMPLATES.find((t) => t.key === key);
}

export function resolveTemplateStudioLayer(t: StudioSystemTemplate): StudioStudioLayer {
  if (t.studioLayer) return t.studioLayer;
  const canvas = t.buildCanvas();
  if (canvas.studioMode === 'write') return 'content';
  return 'design';
}

export function resolveTemplateGalleryKind(t: StudioSystemTemplate): StudioSystemTemplate['galleryKind'] {
  return t.galleryKind || galleryKindForFormat(t.format, t.domain);
}

export function serializeStudioTemplate(t: StudioSystemTemplate) {
  return {
    key: t.key,
    format: t.format,
    domain: t.domain,
    studioLayer: resolveTemplateStudioLayer(t),
    galleryKind: resolveTemplateGalleryKind(t),
    nameEs: t.nameEs,
    namePt: t.namePt,
    nameEn: t.nameEn,
    descriptionEs: t.descriptionEs,
    descriptionPt: t.descriptionPt,
    descriptionEn: t.descriptionEn,
    sortOrder: t.sortOrder,
    isSystem: true,
    isCompany: false as boolean,
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
