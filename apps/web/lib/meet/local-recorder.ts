/**
 * Gravação no browser (fora do iframe da sala CHORUS).
 * Grava em memória e só pede destino ao parar — evita ficheiros .webm vazios no disco.
 */

export type MeetLocalRecorder = {
  stop: (opts?: { saveToDisk?: boolean }) => Promise<{
    blob: Blob;
    fileName: string;
    savedWithPicker: boolean;
  }>;
  destroy: () => void;
};

function defaultFileName(title?: string): string {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const safe =
    (title || '')
      .replace(/[^\w\-áàâãéêíóôõúçñ ]+/gi, '')
      .trim()
      .slice(0, 48) || 'chorus';
  return `${safe}-${stamp}.webm`;
}

async function pickSaveHandle(suggestedName: string): Promise<FileSystemFileHandle | null> {
  const w = window as Window & {
    showSaveFilePicker?: (opts: {
      suggestedName?: string;
      types?: Array<{ description: string; accept: Record<string, string[]> }>;
    }) => Promise<FileSystemFileHandle>;
  };
  if (typeof w.showSaveFilePicker !== 'function') return null;
  try {
    return await w.showSaveFilePicker({
      suggestedName,
      types: [
        {
          description: 'WebM video',
          accept: { 'video/webm': ['.webm'] },
        },
      ],
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    return null;
  }
}

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

async function saveBlob(blob: Blob, fileName: string): Promise<boolean> {
  if (blob.size <= 0) return false;
  const fileHandle = await pickSaveHandle(fileName);
  if (fileHandle) {
    try {
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    } catch {
      triggerDownload(blob, fileName);
      return false;
    }
  }
  triggerDownload(blob, fileName);
  return false;
}

export async function startMeetLocalRecorder(opts?: {
  suggestedTitle?: string;
}): Promise<{
  recorder: MeetLocalRecorder;
  fileName: string;
}> {
  const fileName = defaultFileName(opts?.suggestedTitle);

  const display = await navigator.mediaDevices.getDisplayMedia({
    video: {
      frameRate: 30,
      displaySurface: 'browser',
    } as MediaTrackConstraints,
    audio: true,
    preferCurrentTab: true,
    selfBrowserSurface: 'include',
    surfaceSwitching: 'exclude',
    systemAudio: 'include',
  } as DisplayMediaStreamOptions);

  let mic: MediaStream | null = null;
  try {
    mic = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: false,
    });
  } catch {
    /* só áudio do ecrã / sem mic */
  }

  const tracks: MediaStreamTrack[] = [...display.getVideoTracks()];
  const audioTracks = [...display.getAudioTracks(), ...(mic?.getAudioTracks() || [])];
  let audioCtx: AudioContext | null = null;
  if (audioTracks.length) {
    audioCtx = new AudioContext();
    const dest = audioCtx.createMediaStreamDestination();
    for (const track of audioTracks) {
      const src = audioCtx.createMediaStreamSource(new MediaStream([track]));
      src.connect(dest);
    }
    tracks.push(...dest.stream.getAudioTracks());
  }

  if (!tracks.some((t) => t.kind === 'video' && t.readyState === 'live')) {
    display.getTracks().forEach((t) => t.stop());
    mic?.getTracks().forEach((t) => t.stop());
    void audioCtx?.close().catch(() => undefined);
    throw new Error('Partilha de ecrã sem vídeo. Escolhe a aba do CHORUS com áudio.');
  }

  const composed = new MediaStream(tracks);
  const mimeCandidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  const mimeType = mimeCandidates.find((type) => MediaRecorder.isTypeSupported(type)) || '';
  const mediaRecorder = new MediaRecorder(
    composed,
    mimeType ? { mimeType, videoBitsPerSecond: 2_500_000 } : undefined,
  );

  const chunks: BlobPart[] = [];
  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  const cleanup = () => {
    try {
      display.getTracks().forEach((t) => t.stop());
    } catch {
      /* ignore */
    }
    try {
      mic?.getTracks().forEach((t) => t.stop());
    } catch {
      /* ignore */
    }
    void audioCtx?.close().catch(() => undefined);
  };

  display.getVideoTracks()[0]?.addEventListener('ended', () => {
    if (mediaRecorder.state === 'recording') {
      try {
        mediaRecorder.requestData();
      } catch {
        /* ignore */
      }
      mediaRecorder.stop();
    }
  });

  mediaRecorder.start(1000);

  async function finalizeRecording(): Promise<Blob> {
    if (mediaRecorder.state === 'recording') {
      try {
        mediaRecorder.requestData();
      } catch {
        /* ignore */
      }
      await new Promise<void>((resolve) => {
        mediaRecorder.onstop = () => resolve();
        mediaRecorder.stop();
      });
    }
    return new Blob(chunks, { type: mediaRecorder.mimeType || 'video/webm' });
  }

  const recorder: MeetLocalRecorder = {
    async stop(opts) {
      const blob = await finalizeRecording();
      cleanup();
      const saveToDisk = opts?.saveToDisk !== false;
      const savedWithPicker = saveToDisk ? await saveBlob(blob, fileName) : false;
      return { blob, fileName, savedWithPicker };
    },
    destroy() {
      try {
        if (mediaRecorder.state === 'recording') {
          try {
            mediaRecorder.requestData();
          } catch {
            /* ignore */
          }
          mediaRecorder.stop();
        }
      } catch {
        /* ignore */
      }
      cleanup();
    },
  };

  return { recorder, fileName };
}
