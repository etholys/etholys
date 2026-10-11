import { dateOnlyIso, parseDateOnlyToUtc } from '@/lib/atlas/date-only';

export const INVOICE_CURRENCIES = ['USD', 'CRC', 'EUR', 'BRL', 'UYU', 'GBP', 'CAD', 'MXN', 'COP', 'CLP', 'PEN'] as const;

const MONTHS = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  es: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
  pt: ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'],
} as const;

export function roundMoney(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function addCalendarMonths(raw: unknown, months: number): string {
  const d = parseDateOnlyToUtc(raw);
  if (!d) return dateOnlyIso(raw);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  const target = new Date(Date.UTC(y, m + months, 1, 12, 0, 0));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0, 12, 0, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, last));
  return dateOnlyIso(target);
}

function monthIndex(token: string): { lang: keyof typeof MONTHS; index: number } | null {
  const t = token.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  for (const lang of ['en', 'es', 'pt'] as const) {
    const i = MONTHS[lang].findIndex(
      (name) => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() === t,
    );
    if (i >= 0) return { lang, index: i };
  }
  return null;
}

/** Advance month names (en/es/pt) in invoice text by N calendar months. */
export function shiftPeriodLabels(text: string, months: number): string {
  if (!text || !months) return text;
  return text.replace(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b/gi,
    (raw) => {
      const hit = monthIndex(raw);
      if (!hit) return raw;
      const next = (hit.index + months + 1200) % 12;
      const name = MONTHS[hit.lang][next];
      if (raw === raw.toUpperCase()) return name.toUpperCase();
      if (raw[0] === raw[0].toUpperCase()) {
        return name.charAt(0).toUpperCase() + name.slice(1);
      }
      return name;
    },
  );
}

export function convertAmount(amount: number, rate: number): number {
  return roundMoney(amount * rate);
}

export function hasAltCurrency(inv: { altCurrency?: string | null; exchangeRate?: number | null }): boolean {
  return Boolean(String(inv.altCurrency || '').trim()) && Number(inv.exchangeRate) > 0;
}

export type InvoicePaymentRow = { label: string; value: string };

export type InvoiceBankAccountInput = {
  label?: string | null;
  bankName?: string | null;
  bankAddress?: string | null;
  accountLabel?: string | null;
  accountNumber?: string | null;
  routingLabel?: string | null;
  routingNumber?: string | null;
};

export function bankAccountToPaymentRows(bank: InvoiceBankAccountInput | null | undefined): InvoicePaymentRow[] {
  if (!bank) return [];
  return [
    { label: 'Bank Name', value: String(bank.bankName || '').trim() },
    { label: 'Bank Address', value: String(bank.bankAddress || '').trim() },
    {
      label: String(bank.accountLabel || 'IBAN / Account Number').trim() || 'Account',
      value: String(bank.accountNumber || '').trim(),
    },
    {
      label: String(bank.routingLabel || 'ABA / Routing Number').trim() || 'Routing',
      value: String(bank.routingNumber || '').trim(),
    },
  ].filter((r) => r.value);
}

export function clientToInvoiceParty(client: {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  taxId?: string | null;
  extra?: string | null;
}): {
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  contactAddress: string;
  contactExtra: string;
} {
  const address = [client.address, [client.city, client.country].filter(Boolean).join(' ')].filter(Boolean).join(',\n');
  const extraBits = [
    client.taxId ? `Tax ID: ${client.taxId}` : '',
    client.extra || '',
  ].filter(Boolean);
  return {
    contactName: client.name || '',
    contactEmail: client.email || '',
    contactPhone: client.phone || '',
    contactAddress: address,
    contactExtra: extraBits.join('\n'),
  };
}

export function formatExchangeNote(inv: {
  currency?: string | null;
  altCurrency?: string | null;
  exchangeRate?: number | null;
  exchangeRateDate?: Date | string | null;
  exchangeRateSource?: string | null;
}): string {
  const primary = String(inv.currency || 'USD').toUpperCase();
  const alt = String(inv.altCurrency || '').trim().toUpperCase();
  const rate = Number(inv.exchangeRate);
  if (!alt || !(rate > 0)) return '';
  const lines = [`Quotation: 1 ${primary} = ${rate} ${alt}`];
  const date = dateOnlyIso(inv.exchangeRateDate);
  if (date) lines.push(`Date: ${date}`);
  const source = String(inv.exchangeRateSource || '').trim();
  if (source) lines.push(`Source: ${source}`);
  return lines.join('\n');
}

export type InvoiceAmountView = {
  currency: string;
  subtotal: number;
  taxAmount: number;
  total: number;
  items: { description: string; quantity: number; unitPrice: number; total: number }[];
  exchangeNote?: string;
};

export function invoiceCurrencyViews(inv: {
  currency?: string | null;
  altCurrency?: string | null;
  exchangeRate?: number | null;
  exchangeRateDate?: Date | string | null;
  exchangeRateSource?: string | null;
  subtotal: number;
  taxAmount: number;
  total: number;
  items: { description?: string | null; quantity?: number | null; unitPrice?: number | null; total?: number | null }[];
}): InvoiceAmountView[] {
  const primary = String(inv.currency || 'USD').toUpperCase();
  const items = (inv.items || []).map((it) => {
    const qty = it.quantity ?? 1;
    const unit = it.unitPrice ?? 0;
    const total = it.total ?? qty * unit;
    return {
      description: it.description || '',
      quantity: qty,
      unitPrice: unit,
      total,
    };
  });
  const views: InvoiceAmountView[] = [
    {
      currency: primary,
      subtotal: inv.subtotal,
      taxAmount: inv.taxAmount,
      total: inv.total,
      items,
    },
  ];
  const alt = String(inv.altCurrency || '').trim().toUpperCase();
  const rate = Number(inv.exchangeRate);
  if (!alt || alt === primary || !(rate > 0)) return views;
  const note = formatExchangeNote(inv);
  views[0].exchangeNote = note;
  views.push({
    currency: alt,
    subtotal: convertAmount(inv.subtotal, rate),
    taxAmount: convertAmount(inv.taxAmount, rate),
    total: convertAmount(inv.total, rate),
    items: items.map((it) => ({
      ...it,
      unitPrice: convertAmount(it.unitPrice, rate),
      total: convertAmount(it.total, rate),
    })),
    exchangeNote: note,
  });
  return views;
}

export function nextInvoiceNumber(type: string, existingCount: number): string {
  const prefixMap: Record<string, string> = {
    RECEIVABLE: 'INV',
    PAYABLE: 'BILL',
    CREDIT_NOTE: 'NC',
    DEBIT_NOTE: 'ND',
  };
  return `${prefixMap[type] || 'DOC'}-${String(existingCount + 1).padStart(4, '0')}`;
}

export type DuplicateMonthPlan = {
  offset: number;
  issueDate: string;
  dueDate: string | null;
  description: string;
  notes: string;
  items: { description: string; quantity: number; unitPrice: number }[];
};

export function planInvoiceDuplicates(
  source: {
    issueDate?: Date | string | null;
    dueDate?: Date | string | null;
    description?: string | null;
    notes?: string | null;
    items?: { description?: string | null; quantity?: number | null; unitPrice?: number | null }[];
  },
  months: number,
): DuplicateMonthPlan[] {
  const n = Math.min(24, Math.max(1, Math.floor(Number(months) || 1)));
  const issue = dateOnlyIso(source.issueDate) || dateOnlyIso(new Date());
  const due = source.dueDate ? dateOnlyIso(source.dueDate) : '';
  const plans: DuplicateMonthPlan[] = [];
  for (let offset = 1; offset <= n; offset++) {
    plans.push({
      offset,
      issueDate: addCalendarMonths(issue, offset),
      dueDate: due ? addCalendarMonths(due, offset) : null,
      description: shiftPeriodLabels(source.description || '', offset),
      notes: shiftPeriodLabels(source.notes || '', offset),
      items: (source.items || []).map((it) => ({
        description: shiftPeriodLabels(it.description || '', offset),
        quantity: it.quantity ?? 1,
        unitPrice: it.unitPrice ?? 0,
      })),
    });
  }
  return plans;
}
