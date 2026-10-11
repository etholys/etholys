import { dateOnlyIso } from '@/lib/atlas/date-only';
import { invoiceAmountLayout, type InvoiceAmountLayout } from '@/lib/atlas/invoice-ops';
import { tableCss, type InvoiceTheme } from '@/lib/atlas/invoice-theme';

export type InvoicePdfItem = {
  description?: string | null;
  quantity?: number | null;
  unitPrice?: number | null;
  total?: number | null;
};

export type InvoicePdfModel = {
  number: string;
  type: string;
  status: string;
  currency: string;
  altCurrency?: string | null;
  exchangeRate?: number | null;
  exchangeRateDate?: Date | string | null;
  exchangeRateSource?: string | null;
  paymentRows?: { label: string; value: string }[] | null;
  paymentTitle?: string | null;
  signerName?: string | null;
  signerTitle?: string | null;
  signerCompany?: string | null;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  issueDate: Date | string;
  dueDate?: Date | string | null;
  paidDate?: Date | string | null;
  notes?: string | null;
  description?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  contactAddress?: string | null;
  contactExtra?: string | null;
  supplierName?: string | null;
  items: InvoicePdfItem[];
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Borrador',
  SENT: 'Enviada',
  PAID: 'Pagada',
  OVERDUE: 'Vencida',
  CANCELLED: 'Cancelada',
};

export function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatInvoiceMoney(amount: number, currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale || 'es-UY', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 2,
    }).format(amount ?? 0);
  } catch {
    return new Intl.NumberFormat('es-UY', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount ?? 0);
  }
}

export function formatInvoiceLongDate(raw: Date | string | null | undefined, locale: string): string {
  const iso = dateOnlyIso(raw);
  if (!iso) return '—';
  try {
    return new Date(`${iso}T12:00:00.000Z`).toLocaleDateString(locale || 'en-US', {
      month: 'long',
      day: '2-digit',
      year: 'numeric',
      timeZone: 'UTC',
    });
  } catch {
    return iso;
  }
}

function nl(text: string): string {
  return esc(text).replace(/\r?\n/g, '<br/>');
}

function partyLines(lines: string[]): string {
  return lines
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => `<div>${nl(l)}</div>`)
    .join('');
}

function amountHeader(theme: InvoiceTheme, currency: string): string {
  return `${esc(theme.labels.amount)} (${esc(currency)})`;
}

function renderInvoiceDocument(opts: {
  invoice: InvoicePdfModel;
  theme: InvoiceTheme;
  layout: InvoiceAmountLayout;
  bannerSrc?: string;
  logoSrc?: string;
  signatureSrc?: string;
}): string {
  const { invoice, theme, layout } = opts;
  const isReceivable = invoice.type === 'RECEIVABLE' || invoice.type === 'DEBIT_NOTE';
  const title = isReceivable ? theme.documentTitleReceivable : theme.documentTitlePayable;
  const money = (n: number, currency: string) => formatInvoiceMoney(n, currency, theme.numberLocale);
  const issue = formatInvoiceLongDate(invoice.issueDate, theme.dateLocale);
  const fromName = theme.letterhead.legalName || '';
  const toName = invoice.contactName || invoice.supplierName || '—';
  const bannerBg = opts.bannerSrc
    ? `background-image:url('${opts.bannerSrc}');background-size:cover;background-position:center right;`
    : `background:${theme.primary};`;
  const logo = opts.logoSrc
    ? `<img class="logo" src="${opts.logoSrc}" alt="" />`
    : fromName
      ? `<div class="company-name">${esc(fromName)}</div>`
      : '';

  const fromBody = partyLines([
    theme.letterhead.address,
    theme.letterhead.phone ? `${theme.labels.phone}: ${theme.letterhead.phone}` : '',
    theme.letterhead.email ? `${theme.labels.email}:\n${theme.letterhead.email}` : '',
    theme.letterhead.taxId
      ? `${theme.letterhead.taxIdLabel}: ${theme.letterhead.taxId}`
      : '',
  ]);
  const toBody = partyLines([
    invoice.contactAddress || '',
    invoice.contactPhone ? `${theme.labels.phone}: ${invoice.contactPhone}` : '',
    invoice.contactEmail ? `${theme.labels.email}: ${invoice.contactEmail}` : '',
    invoice.contactExtra || '',
  ]);

  const items = layout.items || [];
  const amountHeads = layout.columns
    .map((col) => `<th class="text-right" style="width:160px">${amountHeader(theme, col.currency)}</th>`)
    .join('');
  let tableHead: string;
  let tableBody: string;
  const colCount = theme.tableLayout === 'amount' ? 1 + layout.columns.length : 4 + layout.columns.length;
  if (theme.tableLayout === 'amount') {
    tableHead = `<tr><th>${esc(theme.labels.item)}</th>${amountHeads}</tr>`;
    tableBody = items
      .map((item) => {
        const cells = item.amounts
          .map((amt) => `<td class="text-right amount">${esc(money(amt.total, amt.currency))}</td>`)
          .join('');
        return `<tr><td class="item-desc">${nl(item.description || '')}</td>${cells}</tr>`;
      })
      .join('');
  } else {
    tableHead = `<tr><th>#</th><th>${esc(theme.labels.item)}</th><th class="text-right">${esc(theme.labels.qty)}</th><th class="text-right">${esc(theme.labels.unitPrice)}</th>${amountHeads}</tr>`;
    tableBody = items
      .map((item, i) => {
        const cells = item.amounts
          .map((amt) => `<td class="text-right">${esc(money(amt.total, amt.currency))}</td>`)
          .join('');
        return `<tr><td>${i + 1}</td><td>${nl(item.description || '')}</td><td class="text-right">${item.quantity ?? 1}</td><td class="text-right">${esc(money(item.unitPrice || 0, layout.columns[0].currency))}</td>${cells}</tr>`;
      })
      .join('');
  }

  const showTotals = theme.tableLayout === 'detailed' || (invoice.taxRate || 0) > 0;
  const totals = showTotals
    ? `<div class="totals">
        <div class="total-row"><span>Subtotal</span>${layout.columns.map((col) => `<span>${esc(money(col.subtotal, col.currency))}</span>`).join('')}</div>
        ${(invoice.taxRate || 0) > 0 ? `<div class="total-row"><span>IVA (${invoice.taxRate}%)</span>${layout.columns.map((col) => `<span>${esc(money(col.taxAmount, col.currency))}</span>`).join('')}</div>` : ''}
        <div class="total-row total-final"><span>${esc(theme.labels.total)}</span>${layout.columns.map((col) => `<span>${esc(money(col.total, col.currency))}</span>`).join('')}</div>
      </div>`
    : '';

  const payRows = (invoice.paymentRows && invoice.paymentRows.length
    ? invoice.paymentRows
    : theme.payment.rows || []
  ).filter((r) => r.label || r.value);
  const showPayment = payRows.length > 0 && (Boolean(invoice.paymentRows?.length) || theme.payment.enabled);
  const payment = showPayment
    ? `<table class="pay">
          <thead><tr><th colspan="2">${esc(invoice.paymentTitle || theme.payment.title)}</th></tr></thead>
          <tbody>${payRows
            .map(
              (r) =>
                `<tr><td><strong>${esc(r.label)}${r.label ? ':' : ''}</strong> ${esc(r.value)}</td></tr>`,
            )
            .join('')}</tbody>
        </table>`
    : '';

  const signerName = invoice.signerName || theme.signature.name;
  const signerTitle = invoice.signerTitle || theme.signature.title;
  const signerCompany = invoice.signerCompany || theme.signature.companyLine;
  const sigImg = opts.signatureSrc
    ? `<img class="sig-img" src="${opts.signatureSrc}" alt="" />`
    : '';
  const signature =
    signerName || opts.signatureSrc
      ? `<div class="sig">
          ${sigImg}
          <div class="sig-line"></div>
          <div class="sig-name">${esc(signerName)}</div>
          <div class="sig-title">${esc(signerTitle)}</div>
          <div class="sig-co">${esc(signerCompany)}</div>
        </div>`
      : '';

  const status = theme.showStatusBadge
    ? `<div class="status status-${esc(invoice.status)}">${esc(STATUS_LABEL[invoice.status] || invoice.status)}</div>`
    : '';
  const rateNote = layout.exchangeNote
    ? `<div class="rate-note">${nl(layout.exchangeNote)}</div>`
    : '';

  return `<div class="doc">
  <div class="banner" style="${bannerBg}color:${theme.bannerText}">
    <div class="banner-top">
      <div>${logo}</div>
      <div class="meta">
        ${theme.showDocumentTitle ? `<div class="doc-title">${esc(title)}</div>` : ''}
        <div>${esc(theme.labels.invoiceNumber)}: ${esc(invoice.number)}</div>
        <div>${esc(theme.labels.invoiceDate)}: ${esc(issue)}</div>
        ${status}
      </div>
    </div>
    <div class="parties">
      <div>
        <div class="party-label">${esc(theme.labels.from)}: <span>${esc(fromName || '—')}</span></div>
        ${fromBody}
      </div>
      <div>
        <div class="party-label">${esc(theme.labels.to)}: <span>${esc(toName)}</span></div>
        ${toBody}
      </div>
    </div>
  </div>
  <div class="sheet">
    ${rateNote}
    <table class="items">
      <thead>${tableHead}</thead>
      <tbody>${tableBody || `<tr><td colspan="${colCount}">—</td></tr>`}</tbody>
    </table>
    ${totals}
    ${invoice.notes ? `<div class="notes"><strong>Notas:</strong> ${nl(invoice.notes)}</div>` : ''}
    ${invoice.description ? `<div style="margin-top:8px;color:#6B7280;font-size:12px;">${nl(invoice.description)}</div>` : ''}
    ${payment}
    ${signature}
  </div>
</div>`;
}

export function buildInvoicePdfHtml(opts: {
  invoice: InvoicePdfModel;
  theme: InvoiceTheme;
  bannerSrc?: string;
  logoSrc?: string;
  signatureSrc?: string;
}): string {
  const { invoice, theme } = opts;
  const layout = invoiceAmountLayout(invoice);
  const page = renderInvoiceDocument({
    invoice,
    theme,
    layout,
    bannerSrc: opts.bannerSrc,
    logoSrc: opts.logoSrc,
    signatureSrc: opts.signatureSrc,
  });

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
  @page { size: Letter; margin: 0; }
  * { box-sizing: border-box; }
  html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: Calibri, 'Segoe UI', Arial, 'Liberation Sans', sans-serif; margin: 0; padding: 0; color: ${theme.bodyText}; font-size: 13px; background: #fff; }
  .doc { page-break-after: auto; }
  .banner { color: ${theme.bannerText}; padding: 28px 40px 32px; min-height: 220px; background-size: cover; background-position: center right; }
  .banner-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
  .logo { height: 64px; max-width: 280px; object-fit: contain; }
  .company-name { font-size: 26px; font-weight: 700; color: ${theme.bannerText}; }
  .meta { text-align: right; font-size: 13px; line-height: 1.45; font-weight: 700; padding-top: 8px; }
  .doc-title { font-size: 22px; font-weight: 700; margin-bottom: 6px; }
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; margin-top: 28px; font-size: 13px; line-height: 1.45; }
  .party-label { color: ${theme.accent}; font-weight: 700; margin-bottom: 4px; }
  .party-label span { font-weight: 700; }
  .sheet { padding: 36px 48px 48px; }
  .rate-note { font-size: 12px; color: ${theme.accent}; font-weight: 600; margin-bottom: 12px; line-height: 1.45; }
  table.items { width: 100%; border-collapse: collapse; margin: 8px 0 28px; }
  ${tableCss(theme)}
  .text-right { text-align: right; }
  .amount { color: ${theme.headingText}; font-weight: 600; white-space: nowrap; }
  .totals { margin-left: auto; min-width: 280px; width: max-content; margin-bottom: 28px; }
  .total-row { display: flex; justify-content: space-between; gap: 24px; padding: 6px 0; }
  .total-final { font-size: 16px; font-weight: 700; border-top: 2px solid ${theme.primary}; padding-top: 8px; margin-top: 4px; color: ${theme.headingText}; }
  table.pay { width: 62%; border-collapse: collapse; margin: 12px 0 36px; }
  table.pay th { background: ${theme.paymentHeaderBg}; color: ${theme.paymentHeaderText}; text-align: left; padding: 8px 12px; font-size: 14px; }
  table.pay td { border: 1px solid ${theme.paymentHeaderBg}; padding: 6px 12px; font-size: 13px; color: ${theme.bodyText}; }
  .notes { background: #FFFBEB; padding: 12px; border-radius: 6px; margin: 12px 0; font-size: 12px; }
  .sig { width: 260px; margin: 48px auto 0; text-align: center; }
  .sig-img { max-height: 64px; margin-bottom: 4px; }
  .sig-line { border-top: 1px solid #111; margin: 0 12px 8px; }
  .sig-name { font-weight: 800; color: ${theme.headingText}; font-size: 16px; }
  .sig-title { color: ${theme.bodyText}; margin-top: 2px; }
  .sig-co { color: ${theme.accent}; margin-top: 2px; font-weight: 600; }
  .status { display: inline-block; padding: 4px 12px; border-radius: 4px; font-weight: 600; font-size: 12px; margin-top: 8px; }
  .status-PAID { background: #D1FAE5; color: #065F46; }
  .status-SENT { background: #DBEAFE; color: #1E40AF; }
  .status-DRAFT { background: #F3F4F6; color: #374151; }
  .status-OVERDUE { background: #FEE2E2; color: #991B1B; }
  .status-CANCELLED { background: #F3F4F6; color: #6B7280; }
</style></head><body>
${page}
</body></html>`;
}
