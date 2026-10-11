import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addCalendarMonths,
  bankAccountToPaymentRows,
  clientToInvoiceParty,
  convertAmount,
  formatExchangeNote,
  invoiceAmountLayout,
  invoiceCurrencyViews,
  invoicePdfUserError,
  nextInvoiceNumber,
  planInvoiceDuplicates,
  shiftPeriodLabels,
} from '../../lib/atlas/invoice-ops';
import {
  allocateInvoiceNumbers,
  extractSeqFromNumber,
  formatInvoiceNumber,
  RURAL_COMMERCE_INVOICE_NUMBERING,
} from '../../lib/atlas/invoice-numbering';
import { buildInvoicePdfHtml } from '../../lib/atlas/invoice-pdf-html';
import { RURAL_COMMERCE_INVOICE_THEME } from '../../lib/atlas/invoice-theme';

test('calendar months clamp end-of-month', () => {
  assert.equal(addCalendarMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(addCalendarMonths('2026-10-01', 1), '2026-11-01');
});

test('period labels advance in English and Spanish', () => {
  assert.match(shiftPeriodLabels('Q2 (September 2026): reimbursement', 1), /October 2026/);
  assert.match(shiftPeriodLabels('Servicio de septiembre', 1), /octubre/i);
});

test('duplicate plan shifts dates and item text for N months', () => {
  const plans = planInvoiceDuplicates(
    {
      issueDate: '2026-09-01',
      dueDate: '2026-09-15',
      items: [{ description: 'September 2026 services', quantity: 1, unitPrice: 100 }],
    },
    3,
  );
  assert.equal(plans.length, 3);
  assert.equal(plans[0].issueDate, '2026-10-01');
  assert.equal(plans[1].issueDate, '2026-11-01');
  assert.equal(plans[2].issueDate, '2026-12-01');
  assert.match(plans[0].items[0].description, /October 2026/);
  assert.match(plans[2].items[0].description, /December 2026/);
});

test('dual currency views keep USD and convert CRC', () => {
  const sample = {
    currency: 'USD',
    altCurrency: 'CRC',
    exchangeRate: 500,
    subtotal: 10,
    taxAmount: 0,
    total: 10,
    items: [{ description: 'Fee', quantity: 1, unitPrice: 10, total: 10 }],
  };
  const layout = invoiceAmountLayout(sample);
  assert.equal(layout.columns.length, 2);
  assert.equal(layout.columns[0].currency, 'USD');
  assert.equal(layout.columns[1].currency, 'CRC');
  assert.equal(layout.columns[1].total, 5000);
  assert.equal(layout.items[0].amounts.length, 2);
  assert.equal(layout.items[0].amounts[0].total, 10);
  assert.equal(layout.items[0].amounts[1].total, 5000);
  const views = invoiceCurrencyViews(sample);
  assert.equal(views.length, 2);
  assert.equal(views[0].currency, 'USD');
  assert.equal(views[1].currency, 'CRC');
  assert.equal(views[1].total, 5000);
  assert.equal(convertAmount(8.14, 500), 4070);
});

test('PDF with two currencies renders one document with amount columns', () => {
  const html = buildInvoicePdfHtml({
    invoice: {
      number: 'INV-0002',
      type: 'RECEIVABLE',
      status: 'DRAFT',
      currency: 'USD',
      altCurrency: 'CRC',
      exchangeRate: 500,
      subtotal: 10,
      taxRate: 0,
      taxAmount: 0,
      total: 10,
      issueDate: '2026-10-01',
      items: [{ description: 'Fee', quantity: 1, unitPrice: 10, total: 10 }],
    },
    theme: RURAL_COMMERCE_INVOICE_THEME,
  });
  assert.match(html, /Amount \(USD\)/);
  assert.match(html, /Amount \(CRC\)/);
  assert.doesNotMatch(html, /page-break-after:\s*always/);
  assert.match(html, /Quotation: 1 USD = 500 CRC/);
  assert.equal((html.match(/class="doc"/g) || []).length, 1);
});

test('invoice numbers pad from existing count', () => {
  assert.equal(nextInvoiceNumber('RECEIVABLE', 0), 'INV-0001');
  assert.equal(nextInvoiceNumber('PAYABLE', 11), 'BILL-0012');
});

test('RC numbering formats INV-YY + padded sequence', () => {
  const when = new Date('2026-08-09T12:00:00.000Z');
  assert.equal(formatInvoiceNumber(RURAL_COMMERCE_INVOICE_NUMBERING, 8097, when), 'INV-2608097');
  assert.equal(extractSeqFromNumber('INV-2608097', RURAL_COMMERCE_INVOICE_NUMBERING, when), 8097);
  const { numbers, nextCfg } = allocateInvoiceNumbers({
    cfg: { ...RURAL_COMMERCE_INVOICE_NUMBERING, nextSeq: 8098 },
    existingNumbers: ['INV-2608097'],
    count: 2,
    when,
  });
  assert.deepEqual(numbers, ['INV-2608098', 'INV-2608099']);
  assert.equal(nextCfg.nextSeq, 8100);
});

test('default numbering is INV-{seq} with 4-digit pad', () => {
  const { numbers } = allocateInvoiceNumbers({
    cfg: { prefix: 'INV', pattern: '{PREFIX}-{SEQ}', seqPadding: 4, nextSeq: 1 },
    existingNumbers: [],
    count: 1,
    when: new Date('2026-01-01T00:00:00.000Z'),
  });
  assert.equal(numbers[0], 'INV-0001');
});

test('quotation note includes date and source', () => {
  const note = formatExchangeNote({
    currency: 'USD',
    altCurrency: 'CRC',
    exchangeRate: 500,
    exchangeRateDate: '2026-09-08',
    exchangeRateSource: 'BCCR',
  });
  assert.match(note, /Quotation: 1 USD = 500 CRC/);
  assert.match(note, /Date: 2026-09-08/);
  assert.match(note, /Source: BCCR/);
});

test('client and bank helpers fill invoice parties', () => {
  const party = clientToInvoiceParty({
    name: 'Wildlife Habitat Council',
    email: 'a@b.com',
    phone: '1',
    address: '7200 Wisconsin',
    extra: 'UEI NUMBER: WMB6H1ME8GR6',
  });
  assert.equal(party.contactName, 'Wildlife Habitat Council');
  assert.match(party.contactExtra, /UEI NUMBER/);
  const rows = bankAccountToPaymentRows({
    bankName: 'Choice Financial Group (Mercury)',
    accountNumber: '2026990037610',
    routingNumber: '091311229',
  });
  assert.equal(rows.length, 3);
  assert.equal(rows[0].value, 'Choice Financial Group (Mercury)');
});

test('PDF prints chosen number and quotation details', () => {
  const html = buildInvoicePdfHtml({
    invoice: {
      number: 'INV-2608097',
      type: 'RECEIVABLE',
      status: 'SENT',
      currency: 'USD',
      altCurrency: 'CRC',
      exchangeRate: 500,
      exchangeRateDate: '2026-09-08',
      exchangeRateSource: 'BCCR',
      subtotal: 10,
      taxRate: 0,
      taxAmount: 0,
      total: 10,
      issueDate: '2026-10-01',
      items: [{ description: 'Fee', quantity: 1, unitPrice: 10, total: 10 }],
    },
    theme: RURAL_COMMERCE_INVOICE_THEME,
  });
  assert.match(html, /Invoice Number: INV-2608097/);
  assert.match(html, /Amount \(USD\)/);
  assert.match(html, /Amount \(CRC\)/);
  assert.match(html, /Quotation: 1 USD = 500 CRC/);
  assert.match(html, /Date: 2026-09-08/);
  assert.match(html, /Source: BCCR/);
  assert.equal((html.match(/class="doc"/g) || []).length, 1);
  assert.doesNotMatch(html, /page-break-after:\s*always/);
});

test('PDF user errors stay generic and never leak secrets', () => {
  assert.equal(invoicePdfUserError(500, { error: 'Timeout generando PDF' }), 'Timeout generando PDF');
  assert.equal(invoicePdfUserError(500, { error: 'PDF API not configured' }), 'PDF API not configured');
  assert.equal(invoicePdfUserError(401, { error: 'No autorizado' }), 'No autorizado');
  assert.equal(invoicePdfUserError(500, { error: 'apikey=sk-secret token=abc' }), 'Error al generar PDF');
});

test('PDF images embed small files and skip huge banners', async () => {
  const { resolvePdfImage, convertHtmlToPdf } = await import('../../lib/atlas/invoice-pdf-convert');
  const small = resolvePdfImage('/logo.png', 'https://app.etholys.com', () => Buffer.from('tiny-logo'));
  assert.match(small, /^data:image\/png;base64,/);
  const huge = resolvePdfImage('/banner.png', 'https://app.etholys.com', () => Buffer.alloc(500_000));
  assert.equal(huge, 'https://app.etholys.com/banner.png');

  const calls: { url: string; body: Record<string, unknown> }[] = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    const href = String(url);
    const body = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>;
    calls.push({ url: href, body });
    if (href.includes('createConvertHtmlToPdfRequest')) {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ request_id: 'req-1' }),
        json: async () => ({ request_id: 'req-1' }),
      } as Response;
    }
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ status: 'SUCCESS', result: { result: Buffer.from('%PDF-1.4').toString('base64') } }),
      json: async () => ({ status: 'SUCCESS', result: { result: Buffer.from('%PDF-1.4').toString('base64') } }),
    } as Response;
  }) as typeof fetch;

  const pdf = await convertHtmlToPdf('<html>invoice</html>', {
    fetchImpl,
    apiKey: 'test-key',
    sleepMs: 0,
    baseUrl: 'https://app.etholys.com',
  });
  assert.equal(calls[0].url, 'https://apps.abacus.ai/api/createConvertHtmlToPdfRequest');
  assert.equal(calls[0].body.html_content, '<html>invoice</html>');
  assert.equal(calls[0].body.deployment_token, 'test-key');
  assert.doesNotMatch(String(calls[0].url), /api\.abacus\.ai/);
  assert.equal(pdf.toString('utf8'), '%PDF-1.4');
});
