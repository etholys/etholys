import fs from 'node:fs/promises';
import path from 'node:path';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { createS3Client, getBucketConfig } from '@/lib/aws-config';
import { generatePresignedUploadUrl } from '@/lib/s3';

export type SiepFileCategory = 'guides' | 'reports' | 'general';

export function isS3Configured(): boolean {
  return Boolean(
    process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY &&
      process.env.AWS_BUCKET_NAME,
  );
}

export function isLocalStoragePath(storagePath: string): boolean {
  return storagePath.startsWith('uploads/siep/');
}

export function localStorageAbsPath(relativePath: string): string {
  return path.join(process.cwd(), 'public', relativePath);
}

export async function saveLocalSiepFile(
  category: SiepFileCategory,
  projectId: string,
  buffer: Buffer,
  fileName: string,
): Promise<string> {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const rel = `uploads/siep/${projectId}/${category}/${Date.now()}-${safe}`;
  const abs = localStorageAbsPath(rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, buffer);
  return rel;
}

export async function loadFileBuffer(cloudStoragePath: string): Promise<Buffer> {
  if (isLocalStoragePath(cloudStoragePath)) {
    try {
      return await fs.readFile(localStorageAbsPath(cloudStoragePath));
    } catch (err: unknown) {
      const code = err && typeof err === 'object' && 'code' in err ? String((err as { code?: string }).code) : '';
      if (code === 'ENOENT') {
        // Mesmo nome noutro upload do projecto (ficheiros locais perdidos em rebuilds)
        const fallback = await findLocalFallbackByFileName(cloudStoragePath);
        if (fallback) return fallback;
        throw new Error(
          'Ficheiro do modelo não encontrado no servidor (foi perdido num deploy). Reenvie o .docx/.xlsx do modelo.',
        );
      }
      throw err;
    }
  }
  if (!isS3Configured()) {
    throw new Error('Armazenamento de ficheiros indisponível de momento.');
  }
  const s3 = createS3Client();
  const { bucketName } = getBucketConfig();
  const resp = await s3.send(
    new GetObjectCommand({ Bucket: bucketName, Key: cloudStoragePath }),
  );
  return Buffer.from(await resp.Body!.transformToByteArray());
}

async function findLocalFallbackByFileName(cloudStoragePath: string): Promise<Buffer | null> {
  const base = path.basename(cloudStoragePath).replace(/^\d+-/, '');
  if (!base) return null;
  // uploads/siep/{projectId}/reports|guides/...
  const parts = cloudStoragePath.split('/');
  const projectIdx = parts.indexOf('siep');
  if (projectIdx < 0 || !parts[projectIdx + 1]) return null;
  const projectId = parts[projectIdx + 1];
  const root = path.join(process.cwd(), 'public', 'uploads', 'siep', projectId);
  try {
    const categories = await fs.readdir(root);
    for (const cat of categories) {
      const dir = path.join(root, cat);
      let entries: string[];
      try {
        entries = await fs.readdir(dir);
      } catch {
        continue;
      }
      const match = entries
        .filter((e) => e.endsWith(base) || e.replace(/^\d+-/, '') === base)
        .sort()
        .reverse()[0];
      if (match) {
        return fs.readFile(path.join(dir, match));
      }
    }
  } catch {
    return null;
  }
  return null;
}

export async function presignSiepUpload(fileName: string, contentType: string) {
  if (isS3Configured()) {
    const { uploadUrl, cloud_storage_path } = await generatePresignedUploadUrl(
      fileName,
      contentType,
      false,
    );
    return { mode: 's3' as const, uploadUrl, cloud_storage_path };
  }
  return { mode: 'local' as const, uploadUrl: '/api/documents/upload' };
}
