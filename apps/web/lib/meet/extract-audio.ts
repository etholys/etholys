import 'server-only';

import { spawn } from 'child_process';
import { createWriteStream } from 'fs';
import { mkdtemp, readFile, rm, stat } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import {
  createS3Client,
  getBucketConfig,
  isObjectStorageConfigured,
} from '@/lib/aws-config';

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', ['-nostdin', ...args], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let stderr = '';
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
      if (stderr.length > 6000) stderr = stderr.slice(-3000);
    });
    child.on('error', (err) => reject(err));
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(-800)}`));
    });
  });
}

async function streamUrlToFile(url: string, destPath: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Falha ao descarregar gravação (${res.status})`);
  if (!res.body) throw new Error('Resposta sem corpo ao descarregar gravação');
  const nodeStream = Readable.fromWeb(res.body as import('stream/web').ReadableStream);
  await pipeline(nodeStream, createWriteStream(destPath));
  return res.headers.get('content-type') || 'application/octet-stream';
}

async function streamS3ToFile(key: string, destPath: string): Promise<string> {
  if (!isObjectStorageConfigured()) {
    throw new Error('Não foi possível ler a gravação.');
  }
  const { bucketName } = getBucketConfig();
  const s3 = createS3Client();
  const out = await s3.send(new GetObjectCommand({ Bucket: bucketName, Key: key }));
  if (!out.Body) throw new Error('Gravação vazia no storage');
  const body = out.Body as { transformToWebStream?: () => ReadableStream };
  if (typeof body.transformToWebStream === 'function') {
    await pipeline(
      Readable.fromWeb(body.transformToWebStream() as import('stream/web').ReadableStream),
      createWriteStream(destPath),
    );
  } else {
    // Fallback SDK stream
    await pipeline(out.Body as Readable, createWriteStream(destPath));
  }
  return out.ContentType || 'application/octet-stream';
}

async function downloadRecordingToFile(
  storageKeyOrUrl: string,
  destPath: string,
): Promise<string> {
  if (/^https?:\/\//i.test(storageKeyOrUrl)) {
    return streamUrlToFile(storageKeyOrUrl, destPath);
  }
  return streamS3ToFile(storageKeyOrUrl, destPath);
}

async function extractCompactMp3(inPath: string, outPath: string): Promise<void> {
  // source.bin: deixa o ffmpeg detetar o contentor (webm/mp4/…)
  const attempts: string[][] = [
    ['-y', '-i', inPath, '-vn', '-ac', '1', '-ar', '16000', '-b:a', '16k', outPath],
    ['-y', '-f', 'webm', '-i', inPath, '-vn', '-ac', '1', '-ar', '16000', '-b:a', '16k', outPath],
    ['-y', '-f', 'mp4', '-i', inPath, '-vn', '-ac', '1', '-ar', '16000', '-b:a', '16k', outPath],
  ];
  let lastErr: unknown;
  for (const args of attempts) {
    try {
      await runFfmpeg(args);
      return;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/**
 * Prepara áudio compacto para STT sem carregar o vídeo inteiro na RAM.
 * Descarrega para disco → ffmpeg → lê só o MP3 (~MB).
 */
export async function prepareMeetAudioForStt(opts: {
  recordingUrlOrKey: string;
  maxBytes?: number;
}): Promise<{ buffer: Buffer; contentType: string; ext: string }> {
  const maxBytes = opts.maxBytes ?? Number(process.env.MEET_TRANSCRIBE_MAX_BYTES || 24 * 1024 * 1024);
  const dir = await mkdtemp(join(tmpdir(), 'chorus-audio-'));
  const inPath = join(dir, 'source.bin');
  const outPath = join(dir, 'out.mp3');

  try {
    const contentType = await downloadRecordingToFile(opts.recordingUrlOrKey, inPath);
    const size = (await stat(inPath)).size;
    if (size < 1000) {
      throw new Error('Gravação vazia ou corrompida no storage.');
    }

    // Já cabe no limite STT e parece áudio — envia directo
    const ct = contentType.toLowerCase();
    const looksAudio =
      ct.includes('audio/') ||
      ct.includes('mpeg') ||
      ct.includes('mp3') ||
      ct.includes('wav') ||
      ct.includes('ogg') ||
      ct.includes('m4a');
    if (size <= maxBytes && looksAudio) {
      const buffer = await readFile(inPath);
      const ext = ct.includes('wav')
        ? 'wav'
        : ct.includes('ogg')
          ? 'ogg'
          : ct.includes('webm')
            ? 'webm'
            : 'mp3';
      return { buffer, contentType: contentType || 'audio/mpeg', ext };
    }

    if (size <= maxBytes && !looksAudio) {
      // Vídeo pequeno: ainda extrair áudio (Whisper prefere áudio limpo)
      try {
        await extractCompactMp3(inPath, outPath);
        const buffer = await readFile(outPath);
        if (buffer.byteLength >= 1000) {
          return { buffer, contentType: 'audio/mpeg', ext: 'mp3' };
        }
      } catch {
        /* fallback: enviar ficheiro original */
      }
      const buffer = await readFile(inPath);
      return {
        buffer,
        contentType: contentType || 'application/octet-stream',
        ext: 'mp4',
      };
    }

    // Ficheiro grande: obrigatório extrair/comprimir áudio em disco
    console.info(
      `[meet/extract-audio] extracting audio from ${(size / 1024 / 1024).toFixed(1)} MB recording`,
    );
    try {
      await extractCompactMp3(inPath, outPath);
    } catch (err) {
      const detail = err instanceof Error ? err.message.slice(0, 240) : String(err);
      console.warn('[meet/extract-audio]', detail);
      throw new Error(
        `Não foi possível extrair o áudio desta gravação (${(size / 1024 / 1024).toFixed(0)} MB). Tente de novo; se persistir, envie só o áudio. Detalhe: ${detail}`,
      );
    }

    const buffer = await readFile(outPath);
    if (buffer.byteLength < 1000) {
      throw new Error('Áudio extraído vazio — a gravação pode não ter faixa de áudio.');
    }
    if (buffer.byteLength > maxBytes) {
      const mb = Math.round(buffer.byteLength / 1024 / 1024);
      const lim = Math.round(maxBytes / 1024 / 1024);
      throw new Error(
        `O áudio extraído ainda é grande (${mb} MB; limite ~${lim} MB). Divida a reunião ou envie só o áudio.`,
      );
    }

    console.info(
      `[meet/extract-audio] ok → ${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB mp3`,
    );
    return { buffer, contentType: 'audio/mpeg', ext: 'mp3' };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/** @deprecated Use prepareMeetAudioForStt — mantido para imports pontuais. */
export async function extractMeetAudioForTranscription(opts: {
  buffer: Buffer;
  contentType: string;
  urlHint?: string;
}): Promise<{ buffer: Buffer; contentType: string; ext: string } | null> {
  const dir = await mkdtemp(join(tmpdir(), 'chorus-audio-buf-'));
  const inPath = join(dir, 'source.bin');
  const outPath = join(dir, 'out.mp3');
  try {
    const { writeFile } = await import('fs/promises');
    await writeFile(inPath, opts.buffer);
    await extractCompactMp3(inPath, outPath);
    const out = await readFile(outPath);
    if (out.byteLength < 1000) return null;
    return { buffer: out, contentType: 'audio/mpeg', ext: 'mp3' };
  } catch (err) {
    console.warn('[meet/extract-audio]', err instanceof Error ? err.message : err);
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}
