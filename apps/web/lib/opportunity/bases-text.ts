const PER_DOC = 8_000;
const MAX_TOTAL = 20_000;

export function clipBasesText(text: string, max = MAX_TOTAL): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max).trim()}…`;
}

export function mergeBasesParts(parts: Array<{ title: string; text: string }>): string {
  const blocks = parts
    .map((p) => {
      const text = clipBasesText(p.text, PER_DOC);
      if (!text) return '';
      return `### ${p.title}\n${text}`;
    })
    .filter(Boolean);
  return clipBasesText(blocks.join('\n\n'), MAX_TOTAL);
}
