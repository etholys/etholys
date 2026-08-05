import { S3Client } from '@aws-sdk/client-s3';

/**
 * S3-compatible storage (AWS S3 ou Cloudflare R2).
 * R2: definir R2_ACCOUNT_ID ou AWS_ENDPOINT_URL + as mesmas AWS_* keys.
 */
export function getBucketConfig() {
  return {
    bucketName: process.env.AWS_BUCKET_NAME ?? '',
    folderPrefix: process.env.AWS_FOLDER_PREFIX ?? '',
  };
}

export function getS3PublicBaseUrl(): string | null {
  const explicit = process.env.AWS_PUBLIC_BASE_URL?.trim() || process.env.R2_PUBLIC_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');
  return null;
}

export function resolveS3Endpoint(): string | undefined {
  const direct = process.env.AWS_ENDPOINT_URL?.trim();
  if (direct) return direct.replace(/\/$/, '');
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  if (accountId) return `https://${accountId}.r2.cloudflarestorage.com`;
  return undefined;
}

export function createS3Client() {
  const endpoint = resolveS3Endpoint();
  const region =
    process.env.AWS_REGION?.trim() ||
    (endpoint ? 'auto' : undefined);

  return new S3Client({
    ...(endpoint
      ? {
          endpoint,
          forcePathStyle: true,
          region: region || 'auto',
        }
      : region
        ? { region }
        : {}),
  });
}

export function isObjectStorageConfigured(): boolean {
  return Boolean(
    process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY &&
      process.env.AWS_BUCKET_NAME,
  );
}
