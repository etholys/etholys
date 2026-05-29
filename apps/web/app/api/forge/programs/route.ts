export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getForgeDb } from '@/lib/forge/db';
import { requireForgeTenant, resolveForgeCompanyId } from '@/lib/forge/tenant';

export async function GET(req: NextRequest) {
  try {
    const tenant = await requireForgeTenant();
    if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const companyId = resolveForgeCompanyId(tenant, req.nextUrl.searchParams.get('companyId'));
    if (!companyId) return NextResponse.json({ error: 'Sem empresa' }, { status: 400 });

    const programs = await getForgeDb().forgeProgram.findMany({
      where: { companyId, isActive: true },
      include: {
        courses: {
          select: { id: true, title: true, status: true, coverEmoji: true },
          orderBy: { updatedAt: 'desc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json({ programs });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const tenant = await requireForgeTenant();
    if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const body = (await req.json()) as { companyId?: string; title?: string; description?: string };
    const companyId = resolveForgeCompanyId(tenant, body.companyId ?? null);
    if (!companyId) return NextResponse.json({ error: 'Sem empresa' }, { status: 400 });
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) return NextResponse.json({ error: 'title obrigatório' }, { status: 400 });

    const program = await getForgeDb().forgeProgram.create({
      data: {
        companyId,
        title: title.slice(0, 300),
        description: typeof body.description === 'string' ? body.description.slice(0, 5000) : null,
      },
    });
    return NextResponse.json({ program });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro' }, { status: 500 });
  }
}
