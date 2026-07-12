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
  tierra: '#1C1C1C',
  futuro: '#5FAE4A',
  mercado: '#6EC4E8',
  alquimia: '#2E5C9A',
  accion: '#A8D5C4',
  desafio: '#3D8B8B',
} as const;

type StationTheme = {
  label: string;
  /** @deprecated use headerStyle — Tailwind arbitrary bg in lib/ is not scanned */
  header: string;
  headerStyle: { backgroundColor: string; color: string };
  column: string;
  accent: string;
  ring: string;
};

export const EXPEDICION_V2_STATIONS: Record<ExpedicionStationSlug, StationTheme> = {
  raices: {
    label: 'Raíces',
    header: 'text-white',
    headerStyle: { backgroundColor: '#145A45', color: '#FFFFFF' },
    column: 'bg-[#E8F5F0] border-[#145A45]/30',
    accent: EXPEDICION_PALETTE.raices,
    ring: 'ring-[#145A45]/40',
  },
  tierra: {
    label: 'Tierra',
    header: 'text-white',
    headerStyle: { backgroundColor: '#1C1C1C', color: '#FFFFFF' },
    column: 'bg-[#F0F0F0] border-[#1C1C1C]/30',
    accent: EXPEDICION_PALETTE.tierra,
    ring: 'ring-[#1C1C1C]/40',
  },
  alquimia: {
    label: 'Alquimia',
    header: 'text-white',
    headerStyle: { backgroundColor: '#2E5C9A', color: '#FFFFFF' },
    column: 'bg-[#E8F0FA] border-[#2E5C9A]/30',
    accent: EXPEDICION_PALETTE.alquimia,
    ring: 'ring-[#2E5C9A]/40',
  },
  mercado: {
    label: 'Mercado',
    header: 'text-[#1A3D5C]',
    headerStyle: { backgroundColor: '#6EC4E8', color: '#1A3D5C' },
    column: 'bg-[#EBF7FC] border-[#6EC4E8]/50',
    accent: EXPEDICION_PALETTE.mercado,
    ring: 'ring-[#6EC4E8]/60',
  },
  futuro: {
    label: 'Futuro',
    header: 'text-white',
    headerStyle: { backgroundColor: '#5FAE4A', color: '#FFFFFF' },
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
  accion: { name: 'Acción', color: 'bg-[#8BC4B0]', ring: 'ring-[#3D8B8B]', text: 'text-[#0D4535]' },
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

/** Botões hub / turmas */
export const EXPEDICION_BTN_PRIMARY =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-[#145A45] px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#0D4535] transition disabled:opacity-50';

export const EXPEDICION_BTN_SECONDARY =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-[#145A45]/25 bg-white px-4 py-2.5 text-sm font-semibold text-[#145A45] hover:bg-[#F5F2EA] transition';

export const EXPEDICION_BTN_GOLD =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-[#C9A227] px-4 py-2.5 text-sm font-bold text-[#0D4535] shadow-sm hover:bg-[#B8921F] transition';

/** Cartões hub */
export const EXPEDICION_CARD =
  'rounded-2xl border border-[#145A45]/15 bg-white shadow-sm';

export const EXPEDICION_SECTION =
  'rounded-2xl border border-[#145A45]/12 bg-[#FAFAF7] p-4 md:p-5';

/** Texto legível em casillas claras del tablero */
export function boardCellTextClass(stationName: string): string {
  return boardCellVisual(stationName).textClass;
}

/** Bordas visíveis em casillas claras (evita “desaparecer” no fundo creme) */
export function boardCellBorderClass(stationName: string): string {
  return boardCellVisual(stationName).borderClass;
}

/** Cores garantidas (inline) — evita Tailwind purgar arbitrary bg */
export function boardCellVisual(stationName: string): {
  bg: string;
  text: string;
  border: string;
  textClass: string;
  borderClass: string;
  light: boolean;
} {
  const map: Record<
    string,
    { bg: string; text: string; border: string; light: boolean }
  > = {
    Raíces: { bg: '#145A45', text: '#FFFFFF', border: '#0D4535', light: false },
    Acción: { bg: '#8BC4B0', text: '#0D4535', border: '#3D8B8B', light: true },
    Tierra: { bg: '#1C1C1C', text: '#FFFFFF', border: '#0D4535', light: false },
    Desafío: { bg: '#3D8B8B', text: '#FFFFFF', border: '#2D7070', light: false },
    Alquimia: { bg: '#2E5C9A', text: '#FFFFFF', border: '#1A3D5C', light: false },
    Mercado: { bg: '#6EC4E8', text: '#0D4535', border: '#2E5C9A', light: true },
    Futuro: { bg: '#5FAE4A', text: '#FFFFFF', border: '#145A45', light: false },
  };
  const v = map[stationName] ?? map['Raíces'];
  return {
    ...v,
    textClass: v.light ? 'text-[#0D4535]' : 'text-white',
    borderClass: v.light ? 'border-2' : 'border border-black/15',
  };
}
