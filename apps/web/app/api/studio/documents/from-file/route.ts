import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { createStudioDocument } from '@/lib/studio/create-document';
import { extractTextFromBuffer } from '@/lib/siep/extract-file-text';
import { parseImportedTextToCanvas } from '@/lib/studio/parse-import';
import { normalizeStudioCanvas } from '@/lib/studio/types';

export const dynamic = 'force-dynamic';

/** POST /api/studio/documents/from-file — PDF/DOCX/TXT → documento Studio estruturado */
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
  const canvas = normalizeStudioCanvas(parseImportedTextToCanvas(text, title));

  const created = await createStudioDocument({
    userId: user.id,
    companyId,
    folderId,
    title,
    canvasState: canvas,
    activityKind: 'imported',
    activitySummary: `Importado (estruturado): ${name}`,
    activityMeta: { sourceFile: name, bytes: buf.length, structured: true },
  });

  if (!created.ok) {
    return NextResponse.json({ error: created.error }, { status: created.status });
  }
  return NextResponse.json({ document: created.document }, { status: 201 });
}
