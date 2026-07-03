import { isInstructionParagraph } from '@/lib/siep/report-template-parse';

export function escapeDocxXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function splitDocxBlocks(xml: string, tag: 'p' | 'tc' | 'tr' | 'tbl'): string[] {
  const openRe = new RegExp(`<w:${tag}(?:\\s[^>]*)?>`, 'g');
  const close = `</w:${tag}>`;
  const blocks: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = openRe.exec(xml)) !== null) {
    const start = match.index;
    const end = xml.indexOf(close, start);
    if (end < 0) break;
    blocks.push(xml.slice(start, end + close.length));
    openRe.lastIndex = end + close.length;
  }
  return blocks;
}

function extractWtTextFromBlock(xml: string): string {
  const parts: string[] = [];
  const re = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) parts.push(m[1]);
  return parts.join('');
}

function extractRunProps(xml: string): string {
  const runMatch = xml.match(/<w:r\b[^>]*>[\s\S]*?<\/w:r>/);
  if (!runMatch) return '';
  const rPr = runMatch[0].match(/<w:rPr[^>]*(?:\/>|>[\s\S]*?<\/w:rPr>)/);
  return rPr ? rPr[0] : '';
}

function extractParagraphProps(pXml: string): string {
  const pPr = pXml.match(/<w:pPr[^>]*>[\s\S]*?<\/w:pPr>/);
  return pPr ? pPr[0] : '';
}

function paragraphOpenTag(pXml: string): string {
  return pXml.match(/^<w:p[^>]*>/)?.[0] ?? '<w:p>';
}

function buildRunsForParagraph(text: string, rPr: string): string {
  const lines = text.split(/\n/);
  let out = '';
  for (let i = 0; i < lines.length; i += 1) {
    if (i > 0) {
      out += `<w:r>${rPr}<w:br/></w:r>`;
    }
    out += `<w:r>${rPr}<w:t xml:space="preserve">${escapeDocxXml(lines[i] ?? '')}</w:t></w:r>`;
  }
  if (!out) out = `<w:r>${rPr}<w:t></w:t></w:r>`;
  return out;
}

function buildParagraphXml(text: string, templatePara: string, cellXml: string): string {
  const rPr = extractRunProps(templatePara) || extractRunProps(cellXml);
  const pPr = extractParagraphProps(templatePara);
  const pOpen = paragraphOpenTag(templatePara);
  return `${pOpen}${pPr}${buildRunsForParagraph(text, rPr)}</w:p>`;
}

function findTargetParagraphIndex(paras: string[]): number {
  for (let i = paras.length - 1; i >= 0; i -= 1) {
    const text = extractWtTextFromBlock(paras[i]!).trim();
    if (!text) return i;
  }
  for (let i = paras.length - 1; i >= 0; i -= 1) {
    const text = extractWtTextFromBlock(paras[i]!).trim();
    if (text && !isInstructionParagraph(text)) return i;
  }
  return Math.max(0, paras.length - 1);
}

function isRemovableDataParagraph(pXml: string): boolean {
  const text = extractWtTextFromBlock(pXml).trim();
  if (!text) return true;
  if (isInstructionParagraph(text)) return false;
  return true;
}

/** Substitui texto numa célula preservando estilos do modelo e quebras de linha. */
export function replaceDocxCellText(cellXml: string, newText: string): string {
  const paras = splitDocxBlocks(cellXml, 'p');

  if (!paras.length) {
    const closeTag = cellXml.trimEnd().endsWith('</w:tc>') ? 'tc' : 'p';
    const rPr = extractRunProps(cellXml);
    const runs = buildRunsForParagraph(newText, rPr);
    return cellXml.replace(
      new RegExp(`</w:${closeTag}>$`),
      `<w:p>${runs}</w:p></w:${closeTag}>`,
    );
  }

  if (!newText.trim()) {
    let result = cellXml;
    const targetIdx = findTargetParagraphIndex(paras);
    for (let i = targetIdx; i < paras.length; i += 1) {
      if (!isRemovableDataParagraph(paras[i]!)) continue;
      const cleared = buildParagraphXml('', paras[i]!, cellXml);
      result = result.replace(paras[i]!, cleared);
    }
    return result;
  }

  const targetIdx = findTargetParagraphIndex(paras);
  const textParts = newText.split(/\n\n+/);
  let result = cellXml;

  const firstPara = buildParagraphXml(textParts[0] ?? '', paras[targetIdx]!, cellXml);
  result = result.replace(paras[targetIdx]!, firstPara);

  let anchor = firstPara;
  for (let i = 1; i < textParts.length; i += 1) {
    const extra = buildParagraphXml(textParts[i] ?? '', paras[targetIdx]!, cellXml);
    result = result.replace(anchor, `${anchor}${extra}`);
    anchor = `${anchor}${extra}`;
  }

  for (let i = targetIdx + 1; i < paras.length; i += 1) {
    if (!isRemovableDataParagraph(paras[i]!)) continue;
    result = result.replace(paras[i]!, '');
  }

  return result;
}

/** Substitui texto num parágrafo do corpo preservando estilos do modelo. */
export function replaceDocxParagraphText(pXml: string, newText: string): string {
  if (!/<w:t/.test(pXml)) {
    const rPr = extractRunProps(pXml);
    const pPr = extractParagraphProps(pXml);
    const pOpen = paragraphOpenTag(pXml);
    return `${pOpen}${pPr}${buildRunsForParagraph(newText, rPr)}</w:p>`;
  }

  const textParts = newText.split(/\n\n+/);
  const first = buildParagraphXml(textParts[0] ?? '', pXml, pXml);
  if (textParts.length <= 1) return first;

  let result = first;
  let anchor = first;
  for (let i = 1; i < textParts.length; i += 1) {
    const extra = buildParagraphXml(textParts[i] ?? '', pXml, pXml);
    result = `${result}${extra}`;
    anchor = `${anchor}${extra}`;
  }
  return result;
}
