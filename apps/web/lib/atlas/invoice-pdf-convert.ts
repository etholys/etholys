import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

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

export function findChromiumBin(exists: (p: string) => boolean = fs.existsSync): string {
  const env = String(process.env.CHROMIUM_PATH || '').trim();
  if (env && exists(env)) return env;
  const localApp = process.env.LOCALAPPDATA || '';
  const candidates = [
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    localApp ? path.join(localApp, 'Google', 'Chrome', 'Application', 'chrome.exe') : '',
  ].filter(Boolean);
  return candidates.find((p) => exists(p)) || '';
}

export function invoicePdfRemoteError(status: number, body: string): string {
  let remote = '';
  try {
    const data = JSON.parse(body) as { error?: unknown; message?: unknown };
    remote = String(data.error || data.message || '').trim();
  } catch {
    remote = '';
  }
  if (status === 402 || /subscription has ended/i.test(remote)) {
    return 'Servicio PDF no disponible';
  }
  if (
    remote
    && remote.length <= 160
    && !/[={}]/.test(remote)
    && !/token|apikey|secret|sk-/i.test(remote)
  ) {
    return remote;
  }
  return 'Error al crear PDF';
}

type SpawnLike = (
  command: string,
  args: string[],
  options?: { stdio?: unknown; env?: NodeJS.ProcessEnv },
) => ChildProcess;

async function runChromiumPrint(opts: {
  bin: string;
  htmlPath: string;
  pdfPath: string;
  headlessArgs: string[];
  spawnFn: SpawnLike;
  timeoutMs: number;
}): Promise<void> {
  const fileUrl = pathToFileURL(opts.htmlPath).href;
  const args = [
    ...opts.headlessArgs,
    '--disable-gpu',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-software-rasterizer',
    '--hide-scrollbars',
    '--font-render-hinting=none',
    '--no-first-run',
    '--no-default-browser-check',
    '--no-pdf-header-footer',
    `--print-to-pdf=${opts.pdfPath}`,
    fileUrl,
  ];
  await new Promise<void>((resolve, reject) => {
    const child = opts.spawnFn(opts.bin, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });
    let stderr = '';
    child.stderr?.on('data', (chunk) => {
      stderr += String(chunk).slice(0, 2000);
    });
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new InvoicePdfError('Timeout generando PDF', 500));
    }, opts.timeoutMs);
    child.on('error', () => {
      clearTimeout(timer);
      reject(new InvoicePdfError('Error al crear PDF', 500));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      try {
        if (code === 0 && fs.existsSync(opts.pdfPath) && fs.statSync(opts.pdfPath).size > 80) {
          resolve();
          return;
        }
      } catch {
        /* fall through */
      }
      console.error('Invoice PDF chromium exit', code, stderr.slice(0, 400));
      reject(new InvoicePdfError('Error al crear PDF', 500));
    });
  });
}

export async function printHtmlWithChromium(
  html: string,
  opts?: {
    chromiumBin?: string;
    spawnFn?: SpawnLike;
    timeoutMs?: number;
  },
): Promise<Buffer> {
  const bin = opts?.chromiumBin || findChromiumBin();
  if (!bin) throw new InvoicePdfError('PDF renderer not installed', 500);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-inv-pdf-'));
  const htmlPath = path.join(dir, 'invoice.html');
  const pdfPath = path.join(dir, 'invoice.pdf');
  try {
    fs.writeFileSync(htmlPath, html, 'utf8');
    const spawnFn = opts?.spawnFn || spawn;
    const timeoutMs = opts?.timeoutMs ?? 25000;
    try {
      await runChromiumPrint({
        bin,
        htmlPath,
        pdfPath,
        headlessArgs: ['--headless=new'],
        spawnFn,
        timeoutMs,
      });
    } catch (first) {
      if (first instanceof InvoicePdfError && first.message === 'Timeout generando PDF') throw first;
      await runChromiumPrint({
        bin,
        htmlPath,
        pdfPath,
        headlessArgs: ['--headless', '--print-to-pdf-no-header'],
        spawnFn,
        timeoutMs,
      }).catch(() => {
        throw first;
      });
    }
    const pdf = fs.readFileSync(pdfPath);
    if (pdf.subarray(0, 4).toString() !== '%PDF') {
      throw new InvoicePdfError('Error al crear PDF', 500);
    }
    return pdf;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function convertViaAbacus(
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
    throw new InvoicePdfError(invoicePdfRemoteError(createRes.status, createText), 500);
  }
  const requestId = createData.request_id || (typeof createData.result === 'string' ? createData.result : '');
  if (!createRes.ok || !requestId) {
    console.error('Invoice PDF create failed:', createRes.status, createText.slice(0, 240));
    throw new InvoicePdfError(invoicePdfRemoteError(createRes.status, createText), 500);
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
      error?: string;
    };
    if (statusData?.status === 'SUCCESS' && statusData.result?.result) {
      return Buffer.from(statusData.result.result, 'base64');
    }
    if (statusData?.status === 'FAILED') {
      console.error('Invoice PDF convert failed:', requestId, statusData.error || '');
      throw new InvoicePdfError(
        invoicePdfRemoteError(500, JSON.stringify({ error: statusData.error || 'Error al crear PDF' })),
        500,
      );
    }
  }
  throw new InvoicePdfError('Timeout generando PDF', 500);
}

export async function convertHtmlToPdf(
  html: string,
  opts?: {
    fetchImpl?: FetchLike;
    apiKey?: string | null;
    baseUrl?: string;
    sleepMs?: number;
    chromiumBin?: string;
    printImpl?: (html: string) => Promise<Buffer>;
    spawnFn?: SpawnLike;
    timeoutMs?: number;
  },
): Promise<Buffer> {
  if (opts?.printImpl) {
    const pdf = await opts.printImpl(html);
    console.info('Invoice PDF via local printer', pdf.length);
    return pdf;
  }

  const chromiumBin = opts?.chromiumBin === undefined ? findChromiumBin() : opts.chromiumBin;
  if (chromiumBin) {
    const pdf = await printHtmlWithChromium(html, {
      chromiumBin,
      spawnFn: opts?.spawnFn,
      timeoutMs: opts?.timeoutMs,
    });
    console.info('Invoice PDF via chromium', pdf.length);
    return pdf;
  }

  console.info('Invoice PDF via remote converter', html.length);
  return convertViaAbacus(html, opts);
}
