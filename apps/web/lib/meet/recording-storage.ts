import 'server-only';

import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  createS3Client,
  getBucketConfig,
  getS3PublicBaseUrl,
  isObjectStorageConfigured,
} from '@/lib/aws-config';

export function isMeetRecordingStorageReady(): boolean {
  return isObjectStorageConfigured();
}

export function meetRecordingObjectKey(sessionId: string, fileName: string): string {
  const { folderPrefix } = getBucketConfig();
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180);
  return `${folderPrefix}uploads/meet/${sessionId}/${Date.now()}-${safe}`;
}

/** Presign PUT para o host enviar gravação local / áudio para R2|S3. */
export async function presignMeetRecordingUpload(opts: {
  sessionId: string;
  fileName: string;
  contentType: string;
}): Promise<{ uploadUrl: string; storageKey: string; publicUrl: string | null }> {
  if (!isObjectStorageConfigured()) {
    throw new Error('Armazenamento de gravações indisponível de momento.');
  }
  const { bucketName } = getBucketConfig();
  const storageKey = meetRecordingObjectKey(opts.sessionId, opts.fileName);
  const s3 = createS3Client();
  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: bucketName,
      Key: storageKey,
      ContentType: opts.contentType || 'application/octet-stream',
    }),
    { expiresIn: 3600 },
  );
  const publicBase = getS3PublicBaseUrl();
  return {
    uploadUrl,
    storageKey,
    publicUrl: publicBase ? `${publicBase}/${storageKey}` : null,
  };
}

/** Upload server-side (proxy CHORUS ou webhook de gravação). */
export async function putMeetRecordingBuffer(opts: {
  sessionId: string;
  fileName: string;
  contentType: string;
  body: Buffer;
}): Promise<{ storageKey: string; recordingUrl: string }> {
  if (!isObjectStorageConfigured()) {
    throw new Error('Armazenamento de gravações indisponível de momento.');
  }
  const { bucketName } = getBucketConfig();
  const storageKey = meetRecordingObjectKey(opts.sessionId, opts.fileName);
  const s3 = createS3Client();
  await s3.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: storageKey,
      Body: opts.body,
      ContentType: opts.contentType || 'application/octet-stream',
    }),
  );
  const recordingUrl = await resolveMeetRecordingUrl(storageKey);
  return { storageKey, recordingUrl };
}

export async function resolveMeetRecordingUrl(storageKeyOrUrl: string): Promise<string> {
  if (/^https?:\/\//i.test(storageKeyOrUrl)) return storageKeyOrUrl;
  const publicBase = getS3PublicBaseUrl();
  if (publicBase) return `${publicBase}/${storageKeyOrUrl}`;
  const { bucketName } = getBucketConfig();
  const s3 = createS3Client();
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: bucketName, Key: storageKeyOrUrl }),
    { expiresIn: 7 * 24 * 3600 },
  );
}

export async function downloadMeetRecordingBuffer(storageKeyOrUrl: string): Promise<{
  buffer: Buffer;
  contentType: string;
}> {
  if (/^https?:\/\//i.test(storageKeyOrUrl)) {
    const res = await fetch(storageKeyOrUrl);
    if (!res.ok) throw new Error(`Falha ao descarregar gravação (${res.status})`);
    const ab = await res.arrayBuffer();
    return {
      buffer: Buffer.from(ab),
      contentType: res.headers.get('content-type') || 'application/octet-stream',
    };
  }
  if (!isObjectStorageConfigured()) {
    throw new Error('Não foi possível ler a gravação.');
  }
  const { bucketName } = getBucketConfig();
  const s3 = createS3Client();
  const out = await s3.send(
    new GetObjectCommand({ Bucket: bucketName, Key: storageKeyOrUrl }),
  );
  const bytes = await out.Body?.transformToByteArray();
  if (!bytes) throw new Error('Gravação vazia no storage');
  return {
    buffer: Buffer.from(bytes),
    contentType: out.ContentType || 'application/octet-stream',
  };
}
