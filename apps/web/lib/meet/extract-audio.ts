import 'server-only';

import { spawn } from 'child_process';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

function pickInputExt(contentType: string, urlHint: string): string {
  const ct = contentType.toLowerCase();
  if (ct.includes('webm')) return 'webm';
  if (ct.includes('ogg')) return 'ogg';
  if (ct.includes('wav')) return 'wav';
  if (ct.includes('mpeg') || ct.includes('mp3')) return 'mp3';
  if (ct.includes('mp4') || ct.includes('m4a')) return 'mp4';
  const m = urlHint.match(/\.([a-z0-9]{2,4})(?:\?|$)/i);
  if (m) return m[1]!.toLowerCase();
  return 'webm';
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
      if (stderr.length > 4000) stderr = stderr.slice(-2000);
    });
    child.on('error', (err) => reject(err));
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(-500)}`));
    });
  });
}

/**
 * Extrai áudio mono compacto para STT (Whisper/Gemini).
 * Reuniões longas em vídeo (centenas de MB) passam a ~MB de áudio.
 */
export async function extractMeetAudioForTranscription(opts: {
  buffer: Buffer;
  contentType: string;
  urlHint?: string;
}): Promise<{ buffer: Buffer; contentType: string; ext: string } | null> {
  const dir = await mkdtemp(join(tmpdir(), 'chorus-audio-'));
  const inExt = pickInputExt(opts.contentType, opts.urlHint || '');
  const inPath = join(dir, `in.${inExt}`);
  const outPath = join(dir, 'out.mp3');
  try {
    await writeFile(inPath, opts.buffer);
    // 16 kHz mono 16 kbps ≈ 7 MB/hora — cabe no limite STT
    await runFfmpeg([
      '-y',
      '-i',
      inPath,
      '-vn',
      '-ac',
      '1',
      '-ar',
      '16000',
      '-b:a',
      '16k',
      outPath,
    ]);
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
