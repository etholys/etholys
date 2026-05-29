export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';

const CATEGORY = 'hub_prism_mvp';
const KEY = 'evidence_ledger_v1';
const MAX_ITEMS = 50;

type PrismItem = { id: string; indicator: string; link: string; projectLabel?: string; at: string };
type PrismPayload = { items: PrismItem[] };

function parsePayload(raw: string | null | undefined): PrismPayload {
  if (!raw) return { items: [] };
  try {
    const d = JSON.parse(raw) as { items?: unknown };
    if (!d || !Array.isArray(d.items)) return { items: [] };
    const items: PrismItem[] = [];
    for (const it of d.items) {
      if (!it || typeof it !== 'object') continue;
      const o = it as Record<string, unknown>;
      if (typeof o.id === 'string' && typeof o.indicator === 'string' && typeof o.link === 'string' && typeof o.at === 'string') {
        items.push({
          id: o.id,
          indicator: o.indicator.slice(0, 500),
          link: o.link.slice(0, 2000),
          projectLabel: typeof o.projectLabel === 'string' ? o.projectLabel.slice(0, 300) : undefined,
          at: o.at,
        });
      }
    }
    return { items: items.slice(0, MAX_ITEMS) };
  } catch {
    return { items: [] };
  }
}

async function readLedger(companyId: string): Promise<PrismPayload> {
  const row = await prisma.aiCompanyMemory.findFirst({
    where: { companyId, category: CATEGORY, key: KEY },
  });
  return parsePayload(row?.value);
}

function resolveCompanyId(tenant: { companyIds: string[] }, requested: string | null): string | null {
  const c = requested?.trim();
  if (c && tenant.companyIds.includes(c)) return c;
  return tenant.companyIds[0] || null;
}

function looksLikeUrl(s: string) {
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const companyId = resolveCompanyId(tenant, req.nextUrl.searchParams.get('companyId'));
    if (!companyId) return NextResponse.json({ error: 'Sem empresa' }, { status: 400 });
    const data = await readLedger(companyId);
    return NextResponse.json({ companyId, ...data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const body = (await req.json()) as { companyId?: string; indicator?: string; link?: string; projectLabel?: string };
    const companyId = resolveCompanyId(tenant, body.companyId ?? null);
    if (!companyId) return NextResponse.json({ error: 'Sem empresa' }, { status: 400 });

    const indicator = typeof body.indicator === 'string' ? body.indicator.trim() : '';
    const link = typeof body.link === 'string' ? body.link.trim() : '';
    if (!indicator) return NextResponse.json({ error: 'indicator é obrigatório' }, { status: 400 });
    if (!link) return NextResponse.json({ error: 'link é obrigatório' }, { status: 400 });
    if (!looksLikeUrl(link)) {
      return NextResponse.json({ error: 'Indique um link http(s) válido' }, { status: 400 });
    }

    const projectLabel = typeof body.projectLabel === 'string' ? body.projectLabel.trim() : undefined;
    const now = new Date().toISOString();
    const nextItem: PrismItem = {
      id: randomUUID(),
      indicator: indicator.slice(0, 500),
      link: link.slice(0, 2000),
      projectLabel: projectLabel ? projectLabel.slice(0, 300) : undefined,
      at: now,
    };

    const cur = await readLedger(companyId);
    const items = [nextItem, ...cur.items].slice(0, MAX_ITEMS);
    const value = JSON.stringify({ items } satisfies PrismPayload);

    const existing = await prisma.aiCompanyMemory.findFirst({
      where: { companyId, category: CATEGORY, key: KEY },
    });

    if (existing) {
      await prisma.aiCompanyMemory.update({
        where: { id: existing.id },
        data: { value, source: `hub-prism:${tenant.userId}` },
      });
    } else {
      await prisma.aiCompanyMemory.create({
        data: { companyId, category: CATEGORY, key: KEY, value, source: `hub-prism:${tenant.userId}` },
      });
    }

    return NextResponse.json({ ok: true, item: nextItem, items });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
