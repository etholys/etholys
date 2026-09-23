import { markdownLiteToHtml } from '@/lib/studio/markdown-lite';

/** Gera um .doc compatível com Word a partir de HTML (sem dependência extra). */
export function buildCandidateWordHtml(opts: {
  title: string;
  institution: string;
  bodyMarkdownish: string;
  meta?: Record<string, string | undefined>;
}): Blob {
  const escape = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const metaRows = Object.entries(opts.meta ?? {})
    .filter(([, v]) => v)
    .map(([k, v]) => `<tr><td><b>${escape(k)}</b></td><td>${escape(v!)}</td></tr>`)
    .join('');

  const bodyHtml = markdownLiteToHtml(opts.bodyMarkdownish);

  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:w="urn:schemas-microsoft-com:office:word"
 xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${escape(opts.title)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
<style>
body{font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#111}
h1{font-size:18pt;color:#1a1a1a}
h2{font-size:13pt;margin-top:18px}
table{border-collapse:collapse;margin:12px 0}
td{border:1px solid #ccc;padding:6px 10px;vertical-align:top}
.muted{color:#555;font-size:10pt}
</style></head>
<body>
<h1>${escape(opts.title)}</h1>
<p class="muted">${escape(opts.institution)} — resumo FundHub / Etholys</p>
<table>${metaRows}</table>
<h2>Análise</h2>
<div>${bodyHtml}</div>
</body></html>`;

  return new Blob(['\ufeff', html], {
    type: 'application/msword',
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
