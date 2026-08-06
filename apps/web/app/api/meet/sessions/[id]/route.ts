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

function isMeetOwner(
  session: { createdById: string | null; participants: { userId: string | null; role: string }[] },
  userId: string,
): boolean {
  if (session.createdById === userId) return true;
  return session.participants.some((p) => p.userId === userId && (p.role === 'host' || p.role === 'cohost'));
}

/** Atualiza metadados / status da sessão. */
export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { id } = await ctx.params;
    const body = (await req.json()) as {
      companyId?: string;
      status?: string;
      title?: string;
      description?: string | null;
      scheduledAt?: string | null;
      endsAt?: string | null;
      recordingUrl?: string | null;
      transcriptText?: string | null;
    };
    const companyId = body.companyId?.trim();
    if (!companyId || !tenant.companyIds.includes(companyId)) {
      return NextResponse.json({ error: 'companyId inválido' }, { status: 400 });
    }

    const existing = await getMeetSessionForCompany(id, companyId);
    if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    const editingMeta =
      body.title !== undefined ||
      body.description !== undefined ||
      body.scheduledAt !== undefined ||
      body.endsAt !== undefined;
    if (editingMeta && !isMeetOwner(existing, tenant.userId)) {
      return NextResponse.json({ error: 'Só o organizador pode editar' }, { status: 403 });
    }

    const data: {
      status?: string;
      title?: string;
      description?: string | null;
      scheduledAt?: Date | null;
      endsAt?: Date | null;
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

    if (typeof body.title === 'string') {
      const title = body.title.trim().slice(0, 200);
      if (!title) return NextResponse.json({ error: 'title requerido' }, { status: 400 });
      data.title = title;
    }
    if (body.description !== undefined) {
      data.description =
        typeof body.description === 'string' ? body.description.trim().slice(0, 8000) || null : null;
    }
    if (body.scheduledAt !== undefined) {
      if (body.scheduledAt === null || body.scheduledAt === '') {
        data.scheduledAt = null;
      } else {
        const starts = new Date(body.scheduledAt);
        if (!Number.isFinite(starts.getTime())) {
          return NextResponse.json({ error: 'scheduledAt inválido' }, { status: 400 });
        }
        data.scheduledAt = starts;
      }
    }
    if (body.endsAt !== undefined) {
      if (body.endsAt === null || body.endsAt === '') {
        data.endsAt = null;
      } else {
        const ends = new Date(body.endsAt);
        if (!Number.isFinite(ends.getTime())) {
          return NextResponse.json({ error: 'endsAt inválido' }, { status: 400 });
        }
        data.endsAt = ends;
      }
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
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        participants: {
          orderBy: { invitedAt: 'asc' },
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    });
    return NextResponse.json({ session });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** Apaga a reunião (só organizador / host). */
export async function DELETE(req: Request, ctx: Ctx) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { id } = await ctx.params;
    const companyId = new URL(req.url).searchParams.get('companyId')?.trim();
    if (!companyId || !tenant.companyIds.includes(companyId)) {
      return NextResponse.json({ error: 'companyId inválido' }, { status: 400 });
    }

    const existing = await getMeetSessionForCompany(id, companyId);
    if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    if (!isMeetOwner(existing, tenant.userId)) {
      return NextResponse.json({ error: 'Só o organizador pode apagar' }, { status: 403 });
    }

    await prisma.meetSession.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
