export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getUserCompanyIds } from '@/lib/tenant';
import { getMeetSessionForCompany, deleteMeetSessionScoped, updateMeetSessionScoped } from '@/lib/meet/create-session';
import { prisma } from '@/lib/prisma';
import type { MeetEditScope } from '@/lib/meet/create-session';

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
      /** this | following | series — para editar recorrências */
      editScope?: MeetEditScope;
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

    const editScope: MeetEditScope =
      body.editScope === 'following' || body.editScope === 'series' ? body.editScope : 'this';
    const editingScheduleOrMeta =
      data.title !== undefined ||
      data.description !== undefined ||
      data.scheduledAt !== undefined ||
      data.endsAt !== undefined;

    if (editingScheduleOrMeta) {
      const scoped = await updateMeetSessionScoped({
        sessionId: id,
        companyId,
        scope: editScope,
        title: data.title,
        description: data.description,
        scheduledAt: data.scheduledAt,
        endsAt: data.endsAt,
      });
      if (!scoped) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

      if (data.status || data.recordingUrl !== undefined || data.transcriptText !== undefined) {
        const session = await prisma.meetSession.update({
          where: { id },
          data: {
            ...(data.status
              ? { status: data.status, startedAt: data.startedAt, endedAt: data.endedAt }
              : {}),
            ...(data.recordingUrl !== undefined ? { recordingUrl: data.recordingUrl } : {}),
            ...(data.transcriptText !== undefined ? { transcriptText: data.transcriptText } : {}),
          },
          include: {
            createdBy: { select: { id: true, name: true, email: true } },
            participants: {
              orderBy: { invitedAt: 'asc' },
              include: { user: { select: { id: true, name: true, email: true } } },
            },
          },
        });
        return NextResponse.json({ session, editScope });
      }
      return NextResponse.json({ session: scoped, editScope });
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
    return NextResponse.json({ session, editScope: 'this' as const });
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

    const scopeParam = new URL(req.url).searchParams.get('scope')?.trim() || 'this';
    const scope =
      scopeParam === 'following' || scopeParam === 'series' ? scopeParam : 'this';

    const result = await deleteMeetSessionScoped({
      sessionId: id,
      companyId,
      scope,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
