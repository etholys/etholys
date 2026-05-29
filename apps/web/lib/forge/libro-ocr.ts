import 'server-only';

import fs from 'node:fs/promises';
import path from 'node:path';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { createS3Client, getBucketConfig } from '@/lib/aws-config';
import { geminiCompleteJsonWithPdf, getGeminiApiKey } from '@/lib/gemini-client';
import { getForgeDb } from '@/lib/forge/db';
import { isS3Configured } from '@/lib/forge/course-libro';

const MIN_TEXT_CHARS = 280;

export type LibroOcrMeta = {
  method: 'pdf-parse' | 'gemini' | 'pdf-parse+gemini';
  pages?: number;
  charCount: number;
};

export async function loadLibroPdfBuffer(courseId: string): Promise<Buffer | null> {
  const course = await getForgeDb().forgeCourse.findUnique({
    where: { id: courseId },
    select: { libroPdfPath: true },
  });
  if (!course?.libroPdfPath) return null;

  if (course.libroPdfPath.startsWith('uploads/forge-libros/')) {
    const abs = path.join(process.cwd(), 'public', course.libroPdfPath);
    try {
      return await fs.readFile(abs);
    } catch {
      return null;
    }
  }

  if (!isS3Configured()) return null;

  const s3 = createS3Client();
  const { bucketName } = getBucketConfig();
  const res = await s3.send(
    new GetObjectCommand({ Bucket: bucketName, Key: course.libroPdfPath })
  );
  const bytes = await res.Body?.transformToByteArray();
  return bytes ? Buffer.from(bytes) : null;
}

async function extractWithPdfParse(buffer: Buffer): Promise<{ text: string; pages?: number }> {
  const pdfParse = (await import('pdf-parse')).default;
  const data = await pdfParse(buffer);
  return { text: (data.text ?? '').trim(), pages: data.numpages };
}

async function extractWithGemini(buffer: Buffer): Promise<string> {
  const b64 = buffer.toString('base64');
  const raw = await geminiCompleteJsonWithPdf(
    'Extrae TODO el texto legible del manual PDF en español. Responde JSON: {"text":"..."} sin markdown.',
    'Devuelve el texto completo en el campo text.',
    b64,
    { maxOutputTokens: 32768 }
  );
  const parsed = JSON.parse(raw) as { text?: string };
  return (parsed.text ?? '').trim();
}

export async function runLibroOcr(courseId: string): Promise<{ ok: boolean; status: string; charCount?: number }> {
  const db = getForgeDb();
  await db.forgeCourse.update({
    where: { id: courseId },
    data: { libroOcrStatus: 'pending', libroOcrAt: new Date() },
  });

  const buffer = await loadLibroPdfBuffer(courseId);
  if (!buffer?.length) {
    await db.forgeCourse.update({
      where: { id: courseId },
      data: { libroOcrStatus: 'failed', libroOcrMeta: { method: 'none', charCount: 0, error: 'no_pdf' } },
    });
    return { ok: false, status: 'failed' };
  }

  try {
    let method: LibroOcrMeta['method'] = 'pdf-parse';
    let text = '';
    let pages: number | undefined;

    try {
      const parsed = await extractWithPdfParse(buffer);
      text = parsed.text;
      pages = parsed.pages;
    } catch {
      text = '';
    }

    if (text.length < MIN_TEXT_CHARS) {
      try {
        getGeminiApiKey();
        const geminiText = await extractWithGemini(buffer);
        if (geminiText.length > text.length) {
          text = geminiText;
          method = text.length >= MIN_TEXT_CHARS ? 'gemini' : 'pdf-parse+gemini';
        }
      } catch {
        /* Gemini opcional */
      }
    }

    if (text.length < 40) {
      await db.forgeCourse.update({
        where: { id: courseId },
        data: {
          libroOcrStatus: 'failed',
          libroOcrMeta: { method, pages, charCount: text.length, error: 'insufficient_text' },
        },
      });
      return { ok: false, status: 'failed' };
    }

    const meta: LibroOcrMeta = { method, pages, charCount: text.length };
    await db.forgeCourse.update({
      where: { id: courseId },
      data: {
        libroOcrText: text.slice(0, 500_000),
        libroOcrStatus: 'done',
        libroOcrAt: new Date(),
        libroOcrMeta: meta,
      },
    });
    return { ok: true, status: 'done', charCount: text.length };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'ocr_error';
    await db.forgeCourse.update({
      where: { id: courseId },
      data: { libroOcrStatus: 'failed', libroOcrMeta: { method: 'error', charCount: 0, error: msg } },
    });
    return { ok: false, status: 'failed' };
  }
}

/** Dispara OCR em background (não bloqueia upload). */
export function queueLibroOcr(courseId: string): void {
  void runLibroOcr(courseId).catch(() => {});
}
