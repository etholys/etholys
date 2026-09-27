/** Chrome estável — Etholys-FundHub/1.0 é bloqueado por WAF. */
export const OFFICIAL_FETCH_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

export function officialFetchHeaders(url: string): Record<string, string> {
  let referer = 'https://www.google.com/';
  try {
    referer = new URL(url).origin + '/';
  } catch {
    /* keep google */
  }
  return {
    'User-Agent': OFFICIAL_FETCH_UA,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,application/pdf;q=0.8,image/avif,image/webp,*/*;q=0.7',
    'Accept-Language': 'en-US,en;q=0.9,pt-BR;q=0.8,es;q=0.7',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'sec-ch-ua': '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    Referer: referer,
  };
}
