export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getUserCompanyIds } from '@/lib/tenant';
import { getMeetSessionForCompany } from '@/lib/meet/create-session';
import { generateMeetLiveBriefing } from '@/lib/meet/live-briefing';
import { prisma } from '@/lib/prisma';

type Ctx = { params: Promise<{ id: string }> };

/**
 * Briefing leve durante a call — não cria tarefas (só hipóteses de encaminhamento).
 */
export async function POST(req: Request, ctx: Ctx) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { id } = await ctx.params;
    const body = (await req.json()) as {
      companyId?: string;
      notesSoFar?: string;
      locale?: string;
      markLive?: boolean;
    };

    const companyId = body.companyId?.trim();
    if (!companyId || !tenant.companyIds.includes(companyId)) {
      return NextResponse.json({ error: 'companyId inválido' }, { status: 400 });
    }

    const session = await getMeetSessionForCompany(id, companyId);
    if (!session) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    const notes = (body.notesSoFar || session.transcriptText || '').trim();
    if (notes.length < 15) {
      return NextResponse.json(
        { error: 'Envie notas parciais da reunião em curso (mín. ~15 caracteres)' },
        { status: 400 },
      );
    }

    const briefing = await generateMeetLiveBriefing({
      title: session.title,
      notesSoFar: notes,
      locale: body.locale,
    });

    if (body.markLive !== false && session.status === 'scheduled') {
      await prisma.meetSession.update({
        where: { id: session.id },
        data: { status: 'live', startedAt: session.startedAt ?? new Date() },
      });
    }

    return NextResponse.json({ briefing });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error interno';
    console.error('[meet/briefing]', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
