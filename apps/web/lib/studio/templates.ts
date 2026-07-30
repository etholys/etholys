import { emptyStudioCanvas, type StudioCanvasState, type StudioFormat } from '@/lib/studio/types';

export type StudioSystemTemplate = {
  key: string;
  format: StudioFormat;
  nameEs: string;
  namePt: string;
  nameEn: string;
  descriptionEs: string;
  descriptionPt: string;
  descriptionEn: string;
  sortOrder: number;
  buildCanvas: () => StudioCanvasState;
};

function page(blocks: StudioCanvasState['pages'][0]['blocks'], title = 'Página 1'): StudioCanvasState {
  return {
    version: 1,
    format: 'report',
    pages: [{ id: 'page-1', title, order: 0, blocks }],
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
    nameEs: 'One-pager de proyecto',
    namePt: 'One-pager de projeto',
    nameEn: 'Project one-pager',
    descriptionEs: 'Resumen ejecutivo: problema, solución, impacto.',
    descriptionPt: 'Resumo executivo: problema, solução, impacto.',
    descriptionEn: 'Executive summary: problem, solution, impact.',
    sortOrder: 20,
    buildCanvas: () => {
      const c = page([
        block('b1', 'heading', 'Título del proyecto', 0),
        block('b2', 'paragraph', 'Problema', 1),
        block('b3', 'paragraph', 'Solución / enfoque', 2),
        block('b4', 'bullets', 'Resultados esperados', 3),
        block('b5', 'callout', 'Llamado a la acción', 4),
      ]);
      c.format = 'brief';
      return c;
    },
  },
  {
    key: 'funding-proposal-outline',
    format: 'proposal',
    nameEs: 'Esquema de propuesta',
    namePt: 'Esquema de proposta',
    nameEn: 'Proposal outline',
    descriptionEs: 'Secciones típicas para captación / donante.',
    descriptionPt: 'Secções típicas para captação / doador.',
    descriptionEn: 'Typical sections for grant / donor proposals.',
    sortOrder: 30,
    buildCanvas: () => {
      const c = page([
        block('b1', 'heading', 'Título de la propuesta', 0),
        block('b2', 'paragraph', 'Resumen ejecutivo', 1),
        block('b3', 'paragraph', 'Contexto y justificación', 2),
        block('b4', 'paragraph', 'Objetivos', 3),
        block('b5', 'bullets', 'Actividades', 4),
        block('b6', 'paragraph', 'Presupuesto (narrativa)', 5),
        block('b7', 'paragraph', 'Impacto y sostenibilidad', 6),
      ]);
      c.format = 'proposal';
      return c;
    },
  },
  {
    key: 'formal-letter',
    format: 'letter',
    nameEs: 'Carta formal',
    namePt: 'Carta formal',
    nameEn: 'Formal letter',
    descriptionEs: 'Carta institucional con destinatario y cierre.',
    descriptionPt: 'Carta institucional com destinatário e fecho.',
    descriptionEn: 'Institutional letter with addressee and closing.',
    sortOrder: 40,
    buildCanvas: () => {
      const c = page([
        block('b1', 'paragraph', 'Destinatario', 0),
        block('b2', 'paragraph', 'Asunto', 1),
        block('b3', 'paragraph', 'Cuerpo', 2),
        block('b4', 'paragraph', 'Cierre / firma', 3),
      ]);
      c.format = 'letter';
      return c;
    },
  },
  {
    key: 'meeting-minutes',
    format: 'report',
    nameEs: 'Acta de reunión',
    namePt: 'Ata de reunião',
    nameEn: 'Meeting minutes',
    descriptionEs: 'Participantes, temas y acuerdos.',
    descriptionPt: 'Participantes, temas e acordos.',
    descriptionEn: 'Attendees, topics, and decisions.',
    sortOrder: 50,
    buildCanvas: () => {
      const c = page([
        block('b1', 'heading', 'Acta — título', 0),
        block('b2', 'bullets', 'Participantes', 1),
        block('b3', 'paragraph', 'Temas tratados', 2),
        block('b4', 'bullets', 'Acuerdos / próximos pasos', 3),
      ]);
      c.format = 'report';
      return c;
    },
  },
  {
    key: 'process-diagram',
    format: 'diagram',
    nameEs: 'Diagrama de proceso',
    namePt: 'Diagrama de processo',
    nameEn: 'Process diagram',
    descriptionEs: 'Bloque Mermaid editable con la IA.',
    descriptionPt: 'Bloco Mermaid editável com a IA.',
    descriptionEn: 'Mermaid block editable with AI.',
    sortOrder: 60,
    buildCanvas: () => {
      const c = page([
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
      ]);
      c.format = 'diagram';
      return c;
    },
  },
  {
    key: 'pitch-deck-outline',
    format: 'presentation',
    nameEs: 'Guion de presentación',
    namePt: 'Guião de apresentação',
    nameEn: 'Pitch deck outline',
    descriptionEs: 'Estructura de diapositivas en texto.',
    descriptionPt: 'Estrutura de slides em texto.',
    descriptionEn: 'Slide outline in text form.',
    sortOrder: 70,
    buildCanvas: () => {
      const c = page([
        block('b1', 'heading', 'Slide 1 — Portada', 0),
        block('b2', 'paragraph', 'Slide 2 — Problema', 1),
        block('b3', 'paragraph', 'Slide 3 — Solución', 2),
        block('b4', 'paragraph', 'Slide 4 — Mercado / alcance', 3),
        block('b5', 'paragraph', 'Slide 5 — Modelo / impacto', 4),
        block('b6', 'paragraph', 'Slide 6 — Equipo y cierre', 5),
      ]);
      c.format = 'presentation';
      return c;
    },
  },
];

export function findSystemTemplate(key: string): StudioSystemTemplate | undefined {
  return STUDIO_SYSTEM_TEMPLATES.find((t) => t.key === key);
}
