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
    return fs.readFile(localStorageAbsPath(cloudStoragePath));
  }
  if (!isS3Configured()) {
    throw new Error('Almacenamiento S3 no configurado');
  }
  const s3 = createS3Client();
  const { bucketName } = getBucketConfig();
  const resp = await s3.send(
    new GetObjectCommand({ Bucket: bucketName, Key: cloudStoragePath }),
  );
  return Buffer.from(await resp.Body!.transformToByteArray());
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
