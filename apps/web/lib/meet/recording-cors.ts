import 'server-only';

import { PutBucketCorsCommand } from '@aws-sdk/client-s3';
import { createS3Client, getBucketConfig, isObjectStorageConfigured } from '@/lib/aws-config';

let corsEnsurePromise: Promise<void> | null = null;

/** Aplica CORS no bucket R2/S3 para uploads directos do browser (idempotente). */
export function ensureMeetRecordingCors(): Promise<void> {
  if (!isObjectStorageConfigured()) return Promise.resolve();
  if (!corsEnsurePromise) {
    corsEnsurePromise = applyCors().catch((err) => {
      corsEnsurePromise = null;
      console.warn('[meet/recording-cors] ensure failed', err);
    });
  }
  return corsEnsurePromise;
}

async function applyCors(): Promise<void> {
  const { bucketName } = getBucketConfig();
  const origins = new Set<string>([
    'https://app.etholys.com',
    'https://forge.etholys.com',
    'http://localhost:3000',
  ]);
  const appUrl = process.env.NEXTAUTH_URL?.trim().replace(/\/$/, '');
  if (appUrl) origins.add(appUrl);

  const s3 = createS3Client();
  await s3.send(
    new PutBucketCorsCommand({
      Bucket: bucketName,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: [...origins],
            AllowedMethods: ['GET', 'PUT', 'HEAD'],
            AllowedHeaders: ['*'],
            ExposeHeaders: ['ETag'],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    }),
  );
  console.info('[meet/recording-cors] CORS applied for', [...origins].join(', '));
}
