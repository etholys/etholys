/** Tipo curto no card / filtro — nunca prosa inventada. */

const SHORT_TYPES = ['Grant', 'Crédito', 'Aliança', 'Técnico'] as const;
export type ShortInstrumentType = (typeof SHORT_TYPES)[number];

function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function normalizeInstrumentType(raw: string | null | undefined): ShortInstrumentType {
  const s = fold(raw || '').trim();
  if (!s) return 'Grant';
  if (SHORT_TYPES.includes(raw?.trim() as ShortInstrumentType)) {
    return raw!.trim() as ShortInstrumentType;
  }

  if (/^(credit|credito|emprest|loan|financiamento\s*\(empr)/.test(s)) return 'Crédito';
  if (/^(alian|alliance|parceria estrat|coaliz)/.test(s)) return 'Aliança';
  if (/^(tecnic|technical|suporte tecnic|assistencia tecnic)/.test(s)) return 'Técnico';

  if (/\bgrant\b|subvenc|donativo|nao.?reembols|nao reembols/.test(s)) return 'Grant';
  if (/\b(credit|credito|emprest|loan|divida)\b/.test(s)) return 'Crédito';
  if (/\b(alianca|alliance|coalizao|partnership)\b/.test(s)) return 'Aliança';
  if (/\b(tecnic|technical assistance|assistencia tecnica|capacidade)\b/.test(s)) return 'Técnico';
  return 'Grant';
}
