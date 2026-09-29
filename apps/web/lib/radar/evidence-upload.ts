import fs from 'node:fs/promises';
import path from 'node:path';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { createS3Client, getBucketConfig, getS3PublicBaseUrl, isObjectStorageConfigured } from '@/lib/aws-config';

const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

export type EvidenceUploadResult = {
  photoUrl: string;
  photoKey: string;
  storage: 'r2' | 'local';
};

function extFor(mime: string) {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}

/** Decode data-URL or raw base64 photo for check-in evidence. */
export function decodeEvidenceImage(raw: string): { buffer: Buffer; contentType: string } | null {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return null;
  const match = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/i.exec(trimmed);
  const contentType = match ? match[1].toLowerCase() : 'image/jpeg';
  const b64 = match ? match[2] : trimmed.replace(/\s/g, '');
  if (!ALLOWED.has(contentType)) return null;
  try {
    const buffer = Buffer.from(b64, 'base64');
    if (!buffer.length || buffer.length > MAX_BYTES) return null;
    return { buffer, contentType };
  } catch {
    return null;
  }
}

export async function storeCheckInPhoto(opts: {
  companyId: string;
  lotId: string;
  buffer: Buffer;
  contentType: string;
}): Promise<EvidenceUploadResult> {
  const ext = extFor(opts.contentType);
  const stamp = Date.now();
  const keyTail = `radar/lots/${opts.companyId}/${opts.lotId}/${stamp}.${ext}`;

  if (isObjectStorageConfigured()) {
    const { bucketName, folderPrefix } = getBucketConfig();
    const key = `${folderPrefix}${keyTail}`;
    const s3 = createS3Client();
    await s3.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: opts.buffer,
        ContentType: opts.contentType,
      })
    );
    const publicBase = getS3PublicBaseUrl();
    const photoUrl = publicBase
      ? `${publicBase}/${key}`
      : `/api/radar/lots/evidence?key=${encodeURIComponent(key)}`;
    return { photoUrl, photoKey: key, storage: 'r2' };
  }

  const rel = `uploads/${keyTail}`;
  const abs = path.join(process.cwd(), 'public', rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, opts.buffer);
  return { photoUrl: `/${rel}`, photoKey: rel, storage: 'local' };
}
