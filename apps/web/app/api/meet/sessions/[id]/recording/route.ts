export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getUserCompanyIds } from '@/lib/tenant';
import { getMeetSessionForCompany } from '@/lib/meet/create-session';
import { prisma } from '@/lib/prisma';
import {
  isMeetRecordingStorageReady,
  presignMeetRecordingUpload,
  resolveMeetRecordingUrl,
} from '@/lib/meet/recording-storage';

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET — estado de storage + recordingUrl actual
 * POST — presign upload OU confirmar storageKey/recordingUrl
 */
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

    return NextResponse.json({
      recordingUrl: session.recordingUrl,
      storageReady: isMeetRecordingStorageReady(),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request, ctx: Ctx) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { id } = await ctx.params;
    const body = (await req.json()) as {
      companyId?: string;
      action?: 'presign' | 'confirm';
      fileName?: string;
      contentType?: string;
      storageKey?: string;
      recordingUrl?: string;
    };

    const companyId = body.companyId?.trim();
    if (!companyId || !tenant.companyIds.includes(companyId)) {
      return NextResponse.json({ error: 'companyId inválido' }, { status: 400 });
    }

    const session = await getMeetSessionForCompany(id, companyId);
    if (!session) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    const action = body.action || 'presign';

    if (action === 'presign') {
      if (!isMeetRecordingStorageReady()) {
        return NextResponse.json(
          { error: 'Armazenamento de gravações indisponível de momento.' },
          { status: 503 },
        );
      }
      const fileName = (body.fileName || `meet-${id}.webm`).trim();
      const contentType = (body.contentType || 'video/webm').trim();
      const signed = await presignMeetRecordingUpload({
        sessionId: id,
        fileName,
        contentType,
      });
      return NextResponse.json(signed);
    }

    if (action === 'confirm') {
      let recordingUrl = body.recordingUrl?.trim() || '';
      if (!recordingUrl && body.storageKey?.trim()) {
        recordingUrl = await resolveMeetRecordingUrl(body.storageKey.trim());
      }
      if (!recordingUrl) {
        return NextResponse.json({ error: 'recordingUrl ou storageKey obrigatório' }, { status: 400 });
      }
      const updated = await prisma.meetSession.update({
        where: { id },
        data: { recordingUrl: recordingUrl.slice(0, 2000) },
        select: { id: true, recordingUrl: true },
      });
      return NextResponse.json({ session: updated });
    }

    return NextResponse.json({ error: 'action inválida' }, { status: 400 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error interno';
    console.error('[meet/recording]', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
