export const dynamic = 'force-dynamic';
export const maxDuration = 120;

import { NextResponse, NextRequest } from 'next/server';
import { llmGenerateContent } from '@/lib/llm-client';
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
    let text = result.text.trim();
    let issue = result.issue;
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (isPdf && text.length < 400 && buffer.length <= 12_000_000) {
      try {
        const { text: read } = await llmGenerateContent({
          systemInstruction:
            'Lês um PDF de bases de convocatória. Transcreves o que está escrito. Não uses conhecimento geral nem o que «normalmente» se pede. Se a página for imagem, lê-a.',
          userParts: [
            {
              text: 'Transcreve as partes que dizem quais documentos, anexos e requisitos o proponente deve enviar, mais prazos e formato. Copia listas e títulos literalmente. Se não houver essa secção, transcreve o índice e os requisitos que existirem.',
            },
            { inlineData: { mimeType: 'application/pdf', data: buffer.toString('base64') } },
          ],
          maxOutputTokens: 4000,
          temperature: 0.1,
          timeoutMs: 90_000,
        });
        if (read.trim().length > text.length) {
          text = read.trim();
          issue = undefined;
        }
      } catch {
        issue = issue || 'Não foi possível ler o PDF.';
      }
    }
    return NextResponse.json({
      text: text.slice(0, 20000),
      ok: text.trim().length > 40,
      issue,
      charCount: text.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao ler o ficheiro.';
    return NextResponse.json({ text: '', ok: false, issue: message }, { status: 500 });
  }
}
