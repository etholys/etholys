/**
 * Limites e validação de anexos no chat NEXUS / assessor Etholys (Gemini multimodal).
 */
import type { GeminiPart } from '@/lib/gemini-client';

export const NEXUS_MAX_FILES = 8;
/** Por ficheiro (bytes antes de Base64). */
export const NEXUS_MAX_FILE_BYTES = 8 * 1024 * 1024;
/** Soma dos ficheiros (bytes decodificados). */
export const NEXUS_MAX_TOTAL_BYTES = 24 * 1024 * 1024;

export type AttachmentParseOk = {
  geminiParts: GeminiPart[];
  /** Nomes para registar na mensagem guardada */
  summaryLine: string;
  meta: Array<{ name: string; mimeType: string; size: number }>;
};

const INLINE_MIME = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/rtf',
  'text/html',
  'application/json',
  // Word/Office (Gemini lê vários como documento quando suportado)
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.presentation',
  'application/vnd.oasis.opendocument.spreadsheet',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'video/mp4',
  'video/webm',
]);

function sniffMime(blob: Blob, fileName: string): string {
  if (blob.type && blob.type !== 'application/octet-stream') return blob.type;
  const lower = fileName.toLowerCase();
  const extMatch = /\.([a-z0-9]+)$/i.exec(lower);
  const ext = extMatch ? extMatch[1].toLowerCase() : '';
  const extToMime: Record<string, string> = {
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    txt: 'text/plain',
    md: 'text/plain',
    markdown: 'text/plain',
    csv: 'text/plain',
    json: 'application/json',
    xml: 'text/plain',
    html: 'text/html',
    htm: 'text/html',
    rtf: 'application/rtf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    doc: 'application/msword',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ppt: 'application/vnd.ms-powerpoint',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    xls: 'application/vnd.ms-excel',
    odt: 'application/vnd.oasis.opendocument.text',
    odp: 'application/vnd.oasis.opendocument.presentation',
    ods: 'application/vnd.oasis.opendocument.spreadsheet',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    mp4: 'video/mp4',
    webm: 'video/webm',
  };
  if (ext && extToMime[ext]) return extToMime[ext];
  if (lower.endsWith('.txt') || lower.endsWith('.md') || lower.endsWith('.csv')) return 'text/plain';
  /** Tipos menos comuns continuam como octet-stream; o modelo pode ainda assim processar quando a API permite. */
  return 'application/octet-stream';
}

function bufferToBase64(buf: ArrayBuffer): string {
  return Buffer.from(buf).toString('base64');
}

/**
 * Converte blobs (FormData) em partes inline para Gemini; texto corrido vai no `userText` da geração, não aqui.
 */
export async function buildGeminiAttachmentsFromFiles(
  files: Blob[],
  displayNames: string[],
): Promise<AttachmentParseOk> {
  if (files.length > NEXUS_MAX_FILES) {
    throw new Error(`Máximo de ${NEXUS_MAX_FILES} ficheiros por mensagem.`);
  }
  let total = 0;
  const geminiParts: GeminiPart[] = [];
  const meta: AttachmentParseOk['meta'] = [];

  for (let i = 0; i < files.length; i++) {
    const blob = files[i];
    const name = displayNames[i] || `ficheiro-${i + 1}`;
    const size = blob.size;
    if (size > NEXUS_MAX_FILE_BYTES) {
      throw new Error(`"${name}" excede o limite de ${Math.round(NEXUS_MAX_FILE_BYTES / (1024 * 1024))} MB por ficheiro.`);
    }
    total += size;
    if (total > NEXUS_MAX_TOTAL_BYTES) {
      throw new Error('Volume total dos anexos excede o limite.');
    }

    const mimeType = sniffMime(blob, name);
    const buf = await blob.arrayBuffer();

    /** Texto / HTML / JSON como parte de texto (evita inline inútil para ficheiros grandes legíveis como string) */
    if (
      mimeType === 'text/plain' ||
      mimeType.startsWith('text/') ||
      mimeType === 'application/json' ||
      mimeType === 'application/xml'
    ) {
      try {
        const text = new TextDecoder('utf-8', { fatal: false }).decode(buf);
        geminiParts.push({
          text: `\n--- Ficheiro: ${name} (${mimeType}) ---\n${text.slice(0, 500_000)}`,
        });
        meta.push({ name, mimeType, size });
        continue;
      } catch {
        /* fallback inline */
      }
    }

    if ((mimeType === 'application/octet-stream' || !INLINE_MIME.has(mimeType)) && !mimeType.startsWith('text/')) {
      /** Ainda assim enviamos inline; Gemini pode falhar por tipo — erro subirá ao utilizador */
    }

    const b64 = bufferToBase64(buf);
    geminiParts.push({
      inlineData: { mimeType: mimeType || 'application/octet-stream', data: b64 },
    });
    meta.push({ name, mimeType: mimeType || 'application/octet-stream', size });
  }

  const summaryLine =
    meta.length > 0
      ? `\n\n[${meta.length} anexo(s) nesta mensagem: ${meta.map((m) => `${m.name} (${m.mimeType})`).join('; ')}]`
      : '';

  return { geminiParts, summaryLine, meta };
}
