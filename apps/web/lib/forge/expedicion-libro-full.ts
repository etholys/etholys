import { EXPEDICION_LIBRO_CHAPTERS } from '@/lib/forge/libro-reference';

/** Contenido extendido del libro (texto didáctico por capítulo). */
export const EXPEDICION_LIBRO_FULL: Record<string, string> = {
  intro: `La Expedición Sostenible transforma una MiPyME en un negocio de triple impacto mediante retos, fichas y un tablero de 20 casillas. Cada estación del mapa A2 representa una dimensión del negocio: estrategia, producción, transformación, mercado y finanzas.

Como expedicionario recibes 500 Eco-Créditos iniciales. Cada ficha validada por el facilitador suma +100 Eco-Créditos y +1 Punto de Impacto. El libro acompaña cada módulo digital en FORGE con lecturas, quizzes y el tablero personal.`,
  raices: `Capítulo Raíces — Estrategia y ADN

El propósito evolutivo pregunta qué vacío dejaría tu negocio si desapareciera mañana. El segmento LOHAS valora trazabilidad y autenticidad por encima del precio más bajo.

Ejercicio clave: redactar la Propuesta de Valor Sostenible = Producto + Beneficio social/ambiental + Diferenciador. Tu precio no compite con el supermercado: financia la regeneración de la tierra.`,
  tierra: `Capítulo Tierra — Producción y regeneración

La ecoeficiencia reduce costos fijos al ahorrar agua y energía. El suelo vivo retiene agua: +1% materia orgánica ≈ 200.000 L/ha.

Semáforo de eficiencia: identifica una práctica roja (desperdicio) y una verde (mejora inmediata). Los bioinsumos convierten “residuos” en ahorro.`,
  alquimia: `Capítulo Alquimia — Transformación

Valor agregado y economía circular: ¿qué subproducto puede ser insumo? Diseña un producto regenerativo con claim honesto en etiqueta.

La alquimia conecta la materia prima con una historia que el cliente LOHAS puede verificar.`,
  mercado: `Capítulo Mercado — Comercialización

Storytelling digital: mensaje principal para WhatsApp/Instagram. Pitch de 30 segundos para feria de negocios.

El canal correcto no es “estar en todas partes”, sino donde tu cliente LOHAS ya confía.`,
  futuro: `Capítulo Futuro — Finanzas y escalabilidad

Modelo financiero triple: económico, social, ambiental. Meta de ventas mes 1 en unidades. Indicadores simples que puedes medir cada semana.

La escalabilidad sostenible crece sin depender de subsidios permanentes.`,
  taller: `Anexo Taller — Tablero

Duración 3,5 h. Turno: lanzar dado → mover → actuar en estación. Validación facilitador: ficha coherente +100 Eco-Créditos.

Fórmula final: (Eco-Créditos × 0,6) + (Puntos de Impacto × 10 × 0,4). La versión digital FORGE replica la pista con cartas y retos.`,
};

export function getFullLibroMarkdown(): string {
  const parts = ['# Libro didáctico — La Expedición Sostenible\n'];
  for (const ch of EXPEDICION_LIBRO_CHAPTERS) {
    parts.push(`\n## ${ch.title}\n\n`, EXPEDICION_LIBRO_FULL[ch.id] ?? ch.summary, '\n');
  }
  return parts.join('');
}

export function getFullLibroHtml(): string {
  const md = getFullLibroMarkdown();
  const body = md
    .split('\n')
    .map((line) => {
      if (line.startsWith('# ')) return `<h1>${escape(line.slice(2))}</h1>`;
      if (line.startsWith('## ')) return `<h2>${escape(line.slice(3))}</h2>`;
      if (!line.trim()) return '';
      return `<p>${escape(line)}</p>`;
    })
    .join('\n');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Libro La Expedición</title>
<style>body{font-family:Georgia,serif;max-width:720px;margin:2rem auto;line-height:1.6;padding:0 1rem}</style></head><body>${body}
<button onclick="window.print()" style="margin-top:2rem;padding:.5rem 1rem">Imprimir / PDF</button></body></html>`;
}

function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
