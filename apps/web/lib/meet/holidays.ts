import Holidays from 'date-holidays';
import { normalizeHolidayCountries } from '@/lib/meet/holiday-countries';

export type HolidayDay = { ymd: string; label: string };

function holidayLanguage(language: string | undefined): string {
  if (language === 'pt' || language === 'es' || language === 'en') return language;
  return 'en';
}

/** Datas de feriado público (união) no calendário civil de cada país. */
export function collectHolidayDays(
  countries: string[],
  fromYear: number,
  toYear: number,
  language?: string,
): HolidayDay[] {
  const codes = normalizeHolidayCountries(countries);
  const lang = holidayLanguage(language);
  const byDate = new Map<string, string[]>();

  for (const code of codes) {
    let rows: { date: string; name: string; type: string }[] = [];
    try {
      const hd = new Holidays(code);
      hd.setLanguages(lang);
      for (let year = fromYear; year <= toYear; year += 1) {
        const batch = hd.getHolidays(year) || [];
        rows = rows.concat(batch);
      }
    } catch {
      continue;
    }
    for (const row of rows) {
      if (row.type !== 'public') continue;
      const ymd = String(row.date || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) continue;
      const names = byDate.get(ymd) || [];
      const name = (row.name || code).trim();
      if (name && !names.includes(name)) names.push(name);
      byDate.set(ymd, names);
    }
  }

  return [...byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([ymd, names]) => ({ ymd, label: names.slice(0, 3).join(' · ').slice(0, 180) }));
}
