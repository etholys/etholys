export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getUserCompanyIds } from '@/lib/tenant';
import { getMeetSessionForCompany } from '@/lib/meet/create-session';
import { prisma } from '@/lib/prisma';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { id } = await ctx.params;
    const companyId = new URL(req.url).searchParams.get('companyId')?.trim();
    if (!companyId || !tenant.companyIds.includes(companyId)) {
      return NextResponse.json({ error: 'companyId inválido' }, { status: 400 });
    }

    const session = await getMeetSessionForCompany(id, companyId);
    if (!session) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    return NextResponse.json({ session });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** Marca sessão como live ou ended */
export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { id } = await ctx.params;
    const body = (await req.json()) as {
      companyId?: string;
      status?: string;
      recordingUrl?: string | null;
      transcriptText?: string | null;
    };
    const companyId = body.companyId?.trim();
    if (!companyId || !tenant.companyIds.includes(companyId)) {
      return NextResponse.json({ error: 'companyId inválido' }, { status: 400 });
    }

    const existing = await getMeetSessionForCompany(id, companyId);
    if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    const data: {
      status?: string;
      startedAt?: Date;
      endedAt?: Date;
      recordingUrl?: string | null;
      transcriptText?: string | null;
    } = {};

    const status = body.status?.trim();
    if (status) {
      if (!['scheduled', 'live', 'ended', 'cancelled'].includes(status)) {
        return NextResponse.json({ error: 'status inválido' }, { status: 400 });
      }
      data.status = status;
      if (status === 'live' && !existing.startedAt) data.startedAt = new Date();
      if (status === 'ended') data.endedAt = new Date();
    }

    if (body.recordingUrl !== undefined) {
      data.recordingUrl =
        typeof body.recordingUrl === 'string' ? body.recordingUrl.trim().slice(0, 2000) || null : null;
    }
    if (body.transcriptText !== undefined) {
      data.transcriptText =
        typeof body.transcriptText === 'string'
          ? body.transcriptText.trim().slice(0, 100_000) || null
          : null;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Nada para actualizar' }, { status: 400 });
    }

    const session = await prisma.meetSession.update({
      where: { id },
      data,
    });
    return NextResponse.json({ session });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
