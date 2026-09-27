export function titleFromHtml(html: string): string {
  const pick = (re: RegExp) => {
    const m = html.match(re);
    return m?.[1] ? m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '';
  };
  const og =
    pick(/property=["']og:title["'][^>]*content=["']([^"']+)/i) ||
    pick(/content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
  const h1 = pick(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  const title = pick(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const raw = og || h1 || title;
  return raw.replace(/\s*[|\-–—].{0,40}$/, '').slice(0, 180);
}

export function siteNameFromHtml(html: string, pageUrl: string): string {
  const og = html.match(/property=["']og:site_name["'][^>]*content=["']([^"']+)/i)?.[1];
  if (og?.trim()) return og.trim().slice(0, 120);
  try {
    return new URL(pageUrl).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function htmlToExcerpt(html: string, max = 8_000): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/** Cloudflare / WAF interstitial — HTTP 200 but not the call page. */
export function isBotWallHtml(html: string | null | undefined): boolean {
  if (!html) return false;
  const h = html.slice(0, 12_000);
  return /checking your browser|just a moment\.\.\.|cf-browser-verification|challenge-platform|cdn-cgi\/challenge|enable javascript and cookies to continue|verifying you are human|attention required.*cloudflare|cf-chl-bypass|managed_checking_loader/i.test(
    h,
  );
}

export function isThinOfficialHtml(html: string | null | undefined, excerpt = ''): boolean {
  if (!html) return true;
  if (isBotWallHtml(html)) return true;
  if (excerpt.length < 500) return true;
  if (/<div id="(?:root|app|__next)"/i.test(html) && excerpt.length < 1200) return true;
  return false;
}

export function htmlMentionsAnnexes(text: string | null | undefined): boolean {
  if (!text) return false;
  return /annex(?:e|es)?\s*[1-9]|anexo(?:s)?\s*[1-9]|concept\s*note|nota\s+conceptual|guidelines for applicants|self-?certif|activity-?based\s+budget|proposal submission requirements/i.test(
    text,
  );
}

export function alternateLocaleCallUrls(url: string): string[] {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/^\/(en|es|fr|ar|it)(\/.*)?$/i);
    if (!m) return [];
    const current = m[1].toLowerCase();
    const rest = m[2] || '/';
    return ['en', 'es', 'fr']
      .filter((lang) => lang !== current)
      .map((lang) => {
        const next = new URL(url);
        next.pathname = `/${lang}${rest}`;
        return next.toString();
      });
  } catch {
    return [];
  }
}
