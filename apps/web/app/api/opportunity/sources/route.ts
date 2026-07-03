export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { resolveOpportunityCompanyId } from '@/lib/opportunity/resolve-company';
import { addMonitoredSource, listMonitoredSources, removeMonitoredSource } from '@/lib/opportunity/sources';

export async function GET(req: NextRequest) {
  const ctx = await resolveOpportunityCompanyId(req.nextUrl.searchParams.get('companyId'));
  if (!ctx) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const sources = await listMonitoredSources(ctx.companyId, ctx.userId);
  return NextResponse.json({ companyId: ctx.companyId, sources });
}

export async function POST(req: NextRequest) {
  const ctx = await resolveOpportunityCompanyId(req.nextUrl.searchParams.get('companyId'));
  if (!ctx) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const body = (await req.json()) as { label?: string; url?: string; languages?: string };
  if (!body.url?.trim()) {
    return NextResponse.json({ error: 'url obrigatória' }, { status: 400 });
  }

  try {
    const source = await addMonitoredSource({
      companyId: ctx.companyId,
      userId: ctx.userId,
      label: body.label ?? '',
      url: body.url,
      languages: body.languages,
    });
    return NextResponse.json({ source }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro' }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const ctx = await resolveOpportunityCompanyId(req.nextUrl.searchParams.get('companyId'));
  if (!ctx) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const sourceId = req.nextUrl.searchParams.get('sourceId')?.trim();
  if (!sourceId) return NextResponse.json({ error: 'sourceId obrigatório' }, { status: 400 });

  try {
    await removeMonitoredSource(ctx.companyId, ctx.userId, sourceId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro' }, { status: 400 });
  }
}
