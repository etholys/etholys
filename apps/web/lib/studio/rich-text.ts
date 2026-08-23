/**
 * Ponte TipTap HTML ↔ markdown-lite do Studio (IA / export / legado).
 */

import { markdownLiteToHtml } from '@/lib/studio/markdown-lite';

export function studioTextLooksLikeHtml(text: string): boolean {
  const t = (text || '').trim();
  return /^<(p|h[1-6]|ul|ol|li|div|strong|em|u|br)\b/i.test(t);
}

/** Conteúdo inicial do TipTap a partir do `block.text` (md ou HTML). */
export function studioTextToEditorHtml(text: string, kind?: string): string {
  const raw = String(text || '').trim();
  if (!raw) {
    if (kind === 'heading') return '<h2></h2>';
    if (kind === 'bullets') return '<ul><li></li></ul>';
    return '<p></p>';
  }
  if (studioTextLooksLikeHtml(raw)) return raw;
  return markdownLiteToHtml(raw);
}

/** Serializa HTML do TipTap de volta a markdown-lite (compatível com copiloto/export). */
export function studioEditorHtmlToText(html: string): string {
  let h = String(html || '')
    .replace(/\u00a0/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n');

  h = h.replace(/<\/(p|h[1-6]|li|div)>/gi, '\n');
  h = h.replace(/<h[1-6][^>]*>/gi, (tag) => {
    const m = tag.match(/h([1-6])/i);
    const n = Math.min(3, Math.max(1, Number(m?.[1] || 2)));
    return `${'#'.repeat(n)} `;
  });
  h = h.replace(/<li[^>]*>/gi, '- ');
  h = h.replace(/<\/?(ul|ol|div|span|p)[^>]*>/gi, '');
  h = h.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**');
  h = h.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**');
  h = h.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*');
  h = h.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*');
  h = h.replace(/<u[^>]*>([\s\S]*?)<\/u>/gi, '<u>$1</u>');
  h = h.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');
  h = h.replace(/<[^>]+>/g, '');
  h = h
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
  return h
    .split(/\n/)
    .map((l) => l.replace(/[ \t]+$/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd();
}

/** Texto plano para IA / pesquisa. */
export function studioBlockPlainText(text: string): string {
  if (!text) return '';
  if (studioTextLooksLikeHtml(text)) return studioEditorHtmlToText(text);
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/<u>([\s\S]*?)<\/u>/gi, '$1')
    .replace(/^#+\s+/gm, '')
    .replace(/^[-*•]\s+/gm, '');
}
