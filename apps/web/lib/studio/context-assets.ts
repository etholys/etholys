import fs from 'node:fs/promises';
import path from 'node:path';
import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { prisma } from '@/lib/prisma';
import { createS3Client, getBucketConfig } from '@/lib/aws-config';
import { isS3Configured } from '@/lib/siep/file-storage';
import type { LlmPart } from '@/lib/llm-client';

export const STUDIO_CONTEXT_MAX_BYTES = 12 * 1024 * 1024;
export const STUDIO_CONTEXT_MAX_TEXT = 120_000;
/** PDF/imagem inline no LLM — evita OOM e 502 no proxy */
export const STUDIO_LLM_INLINE_MAX_BYTES = 3 * 1024 * 1024;

const SELECT_ASSET = {
  id: true,
  companyId: true,
  scope: true,
  folderId: true,
  documentId: true,
  name: true,
  fileName: true,
  mimeType: true,
  sizeBytes: true,
  storagePath: true,
  label: true,
  extractedText: true,
  createdAt: true,
  createdById: true,
} as const;

function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180) || 'file';
}

function sniffMime(fileName: string, declared?: string | null, buffer?: Buffer): string {
  if (buffer && buffer.length >= 4) {
    if (buffer.subarray(0, 4).toString('ascii') === '%PDF') return 'application/pdf';
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      return 'image/png';
    }
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  }
  if (declared && declared !== 'application/octet-stream') return declared;
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.docx')) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  if (lower.endsWith('.txt') || lower.endsWith('.md') || lower.endsWith('.csv')) return 'text/plain';
  if (lower.endsWith('.json')) return 'application/json';
  return declared || 'application/octet-stream';
}

export async function extractStudioContextText(
  buffer: Buffer,
  mimeType: string,
  fileName: string,
): Promise<string | null> {
  const mime = sniffMime(fileName, mimeType).toLowerCase();
  try {
    if (
      mime.startsWith('text/') ||
      mime === 'application/json' ||
      mime === 'application/xml' ||
      mime === 'application/csv'
    ) {
      return buffer.toString('utf8').slice(0, STUDIO_CONTEXT_MAX_TEXT);
    }
    if (mime === 'application/pdf') {
      const pdfParse = (await import('pdf-parse')).default;
      const parsed = await pdfParse(buffer);
      const text = (parsed.text || '').trim();
      return text ? text.slice(0, STUDIO_CONTEXT_MAX_TEXT) : null;
    }
    if (mime.includes('wordprocessingml') || fileName.toLowerCase().endsWith('.docx')) {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      const text = (result.value || '').trim();
      return text ? text.slice(0, STUDIO_CONTEXT_MAX_TEXT) : null;
    }
  } catch (e) {
    console.warn('[studio-context] extract failed', fileName, e);
  }
  return null;
}

async function saveStudioContextBuffer(
  companyId: string,
  buffer: Buffer,
  fileName: string,
  mimeType: string,
): Promise<string> {
  const safe = safeFileName(fileName);
  if (isS3Configured()) {
    const s3 = createS3Client();
    const { bucketName, folderPrefix } = getBucketConfig();
    const key = `${folderPrefix}studio-context/${companyId}/${Date.now()}-${safe}`;
    await s3.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      }),
    );
    return key;
  }
  const rel = `uploads/studio-context/${companyId}/${Date.now()}-${safe}`;
  const abs = path.join(process.cwd(), 'public', rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, buffer);
  return rel;
}

async function loadStudioContextBuffer(storagePath: string): Promise<Buffer> {
  if (storagePath.startsWith('uploads/studio-context/')) {
    return fs.readFile(path.join(process.cwd(), 'public', storagePath));
  }
  if (!isS3Configured()) throw new Error('S3 não configurado');
  const s3 = createS3Client();
  const { bucketName } = getBucketConfig();
  const resp = await s3.send(new GetObjectCommand({ Bucket: bucketName, Key: storagePath }));
  const bytes = await resp.Body?.transformToByteArray();
  if (!bytes) throw new Error('Ficheiro vazio');
  return Buffer.from(bytes);
}

async function deleteStudioContextStorage(storagePath: string): Promise<void> {
  try {
    if (storagePath.startsWith('uploads/studio-context/')) {
      await fs.unlink(path.join(process.cwd(), 'public', storagePath));
      return;
    }
    if (!isS3Configured()) return;
    const s3 = createS3Client();
    const { bucketName } = getBucketConfig();
    await s3.send(new DeleteObjectCommand({ Bucket: bucketName, Key: storagePath }));
  } catch (e) {
    console.warn('[studio-context] delete storage', storagePath, e);
  }
}

export async function createStudioContextAsset(opts: {
  companyId: string;
  scope: 'folder' | 'document';
  folderId?: string | null;
  documentId?: string | null;
  file: { buffer: Buffer; fileName: string; mimeType?: string | null; size?: number };
  label?: string | null;
  createdById?: string | null;
}) {
  if (opts.file.buffer.length > STUDIO_CONTEXT_MAX_BYTES) {
    throw new Error(`Ficheiro excede ${Math.round(STUDIO_CONTEXT_MAX_BYTES / (1024 * 1024))} MB`);
  }
  const mimeType = sniffMime(opts.file.fileName, opts.file.mimeType, opts.file.buffer);
  const extractedText = await extractStudioContextText(opts.file.buffer, mimeType, opts.file.fileName);
  const storagePath = await saveStudioContextBuffer(
    opts.companyId,
    opts.file.buffer,
    opts.file.fileName,
    mimeType,
  );
  const name = opts.label?.trim() || opts.file.fileName;

  return prisma.studioContextAsset.create({
    data: {
      companyId: opts.companyId,
      scope: opts.scope,
      folderId: opts.scope === 'folder' ? opts.folderId || null : null,
      documentId: opts.scope === 'document' ? opts.documentId || null : null,
      name,
      fileName: opts.file.fileName,
      mimeType,
      sizeBytes: opts.file.size ?? opts.file.buffer.length,
      storagePath,
      extractedText,
      label: opts.label?.trim() || null,
      createdById: opts.createdById || null,
    },
    select: SELECT_ASSET,
  });
}

export async function listStudioContextAssets(opts: {
  companyId: string;
  folderId?: string | null;
  documentId?: string | null;
}) {
  return prisma.studioContextAsset.findMany({
    where: {
      companyId: opts.companyId,
      ...(opts.folderId ? { scope: 'folder', folderId: opts.folderId } : {}),
      ...(opts.documentId ? { scope: 'document', documentId: opts.documentId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      companyId: true,
      scope: true,
      folderId: true,
      documentId: true,
      name: true,
      fileName: true,
      mimeType: true,
      sizeBytes: true,
      label: true,
      createdAt: true,
      createdById: true,
    },
  });
}

export async function deleteStudioContextAsset(id: string, companyId: string) {
  const row = await prisma.studioContextAsset.findFirst({
    where: { id, companyId },
    select: { id: true, storagePath: true },
  });
  if (!row) return false;
  await prisma.studioContextAsset.delete({ where: { id: row.id } });
  await deleteStudioContextStorage(row.storagePath);
  return true;
}

async function folderAncestorIdsIncludingSelf(folderId: string): Promise<string[]> {
  const ids: string[] = [folderId];
  let cur: string | null = folderId;
  for (let i = 0; i < 40; i++) {
    const f: { parentId: string | null } | null = await prisma.studioFolder.findUnique({
      where: { id: cur },
      select: { parentId: true },
    });
    if (!f?.parentId) break;
    ids.push(f.parentId);
    cur = f.parentId;
  }
  return ids;
}

/** Texto de contexto de pasta (própria + ancestrais) + documento. */
export async function loadStudioUserContextText(opts: {
  companyId: string;
  folderId?: string | null;
  documentId?: string | null;
  extraAssetIds?: string[];
}): Promise<string> {
  const folderIds = opts.folderId ? await folderAncestorIdsIncludingSelf(opts.folderId) : [];
  const or: Array<
    | { scope: 'folder'; folderId: { in: string[] } }
    | { scope: 'document'; documentId: string }
    | { id: { in: string[] } }
  > = [];
  if (folderIds.length) or.push({ scope: 'folder', folderId: { in: folderIds } });
  if (opts.documentId) or.push({ scope: 'document', documentId: opts.documentId });
  if (opts.extraAssetIds?.length) or.push({ id: { in: opts.extraAssetIds } });
  if (!or.length) return '';

  const assets = await prisma.studioContextAsset.findMany({
    where: {
      companyId: opts.companyId,
      OR: or,
    },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      fileName: true,
      mimeType: true,
      label: true,
      scope: true,
      extractedText: true,
    },
  });

  if (!assets.length) return '';

  const parts: string[] = [];
  for (const a of assets) {
    const title = a.label || a.name || a.fileName;
    const scopeLabel = a.scope === 'folder' ? 'pasta' : 'documento/chat';
    if (a.extractedText?.trim()) {
      parts.push(
        `### ${title} (${scopeLabel}, ${a.mimeType})\n${a.extractedText.trim().slice(0, STUDIO_CONTEXT_MAX_TEXT)}`,
      );
    } else {
      parts.push(
        `### ${title} (${scopeLabel}, ${a.mimeType})\n[Ficheiro sem texto extraído — ver anexo multimodal se disponível.]`,
      );
    }
  }
  return parts.join('\n\n');
}

/** Partes multimodais (imagens/PDF) para o turno, a partir de assets seleccionados. */
export async function buildStudioContextLlmParts(assetIds: string[], companyId: string): Promise<LlmPart[]> {
  if (!assetIds.length) return [];
  const assets = await prisma.studioContextAsset.findMany({
    where: { companyId, id: { in: assetIds } },
    select: { id: true, name: true, fileName: true, mimeType: true, storagePath: true, extractedText: true },
  });
  const parts: LlmPart[] = [];
  for (const a of assets) {
    const mime = (a.mimeType || '').toLowerCase();
    // Texto extraído já vai no system prompt (loadStudioUserContextText) — não duplicar PDF/DOCX em binário
    if (a.extractedText?.trim()) {
      continue;
    }
    const isImage = mime.startsWith('image/');
    const isPdf = mime === 'application/pdf';
    if (!isImage && !isPdf) continue;

    try {
      const buf = await loadStudioContextBuffer(a.storagePath);
      if (buf.length > STUDIO_LLM_INLINE_MAX_BYTES) {
        console.warn('[studio-context] skip large inline attachment', a.id, buf.length);
        continue;
      }
      parts.push({
        inlineData: {
          mimeType: isImage ? mime : 'application/pdf',
          data: buf.toString('base64'),
        },
      });
      parts.push({ text: `\n[Anexo: ${a.name || a.fileName}]` });
    } catch (e) {
      console.warn('[studio-context] load for llm', a.id, e);
    }
  }
  return parts;
}
