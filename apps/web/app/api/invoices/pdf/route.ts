export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { buildInvoicePdfHtml } from '@/lib/atlas/invoice-pdf-html';
import { loadInvoiceTheme } from '@/lib/atlas/invoice-theme-store';
import { bankAccountToPaymentRows } from '@/lib/atlas/invoice-ops';
import {
  convertHtmlToPdf,
  InvoicePdfError,
  resolvePdfImage,
} from '@/lib/atlas/invoice-pdf-convert';

async function loadInvoiceForPdf(invoiceId: string) {
  try {
    return await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        items: { orderBy: { order: 'asc' } },
        company: true,
        supplier: true,
        bankAccount: true,
        invoiceSignature: true,
      },
    });
  } catch (error) {
    console.error('Invoice PDF include fallback:', error);
    return prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        items: { orderBy: { order: 'asc' } },
        company: true,
        supplier: true,
      },
    });
  }
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return jsonError('No autorizado', 401);
    const { searchParams } = new URL(req.url);
    const invoiceId = searchParams.get('id');
    if (!invoiceId) return jsonError('Missing id', 400);

    const invoice = await loadInvoiceForPdf(invoiceId);
    if (!invoice || !tenant.companyIds.includes(invoice.companyId)) {
      return jsonError('Factura no encontrada', 404);
    }

    const theme = await loadInvoiceTheme(invoice.companyId);
    const baseUrl = process.env.NEXTAUTH_URL || 'https://app.etholys.com';
    const bankAccount = 'bankAccount' in invoice ? invoice.bankAccount : null;
    const invoiceSignature = 'invoiceSignature' in invoice ? invoice.invoiceSignature : null;
    const html = buildInvoicePdfHtml({
      invoice: {
        number: invoice.number,
        type: invoice.type,
        status: invoice.status,
        currency: invoice.currency,
        altCurrency: invoice.altCurrency,
        exchangeRate: invoice.exchangeRate,
        exchangeRateDate: invoice.exchangeRateDate,
        exchangeRateSource: invoice.exchangeRateSource,
        paymentRows: bankAccountToPaymentRows(bankAccount),
        signerName: invoiceSignature?.name,
        signerTitle: invoiceSignature?.title,
        signerCompany: invoiceSignature?.companyLine,
        subtotal: invoice.subtotal,
        taxRate: invoice.taxRate,
        taxAmount: invoice.taxAmount,
        total: invoice.total,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        paidDate: invoice.paidDate,
        notes: invoice.notes,
        description: invoice.description,
        contactName: invoice.contactName,
        contactEmail: invoice.contactEmail,
        contactPhone: invoice.contactPhone,
        contactAddress: invoice.contactAddress,
        contactExtra: invoice.contactExtra,
        supplierName: invoice.supplier?.name,
        items: invoice.items || [],
      },
      theme,
      bannerSrc: resolvePdfImage(theme.bannerUrl, baseUrl),
      logoSrc: resolvePdfImage(theme.logoUrl, baseUrl),
      signatureSrc: resolvePdfImage(
        invoice.signatureImage || invoiceSignature?.imageUrl || theme.signature.imageUrl,
        baseUrl,
      ),
    });

    if (searchParams.get('html') === '1') {
      return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    console.info('Invoice PDF html bytes', html.length, invoice.number);
    const pdfBuffer = await convertHtmlToPdf(html, { baseUrl });
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${invoice.number}.pdf"`,
      },
    });
  } catch (error: unknown) {
    if (error instanceof InvoicePdfError) {
      console.error('Invoice PDF error:', error.message);
      return jsonError(error.message, error.status);
    }
    console.error('Invoice PDF error:', error);
    return jsonError('Error interno', 500);
  }
}
