import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createS3Client, getBucketConfig } from './aws-config';

const s3 = createS3Client();
const { bucketName, folderPrefix } = getBucketConfig();

export async function generatePresignedUploadUrl(fileName: string, contentType: string, isPublic = false) {
  const key = isPublic
    ? `${folderPrefix}public/uploads/${Date.now()}-${fileName}`
    : `${folderPrefix}uploads/${Date.now()}-${fileName}`;
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    ContentType: contentType,
    ...(isPublic ? { ContentDisposition: 'attachment' } : {}),
  });
  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
  return { uploadUrl, cloud_storage_path: key };
}

export async function getFileUrl(cloudStoragePath: string, isPublic: boolean) {
  if (isPublic) {
    const region = process.env.AWS_REGION ?? 'us-east-1';
    return `https://${bucketName}.s3.${region}.amazonaws.com/${cloudStoragePath}`;
  }
  const command = new GetObjectCommand({ Bucket: bucketName, Key: cloudStoragePath, ResponseContentDisposition: 'attachment' });
  return getSignedUrl(s3, command, { expiresIn: 3600 });
}

export async function deleteFile(cloudStoragePath: string) {
  await s3.send(new DeleteObjectCommand({ Bucket: bucketName, Key: cloudStoragePath }));
}
