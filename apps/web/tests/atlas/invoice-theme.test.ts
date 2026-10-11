import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_INVOICE_THEME,
  RURAL_COMMERCE_INVOICE_THEME,
  defaultInvoiceThemeForCompany,
  isRuralCommerceCompany,
  parseInvoiceTheme,
  tableCss,
} from '../../lib/atlas/invoice-theme';
import { buildInvoicePdfHtml, formatInvoiceLongDate, formatInvoiceMoney } from '../../lib/atlas/invoice-pdf-html';

const sampleInvoice = {
  number: 'INV-2608097',
  type: 'RECEIVABLE',
  status: 'SENT',
  currency: 'USD',
  subtotal: 8139.8,
  taxRate: 0,
  taxAmount: 0,
  total: 8139.8,
  issueDate: '2026-10-01',
  contactName: 'Wildlife Habitat Council dba Tandem Global',
  contactEmail: 'esamayo@tandemglobal.org / skonduri@tandemglobal.org',
  contactPhone: '+56 32 227 3000',
  contactAddress: '7200 Wisconsin Avenue, Suite 500,\nBethesda MD 20814 USA',
  contactExtra: 'UEI NUMBER: WMB6H1ME8GR6',
  items: [
    {
      description:
        'Q2 (September 2026): Reimbursement for the technical and financial execution of Subaward.',
      quantity: 1,
      unitPrice: 8139.8,
      total: 8139.8,
    },
  ],
};

test('company color becomes default primary', () => {
  const t = defaultInvoiceThemeForCompany({ name: 'Acme', color: '#EA580C', logo: '/x.png' });
  assert.equal(t.primary, '#EA580C');
  assert.equal(t.logoUrl, '/x.png');
  assert.equal(t.tableLayout, 'detailed');
});

test('invalid stored JSON falls back without throwing', () => {
  const t = parseInvoiceTheme('nope', { color: '#111111' });
  assert.equal(t.primary, '#111111');
});

test('parse keeps RC navy / teal and amount table', () => {
  const t = parseInvoiceTheme(RURAL_COMMERCE_INVOICE_THEME);
  assert.equal(t.presetId, 'rural-commerce');
  assert.equal(t.primary, '#031F51');
  assert.equal(t.accent, '#4DA5A7');
  assert.equal(t.tableStyle, 'branded');
  assert.equal(t.tableLayout, 'amount');
  assert.equal(t.showDocumentTitle, false);
  assert.equal(t.payment.enabled, true);
  assert.equal(t.signature.name, 'Tiago Rezende');
  assert.match(t.bannerUrl, /rural-commerce\/banner/);
  assert.match(t.logoUrl, /rural-commerce\/logo/);
});

test('Tiago / Rural Commerce companies match the preset owner', () => {
  assert.equal(
    isRuralCommerceCompany({ emails: ['tiagorezende@ruralcommerceglobal.com'] }),
    true,
  );
  assert.equal(isRuralCommerceCompany({ name: 'Rural Commerce CR' }), true);
  assert.equal(isRuralCommerceCompany({ name: 'Acme', emails: ['other@x.com'] }), false);
});

test('RC dual-currency PDF is one document with amount columns', () => {
  const html = buildInvoicePdfHtml({
    invoice: { ...sampleInvoice, altCurrency: 'CRC', exchangeRate: 500 },
    theme: RURAL_COMMERCE_INVOICE_THEME,
  });
  assert.equal((html.match(/class="doc"/g) || []).length, 1);
  assert.match(html, />Item</);
  assert.match(html, /Amount \(USD\)/);
  assert.match(html, /Amount \(CRC\)/);
  assert.doesNotMatch(html, /page-break-after:\s*always/);
  assert.match(html, /Quotation: 1 USD = 500 CRC/);
  assert.match(html, /From:.*Rural Commerce LLC/s);
  assert.match(html, /Payment Instructions/);
});

test('RC HTML matches payment-request structure', () => {
  const html = buildInvoicePdfHtml({
    invoice: sampleInvoice,
    theme: RURAL_COMMERCE_INVOICE_THEME,
    bannerSrc: 'data:image/png;base64,xx',
    logoSrc: 'data:image/png;base64,yy',
  });
  assert.match(html, /Invoice Number: INV-2608097/);
  assert.match(html, /Invoice Date: October 01, 2026/);
  assert.match(html, /From:.*Rural Commerce LLC/s);
  assert.match(html, /To:.*Wildlife Habitat Council/s);
  assert.match(html, /UEI NUMBER/);
  assert.match(html, /Payment Instructions/);
  assert.match(html, /Choice Financial Group/);
  assert.match(html, /Tiago Rezende/);
  assert.doesNotMatch(html, />FACTURA</);
  assert.doesNotMatch(html, /Generado por ATLAS/);
  assert.match(html, /background-image:url\('data:image\/png;base64,xx'\)/);
});

test('classic detailed layout still has qty columns and FACTURA title', () => {
  const theme = parseInvoiceTheme({
    ...DEFAULT_INVOICE_THEME,
    showDocumentTitle: true,
    tableLayout: 'detailed',
    tableStyle: 'classic',
  });
  const html = buildInvoicePdfHtml({
    invoice: { ...sampleInvoice, altCurrency: 'CRC', exchangeRate: 500, taxRate: 22, taxAmount: 1790.76, total: 9930.56 },
    theme,
  });
  assert.match(html, /FACTURA/);
  assert.match(html, /Cant\./);
  assert.match(html, /IVA \(22%\)/);
  assert.match(html, /Amount \(USD\)/);
  assert.match(html, /Amount \(CRC\)/);
  assert.equal((html.match(/class="doc"/g) || []).length, 1);
  assert.doesNotMatch(html, /page-break-after:\s*always/);
});

test('branded table CSS uses primary header', () => {
  const css = tableCss(RURAL_COMMERCE_INVOICE_THEME);
  assert.match(css, /#031F51/);
  assert.match(css, /item-desc/);
});

test('money uses Latin American grouping like the RC PDF', () => {
  const s = formatInvoiceMoney(8139.8, 'USD', 'es-UY');
  assert.match(s, /8\.139,80|8.139,80/);
});

test('long date is English month for RC', () => {
  assert.equal(formatInvoiceLongDate('2026-10-01', 'en-US'), 'October 01, 2026');
});
