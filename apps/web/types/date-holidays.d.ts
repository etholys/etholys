declare module 'date-holidays' {
  export default class Holidays {
    constructor(country?: string, state?: string, region?: string);
    setLanguages(language: string): void;
    getHolidays(year: number): { date: string; name: string; type: string }[];
  }
}
