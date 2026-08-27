/** Markdown pipe-table ↔ grid (camada Conteúdo / Excel). */

export type StudioTableGrid = {
  headers: string[];
  rows: string[][];
};

export function defaultTableMarkdown(cols = 4, rows = 4): string {
  const headers = Array.from({ length: cols }, (_, i) => `Col ${i + 1}`);
  const sep = headers.map(() => '---').join(' | ');
  const body = Array.from({ length: rows - 1 }, (_, r) =>
    headers.map((_, c) => (r === 0 && c === 0 ? '100' : '…')).join(' | '),
  );
  return `| ${headers.join(' | ')} |\n| ${sep} |\n${body.map((line) => `| ${line} |`).join('\n')}`;
}

export function parseMarkdownTable(text: string): StudioTableGrid | null {
  const lines = String(text || '')
    .trim()
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.includes('|'));
  if (lines.length < 2) return null;

  function splitRow(line: string): string[] {
    const inner = line.replace(/^\|/, '').replace(/\|$/, '').trim();
    return inner.split('|').map((c) => c.trim());
  }

  const headers = splitRow(lines[0]!);
  if (!headers.length) return null;
  let dataStart = 1;
  if (/^[\|\s\-:]+$/.test(lines[1] || '')) dataStart = 2;
  const rows: string[][] = [];
  for (let i = dataStart; i < lines.length; i++) {
    const cells = splitRow(lines[i]!);
    while (cells.length < headers.length) cells.push('');
    rows.push(cells.slice(0, headers.length));
  }
  return { headers, rows };
}

export function serializeMarkdownTable(grid: StudioTableGrid): string {
  const { headers, rows } = grid;
  if (!headers.length) return defaultTableMarkdown();
  const sep = headers.map(() => '---').join(' | ');
  const body = rows.map((r) => {
    const cells = headers.map((_, i) => (r[i] ?? '').replace(/\|/g, '\\|'));
    return `| ${cells.join(' | ')} |`;
  });
  return [`| ${headers.join(' | ')} |`, `| ${sep} |`, ...body].join('\n');
}

export function tableGridToHtml(text: string): string {
  const grid = parseMarkdownTable(text);
  if (!grid) return `<pre>${text}</pre>`;
  const th = grid.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('');
  const trs = grid.rows
    .map(
      (row) =>
        `<tr>${row.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`,
    )
    .join('');
  return `<table class="studio-table"><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>`;
}

function escapeHtml(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
