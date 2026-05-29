export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { EXPEDICION_LIBRO_CHAPTERS } from '@/lib/forge/libro-reference';

/** Índice del libro en Markdown (descarga / referencia). */
export async function GET() {
  const lines = [
    '# Libro didáctico — La Expedición Sostenible',
    '',
    'Referencia para alumnos y facilitadores. Contenido alineado con los módulos FORGE.',
    '',
  ];

  for (const ch of EXPEDICION_LIBRO_CHAPTERS) {
    lines.push(`## ${ch.title}`, '', `*Estación: ${ch.moduleHint}*`, '', ch.summary, '', '---', '');
  }

  const md = lines.join('\n');
  return new NextResponse(md, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': 'attachment; filename="libro-expedicion-sostenible.md"',
    },
  });
}
