import type { ReactNode } from 'react';

/** http(s) URLs; stops before common trailing punctuation. */
const URL_RE = /https?:\/\/[^\s<>"'`]+/gi;

function trimUrl(raw: string): string {
  return raw.replace(/[).,;:!?\]]+$/g, '');
}

export function firstHttpUrl(text: string | null | undefined): string | null {
  if (!text) return null;
  const m = String(text).match(URL_RE);
  if (!m?.[0]) return null;
  return trimUrl(m[0]);
}

export function isBareHttpUrl(text: string | null | undefined): boolean {
  const s = String(text || '').trim();
  if (!s) return false;
  const url = firstHttpUrl(s);
  return !!url && url === s;
}

/** Short label for a URL title (hostname + short path). */
export function shortUrlLabel(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    const path = u.pathname.length > 1 ? u.pathname.replace(/\/$/, '') : '';
    const shortPath = path.length > 28 ? `${path.slice(0, 26)}…` : path;
    return shortPath ? `${host}${shortPath}` : host;
  } catch {
    return url.length > 48 ? `${url.slice(0, 46)}…` : url;
  }
}

/**
 * Split plain text into text / @mention / URL parts for safe React rendering.
 * Mentions keep existing @name highlighting; URLs become external links.
 */
export function renderLinkedText(
  content: string,
  opts?: {
    mentionClassName?: string;
    linkClassName?: string;
  },
): ReactNode[] {
  const mentionClass =
    opts?.mentionClassName || 'rounded bg-cyan-500/20 px-1 font-medium text-cyan-200';
  const linkClass =
    opts?.linkClassName ||
    'break-all font-medium text-teal-600 underline decoration-teal-500/40 underline-offset-2 hover:text-teal-500 dark:text-teal-300';

  const parts = String(content || '').split(/(@[^\s@][^@]*?)(?=\s|$|@)/g);
  const out: ReactNode[] = [];

  parts.forEach((part, i) => {
    if (!part) return;
    if (part.startsWith('@')) {
      out.push(
        <span key={`m-${i}`} className={mentionClass}>
          {part}
        </span>,
      );
      return;
    }

    let last = 0;
    const re = new RegExp(URL_RE.source, 'gi');
    let m: RegExpExecArray | null;
    while ((m = re.exec(part)) !== null) {
      const raw = m[0];
      const url = trimUrl(raw);
      const start = m.index;
      if (start > last) {
        out.push(<span key={`t-${i}-${last}`}>{part.slice(last, start)}</span>);
      }
      out.push(
        <a
          key={`u-${i}-${start}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
          onClick={(e) => e.stopPropagation()}
        >
          {url}
        </a>,
      );
      if (url.length < raw.length) {
        out.push(<span key={`tr-${i}-${start}`}>{raw.slice(url.length)}</span>);
      }
      last = start + raw.length;
    }
    if (last < part.length) {
      out.push(<span key={`t-${i}-end`}>{part.slice(last)}</span>);
    }
  });

  return out;
}
