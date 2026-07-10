/** Paleta visual V2 — material físico La Expedición Sostenible (Rural Commerce) */

import type { ExpedicionStationSlug } from '@/lib/forge/expedicion-station-decks';
import type { PostItType } from '@/lib/forge/expedicion-v2/types';

/** Cores oficiais do tabuleiro e mazos (verso das cartas / legenda) */
export const EXPEDICION_PALETTE = {
  brand: '#145A45',
  brandDark: '#0D4535',
  cream: '#F5F2EA',
  creamDark: '#E8E4D8',
  gold: '#C9A227',
  raices: '#145A45',
  tierra: '#1A3D5C',
  futuro: '#5FAE4A',
  mercado: '#6EC4E8',
  alquimia: '#2E5C9A',
  accion: '#A8D5C4',
  desafio: '#3D8B8B',
} as const;

export const EXPEDICION_V2_STATIONS: Record<
  ExpedicionStationSlug,
  { label: string; header: string; column: string; accent: string; ring: string }
> = {
  raices: {
    label: 'Raíces',
    header: 'bg-[#145A45] text-white',
    column: 'bg-[#E8F5F0] border-[#145A45]/30',
    accent: EXPEDICION_PALETTE.raices,
    ring: 'ring-[#145A45]/40',
  },
  tierra: {
    label: 'Tierra',
    header: 'bg-[#1A3D5C] text-white',
    column: 'bg-[#E8EEF5] border-[#1A3D5C]/30',
    accent: EXPEDICION_PALETTE.tierra,
    ring: 'ring-[#1A3D5C]/40',
  },
  alquimia: {
    label: 'Alquimia',
    header: 'bg-[#2E5C9A] text-white',
    column: 'bg-[#E8F0FA] border-[#2E5C9A]/30',
    accent: EXPEDICION_PALETTE.alquimia,
    ring: 'ring-[#2E5C9A]/40',
  },
  mercado: {
    label: 'Mercado',
    header: 'bg-[#6EC4E8] text-[#1A3D5C]',
    column: 'bg-[#EBF7FC] border-[#6EC4E8]/50',
    accent: EXPEDICION_PALETTE.mercado,
    ring: 'ring-[#6EC4E8]/60',
  },
  futuro: {
    label: 'Futuro',
    header: 'bg-[#5FAE4A] text-white',
    column: 'bg-[#EDF8EB] border-[#5FAE4A]/40',
    accent: EXPEDICION_PALETTE.futuro,
    ring: 'ring-[#5FAE4A]/40',
  },
};

export const POST_IT_TYPE_STYLES: Record<
  PostItType,
  { label: string; bg: string; border: string; text: string }
> = {
  diagnostico: {
    label: 'Diagnóstico',
    bg: 'bg-[#FFF9C4]',
    border: 'border-[#C9A227]',
    text: 'text-[#5D4037]',
  },
  accion: {
    label: 'Acción',
    bg: 'bg-[#D4EDE4]',
    border: 'border-[#3D8B8B]',
    text: 'text-[#1A3D5C]',
  },
  inversion: {
    label: 'Inversión',
    bg: 'bg-[#E8F0FA]',
    border: 'border-[#2E5C9A]',
    text: 'text-[#1A3D5C]',
  },
  metrica: {
    label: 'Métrica',
    bg: 'bg-[#EDF8EB]',
    border: 'border-[#5FAE4A]',
    text: 'text-[#145A45]',
  },
};

/** Tabuleiro V2 — casas especiais (legenda do jogo físico) */
export const BOARD_V2_CELL = {
  accion: { name: 'Acción', color: 'bg-[#A8D5C4]', ring: 'ring-[#3D8B8B]', text: 'text-[#1A3D5C]' },
  desafio: { name: 'Desafío', color: 'bg-[#3D8B8B]', ring: 'ring-[#2D7070]', text: 'text-white' },
  salida: { name: 'Salida', color: 'bg-[#145A45]', ring: 'ring-[#0D4535]', text: 'text-white' },
  meta: { name: 'Meta', color: 'bg-[#145A45]', ring: 'ring-[#5FAE4A]', text: 'text-white' },
} as const;

/** Fundo geral da sala — papel / guia participante */
export const EXPEDICION_V2_SHELL =
  'min-h-screen bg-gradient-to-br from-[#F5F2EA] via-[#F0EDE4] to-[#E8E4D8]';

/** Consola da sessão (hall) — verde caixa do jogo */
export const EXPEDICION_HALL_PANEL =
  'rounded-2xl border-2 border-[#0D4535]/40 bg-[#145A45] shadow-lg shadow-[#145A45]/25 text-white';

/** Barras do facilitador sobre fundo claro */
export const EXPEDICION_FAC_TOOLBAR =
  'rounded-xl border border-[#145A45]/20 bg-white/95 shadow-sm text-[#145A45]';
