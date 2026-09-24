import type { FieldEntryKind, SectorModule } from './types';

const GENERIC_ENTRIES: FieldEntryKind[] = ['observation', 'visit', 'note'];

export const GENERIC_MODULE: SectorModule = {
  moduleId: 'generic',
  sectorIds: [],
  unitKind: 'generic',
  unitLabel: { es: 'Operación', pt: 'Operação', en: 'Operation' },
  bookLabel: { es: 'Diario operativo', pt: 'Diário operativo', en: 'Operations diary' },
  monitorLabel: { es: 'Monitoreo', pt: 'Monitorização', en: 'Monitoring' },
  intro: {
    es: 'Diario operativo del sector — una unidad, un registro, un indicador.',
    pt: 'Diário operativo do setor — uma unidade, um registo, um indicador.',
    en: 'Sector operations diary — one unit, one log, one indicator.',
  },
  namePlaceholder: { es: 'Operación', pt: 'Operação', en: 'Operation' },
  cropLabel: { es: 'Línea', pt: 'Linha', en: 'Line' },
  entryKinds: GENERIC_ENTRIES,
  metrics: [
    { id: 'custom', label: { es: 'Indicador', pt: 'Indicador', en: 'Indicator' }, unit: 'u' },
  ],
  protocols: [
    {
      id: 'weekly_log',
      title: { es: 'Diario semanal', pt: 'Diário semanal', en: 'Weekly log' },
      summary: {
        es: 'Al menos una línea real por semana en el diario.',
        pt: 'Pelo menos uma linha real por semana no diário.',
        en: 'At least one real diary line each week.',
      },
      entryKinds: ['note', 'observation'],
      rules: [{ type: 'stale_book', days: 7 }],
    },
    {
      id: 'visit_followup',
      title: { es: 'Seguimiento de visita', pt: 'Acompanhamento de visita', en: 'Visit follow-up' },
      summary: {
        es: 'Si hay AT, no dejar más de 14 días sin registro.',
        pt: 'Se há AT, não deixar mais de 14 dias sem registo.',
        en: 'If TA is active, do not go 14 days without a record.',
      },
      entryKinds: ['visit'],
      rules: [{ type: 'stale_book', days: 14 }],
    },
    {
      id: 'quality_check',
      title: { es: 'Chequeo de calidad', pt: 'Checagem de qualidade', en: 'Quality check' },
      summary: {
        es: 'Observación breve de lo que se produce o entrega.',
        pt: 'Observação breve do que se produz ou entrega.',
        en: 'A short observation of what is produced or delivered.',
      },
      entryKinds: ['observation'],
      rules: [],
    },
  ],
  planSeeds: [
    {
      id: 'gen_register_unit',
      title: {
        es: 'Nombrar la operación que se va a seguir',
        pt: 'Nomear a operação que se vai acompanhar',
        en: 'Name the operation you will track',
      },
      description: {
        es: 'Crear una unidad operativa (taller, ruta, local) para el diario.',
        pt: 'Criar uma unidade operativa (oficina, rota, loja) para o diário.',
        en: 'Create an operations unit (workshop, route, shop) for the diary.',
      },
      pillar: 'operations',
      priority: 'high',
      kind: 'ops_unit',
      estimatedHours: 2,
      href: 'campo',
    },
    {
      id: 'gen_open_diary',
      title: {
        es: 'Abrir el diario de esta semana',
        pt: 'Abrir o diário desta semana',
        en: 'Open this week’s diary',
      },
      description: {
        es: 'Primera línea: qué se hizo, con quién, qué falta.',
        pt: 'Primeira linha: o que se fez, com quem, o que falta.',
        en: 'First line: what was done, with whom, what is missing.',
      },
      pillar: 'sector',
      priority: 'high',
      kind: 'field_book',
      estimatedHours: 2,
      href: 'campo',
      protocolId: 'weekly_log',
    },
  ],
};
