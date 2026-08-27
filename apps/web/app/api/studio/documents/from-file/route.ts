import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { createStudioDocument } from '@/lib/studio/create-document';
import { extractTextFromBuffer } from '@/lib/siep/extract-file-text';
import { emptyStudioCanvas } from '@/lib/studio/types';

export const dynamic = 'force-dynamic';

/** POST /api/studio/documents/from-file — PDF/DOCX/TXT → documento Studio */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'multipart required' }, { status: 400 });

  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'file required' }, { status: 400 });

  const companyId = typeof form.get('companyId') === 'string' ? String(form.get('companyId')) : null;
  const folderIdRaw = form.get('folderId');
  const folderId =
    typeof folderIdRaw === 'string' && folderIdRaw.trim() ? folderIdRaw.trim() : null;

  const buf = Buffer.from(await file.arrayBuffer());
  const name = file.name || 'upload.txt';
  let text = '';
  try {
    text = (await extractTextFromBuffer(buf, name, file.type || null)).trim();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: 'Could not read file', detail: msg }, { status: 422 });
  }
  if (!text) {
    return NextResponse.json({ error: 'Empty or unreadable file' }, { status: 422 });
  }

  const title = name.replace(/\.[^.]+$/, '').slice(0, 120) || 'Documento importado';
  const canvas = emptyStudioCanvas('report');
  canvas.studioMode = 'write';
  if (canvas.pages[0]?.blocks[0]) {
    canvas.pages[0].blocks[0].text = title;
  }
  if (canvas.pages[0]?.blocks[1]) {
    canvas.pages[0].blocks[1].text = text.slice(0, 80_000);
  }

  const created = await createStudioDocument({
    userId: user.id,
    companyId,
    folderId,
    title,
    canvasState: canvas,
    activityKind: 'imported',
    activitySummary: `Importado: ${name}`,
    activityMeta: { sourceFile: name, bytes: buf.length },
  });

  if (!created.ok) {
    return NextResponse.json({ error: created.error }, { status: created.status });
  }
  return NextResponse.json({ document: created.document }, { status: 201 });
}
