/** Países cujo feriado público pode fechar a agenda CHORUS. */
export type HolidayCountry = {
  code: string;
  pt: string;
  es: string;
  en: string;
};

export const AGENDA_HOLIDAY_COUNTRIES: HolidayCountry[] = [
  { code: 'BR', pt: 'Brasil', es: 'Brasil', en: 'Brazil' },
  { code: 'NI', pt: 'Nicarágua', es: 'Nicaragua', en: 'Nicaragua' },
  { code: 'ES', pt: 'Espanha', es: 'España', en: 'Spain' },
  { code: 'PT', pt: 'Portugal', es: 'Portugal', en: 'Portugal' },
  { code: 'US', pt: 'Estados Unidos', es: 'Estados Unidos', en: 'United States' },
  { code: 'MX', pt: 'México', es: 'México', en: 'Mexico' },
  { code: 'AR', pt: 'Argentina', es: 'Argentina', en: 'Argentina' },
  { code: 'CO', pt: 'Colômbia', es: 'Colombia', en: 'Colombia' },
  { code: 'CL', pt: 'Chile', es: 'Chile', en: 'Chile' },
  { code: 'PE', pt: 'Peru', es: 'Perú', en: 'Peru' },
  { code: 'UY', pt: 'Uruguai', es: 'Uruguay', en: 'Uruguay' },
  { code: 'PY', pt: 'Paraguai', es: 'Paraguay', en: 'Paraguay' },
  { code: 'BO', pt: 'Bolívia', es: 'Bolivia', en: 'Bolivia' },
  { code: 'EC', pt: 'Equador', es: 'Ecuador', en: 'Ecuador' },
  { code: 'VE', pt: 'Venezuela', es: 'Venezuela', en: 'Venezuela' },
  { code: 'CR', pt: 'Costa Rica', es: 'Costa Rica', en: 'Costa Rica' },
  { code: 'PA', pt: 'Panamá', es: 'Panamá', en: 'Panama' },
  { code: 'GT', pt: 'Guatemala', es: 'Guatemala', en: 'Guatemala' },
  { code: 'HN', pt: 'Honduras', es: 'Honduras', en: 'Honduras' },
  { code: 'SV', pt: 'El Salvador', es: 'El Salvador', en: 'El Salvador' },
  { code: 'DO', pt: 'República Dominicana', es: 'República Dominicana', en: 'Dominican Republic' },
  { code: 'CU', pt: 'Cuba', es: 'Cuba', en: 'Cuba' },
  { code: 'PR', pt: 'Porto Rico', es: 'Puerto Rico', en: 'Puerto Rico' },
  { code: 'GY', pt: 'Guiana', es: 'Guyana', en: 'Guyana' },
  { code: 'SR', pt: 'Suriname', es: 'Surinam', en: 'Suriname' },
  { code: 'BZ', pt: 'Belize', es: 'Belice', en: 'Belize' },
  { code: 'HT', pt: 'Haiti', es: 'Haití', en: 'Haiti' },
  { code: 'JM', pt: 'Jamaica', es: 'Jamaica', en: 'Jamaica' },
  { code: 'TT', pt: 'Trinidad e Tobago', es: 'Trinidad y Tobago', en: 'Trinidad and Tobago' },
];

const ALLOWED = new Set(AGENDA_HOLIDAY_COUNTRIES.map((country) => country.code));

export function normalizeHolidayCountries(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    const code = String(item || '')
      .trim()
      .toUpperCase();
    if (!ALLOWED.has(code) || out.includes(code)) continue;
    out.push(code);
    if (out.length >= 30) break;
  }
  return out;
}
