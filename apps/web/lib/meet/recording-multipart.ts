import 'server-only';

import {
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { createS3Client, getBucketConfig } from '@/lib/aws-config';
import { meetRecordingObjectKey, resolveMeetRecordingUrl } from '@/lib/meet/recording-storage';

export const MEET_RECORDING_PART_BYTES = 8 * 1024 * 1024; // 8 MB

export async function initMeetRecordingMultipart(opts: {
  sessionId: string;
  fileName: string;
  contentType: string;
}): Promise<{ uploadId: string; storageKey: string; partSize: number }> {
  const { bucketName } = getBucketConfig();
  const storageKey = meetRecordingObjectKey(opts.sessionId, opts.fileName);
  const s3 = createS3Client();
  const out = await s3.send(
    new CreateMultipartUploadCommand({
      Bucket: bucketName,
      Key: storageKey,
      ContentType: opts.contentType || 'application/octet-stream',
    }),
  );
  if (!out.UploadId) throw new Error('Multipart init failed');
  return { uploadId: out.UploadId, storageKey, partSize: MEET_RECORDING_PART_BYTES };
}

export async function uploadMeetRecordingPart(opts: {
  storageKey: string;
  uploadId: string;
  partNumber: number;
  body: Buffer;
}): Promise<string> {
  const { bucketName } = getBucketConfig();
  const s3 = createS3Client();
  const out = await s3.send(
    new UploadPartCommand({
      Bucket: bucketName,
      Key: opts.storageKey,
      UploadId: opts.uploadId,
      PartNumber: opts.partNumber,
      Body: opts.body,
    }),
  );
  if (!out.ETag) throw new Error('Part upload failed');
  return out.ETag;
}

export async function completeMeetRecordingMultipart(opts: {
  sessionId: string;
  storageKey: string;
  uploadId: string;
  parts: Array<{ PartNumber: number; ETag: string }>;
}): Promise<{ storageKey: string; recordingUrl: string }> {
  const { bucketName } = getBucketConfig();
  const s3 = createS3Client();
  await s3.send(
    new CompleteMultipartUploadCommand({
      Bucket: bucketName,
      Key: opts.storageKey,
      UploadId: opts.uploadId,
      MultipartUpload: {
        Parts: opts.parts.sort((a, b) => a.PartNumber - b.PartNumber),
      },
    }),
  );
  const recordingUrl = await resolveMeetRecordingUrl(opts.storageKey);
  return { storageKey: opts.storageKey, recordingUrl };
}
