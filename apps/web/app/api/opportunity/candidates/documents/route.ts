export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { isSafePublicHttpUrl } from '@/lib/opportunity/call-evidence';
import { isAggregatorFundingUrl } from '@/lib/opportunity/official-url';
import { resolveOpportunityCompanyId } from '@/lib/opportunity/resolve-company';

const MAX_FILE = 12 * 1024 * 1024;
const MAX_FILES = 8;
const FETCH_MS = 20_000;

function safeName(raw: string, fallback: string): string {
  const cleaned = raw.replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, ' ').trim();
  return (cleaned || fallback).slice(0, 80);
}

async function fetchOfficialFile(url: string): Promise<{ name: string; bytes: Uint8Array; type: string } | null> {
  if (!isSafePublicHttpUrl(url) || isAggregatorFundingUrl(url)) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'Etholys-FundHub/1.0 (+https://etholys.com)' },
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > MAX_FILE) return null;
    const type = res.headers.get('content-type') || 'application/octet-stream';
    const fromUrl = decodeURIComponent(url.split('/').pop()?.split('?')[0] || 'documento');
    return { name: safeName(fromUrl, 'documento'), bytes: new Uint8Array(buf), type };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(req: NextRequest) {
  const ctx = await resolveOpportunityCompanyId(req.nextUrl.searchParams.get('companyId'));
  if (!ctx) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const body = (await req.json()) as { url?: string; urls?: string[]; zip?: boolean };
  const urls = (body.zip ? body.urls : body.url ? [body.url] : body.urls ?? [])
    .filter((u): u is string => typeof u === 'string')
    .slice(0, MAX_FILES);

  if (urls.length === 0) {
    return NextResponse.json({ error: 'url obrigatório' }, { status: 400 });
  }

  if (!body.zip && urls.length === 1) {
    const file = await fetchOfficialFile(urls[0]!);
    if (!file) return NextResponse.json({ error: 'Não foi possível descarregar o ficheiro' }, { status: 502 });
    return new NextResponse(Buffer.from(file.bytes), {
      headers: {
        'Content-Type': file.type,
        'Content-Disposition': `attachment; filename="${file.name}"`,
      },
    });
  }

  const zip = new JSZip();
  let added = 0;
  for (const url of urls) {
    const file = await fetchOfficialFile(url);
    if (!file) continue;
    const name = zip.file(file.name) ? `${added + 1}-${file.name}` : file.name;
    zip.file(name, file.bytes);
    added += 1;
  }
  if (added === 0) {
    return NextResponse.json({ error: 'Nenhum anexo oficial disponível' }, { status: 502 });
  }
  const bytes = await zip.generateAsync({ type: 'uint8array' });
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="documentos-convocatoria.zip"',
    },
  });
}
