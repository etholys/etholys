/**
 * Export WebM do storyboard — grava canvas com planos + duração (CapCut/Premiere-lite).
 */
import type { StudioVideoScene } from '@/lib/studio/video-timeline';

export type StoryboardWebmProgress = {
  phase: 'recording' | 'done' | 'error';
  sceneIndex: number;
  sceneTotal: number;
  elapsedSec: number;
  message?: string;
};

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image load failed'));
    img.src = url;
  });
}

function drawSceneFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  scene: StudioVideoScene,
  img: HTMLImageElement | null,
) {
  ctx.fillStyle = '#0f0a18';
  ctx.fillRect(0, 0, w, h);
  if (img) {
    const scale = Math.min(w / img.width, h / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, h - 72, w, 72);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px system-ui,sans-serif';
  ctx.fillText(scene.pageTitle || 'Plano', 24, h - 40);
  if (scene.narration) {
    ctx.font = '16px system-ui,sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    const line = scene.narration.slice(0, 80);
    ctx.fillText(line, 24, h - 14);
  }
}

/** Grava storyboard como WebM (VP9/VP8) no browser. */
export async function recordStoryboardWebm(
  scenes: StudioVideoScene[],
  opts?: {
    width?: number;
    height?: number;
    fps?: number;
    onProgress?: (p: StoryboardWebmProgress) => void;
  },
): Promise<Blob> {
  if (!scenes.length) throw new Error('Sem planos para gravar');
  if (typeof MediaRecorder === 'undefined') throw new Error('MediaRecorder não disponível neste browser');

  const w = opts?.width ?? 1280;
  const h = opts?.height ?? 720;
  const fps = opts?.fps ?? 24;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D indisponível');

  const thumbs = await Promise.all(
    scenes.map(async (s) => {
      if (!s.thumbnailUrl) return null;
      try {
        return await loadImage(s.thumbnailUrl);
      } catch {
        return null;
      }
    }),
  );

  const stream = canvas.captureStream(fps);
  const mimeCandidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  const mime = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || 'video/webm';
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2_500_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };

  const totalSec = scenes.reduce((a, s) => a + s.durationSec, 0);
  let elapsed = 0;

  return new Promise((resolve, reject) => {
    recorder.onerror = () => reject(new Error('Gravação falhou'));
    recorder.onstop = () => {
      opts?.onProgress?.({
        phase: 'done',
        sceneIndex: scenes.length,
        sceneTotal: scenes.length,
        elapsedSec: totalSec,
      });
      resolve(new Blob(chunks, { type: mime.split(';')[0] }));
    };

    recorder.start(200);
    opts?.onProgress?.({ phase: 'recording', sceneIndex: 0, sceneTotal: scenes.length, elapsedSec: 0 });

    let sceneIdx = 0;
    let sceneElapsed = 0;
    const tickMs = 1000 / fps;

    const interval = window.setInterval(() => {
      const scene = scenes[sceneIdx]!;
      drawSceneFrame(ctx, w, h, scene, thumbs[sceneIdx] ?? null);
      sceneElapsed += tickMs / 1000;
      elapsed += tickMs / 1000;
      opts?.onProgress?.({
        phase: 'recording',
        sceneIndex: sceneIdx + 1,
        sceneTotal: scenes.length,
        elapsedSec: elapsed,
      });

      if (sceneElapsed >= scene.durationSec) {
        sceneIdx += 1;
        sceneElapsed = 0;
        if (sceneIdx >= scenes.length) {
          window.clearInterval(interval);
          window.setTimeout(() => recorder.stop(), 120);
        }
      }
    }, tickMs);
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
