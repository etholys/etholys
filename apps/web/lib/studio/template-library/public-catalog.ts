/**
 * Catálogo público embutido — modelos com layout Design visível (estilo Canva/Gamma).
 */
import type { StudioBlock, StudioCanvasState, StudioFormat } from '@/lib/studio/types';
import {
  applyLayoutPreset,
  designPageCanvas,
  writePageCanvas,
  writeSlidesOutline,
  type LayoutVariant,
} from '@/lib/studio/template-library/layout-presets';
import { DEFAULT_STUDIO_MARGINS_MM } from '@/lib/studio/types';
import type { StudioStudioLayer } from '@/lib/studio/templates';

type PublicTemplate = {
  key: string;
  format: StudioFormat;
  domain: 'general' | 'fundhub' | 'siep' | 'meet' | 'forge' | 'atlas' | 'nexus';
  studioLayer: StudioStudioLayer;
  galleryKind:
    | 'docs'
    | 'data'
    | 'slides'
    | 'pdf'
    | 'proposals'
    | 'presentations'
    | 'letters'
    | 'social'
    | 'photos'
    | 'videos'
    | 'print'
    | 'whiteboards'
    | 'web'
    | 'emails';
  nameEs: string;
  namePt: string;
  nameEn: string;
  descriptionEs: string;
  descriptionPt: string;
  descriptionEn: string;
  sortOrder: number;
  buildCanvas: () => StudioCanvasState;
};

function blk(
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
    else if (kind === 'bullets') body = `- ${label}\n- Punto clave\n- Evidencia / dato`;
    else if (kind === 'callout') body = `**${label}** — texto destacado para completar.`;
    else if (kind === 'table') body = text || `| ${label} | Col A | Col B |\n| --- | --- | --- |\n| Fila 1 | … | … |`;
    else if (kind === 'image') body = text || 'Arrastra o sube una imagen…';
    else body = `${label}\n\nDesarrolla esta sección con datos concretos…`;
  }
  return { id, kind, title: label, text: body, order, ...extra };
}

function page(blocks: StudioBlock[], format: StudioFormat, variant: LayoutVariant) {
  return designPageCanvas(blocks, format, variant);
}

function slidesCanvas(slides: Array<{ title: string; body: string }>): StudioCanvasState {
  return {
    version: 1,
    format: 'presentation',
    pageSize: 'Slide',
    orientation: 'landscape',
    marginsMm: { ...DEFAULT_STUDIO_MARGINS_MM },
    studioMode: 'design',
    pages: slides.map((s, i) => ({
      id: `page-${i + 1}`,
      title: `Slide ${i + 1}`,
      order: i,
      pageSize: 'Slide' as const,
      layoutMode: 'blank' as const,
      blocks: applyLayoutPreset(
        [blk(`h-${i}`, 'heading', s.title, 0), blk(`p-${i}`, 'paragraph', 'Contenido', 1, s.body)],
        i === 0 ? 'cover' : 'slide',
      ),
    })),
  };
}

export const STUDIO_PUBLIC_TEMPLATES: PublicTemplate[] = [
  /* —— Camada Conteúdo (Write) —— */
  {
    key: 'pub-word-document',
    format: 'report',
    domain: 'general',
    studioLayer: 'content',
    galleryKind: 'docs',
    nameEs: 'Documento Word',
    namePt: 'Documento Word',
    nameEn: 'Word document',
    descriptionEs: 'Redacción continua — título, secciones y cuerpo.',
    descriptionPt: 'Redação contínua — título, secções e corpo.',
    descriptionEn: 'Continuous writing — title, sections and body.',
    sortOrder: 11,
    buildCanvas: () =>
      writePageCanvas([
        blk('h', 'heading', 'Título del documento', 0),
        blk('i', 'paragraph', 'Introducción', 1, 'Contexto y propósito del documento…'),
        blk('s1', 'heading', 'Sección 1', 2),
        blk('p1', 'paragraph', 'Contenido', 3, 'Desarrolla los puntos clave…'),
        blk('s2', 'heading', 'Sección 2', 4),
        blk('p2', 'paragraph', 'Contenido', 5, 'Evidencias, datos y conclusiones…'),
      ]),
  },
  {
    key: 'pub-excel-sheet',
    format: 'report',
    domain: 'general',
    studioLayer: 'content',
    galleryKind: 'data',
    nameEs: 'Hoja de cálculo',
    namePt: 'Folha de cálculo',
    nameEn: 'Spreadsheet',
    descriptionEs: 'Tabla editable — indicadores, presupuesto, seguimiento.',
    descriptionPt: 'Tabela editável — indicadores, orçamento, acompanhamento.',
    descriptionEn: 'Editable table — KPIs, budget, tracking.',
    sortOrder: 12,
    buildCanvas: () =>
      writePageCanvas([
        blk('h', 'heading', 'Panel de datos', 0),
        blk(
          't',
          'table',
          'Datos',
          1,
          '| Indicador | Q1 | Q2 | Q3 | Q4 |\n| --- | --- | --- | --- | --- |\n| Ventas | 100 | 120 | 135 | 150 |\n| Costes | 80 | 85 | 90 | 95 |\n| Margen | 20 | 35 | 45 | 55 |',
        ),
        blk('n', 'paragraph', 'Notas', 2, 'Metodología y fuentes de los datos…'),
      ]),
  },
  {
    key: 'pub-ppt-outline',
    format: 'presentation',
    domain: 'general',
    studioLayer: 'content',
    galleryKind: 'slides',
    nameEs: 'Guión de presentación (PPT)',
    namePt: 'Guião de apresentação (PPT)',
    nameEn: 'Presentation outline (PPT)',
    descriptionEs: 'Un slide por página — título y notas del ponente (modo Redacción).',
    descriptionPt: 'Um slide por página — título e notas do orador (modo Redação).',
    descriptionEn: 'One slide per page — title and speaker notes (Write mode).',
    sortOrder: 13,
    buildCanvas: () =>
      writeSlidesOutline([
        { title: 'Portada', notes: 'Nombre del proyecto · organización · fecha' },
        { title: 'Problema', notes: 'Describe el dolor que resuelves…' },
        { title: 'Solución', notes: 'Propuesta de valor y enfoque…' },
        { title: 'Impacto', notes: 'Resultados medibles y beneficiarios…' },
        { title: 'Cierre', notes: 'Equipo · contacto · próximo paso' },
      ]),
  },
  {
    key: 'pub-pdf-report',
    format: 'report',
    domain: 'general',
    studioLayer: 'content',
    galleryKind: 'pdf',
    nameEs: 'Informe PDF (texto)',
    namePt: 'Relatório PDF (texto)',
    nameEn: 'PDF report (text)',
    descriptionEs: 'Informe largo listo para exportar a PDF.',
    descriptionPt: 'Relatório longo pronto para exportar em PDF.',
    descriptionEn: 'Long-form report ready for PDF export.',
    sortOrder: 14,
    buildCanvas: () =>
      writePageCanvas([
        blk('h', 'heading', 'Informe — título', 0),
        blk('e', 'paragraph', 'Resumen ejecutivo', 1, 'Síntesis de hallazgos y recomendaciones…'),
        blk('s1', 'heading', '1. Contexto', 2),
        blk('p1', 'paragraph', 'Antecedentes', 3),
        blk('s2', 'heading', '2. Metodología', 4),
        blk('p2', 'paragraph', 'Enfoque', 5),
        blk('s3', 'heading', '3. Resultados', 6),
        blk('b', 'bullets', 'Hallazgos', 7),
        blk('c', 'callout', 'Conclusión', 8, '**Recomendación principal** — acción concreta.'),
      ]),
  },
  /* —— Camada Desenho (Design) —— */
  {
    key: 'pub-impact-report',
    format: 'report',
    domain: 'general',
    studioLayer: 'design',
    galleryKind: 'docs',
    nameEs: 'Informe de impacto',
    namePt: 'Relatório de impacto',
    nameEn: 'Impact report',
    descriptionEs: 'Portada + columnas + bloques destacados.',
    descriptionPt: 'Capa + colunas + blocos de destaque.',
    descriptionEn: 'Cover + columns + highlight blocks.',
    sortOrder: 15,
    buildCanvas: () =>
      page(
        [
          blk('h', 'heading', 'Informe de impacto', 0),
          blk('a', 'paragraph', 'Resumen ejecutivo', 1, 'Resultados clave del periodo…'),
          blk('b', 'callout', 'Dato destacado', 2, '**+32%** de beneficiarios alcanzados'),
          blk('c', 'bullets', 'Logros', 3),
          blk('d', 'paragraph', 'Próximos pasos', 4),
        ],
        'report',
        'report',
      ),
  },
  {
    key: 'pub-brand-onepager',
    format: 'brief',
    domain: 'general',
    studioLayer: 'design',
    galleryKind: 'web',
    nameEs: 'One-pager web / landing',
    namePt: 'One-pager web / landing',
    nameEn: 'Web one-pager',
    descriptionEs: 'Hero centrado + propuesta + CTA.',
    descriptionPt: 'Hero centrado + proposta + CTA.',
    descriptionEn: 'Centered hero + value prop + CTA.',
    sortOrder: 18,
    buildCanvas: () =>
      page(
        [
          blk('h', 'heading', 'Nombre del programa', 0),
          blk('s', 'paragraph', 'Subtítulo', 1, 'Propuesta de valor en una frase clara'),
          blk('c', 'callout', 'Llamado a la acción', 2, 'Contacto · demo · inscripción'),
        ],
        'brief',
        'cover',
      ),
  },
  {
    key: 'pub-social-post',
    format: 'brief',
    domain: 'general',
    studioLayer: 'design',
    galleryKind: 'social',
    nameEs: 'Post redes (4:5)',
    namePt: 'Post redes (4:5)',
    nameEn: 'Social post (4:5)',
    descriptionEs: 'Titular + mensaje + CTA para LinkedIn/Instagram.',
    descriptionPt: 'Título + mensagem + CTA para LinkedIn/Instagram.',
    descriptionEn: 'Headline + message + CTA for social.',
    sortOrder: 22,
    buildCanvas: () =>
      page(
        [
          blk('h', 'heading', 'Titular del post', 0),
          blk('b', 'paragraph', 'Mensaje', 1, 'Texto breve y visual para la red social.'),
          blk('c', 'callout', 'CTA', 2, 'Saber más → enlace'),
        ],
        'brief',
        'social',
      ),
  },
  {
    key: 'pub-print-flyer',
    format: 'report',
    domain: 'general',
    studioLayer: 'design',
    galleryKind: 'print',
    nameEs: 'Flyer A4 impresión',
    namePt: 'Flyer A4 impressão',
    nameEn: 'A4 print flyer',
    descriptionEs: 'Díptico visual para imprimir o PDF.',
    descriptionPt: 'Díptico visual para imprimir ou PDF.',
    descriptionEn: 'Visual flyer for print or PDF.',
    sortOrder: 25,
    buildCanvas: () =>
      page(
        [
          blk('h', 'heading', 'Evento / campaña', 0),
          blk('i', 'paragraph', 'Intro', 1, 'Qué, cuándo, dónde…'),
          blk('l', 'bullets', 'Beneficios', 2),
          blk('r', 'bullets', 'Requisitos', 3),
          blk('f', 'paragraph', 'Pie', 4, 'Organización · contacto · web'),
        ],
        'report',
        'print',
      ),
  },
  {
    key: 'pub-workshop-board',
    format: 'diagram',
    domain: 'general',
    studioLayer: 'design',
    galleryKind: 'whiteboards',
    nameEs: 'Pizarra de taller',
    namePt: 'Quadro de workshop',
    nameEn: 'Workshop whiteboard',
    descriptionEs: 'Notas + diagrama + acuerdos.',
    descriptionPt: 'Notas + diagrama + acordos.',
    descriptionEn: 'Notes + diagram + agreements.',
    sortOrder: 28,
    buildCanvas: () =>
      page(
        [
          blk('h', 'heading', 'Taller — tema', 0),
          blk('d', 'diagram', 'Mapa', 1, 'flowchart LR\n  A[Idea] --> B[Prueba]\n  B --> C[Aprendizaje]', {
            diagramLang: 'mermaid',
          }),
          blk('n', 'bullets', 'Acuerdos', 2),
        ],
        'diagram',
        'report',
      ),
  },
  {
    key: 'pub-data-brief',
    format: 'report',
    domain: 'general',
    studioLayer: 'design',
    galleryKind: 'print',
    nameEs: 'Panel KPI (visual)',
    namePt: 'Painel KPI (visual)',
    nameEn: 'KPI dashboard (visual)',
    descriptionEs: 'Indicadores con layout Design — ideal para imprimir o PDF.',
    descriptionPt: 'Indicadores com layout Design — ideal para imprimir ou PDF.',
    descriptionEn: 'KPI blocks with Design layout — print or PDF ready.',
    sortOrder: 30,
    buildCanvas: () =>
      page(
        [
          blk('h', 'heading', 'Panel de indicadores', 0),
          blk('k1', 'callout', 'KPI 1', 1, '**Meta:** 100 · **Actual:** 78'),
          blk('k2', 'callout', 'KPI 2', 2, '**Meta:** 50 · **Actual:** 52'),
          blk('n', 'paragraph', 'Notas metodológicas', 3),
        ],
        'report',
        'report',
      ),
  },
  {
    key: 'pub-email-newsletter',
    format: 'letter',
    domain: 'general',
    studioLayer: 'design',
    galleryKind: 'emails',
    nameEs: 'Newsletter / correo',
    namePt: 'Newsletter / email',
    nameEn: 'Newsletter email',
    descriptionEs: 'Asunto + cuerpo + botón CTA.',
    descriptionPt: 'Assunto + corpo + botão CTA.',
    descriptionEn: 'Subject + body + CTA button.',
    sortOrder: 35,
    buildCanvas: () =>
      page(
        [
          blk('s', 'heading', 'Asunto del correo', 0),
          blk('b', 'paragraph', 'Saludo', 1, 'Hola {{nombre}},\n\nMensaje principal…'),
          blk('c', 'callout', 'CTA', 2, '**Ver más** — enlace al recurso'),
          blk('f', 'paragraph', 'Firma', 3, 'Equipo · organización'),
        ],
        'letter',
        'cover',
      ),
  },
  {
    key: 'pub-pitch-deck-pro',
    format: 'presentation',
    domain: 'general',
    studioLayer: 'design',
    galleryKind: 'presentations',
    nameEs: 'Pitch deck (6 slides)',
    namePt: 'Pitch deck (6 slides)',
    nameEn: 'Pitch deck (6 slides)',
    descriptionEs: 'Presentación con portada y secciones diagramadas.',
    descriptionPt: 'Apresentação com capa e secções diagramadas.',
    descriptionEn: 'Deck with cover and laid-out sections.',
    sortOrder: 82,
    buildCanvas: () =>
      slidesCanvas([
        { title: 'Nombre del proyecto', body: 'Organización · fecha' },
        { title: 'Problema', body: 'Describe el dolor que resuelves…' },
        { title: 'Solución', body: 'Tu enfoque único…' },
        { title: 'Mercado', body: 'Beneficiarios · tamaño · geografía…' },
        { title: 'Impacto', body: 'Resultados medibles…' },
        { title: 'Contacto', body: 'Equipo · email · próximo paso' },
      ]),
  },
  {
    key: 'pub-fundhub-proposal',
    format: 'proposal',
    domain: 'fundhub',
    studioLayer: 'design',
    galleryKind: 'proposals',
    nameEs: 'Propuesta a donante (visual)',
    namePt: 'Proposta a doador (visual)',
    nameEn: 'Donor proposal (visual)',
    descriptionEs: 'Estructura FUNDHUB con layout Design.',
    descriptionPt: 'Estrutura FUNDHUB com layout Design.',
    descriptionEn: 'FUNDHUB structure with Design layout.',
    sortOrder: 33,
    buildCanvas: () =>
      page(
        [
          blk('h', 'heading', 'Título de la propuesta', 0),
          blk('e', 'paragraph', 'Resumen ejecutivo', 1),
          blk('j', 'paragraph', 'Justificación', 2),
          blk('o', 'bullets', 'Objetivos', 3),
          blk('a', 'bullets', 'Actividades', 4),
          blk('i', 'paragraph', 'Impacto', 5),
          blk('b', 'callout', 'Presupuesto solicitado', 6, '**Total:** € …'),
        ],
        'proposal',
        'report',
      ),
  },
  {
    key: 'pub-photo-poster',
    format: 'brief',
    domain: 'general',
    studioLayer: 'design',
    galleryKind: 'photos',
    nameEs: 'Póster con foto',
    namePt: 'Póster com foto',
    nameEn: 'Photo poster',
    descriptionEs: 'Imagen principal + título + pie — estilo Canva/InDesign.',
    descriptionPt: 'Imagem principal + título + legenda — estilo Canva/InDesign.',
    descriptionEn: 'Hero image + title + caption — Canva/InDesign style.',
    sortOrder: 40,
    buildCanvas: () =>
      page(
        [
          blk('img', 'image', 'Foto principal', 0, '', { imageUrl: null }),
          blk('h', 'heading', 'Título del póster', 1),
          blk('c', 'paragraph', 'Pie de foto', 2, 'Crédito · fecha · lugar'),
        ],
        'brief',
        'photo',
      ),
  },
  {
    key: 'pub-photo-collage',
    format: 'report',
    domain: 'general',
    studioLayer: 'design',
    galleryKind: 'photos',
    nameEs: 'Collage de fotos',
    namePt: 'Collage de fotos',
    nameEn: 'Photo collage',
    descriptionEs: 'Tres marcos de imagen + título — álbum o informe visual.',
    descriptionPt: 'Três molduras de imagem + título — álbum ou relatório visual.',
    descriptionEn: 'Three image frames + title — album or visual report.',
    sortOrder: 42,
    buildCanvas: () => {
      const c = designPageCanvas(
        [
          blk('h', 'heading', 'Galería / álbum', 0),
          blk('i1', 'image', 'Foto 1', 1, '', { imageUrl: null }),
          blk('i2', 'image', 'Foto 2', 2, '', { imageUrl: null }),
          blk('i3', 'image', 'Foto 3', 3, '', { imageUrl: null }),
          blk('n', 'paragraph', 'Descripción', 4, 'Contexto del conjunto de imágenes…'),
        ],
        'report',
        'print',
      );
      if (c.pages[0]?.blocks[1]) c.pages[0].blocks[1].layout = { xPct: 8, yPct: 22, wPct: 40 };
      if (c.pages[0]?.blocks[2]) c.pages[0].blocks[2].layout = { xPct: 52, yPct: 22, wPct: 40 };
      if (c.pages[0]?.blocks[3]) c.pages[0].blocks[3].layout = { xPct: 8, yPct: 55, wPct: 84 };
      return c;
    },
  },
  {
    key: 'pub-video-storyboard',
    format: 'brief',
    domain: 'forge',
    studioLayer: 'design',
    galleryKind: 'videos',
    nameEs: 'Storyboard de vídeo',
    namePt: 'Storyboard de vídeo',
    nameEn: 'Video storyboard',
    descriptionEs: 'Marcos visuales + guión — FORGE, Meet o campaña.',
    descriptionPt: 'Quadros visuais + guião — FORGE, Meet ou campanha.',
    descriptionEn: 'Visual frames + script — FORGE, Meet or campaign.',
    sortOrder: 44,
    buildCanvas: () =>
      page(
        [
          blk('t', 'heading', 'Vídeo — título', 0),
          blk('f1', 'image', 'Plano 1', 1, 'Escena 1: apertura…', { imageUrl: null }),
          blk('n1', 'paragraph', 'Notas plano 1', 2, 'Duración · voz en off · acción'),
          blk('f2', 'image', 'Plano 2', 3, 'Escena 2: desarrollo…', { imageUrl: null }),
          blk('f3', 'image', 'Plano 3', 4, 'Escena 3: cierre…', { imageUrl: null }),
          blk('s', 'callout', 'Guión / narración', 5, 'Texto completo del vídeo o locución…'),
        ],
        'brief',
        'video',
      ),
  },
  {
    key: 'pub-video-thumbnail',
    format: 'brief',
    domain: 'meet',
    studioLayer: 'design',
    galleryKind: 'videos',
    nameEs: 'Miniatura de vídeo',
    namePt: 'Miniatura de vídeo',
    nameEn: 'Video thumbnail',
    descriptionEs: 'Frame + titular para YouTube, FORGE o CHORUS.',
    descriptionPt: 'Frame + título para YouTube, FORGE ou CHORUS.',
    descriptionEn: 'Frame + headline for YouTube, FORGE or CHORUS.',
    sortOrder: 46,
    buildCanvas: () =>
      page(
        [
          blk('thumb', 'image', 'Frame del vídeo', 0, '', { imageUrl: null }),
          blk('h', 'heading', 'Titular del vídeo', 1),
          blk('b', 'callout', 'Duración / serie', 2, '12 min · Ep. 3 · FORGE'),
        ],
        'brief',
        'photo',
      ),
  },
];
