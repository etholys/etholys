export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextResponse } from 'next/server';
import { getUserCompanyIds } from '@/lib/tenant';
import { getMeetSessionForCompany } from '@/lib/meet/create-session';
import { prisma } from '@/lib/prisma';
import {
  isMeetRecordingStorageReady,
  presignMeetRecordingUpload,
  putMeetRecordingBuffer,
  resolveMeetRecordingUrl,
} from '@/lib/meet/recording-storage';

type Ctx = { params: Promise<{ id: string }> };

function readUploadBlob(form: FormData): { blob: Blob; fileName: string } | null {
  const raw = form.get('file');
  if (!raw || typeof raw === 'string') return null;
  if (!(raw instanceof Blob)) return null;
  if (raw.size <= 0) return null;
  const fileName =
    raw instanceof File && raw.name.trim() ? raw.name.trim() : 'recording.webm';
  return { blob: raw, fileName };
}

async function handleDirectUpload(req: Request, sessionId: string) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const form = await req.formData();
  const companyId = String(form.get('companyId') || '').trim();
  const upload = readUploadBlob(form);

  if (!companyId || !tenant.companyIds.includes(companyId)) {
    return NextResponse.json({ error: 'companyId inválido' }, { status: 400 });
  }
  if (!upload) {
    const raw = form.get('file');
    console.warn('[meet/recording] upload reject', {
      sessionId,
      hasFileField: raw != null,
      rawType: raw == null ? 'null' : typeof raw,
      ctor: raw && typeof raw === 'object' ? (raw as object).constructor?.name : undefined,
    });
    return NextResponse.json(
      {
        error:
          'Ficheiro de gravação obrigatório (upload interrompido ou ficheiro vazio). Para vídeos grandes, configure CORS no bucket R2 etholys-chorus e tente de novo.',
      },
      { status: 400 },
    );
  }

  const session = await getMeetSessionForCompany(sessionId, companyId);
  if (!session) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  if (!isMeetRecordingStorageReady()) {
    return NextResponse.json(
      { error: 'Armazenamento de gravações indisponível de momento.' },
      { status: 503 },
    );
  }

  const buffer = Buffer.from(await upload.blob.arrayBuffer());
  const fileName = upload.fileName;
  const contentType =
    (upload.blob instanceof File && upload.blob.type) || 'video/webm';
  const { storageKey, recordingUrl } = await putMeetRecordingBuffer({
    sessionId,
    fileName,
    contentType,
    body: buffer,
  });

  const updated = await prisma.meetSession.update({
    where: { id: sessionId },
    data: { recordingUrl: recordingUrl.slice(0, 2000) },
    select: { id: true, recordingUrl: true },
  });

  return NextResponse.json({ ok: true, session: updated, storageKey });
}

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
    const { id } = await ctx.params;
    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      return await handleDirectUpload(req, id);
    }

    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

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
