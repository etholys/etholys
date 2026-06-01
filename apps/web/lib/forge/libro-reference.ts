/** Índice del Libro Didáctico — La Expedición Sostenible (referencia en lecciones). */

export type LibroChapter = {
  id: string;
  title: string;
  moduleHint: string;
  summary: string;
};

export const EXPEDICION_LIBRO_CHAPTERS: LibroChapter[] = [
  {
    id: 'intro',
    title: 'Introducción — El viaje del expedicionario',
    moduleHint: 'Bienvenida',
    summary: 'Reglas del tablero, Eco-Créditos, las 5 estaciones y el mapa.',
  },
  {
    id: 'raices',
    title: 'Cap. 1 — Raíces (Estrategia)',
    moduleHint: 'Raíces',
    summary: 'Triple impacto, propósito evolutivo, cliente LOHAS y propuesta de valor sostenible.',
  },
  {
    id: 'tierra',
    title: 'Cap. 2 — Tierra (Producción)',
    moduleHint: 'Tierra',
    summary: 'Ecoeficiencia, suelo vivo, bioinsumos y semáforo de eficiencia.',
  },
  {
    id: 'alquimia',
    title: 'Cap. 3 — Alquimia (Transformación)',
    moduleHint: 'Alquimia',
    summary: 'Valor agregado, economía circular y diseño de producto regenerativo.',
  },
  {
    id: 'mercado',
    title: 'Cap. 4 — Mercado (Comercialización)',
    moduleHint: 'Mercado',
    summary: 'Storytelling, canales digitales y precio que financia la regeneración.',
  },
  {
    id: 'futuro',
    title: 'Cap. 5 — Futuro (Finanzas)',
    moduleHint: 'Futuro',
    summary: 'Modelo financiero triple, indicadores y plan de escalabilidad.',
  },
  {
    id: 'taller',
    title: 'Anexo — Taller del tablero',
    moduleHint: 'Taller',
    summary: 'Dinámica presencial, cartas de reto y validación del facilitador.',
  },
];

export function libroChapterForModuleTitle(moduleTitle: string): LibroChapter | undefined {
  const t = moduleTitle.toLowerCase();
  return EXPEDICION_LIBRO_CHAPTERS.find((c) => t.includes(c.moduleHint.toLowerCase()));
}
