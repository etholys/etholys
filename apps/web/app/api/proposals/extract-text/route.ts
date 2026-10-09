export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse, NextRequest } from 'next/server';
import { extractTextDetailed } from '@/lib/siep/extract-file-text';

const MAX_BYTES = 15 * 1024 * 1024;

/** Pull text out of a proposal PDF/DOCX/XLSX so the model reads the bases instead of guessing. */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Ficheiro em falta.' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ text: '', ok: false, issue: 'Ficheiro demasiado grande.' });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await extractTextDetailed(buffer, file.name, file.type);
    return NextResponse.json({
      text: result.text.slice(0, 20000),
      ok: result.ok && result.text.trim().length > 40,
      issue: result.issue,
      charCount: result.charCount,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao ler o ficheiro.';
    return NextResponse.json({ text: '', ok: false, issue: message }, { status: 500 });
  }
}
