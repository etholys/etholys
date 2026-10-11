export type InvoiceNumbering = {
  prefix: string;
  /** Tokens: {PREFIX} {YYYY} {YY} {MM} {DD} {SEQ} */
  pattern: string;
  seqPadding: number;
  nextSeq: number;
};

export const DEFAULT_INVOICE_NUMBERING: InvoiceNumbering = {
  prefix: 'INV',
  pattern: '{PREFIX}-{SEQ}',
  seqPadding: 4,
  nextSeq: 1,
};

/** RC payment request style: INV-2608097 = INV- + YY + 5-digit sequence */
export const RURAL_COMMERCE_INVOICE_NUMBERING: InvoiceNumbering = {
  prefix: 'INV',
  pattern: '{PREFIX}-{YY}{SEQ}',
  seqPadding: 5,
  nextSeq: 8098,
};

export function parseInvoiceNumbering(raw: unknown, fallback: InvoiceNumbering = DEFAULT_INVOICE_NUMBERING): InvoiceNumbering {
  if (!raw || typeof raw !== 'object') return { ...fallback };
  const o = raw as Record<string, unknown>;
  const prefix = typeof o.prefix === 'string' && o.prefix.trim() ? o.prefix.trim().toUpperCase() : fallback.prefix;
  const pattern = typeof o.pattern === 'string' && o.pattern.includes('{SEQ}')
    ? o.pattern.trim()
    : fallback.pattern;
  const pad = Math.min(8, Math.max(1, Number(o.seqPadding) || fallback.seqPadding));
  const nextSeq = Math.max(1, Math.floor(Number(o.nextSeq) || fallback.nextSeq));
  return { prefix, pattern, seqPadding: pad, nextSeq };
}

export function formatInvoiceNumber(cfg: InvoiceNumbering, seq: number, when: Date = new Date()): string {
  const y = when.getUTCFullYear();
  const yy = String(y).slice(-2);
  const mm = String(when.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(when.getUTCDate()).padStart(2, '0');
  const padded = String(Math.max(1, Math.floor(seq))).padStart(cfg.seqPadding, '0');
  return cfg.pattern
    .replace(/\{PREFIX\}/g, cfg.prefix)
    .replace(/\{YYYY\}/g, String(y))
    .replace(/\{YY\}/g, yy)
    .replace(/\{MM\}/g, mm)
    .replace(/\{DD\}/g, dd)
    .replace(/\{SEQ\}/g, padded);
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function extractSeqFromNumber(number: string, cfg: InvoiceNumbering, _when: Date = new Date()): number | null {
  const y = _when.getUTCFullYear();
  const body = cfg.pattern
    .split(/(\{PREFIX\}|\{YYYY\}|\{YY\}|\{MM\}|\{DD\}|\{SEQ\})/)
    .map((part) => {
      if (part === '{PREFIX}') return escapeRe(cfg.prefix);
      if (part === '{YYYY}') return String(y);
      if (part === '{YY}') return String(y).slice(-2);
      if (part === '{MM}') return String(_when.getUTCMonth() + 1).padStart(2, '0');
      if (part === '{DD}') return String(_when.getUTCDate()).padStart(2, '0');
      if (part === '{SEQ}') return `(\\d{${cfg.seqPadding}})`;
      return escapeRe(part);
    })
    .join('');
  const m = String(number || '').trim().match(new RegExp(`^${body}$`));
  if (m?.[1]) return Number(m[1]);
  const tail = String(number || '').match(/(\d+)\s*$/);
  if (!tail) return null;
  const raw = tail[1];
  if (raw.length >= cfg.seqPadding) return Number(raw.slice(-cfg.seqPadding));
  return Number(raw);
}

export function nextSeqFromExisting(numbers: string[], cfg: InvoiceNumbering, when: Date = new Date()): number {
  let max = cfg.nextSeq - 1;
  for (const num of numbers) {
    const seq = extractSeqFromNumber(num, cfg, when);
    if (seq && seq > max) max = seq;
  }
  return max + 1;
}

export function allocateInvoiceNumbers(opts: {
  cfg: InvoiceNumbering;
  existingNumbers: string[];
  count: number;
  when?: Date;
}): { numbers: string[]; nextCfg: InvoiceNumbering } {
  const when = opts.when || new Date();
  let seq = nextSeqFromExisting(opts.existingNumbers, opts.cfg, when);
  const numbers: string[] = [];
  const used = new Set(opts.existingNumbers.map((n) => n.trim().toUpperCase()));
  for (let i = 0; i < Math.max(1, opts.count); i++) {
    let candidate = formatInvoiceNumber(opts.cfg, seq, when);
    while (used.has(candidate.toUpperCase())) {
      seq += 1;
      candidate = formatInvoiceNumber(opts.cfg, seq, when);
    }
    numbers.push(candidate);
    used.add(candidate.toUpperCase());
    seq += 1;
  }
  return { numbers, nextCfg: { ...opts.cfg, nextSeq: seq } };
}
