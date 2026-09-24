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
