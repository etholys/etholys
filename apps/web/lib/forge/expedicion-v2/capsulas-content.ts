/** Cápsulas técnicas — PPT guion + notas facilitador + capítulo integral del libro didáctico */

import { EXPEDICION_LIBRO_FULL } from '@/lib/forge/expedicion-libro-full';
import { EXPEDICION_PRESENTATION_SLIDES } from '@/lib/forge/expedicion-presentacion-slides';

export type CapsulaTecnica = {
  station: string;
  title: string;
  body: string;
  guion?: string;
  accion?: string;
  tecnico?: string;
  visual?: string;
  /** Texto del capítulo del libro (referencia completa) */
  libro?: string;
};

const STATION_SLIDES: Record<string, number> = {
  raices: 3,
  tierra: 4,
  alquimia: 5,
  mercado: 6,
  futuro: 7,
};

function slideForStation(station: string) {
  const n = STATION_SLIDES[station];
  return EXPEDICION_PRESENTATION_SLIDES.find((s) => s.n === n);
}

/** Construye cápsulas enriquecidas desde fuentes oficiales (PPT + libro). */
export function buildCapsulasTecnicas(): CapsulaTecnica[] {
  return Object.keys(STATION_SLIDES).map((station) => {
    const slide = slideForStation(station)!;
    const libro = (EXPEDICION_LIBRO_FULL[station] ?? '').trim();
    const bodyParts = [
      slide.texto ? `**${slide.texto}**` : '',
      slide.tecnico ? `### Notas del facilitador\n${slide.tecnico}` : '',
      libro ? `### Libro didáctico\n${libro}` : '',
    ].filter(Boolean);

    return {
      station,
      title: slide.title,
      guion: slide.guion,
      accion: slide.accion,
      tecnico: slide.tecnico,
      visual: slide.visual,
      libro,
      body: bodyParts.join('\n\n'),
    };
  });
}

export const CAPSULAS_TECNICAS: CapsulaTecnica[] = buildCapsulasTecnicas();
