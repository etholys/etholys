import fs from 'node:fs';
import path from 'node:path';

const MAX_EMBED_BYTES = 400_000;

export class InvoicePdfError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = 'InvoicePdfError';
    this.status = status;
  }
}

export function resolvePdfImage(src: string, baseUrl: string, readFile?: (abs: string) => Buffer): string {
  const s = String(src || '').trim();
  if (!s) return '';
  if (s.startsWith('data:')) {
    return s.length > MAX_EMBED_BYTES * 1.4 ? '' : s;
  }
  if (s.startsWith('/')) {
    const abs = path.join(process.cwd(), 'public', s.replace(/^\//, '').replace(/\//g, path.sep));
    try {
      const buf = readFile ? readFile(abs) : fs.readFileSync(abs);
      if (buf.length > MAX_EMBED_BYTES) {
        return `${baseUrl.replace(/\/$/, '')}${s}`;
      }
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

type FetchLike = typeof fetch;

export async function convertHtmlToPdf(
  html: string,
  opts?: { fetchImpl?: FetchLike; apiKey?: string | null; baseUrl?: string; sleepMs?: number },
): Promise<Buffer> {
  const apiKey = opts?.apiKey ?? process.env.HTML2PDF_API_KEY ?? process.env.ABACUSAI_API_KEY;
  if (!apiKey) throw new InvoicePdfError('PDF API not configured', 500);
  const doFetch = opts?.fetchImpl || fetch;
  const baseUrl = opts?.baseUrl || process.env.NEXTAUTH_URL || 'https://app.etholys.com';

  const createRes = await doFetch('https://apps.abacus.ai/api/createConvertHtmlToPdfRequest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deployment_token: apiKey,
      html_content: html,
      pdf_options: {
        format: 'Letter',
        print_background: true,
        margin: { top: '0.3in', right: '0.4in', bottom: '0.3in', left: '0.4in' },
      },
      base_url: baseUrl,
    }),
  });
  const createText = await createRes.text();
  let createData: { request_id?: string; result?: string; success?: boolean } = {};
  try {
    createData = JSON.parse(createText) as typeof createData;
  } catch {
    console.error('Invoice PDF create: non-JSON', createRes.status, createText.slice(0, 240));
    throw new InvoicePdfError('Error al crear PDF', 500);
  }
  const requestId = createData.request_id || (typeof createData.result === 'string' ? createData.result : '');
  if (!createRes.ok || !requestId) {
    console.error('Invoice PDF create failed:', createRes.status, createText.slice(0, 240));
    throw new InvoicePdfError('Error al crear PDF', 500);
  }

  for (let i = 0; i < 60; i++) {
    const wait = opts?.sleepMs ?? 1000;
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    const statusRes = await doFetch('https://apps.abacus.ai/api/getConvertHtmlToPdfStatus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request_id: requestId, deployment_token: apiKey }),
    });
    const statusData = (await statusRes.json()) as {
      status?: string;
      result?: { result?: string };
    };
    if (statusData?.status === 'SUCCESS' && statusData.result?.result) {
      return Buffer.from(statusData.result.result, 'base64');
    }
    if (statusData?.status === 'FAILED') {
      console.error('Invoice PDF convert failed:', requestId);
      throw new InvoicePdfError('Error al crear PDF', 500);
    }
  }
  throw new InvoicePdfError('Timeout generando PDF', 500);
}
