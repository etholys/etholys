/** RADAR UI copy helper — always pass pt, es, en. */
export type RadarLoc = 'pt' | 'es' | 'en';

export function radarLoc(locale: string | null | undefined): RadarLoc {
  return locale === 'es' || locale === 'en' ? locale : 'pt';
}

export function radarT(loc: RadarLoc, pt: string, es: string, en: string): string {
  if (loc === 'es') return es;
  if (loc === 'en') return en;
  return pt;
}
