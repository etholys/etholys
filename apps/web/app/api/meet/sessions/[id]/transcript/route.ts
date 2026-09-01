export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getUserCompanyIds } from '@/lib/tenant';
import { getMeetSessionForCompany, isMeetSessionOwner } from '@/lib/meet/create-session';
import { prisma } from '@/lib/prisma';

type Ctx = { params: Promise<{ id: string }> };

function renderTranscript(
  rows: Array<{ participantName: string; text: string; startedAt: Date }>,
): string {
  return rows
    .map((row) => {
      const time = row.startedAt.toISOString().slice(11, 19);
      return `[${time}] ${row.participantName}: ${row.text}`;
    })
    .join('\n');
}

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

    const segments = await prisma.meetTranscriptSegment.findMany({
      where: { sessionId: id },
      orderBy: [{ startedAt: 'asc' }, { createdAt: 'asc' }],
      take: 5000,
    });

    const whisperSegments = segments.filter((s) => s.messageId.startsWith('chorus-whisper-'));
    const displaySegments = whisperSegments.length > 0 ? whisperSegments : segments;

    return NextResponse.json({
      segments: displaySegments,
      transcriptText: renderTranscript(displaySegments),
      source: whisperSegments.length > 0 ? 'whisper' : 'live',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Persiste apenas chunks finais emitidos por transcriptionChunkReceived (Jigasi). */
export async function POST(req: Request, ctx: Ctx) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { id } = await ctx.params;
    const body = (await req.json()) as {
      companyId?: string;
      messageId?: string;
      participantId?: string;
      participantName?: string;
      language?: string;
      text?: string;
      startedAt?: string;
    };
    const companyId = body.companyId?.trim();
    if (!companyId || !tenant.companyIds.includes(companyId)) {
      return NextResponse.json({ error: 'companyId inválido' }, { status: 400 });
    }
    const session = await getMeetSessionForCompany(id, companyId);
    if (!session) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    const messageId = body.messageId?.trim().slice(0, 200);
    const text = body.text?.trim().slice(0, 20_000);
    if (!messageId || !text) {
      return NextResponse.json({ error: 'messageId e text obrigatórios' }, { status: 400 });
    }
    const storedMessageId = messageId.startsWith('live-jigasi-')
      ? messageId
      : `live-jigasi-${messageId}`;
    const participantName =
      body.participantName?.trim().slice(0, 200) || 'Participante';
    const parsedDate = body.startedAt ? new Date(body.startedAt) : new Date();
    const startedAt = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;

    const segment = await prisma.meetTranscriptSegment.upsert({
      where: { sessionId_messageId: { sessionId: id, messageId: storedMessageId } },
      create: {
        sessionId: id,
        messageId: storedMessageId,
        participantId: body.participantId?.trim().slice(0, 200) || null,
        participantName,
        language: body.language?.trim().slice(0, 20) || null,
        text,
        startedAt,
      },
      update: {
        participantId: body.participantId?.trim().slice(0, 200) || null,
        participantName,
        language: body.language?.trim().slice(0, 20) || null,
        text,
      },
    });

    // Mantém o campo legado sincronizado para resumo/finalização e exportação simples.
    const rows = await prisma.meetTranscriptSegment.findMany({
      where: { sessionId: id },
      orderBy: [{ startedAt: 'asc' }, { createdAt: 'asc' }],
      select: { participantName: true, text: true, startedAt: true, messageId: true },
      take: 5000,
    });
    const whisperRows = rows.filter((r) => r.messageId.startsWith('chorus-whisper-'));
    const syncRows = (whisperRows.length > 0 ? whisperRows : rows).map(
      ({ participantName, text, startedAt }) => ({ participantName, text, startedAt }),
    );
    await prisma.meetSession.update({
      where: { id },
      data: { transcriptText: renderTranscript(syncRows).slice(0, 100_000) },
    });

    return NextResponse.json({ segment });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno';
    console.error('[meet/transcript]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Apaga transcrição e segmentos (só organizador). Opcionalmente limpa o resumo derivado. */
export async function DELETE(req: Request, ctx: Ctx) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { id } = await ctx.params;
    const url = new URL(req.url);
    const companyId = url.searchParams.get('companyId')?.trim();
    const clearSummary = url.searchParams.get('clearSummary') === '1';
    if (!companyId || !tenant.companyIds.includes(companyId)) {
      return NextResponse.json({ error: 'companyId inválido' }, { status: 400 });
    }

    const session = await getMeetSessionForCompany(id, companyId);
    if (!session) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    if (!isMeetSessionOwner(session, tenant.userId)) {
      return NextResponse.json({ error: 'Só o organizador pode apagar' }, { status: 403 });
    }

    await prisma.meetTranscriptSegment.deleteMany({ where: { sessionId: id } });
    await prisma.meetSession.update({
      where: { id },
      data: {
        transcriptText: null,
        ...(clearSummary ? { summaryText: null } : {}),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
