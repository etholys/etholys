export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';

const CATEGORY = 'hub_forge_mvp';
const KEY = 'innovation_ledger_v1';
const MAX_ITEMS = 50;

type ForgeItem = { id: string; title: string; phase: string; note?: string; at: string };
type ForgePayload = { items: ForgeItem[] };

function parsePayload(raw: string | null | undefined): ForgePayload {
  if (!raw) return { items: [] };
  try {
    const d = JSON.parse(raw) as { items?: unknown };
    if (!d || !Array.isArray(d.items)) return { items: [] };
    const items: ForgeItem[] = [];
    for (const it of d.items) {
      if (!it || typeof it !== 'object') continue;
      const o = it as Record<string, unknown>;
      if (typeof o.id === 'string' && typeof o.title === 'string' && typeof o.phase === 'string' && typeof o.at === 'string') {
        items.push({
          id: o.id,
          title: o.title.slice(0, 500),
          phase: o.phase.slice(0, 120),
          note: typeof o.note === 'string' ? o.note.slice(0, 2000) : undefined,
          at: o.at,
        });
      }
    }
    return { items: items.slice(0, MAX_ITEMS) };
  } catch {
    return { items: [] };
  }
}

async function readLedger(companyId: string): Promise<ForgePayload> {
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

    const body = (await req.json()) as { companyId?: string; title?: string; phase?: string; note?: string };
    const companyId = resolveCompanyId(tenant, body.companyId ?? null);
    if (!companyId) return NextResponse.json({ error: 'Sem empresa' }, { status: 400 });

    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const phase = typeof body.phase === 'string' ? body.phase.trim() : '';
    if (!title) return NextResponse.json({ error: 'title é obrigatório' }, { status: 400 });
    if (!phase) return NextResponse.json({ error: 'phase é obrigatório' }, { status: 400 });

    const note = typeof body.note === 'string' ? body.note.trim() : undefined;
    const now = new Date().toISOString();
    const nextItem: ForgeItem = {
      id: randomUUID(),
      title: title.slice(0, 500),
      phase: phase.slice(0, 120),
      note: note ? note.slice(0, 2000) : undefined,
      at: now,
    };

    const cur = await readLedger(companyId);
    const items = [nextItem, ...cur.items].slice(0, MAX_ITEMS);
    const value = JSON.stringify({ items } satisfies ForgePayload);

    const existing = await prisma.aiCompanyMemory.findFirst({
      where: { companyId, category: CATEGORY, key: KEY },
    });

    if (existing) {
      await prisma.aiCompanyMemory.update({
        where: { id: existing.id },
        data: { value, source: `hub-forge:${tenant.userId}` },
      });
    } else {
      await prisma.aiCompanyMemory.create({
        data: { companyId, category: CATEGORY, key: KEY, value, source: `hub-forge:${tenant.userId}` },
      });
    }

    return NextResponse.json({ ok: true, item: nextItem, items });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
