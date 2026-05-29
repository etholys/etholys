import 'server-only';

import fs from 'node:fs/promises';
import path from 'node:path';
import { generatePresignedUploadUrl, getFileUrl } from '@/lib/s3';
import { getForgeDb } from '@/lib/forge/db';
import { queueLibroOcr } from '@/lib/forge/libro-ocr';

const LOCAL_DIR = 'public/uploads/forge-libros';

export function forgeLibroS3Key(courseId: string, fileName: string): string {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `forge/courses/${courseId}/${Date.now()}-${safe}`;
}

export function isS3Configured(): boolean {
  return Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.AWS_BUCKET_NAME);
}

export async function presignLibroUpload(courseId: string, fileName: string) {
  const contentType = 'application/pdf';
  if (isS3Configured()) {
    const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const { uploadUrl, cloud_storage_path } = await generatePresignedUploadUrl(
      `forge-${courseId}-${safe}`,
      contentType,
      true
    );
    return { mode: 's3' as const, uploadUrl, storagePath: cloud_storage_path };
  }
  return { mode: 'local' as const, uploadUrl: `/api/forge/courses/${courseId}/libro/upload` };
}

export async function saveLibroMeta(courseId: string, storagePath: string, fileName: string) {
  await getForgeDb().forgeCourse.update({
    where: { id: courseId },
    data: {
      libroPdfPath: storagePath,
      libroPdfName: fileName,
      libroOcrStatus: 'pending',
      libroOcrText: null,
    },
  });
  queueLibroOcr(courseId);
}

export async function saveLibroLocal(courseId: string, buffer: Buffer, fileName: string) {
  const dir = path.join(process.cwd(), LOCAL_DIR);
  await fs.mkdir(dir, { recursive: true });
  const rel = `uploads/forge-libros/${courseId}.pdf`;
  const abs = path.join(process.cwd(), 'public', rel);
  await fs.writeFile(abs, buffer);
  await saveLibroMeta(courseId, rel, fileName);
  return rel;
}

export async function resolveLibroViewUrl(courseId: string): Promise<string | null> {
  const course = await getForgeDb().forgeCourse.findUnique({
    where: { id: courseId },
    select: { libroPdfPath: true },
  });
  if (!course?.libroPdfPath) return null;

  if (course.libroPdfPath.startsWith('uploads/forge-libros/')) {
    return `/${course.libroPdfPath}`;
  }

  if (isS3Configured()) {
    try {
      return await getFileUrl(course.libroPdfPath, true);
    } catch {
      return null;
    }
  }
  return null;
}
