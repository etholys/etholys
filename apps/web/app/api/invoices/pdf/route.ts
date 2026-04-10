export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

function fmt(amount: number, currency: string = 'USD') {
  return new Intl.NumberFormat('es-UY', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount ?? 0);
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const invoiceId = searchParams.get('id');
    if (!invoiceId) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { items: { orderBy: { order: 'asc' } }, company: true, supplier: true },
    });
    if (!invoice) return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 });

    const isReceivable = invoice.type === 'RECEIVABLE';
    const title = isReceivable ? 'FACTURA' : 'FACTURA DE COMPRA';
    const statusLabel: Record<string, string> = {
      DRAFT: 'Borrador', SENT: 'Enviada', PAID: 'Pagada', OVERDUE: 'Vencida', CANCELLED: 'Cancelada'
    };

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
  body { font-family: 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 40px; color: #1a1a1a; font-size: 13px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; border-bottom: 3px solid #0D9488; padding-bottom: 20px; }
  .company-name { font-size: 22px; font-weight: 700; color: #0D9488; }
  .invoice-title { font-size: 28px; font-weight: 700; color: #374151; text-align: right; }
  .invoice-number { font-size: 14px; color: #6B7280; text-align: right; }
  .status { display: inline-block; padding: 4px 12px; border-radius: 4px; font-weight: 600; font-size: 12px; }
  .status-PAID { background: #D1FAE5; color: #065F46; }
  .status-SENT { background: #DBEAFE; color: #1E40AF; }
  .status-DRAFT { background: #F3F4F6; color: #374151; }
  .status-OVERDUE { background: #FEE2E2; color: #991B1B; }
  .status-CANCELLED { background: #F3F4F6; color: #6B7280; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
  .info-box { background: #F9FAFB; padding: 16px; border-radius: 8px; }
  .info-label { font-size: 11px; text-transform: uppercase; color: #6B7280; font-weight: 600; margin-bottom: 4px; }
  .info-value { font-size: 14px; font-weight: 500; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  th { background: #F3F4F6; padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; color: #6B7280; font-weight: 600; }
  td { padding: 10px 12px; border-bottom: 1px solid #E5E7EB; }
  .text-right { text-align: right; }
  .totals { margin-left: auto; width: 280px; }
  .total-row { display: flex; justify-content: space-between; padding: 6px 0; }
  .total-final { font-size: 18px; font-weight: 700; border-top: 2px solid #0D9488; padding-top: 8px; margin-top: 4px; }
  .notes { background: #FFFBEB; padding: 12px; border-radius: 6px; margin-top: 20px; font-size: 12px; }
  .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #9CA3AF; }
</style></head><body>
  <div class="header">
    <div>
      <div class="company-name">${invoice.company?.name || 'Empresa'}</div>
      <div style="color:#6B7280;margin-top:4px;">${invoice.company?.description || ''}</div>
    </div>
    <div>
      <div class="invoice-title">${title}</div>
      <div class="invoice-number">${invoice.number}</div>
      <div style="text-align:right;margin-top:6px;"><span class="status status-${invoice.status}">${statusLabel[invoice.status] || invoice.status}</span></div>
    </div>
  </div>
  <div class="info-grid">
    <div class="info-box">
      <div class="info-label">${isReceivable ? 'Cliente' : 'Proveedor'}</div>
      <div class="info-value">${invoice.contactName || invoice.supplier?.name || '—'}</div>
      <div style="color:#6B7280;font-size:12px;">${invoice.contactEmail || ''}</div>
    </div>
    <div class="info-box">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <div><div class="info-label">Fecha emisión</div><div class="info-value">${new Date(invoice.issueDate).toLocaleDateString('es-UY')}</div></div>
        <div><div class="info-label">Fecha vencimiento</div><div class="info-value">${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('es-UY') : '—'}</div></div>
        ${invoice.paidDate ? `<div><div class="info-label">Fecha pago</div><div class="info-value">${new Date(invoice.paidDate).toLocaleDateString('es-UY')}</div></div>` : ''}
      </div>
    </div>
  </div>
  <table>
    <thead><tr><th>#</th><th>Descripción</th><th class="text-right">Cant.</th><th class="text-right">Precio Unit.</th><th class="text-right">Total</th></tr></thead>
    <tbody>
      ${(invoice.items || []).map((item: any, i: number) => `<tr><td>${i + 1}</td><td>${item.description}</td><td class="text-right">${item.quantity}</td><td class="text-right">${fmt(item.unitPrice, invoice.currency)}</td><td class="text-right">${fmt(item.total, invoice.currency)}</td></tr>`).join('')}
    </tbody>
  </table>
  <div class="totals">
    <div class="total-row"><span>Subtotal</span><span>${fmt(invoice.subtotal, invoice.currency)}</span></div>
    <div class="total-row"><span>IVA (${invoice.taxRate}%)</span><span>${fmt(invoice.taxAmount, invoice.currency)}</span></div>
    <div class="total-row total-final"><span>TOTAL</span><span>${fmt(invoice.total, invoice.currency)}</span></div>
  </div>
  ${invoice.notes ? `<div class="notes"><strong>Notas:</strong> ${invoice.notes}</div>` : ''}
  ${invoice.description ? `<div style="margin-top:10px;color:#6B7280;font-size:12px;">${invoice.description}</div>` : ''}
  <div class="footer">Generado por ATLAS ERP &mdash; ETHOLYS</div>
</body></html>`;

    // Use Abacus PDF API
    const apiKey = process.env.HTML2PDF_API_KEY || process.env.ABACUSAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'PDF API not configured' }, { status: 500 });

    const createRes = await fetch('https://api.abacus.ai/api/createConvertHtmlToPdfRequest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
      body: JSON.stringify({ html, base_url: process.env.NEXTAUTH_URL || 'https://etholys.abacusai.app' }),
    });
    const createData = await createRes.json();
    if (!createData?.success) return NextResponse.json({ error: 'Error al crear PDF' }, { status: 500 });
    const requestId = createData.result;

    // Poll for completion
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const checkRes = await fetch('https://api.abacus.ai/api/getConvertHtmlToPdfRequestResult', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
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
  } catch (error: any) {
    console.error('Invoice PDF error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
