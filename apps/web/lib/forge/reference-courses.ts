/**
 * Cursos de referência para desenvolvimento e testes visuais.
 * @see docs/architecture/forge-ui-vision.md
 */
export const REFERENCE_FORGE_COURSES = {
  expedicionSostenible: {
    title: 'La Expedición Sostenible',
    seedModule: '@/lib/forge/seed-expedicion-sostenible',
    seedApi: '/api/forge/seed-expedicion',
    mode: 'hybrid' as const,
    stations: ['Raíces', 'Tierra', 'Alquimia', 'Mercado', 'Futuro'],
    gameEngine: 'board',
    locale: 'es',
  },
} as const;
