import type { StudioCanvasState, StudioBlock } from '@/lib/studio/types';
import { markdownLiteToHtml } from '@/lib/studio/markdown-lite';
import { parseStudioDrawScene } from '@/lib/studio/draw-scene';
import { studioBlockStyleToInlineCss } from '@/lib/studio/block-style';

export type StudioBrandKit = {
  primaryColor: string;
  secondaryColor?: string;
  logoUrl?: string | null;
  orgName?: string | null;
  footerText?: string | null;
  fontFamily?: string | null;
};

export const DEFAULT_STUDIO_BRAND: StudioBrandKit = {
  primaryColor: '#ea580c',
  secondaryColor: '#78350f',
  footerText: 'Etholys Studio',
  fontFamily: "'Segoe UI', Helvetica, Arial, sans-serif",
};

function esc(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Remove marcadores markdown simples para texto plano (DOCX). */
function stripMdMarkers(s: string): string {
  return String(s || '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,3}\s+/, '');
}

function inlineMdHtml(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/_([^_]+)_/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

function blockHtml(block: StudioBlock): string {
  const text = block.text || '';
  const wrapStyle = studioBlockStyleToInlineCss(block.style);
  const wrap = (inner: string) =>
    wrapStyle ? `<div style="${wrapStyle}">${inner}</div>` : inner;

  switch (block.kind) {
    case 'heading':
      return wrap(`<h2>${inlineMdHtml(text.replace(/^#+\s*/, '')) || '&nbsp;'}</h2>`);
    case 'bullets': {
      const items = text
        .split(/\r?\n/)
        .map((l) => l.replace(/^[-*•]\s*/, '').trim())
        .filter(Boolean);
      if (!items.length) return wrap(`<p class="muted">—</p>`);
      return wrap(`<ul>${items.map((i) => `<li>${inlineMdHtml(i)}</li>`).join('')}</ul>`);
    }
    case 'callout':
      return wrap(`<div class="callout">${markdownLiteToHtml(text)}</div>`);
    case 'image':
      return wrap(
        block.imageUrl
          ? `<figure class="studio-image"><img src="${esc(block.imageUrl)}" alt="${esc(block.text || '')}" /></figure>`
          : `<p class="muted">${esc(block.text || '—')}</p>`,
      );
    case 'diagram': {
      const draw = parseStudioDrawScene(text);
      if (draw?.svgPreview) {
        return wrap(`<div class="diagram-visual">${draw.svgPreview}</div>`);
      }
      return wrap(`<pre class="diagram">${esc(text)}</pre>`);
    }
    case 'table':
      return wrap(`<pre class="table-raw">${esc(text)}</pre>`);
    default:
      return wrap(markdownLiteToHtml(text));
  }
}

export function studioCanvasToHtml(
  title: string,
  canvas: StudioCanvasState,
  brand: StudioBrandKit = DEFAULT_STUDIO_BRAND,
): string {
  const color = brand.primaryColor || DEFAULT_STUDIO_BRAND.primaryColor;
  const font = brand.fontFamily || DEFAULT_STUDIO_BRAND.fontFamily;
  const org = brand.orgName || '';
  const logo = brand.logoUrl
    ? `<img class="logo" src="${esc(brand.logoUrl)}" alt="" />`
    : '';
  const pages = canvas.pages
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((page) => {
      const blocks = page.blocks
        .slice()
        .sort((a, b) => a.order - b.order)
        .map(blockHtml)
        .join('\n');
      return `<section class="page"><div class="page-label">${esc(page.title)}</div>${blocks}</section>`;
    })
    .join('\n');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  body { font-family: ${font}; margin: 0; padding: 0; color: #1e293b; font-size: 12.5px; line-height: 1.55; }
  .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid ${color}; padding-bottom: 12px; margin-bottom: 28px; }
  .logo { max-height: 48px; max-width: 160px; object-fit: contain; }
  .org { font-size: 11px; color: #64748b; text-align: right; }
  h1 { color: ${color}; font-size: 22px; margin: 0 0 4px; }
  h2 { color: #0f172a; font-size: 16px; margin: 18px 0 8px; }
  .block-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; margin-bottom: 4px; }
  .page { margin-bottom: 32px; page-break-after: always; }
  .page:last-child { page-break-after: auto; }
  .page-label { font-size: 9px; color: #cbd5e1; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.12em; }
  ul { margin: 8px 0 8px 18px; padding: 0; }
  li { margin: 4px 0; }
  .callout { background: #fff7ed; border-left: 4px solid ${color}; padding: 12px 14px; margin: 10px 0; border-radius: 0 8px 8px 0; }
  .diagram, .table-raw { background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; font-size: 10px; white-space: pre-wrap; overflow-wrap: break-word; }
  .diagram-visual { margin: 12px 0; text-align: center; }
  .diagram-visual svg { max-width: 100%; height: auto; }
  .studio-image { margin: 14px 0; text-align: center; }
  .studio-image img { max-width: 100%; height: auto; border-radius: 6px; }
  .muted { color: #94a3b8; }
  .footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 9px; color: #94a3b8; text-align: center; }
</style></head><body>
  <div class="header">
    <div>
      <h1>${esc(title)}</h1>
      ${org ? `<div class="org">${esc(org)}</div>` : ''}
    </div>
    ${logo}
  </div>
  ${pages}
  <div class="footer">${esc(brand.footerText || 'Etholys Studio')} · ${new Date().toLocaleDateString('pt-BR')}</div>
</body></html>`;
}

/** OOXML mínimo (DOCX) via JSZip — sem dependência `docx`. */
export async function studioCanvasToDocxBuffer(
  title: string,
  canvas: StudioCanvasState,
  brand: StudioBrandKit = DEFAULT_STUDIO_BRAND,
): Promise<Buffer> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  const colorHex = (brand.primaryColor || '#ea580c').replace('#', '').toUpperCase();

  const paras: string[] = [];
  paras.push(wParagraph(wRun(title, { bold: true, size: 36, color: colorHex })));
  if (brand.orgName) {
    paras.push(wParagraph(wRun(brand.orgName, { size: 20, color: '64748B' })));
  }
  paras.push(wParagraph(wRun('')));

  for (const page of canvas.pages.slice().sort((a, b) => a.order - b.order)) {
    paras.push(wParagraph(wRun(page.title, { bold: true, size: 18, color: '94A3B8' })));
    for (const block of page.blocks.slice().sort((a, b) => a.order - b.order)) {
      if (block.kind === 'heading') {
        paras.push(wParagraph(wRun(stripMdMarkers(block.text) || ' ', { bold: true, size: 28 })));
      } else if (block.kind === 'bullets') {
        const items = (block.text || '')
          .split(/\r?\n/)
          .map((l) => l.replace(/^[-*•]\s*/, '').trim())
          .filter(Boolean);
        for (const item of items) {
          paras.push(wParagraph(wRun(`• ${stripMdMarkers(item)}`, { size: 22 })));
        }
      } else if (block.kind === 'diagram') {
        const draw = parseStudioDrawScene(block.text || '');
        if (draw?.svgPreview) {
          paras.push(wParagraph(wRun('[Diagrama visual]', { size: 18, color: '94A3B8' })));
        } else {
          paras.push(wParagraph(wRun('[Diagrama]', { size: 18, color: '94A3B8' })));
          for (const line of (block.text || '').split(/\r?\n/).slice(0, 40)) {
            paras.push(wParagraph(wRun(line || ' ', { size: 18 })));
          }
        }
      } else {
        for (const line of (block.text || ' ').split(/\r?\n/)) {
          paras.push(wParagraph(wRun(stripMdMarkers(line) || ' ', { size: 22 })));
        }
      }
    }
  }

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paras.join('\n')}
    <w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>
  </w:body>
</w:document>`;

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
  );
  zip.folder('_rels')?.file(
    '.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  );
  zip.folder('word')?.file('document.xml', documentXml);
  zip.folder('word')?.folder('_rels')?.file(
    'document.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`,
  );

  const buf = await zip.generateAsync({ type: 'nodebuffer' });
  return Buffer.from(buf);
}

function wRun(
  text: string,
  opts?: { bold?: boolean; size?: number; color?: string },
): string {
  const rPr: string[] = [];
  if (opts?.bold) rPr.push('<w:b/>');
  if (opts?.size) rPr.push(`<w:sz w:val="${opts.size}"/><w:szCs w:val="${opts.size}"/>`);
  if (opts?.color) rPr.push(`<w:color w:val="${opts.color}"/>`);
  const pr = rPr.length ? `<w:rPr>${rPr.join('')}</w:rPr>` : '';
  return `<w:r>${pr}<w:t xml:space="preserve">${escXml(text)}</w:t></w:r>`;
}

function wParagraph(inner: string): string {
  return `<w:p>${inner}</w:p>`;
}

function escXml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function htmlToPdfViaAbacus(
  html: string,
  opts?: {
    format?: string;
    landscape?: boolean;
    margin?: { top: string; right: string; bottom: string; left: string };
  },
): Promise<Buffer> {
  const key = process.env.ABACUSAI_API_KEY?.trim();
  if (!key) {
    throw new Error('Falta ABACUSAI_API_KEY para export PDF');
  }
  const createRes = await fetch('https://apps.abacus.ai/api/createConvertHtmlToPdfRequest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deployment_token: key,
      html_content: html,
      pdf_options: {
        format: opts?.format || 'A4',
        landscape: !!opts?.landscape,
        print_background: true,
        margin: opts?.margin || { top: '25mm', right: '25mm', bottom: '25mm', left: '25mm' },
      },
      base_url: process.env.NEXTAUTH_URL || 'https://app.etholys.com',
    }),
  });
  if (!createRes.ok) {
    throw new Error(`Abacus PDF create failed (${createRes.status})`);
  }
  const created = (await createRes.json()) as { request_id?: string };
  if (!created.request_id) throw new Error('No request ID from Abacus');

  for (let attempts = 0; attempts < 120; attempts++) {
    await new Promise((r) => setTimeout(r, 1000));
    const statusRes = await fetch('https://apps.abacus.ai/api/getConvertHtmlToPdfStatus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request_id: created.request_id, deployment_token: key }),
    });
    const statusResult = (await statusRes.json()) as {
      status?: string;
      result?: { result?: string };
      error?: string;
    };
    if (statusResult?.status === 'SUCCESS' && statusResult?.result?.result) {
      return Buffer.from(statusResult.result.result, 'base64');
    }
    if (statusResult?.status === 'FAILED') {
      throw new Error(statusResult.error || 'PDF generation failed');
    }
  }
  throw new Error('Timeout a gerar PDF');
}
