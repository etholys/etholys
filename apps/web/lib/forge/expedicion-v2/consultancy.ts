import type { ConsultancyOptionId } from '@/lib/forge/expedicion-v2/types';

export type ConsultancyOption = {
  id: ConsultancyOptionId;
  label: string;
  description: string;
  cost: number;
  payee: string;
};

/** Tabla de costos de consultoría — PDF Tablas financieras */
export const CONSULTANCY_OPTIONS: ConsultancyOption[] = [
  {
    id: 'ia_capsula',
    label: 'Consultar Cápsula Técnica / IA',
    description: 'Lee la cápsula del módulo y aplica la pista a tu mapa.',
    cost: 50,
    payee: 'Banco',
  },
  {
    id: 'companero',
    label: 'Ayuda de un Colega',
    description: 'Un compañero de mesa te orienta (pago al jugador que ayuda).',
    cost: 100,
    payee: 'Compañero',
  },
  {
    id: 'grupo',
    label: 'Ayuda del Grupo',
    description: 'La mesa completa debate tu micro-caso.',
    cost: 150,
    payee: 'Banco',
  },
  {
    id: 'facilitador',
    label: 'Resolución del Facilitador',
    description: 'El facilitador revela la rúbrica y guía la respuesta.',
    cost: 250,
    payee: 'Banco',
  },
];

export const INVESTMENT_TIERS = [
  { id: 'baja', label: 'Inversión Baja', cost: 100, examples: 'Capacitación, señalética, procesos simples' },
  { id: 'media', label: 'Inversión Media', cost: 300, examples: 'Equipos usados, software, consultoría' },
  { id: 'alta', label: 'Inversión Alta', cost: 600, examples: 'Maquinaria nueva, certificación, rediseño' },
] as const;
