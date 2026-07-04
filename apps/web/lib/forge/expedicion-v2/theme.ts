/** Paleta visual V2 — alinhada ao material impresso Rural Commerce */

import type { ExpedicionStationSlug } from '@/lib/forge/expedicion-station-decks';
import type { PostItType } from '@/lib/forge/expedicion-v2/types';

export const EXPEDICION_V2_STATIONS: Record<
  ExpedicionStationSlug,
  { label: string; header: string; column: string; accent: string; ring: string }
> = {
  raices: {
    label: 'Raíces',
    header: 'bg-[#1B5E4B] text-white',
    column: 'bg-[#E8F5F0] border-[#1B5E4B]/30',
    accent: '#1B5E4B',
    ring: 'ring-[#1B5E4B]/40',
  },
  tierra: {
    label: 'Tierra',
    header: 'bg-[#8B5A2B] text-white',
    column: 'bg-[#F5EDE3] border-[#8B5A2B]/30',
    accent: '#8B5A2B',
    ring: 'ring-[#8B5A2B]/40',
  },
  alquimia: {
    label: 'Alquimia',
    header: 'bg-[#C45C26] text-white',
    column: 'bg-[#FDF0E8] border-[#C45C26]/30',
    accent: '#C45C26',
    ring: 'ring-[#C45C26]/40',
  },
  mercado: {
    label: 'Mercado',
    header: 'bg-[#1E6B8C] text-white',
    column: 'bg-[#E8F4FA] border-[#1E6B8C]/30',
    accent: '#1E6B8C',
    ring: 'ring-[#1E6B8C]/40',
  },
  futuro: {
    label: 'Futuro',
    header: 'bg-[#5B3E8C] text-white',
    column: 'bg-[#F0EBF8] border-[#5B3E8C]/30',
    accent: '#5B3E8C',
    ring: 'ring-[#5B3E8C]/40',
  },
};

export const POST_IT_TYPE_STYLES: Record<
  PostItType,
  { label: string; bg: string; border: string; text: string }
> = {
  diagnostico: {
    label: 'Diagnóstico',
    bg: 'bg-[#FFF9C4]',
    border: 'border-[#F9A825]',
    text: 'text-[#5D4037]',
  },
  accion: {
    label: 'Acción',
    bg: 'bg-[#B3E5FC]',
    border: 'border-[#0288D1]',
    text: 'text-[#01579B]',
  },
  inversion: {
    label: 'Inversión',
    bg: 'bg-[#F8BBD0]',
    border: 'border-[#C2185B]',
    text: 'text-[#880E4F]',
  },
  metrica: {
    label: 'Métrica',
    bg: 'bg-[#C8E6C9]',
    border: 'border-[#388E3C]',
    text: 'text-[#1B5E20]',
  },
};

/** Tabuleiro V2 — casas especiais */
export const BOARD_V2_CELL = {
  accion: { name: 'Acción', color: 'bg-[#F4B942]', ring: 'ring-[#E5A82E]' },
  desafio: { name: 'Desafío', color: 'bg-[#C62828]', ring: 'ring-[#B71C1C]' },
  salida: { name: 'Salida', color: 'bg-slate-600', ring: 'ring-slate-400' },
  meta: { name: 'Meta', color: 'bg-[#1B5E4B]', ring: 'ring-[#2E7D5A]' },
} as const;

export const EXPEDICION_V2_SHELL =
  'min-h-screen bg-gradient-to-br from-[#F7F3EB] via-[#F0EDE4] to-[#E8E4D8]';
