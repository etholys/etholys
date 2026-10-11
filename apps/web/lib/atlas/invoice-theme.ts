/** Per-company invoice PDF skin. Structure is fixed; colors, banner, logo and table style vary. */

export const RURAL_COMMERCE_INVOICE_OWNER_EMAIL = 'tiagorezende@ruralcommerceglobal.com';

export type InvoiceTableStyle = 'classic' | 'branded' | 'lined' | 'striped';
export type InvoiceTableLayout = 'amount' | 'detailed';

export type InvoiceThemePaymentRow = { label: string; value: string };

export type InvoiceTheme = {
  presetId?: string;
  bannerUrl: string;
  logoUrl: string;
  primary: string;
  accent: string;
  headingText: string;
  bodyText: string;
  bannerText: string;
  tableStyle: InvoiceTableStyle;
  tableLayout: InvoiceTableLayout;
  tableHeaderBg: string;
  tableHeaderText: string;
  tableBorder: string;
  paymentHeaderBg: string;
  paymentHeaderText: string;
  showDocumentTitle: boolean;
  showStatusBadge: boolean;
  documentTitleReceivable: string;
  documentTitlePayable: string;
  dateLocale: string;
  numberLocale: string;
  letterhead: {
    legalName: string;
    address: string;
    phone: string;
    email: string;
    taxIdLabel: string;
    taxId: string;
  };
  payment: {
    enabled: boolean;
    title: string;
    rows: InvoiceThemePaymentRow[];
  };
  signature: {
    enabled: boolean;
    name: string;
    title: string;
    companyLine: string;
    imageUrl: string;
  };
  labels: {
    invoiceNumber: string;
    invoiceDate: string;
    from: string;
    to: string;
    item: string;
    amount: string;
    qty: string;
    unitPrice: string;
    total: string;
    phone: string;
    email: string;
  };
};

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isHexColor(v: unknown): v is string {
  return typeof v === 'string' && HEX.test(v.trim());
}

function hex(v: unknown, fallback: string): string {
  if (typeof v === 'string' && HEX.test(v.trim())) return v.trim();
  return fallback;
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

const TABLE_STYLES: InvoiceTableStyle[] = ['classic', 'branded', 'lined', 'striped'];
const TABLE_LAYOUTS: InvoiceTableLayout[] = ['amount', 'detailed'];

export const DEFAULT_INVOICE_THEME: InvoiceTheme = {
  bannerUrl: '',
  logoUrl: '',
  primary: '#0D9488',
  accent: '#0D9488',
  headingText: '#111827',
  bodyText: '#1a1a1a',
  bannerText: '#FFFFFF',
  tableStyle: 'classic',
  tableLayout: 'detailed',
  tableHeaderBg: '#F3F4F6',
  tableHeaderText: '#6B7280',
  tableBorder: '#E5E7EB',
  paymentHeaderBg: '#0D9488',
  paymentHeaderText: '#FFFFFF',
  showDocumentTitle: true,
  showStatusBadge: true,
  documentTitleReceivable: 'FACTURA',
  documentTitlePayable: 'FACTURA DE COMPRA',
  dateLocale: 'es-UY',
  numberLocale: 'es-UY',
  letterhead: {
    legalName: '',
    address: '',
    phone: '',
    email: '',
    taxIdLabel: 'EIN',
    taxId: '',
  },
  payment: { enabled: false, title: 'Payment Instructions:', rows: [] },
  signature: { enabled: false, name: '', title: '', companyLine: '', imageUrl: '' },
  labels: {
    invoiceNumber: 'Invoice Number',
    invoiceDate: 'Invoice Date',
    from: 'From',
    to: 'To',
    item: 'Item',
    amount: 'Amount',
    qty: 'Cant.',
    unitPrice: 'Precio Unit.',
    total: 'Total',
    phone: 'Phone',
    email: 'Email',
  },
};

/** Visual + letterhead cloned from [RC-CR] IN2609097 payment request + banner fb.psd */
export const RURAL_COMMERCE_INVOICE_THEME: InvoiceTheme = {
  presetId: 'rural-commerce',
  bannerUrl: '/invoice-themes/rural-commerce/banner.png',
  logoUrl: '/invoice-themes/rural-commerce/logo.png',
  primary: '#031F51',
  accent: '#4DA5A7',
  headingText: '#031F51',
  bodyText: '#111827',
  bannerText: '#FFFFFF',
  tableStyle: 'branded',
  tableLayout: 'amount',
  tableHeaderBg: '#031F51',
  tableHeaderText: '#FFFFFF',
  tableBorder: '#031F51',
  paymentHeaderBg: '#4DA5A7',
  paymentHeaderText: '#FFFFFF',
  showDocumentTitle: false,
  showStatusBadge: false,
  documentTitleReceivable: 'INVOICE',
  documentTitlePayable: 'BILL',
  dateLocale: 'en-US',
  numberLocale: 'es-UY',
  letterhead: {
    legalName: 'Rural Commerce LLC',
    address: '525 Randall Ave, Ste 100,\nCheyenne WY 82001 USA',
    phone: '+1 (307) 212-6747',
    email: 'financial@ruralcommerceglobal.com',
    taxIdLabel: 'EIN',
    taxId: '35-2895068',
  },
  payment: {
    enabled: true,
    title: 'Payment Instructions:',
    rows: [
      { label: 'Bank Name', value: 'Choice Financial Group (Mercury)' },
      { label: 'Bank Adress', value: '4501 23rd Avenue S, Fargo, ND 58104' },
      { label: 'IBAN / Account Number', value: '2026990037610' },
      { label: 'ABA / Routing Number', value: '091311229' },
    ],
  },
  signature: {
    enabled: true,
    name: 'Tiago Rezende',
    title: 'Director Ejecutivo',
    companyLine: 'Rural Commerce',
    imageUrl: '',
  },
  labels: {
    invoiceNumber: 'Invoice Number',
    invoiceDate: 'Invoice Date',
    from: 'From',
    to: 'To',
    item: 'Item',
    amount: 'Amount',
    qty: 'Qty',
    unitPrice: 'Unit price',
    total: 'Total',
    phone: 'Phone',
    email: 'Email',
  },
};

export function defaultInvoiceThemeForCompany(company?: {
  name?: string | null;
  color?: string | null;
  logo?: string | null;
  ein?: string | null;
  taxAddress?: string | null;
  description?: string | null;
} | null): InvoiceTheme {
  const primary = isHexColor(company?.color) ? company!.color! : DEFAULT_INVOICE_THEME.primary;
  return {
    ...DEFAULT_INVOICE_THEME,
    primary,
    accent: primary,
    paymentHeaderBg: primary,
    logoUrl: company?.logo || '',
    letterhead: {
      ...DEFAULT_INVOICE_THEME.letterhead,
      legalName: company?.name || '',
      address: company?.taxAddress || '',
      taxId: company?.ein || '',
    },
  };
}

function parseRows(raw: unknown): InvoiceThemePaymentRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      if (!row || typeof row !== 'object') return null;
      const r = row as Record<string, unknown>;
      const label = str(r.label).trim();
      const value = str(r.value).trim();
      if (!label && !value) return null;
      return { label, value };
    })
    .filter((x): x is InvoiceThemePaymentRow => Boolean(x));
}

export function parseInvoiceTheme(
  raw: unknown,
  company?: {
    name?: string | null;
    color?: string | null;
    logo?: string | null;
    ein?: string | null;
    taxAddress?: string | null;
  } | null,
): InvoiceTheme {
  const base = defaultInvoiceThemeForCompany(company);
  if (!raw || typeof raw !== 'object') return base;
  const o = raw as Record<string, unknown>;
  const tableStyle = TABLE_STYLES.includes(o.tableStyle as InvoiceTableStyle)
    ? (o.tableStyle as InvoiceTableStyle)
    : base.tableStyle;
  const tableLayout = TABLE_LAYOUTS.includes(o.tableLayout as InvoiceTableLayout)
    ? (o.tableLayout as InvoiceTableLayout)
    : base.tableLayout;
  const letter = o.letterhead && typeof o.letterhead === 'object' ? (o.letterhead as Record<string, unknown>) : {};
  const pay = o.payment && typeof o.payment === 'object' ? (o.payment as Record<string, unknown>) : {};
  const sig = o.signature && typeof o.signature === 'object' ? (o.signature as Record<string, unknown>) : {};
  const labels = o.labels && typeof o.labels === 'object' ? (o.labels as Record<string, unknown>) : {};
  const primary = hex(o.primary, base.primary);
  return {
    presetId: str(o.presetId, base.presetId || '') || undefined,
    bannerUrl: str(o.bannerUrl, base.bannerUrl),
    logoUrl: str(o.logoUrl, base.logoUrl),
    primary,
    accent: hex(o.accent, primary),
    headingText: hex(o.headingText, base.headingText),
    bodyText: hex(o.bodyText, base.bodyText),
    bannerText: hex(o.bannerText, base.bannerText),
    tableStyle,
    tableLayout,
    tableHeaderBg: hex(o.tableHeaderBg, tableStyle === 'branded' ? primary : base.tableHeaderBg),
    tableHeaderText: hex(o.tableHeaderText, tableStyle === 'branded' ? '#FFFFFF' : base.tableHeaderText),
    tableBorder: hex(o.tableBorder, tableStyle === 'branded' ? primary : base.tableBorder),
    paymentHeaderBg: hex(o.paymentHeaderBg, hex(o.accent, primary)),
    paymentHeaderText: hex(o.paymentHeaderText, base.paymentHeaderText),
    showDocumentTitle: bool(o.showDocumentTitle, base.showDocumentTitle),
    showStatusBadge: bool(o.showStatusBadge, base.showStatusBadge),
    documentTitleReceivable: str(o.documentTitleReceivable, base.documentTitleReceivable) || base.documentTitleReceivable,
    documentTitlePayable: str(o.documentTitlePayable, base.documentTitlePayable) || base.documentTitlePayable,
    dateLocale: str(o.dateLocale, base.dateLocale) || base.dateLocale,
    numberLocale: str(o.numberLocale, base.numberLocale) || base.numberLocale,
    letterhead: {
      legalName: str(letter.legalName, base.letterhead.legalName),
      address: str(letter.address, base.letterhead.address),
      phone: str(letter.phone, base.letterhead.phone),
      email: str(letter.email, base.letterhead.email),
      taxIdLabel: str(letter.taxIdLabel, base.letterhead.taxIdLabel) || 'EIN',
      taxId: str(letter.taxId, base.letterhead.taxId),
    },
    payment: {
      enabled: bool(pay.enabled, base.payment.enabled),
      title: str(pay.title, base.payment.title) || base.payment.title,
      rows: parseRows(pay.rows).length ? parseRows(pay.rows) : base.payment.rows,
    },
    signature: {
      enabled: bool(sig.enabled, base.signature.enabled),
      name: str(sig.name, base.signature.name),
      title: str(sig.title, base.signature.title),
      companyLine: str(sig.companyLine, base.signature.companyLine),
      imageUrl: str(sig.imageUrl, base.signature.imageUrl),
    },
    labels: {
      invoiceNumber: str(labels.invoiceNumber, base.labels.invoiceNumber) || base.labels.invoiceNumber,
      invoiceDate: str(labels.invoiceDate, base.labels.invoiceDate) || base.labels.invoiceDate,
      from: str(labels.from, base.labels.from) || base.labels.from,
      to: str(labels.to, base.labels.to) || base.labels.to,
      item: str(labels.item, base.labels.item) || base.labels.item,
      amount: str(labels.amount, base.labels.amount) || base.labels.amount,
      qty: str(labels.qty, base.labels.qty) || base.labels.qty,
      unitPrice: str(labels.unitPrice, base.labels.unitPrice) || base.labels.unitPrice,
      total: str(labels.total, base.labels.total) || base.labels.total,
      phone: str(labels.phone, base.labels.phone) || base.labels.phone,
      email: str(labels.email, base.labels.email) || base.labels.email,
    },
  };
}

export function isRuralCommerceCompany(company: {
  name?: string | null;
  shortName?: string | null;
  emails?: string[] | null;
}): boolean {
  const blob = `${company.name || ''} ${company.shortName || ''}`.toLowerCase();
  if (/rural\s*commerce/.test(blob)) return true;
  const emails = (company.emails || []).map((e) => e.trim().toLowerCase());
  return emails.includes(RURAL_COMMERCE_INVOICE_OWNER_EMAIL);
}

export function tableCss(theme: InvoiceTheme): string {
  const th = `th { background: ${theme.tableHeaderBg}; color: ${theme.tableHeaderText}; padding: 10px 14px; text-align: left; font-size: 13px; font-weight: 700; }`;
  const td = `td { padding: 12px 14px; vertical-align: top; }`;
  if (theme.tableStyle === 'classic') {
    return `${th} th { text-transform: uppercase; font-size: 11px; font-weight: 600; } ${td} td { border-bottom: 1px solid ${theme.tableBorder}; }`;
  }
  if (theme.tableStyle === 'lined') {
    return `${th} ${td} th, td { border: 1px solid ${theme.tableBorder}; }`;
  }
  if (theme.tableStyle === 'striped') {
    return `${th} ${td} td { border-bottom: 1px solid ${theme.tableBorder}; } tbody tr:nth-child(even) td { background: #F8FAFC; }`;
  }
  return `${th} ${td} th, td { border: 1px solid ${theme.tableBorder}; } .item-desc { color: ${theme.accent}; font-weight: 600; }`;
}
