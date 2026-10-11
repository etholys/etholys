export const dynamic = 'force-dynamic';

import fs from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { buildInvoicePdfHtml } from '@/lib/atlas/invoice-pdf-html';
import { loadInvoiceTheme } from '@/lib/atlas/invoice-theme-store';

function resolvePdfImage(src: string, baseUrl: string): string {
  const s = String(src || '').trim();
  if (!s) return '';
  if (s.startsWith('data:')) return s;
  if (s.startsWith('/')) {
    const abs = path.join(process.cwd(), 'public', s.replace(/^\//, '').replace(/\//g, path.sep));
    try {
      const buf = fs.readFileSync(abs);
      const lower = s.toLowerCase();
      const mime = lower.endsWith('.png')
        ? 'image/png'
        : lower.endsWith('.webp')
          ? 'image/webp'
          : lower.endsWith('.svg')
            ? 'image/svg+xml'
            : 'image/jpeg';
      return `data:${mime};base64,${buf.toString('base64')}`;
    } catch {
      return `${baseUrl.replace(/\/$/, '')}${s}`;
    }
  }
  return s;
}

export async function GET(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const invoiceId = searchParams.get('id');
    if (!invoiceId) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { items: { orderBy: { order: 'asc' } }, company: true, supplier: true },
    });
    if (!invoice || !tenant.companyIds.includes(invoice.companyId)) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 });
    }

    const theme = await loadInvoiceTheme(invoice.companyId);
    const baseUrl = process.env.NEXTAUTH_URL || 'https://forge.etholys.com';
    const html = buildInvoicePdfHtml({
      invoice: {
        number: invoice.number,
        type: invoice.type,
        status: invoice.status,
        currency: invoice.currency,
        altCurrency: invoice.altCurrency,
        exchangeRate: invoice.exchangeRate,
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
      signatureSrc: resolvePdfImage(theme.signature.imageUrl, baseUrl),
    });

    if (searchParams.get('html') === '1') {
      return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    const apiKey = process.env.HTML2PDF_API_KEY || process.env.ABACUSAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'PDF API not configured' }, { status: 500 });

    const createRes = await fetch('https://api.abacus.ai/api/createConvertHtmlToPdfRequest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: apiKey },
      body: JSON.stringify({ html, base_url: baseUrl }),
    });
    const createData = await createRes.json();
    if (!createData?.success) return NextResponse.json({ error: 'Error al crear PDF' }, { status: 500 });
    const requestId = createData.result;

    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const checkRes = await fetch('https://api.abacus.ai/api/getConvertHtmlToPdfRequestResult', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: apiKey },
        body: JSON.stringify({ request_id: requestId }),
      });
      const checkData = await checkRes.json();
      if (checkData?.result?.status === 'COMPLETE' && checkData.result.downloadUrl) {
        const pdfRes = await fetch(checkData.result.downloadUrl);
        const pdfBuffer = await pdfRes.arrayBuffer();
        return new NextResponse(pdfBuffer, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${invoice.number}.pdf"`,
          },
        });
      }
      if (checkData?.result?.status === 'FAILED') break;
    }
    return NextResponse.json({ error: 'Timeout generando PDF' }, { status: 500 });
  } catch (error: unknown) {
    console.error('Invoice PDF error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
