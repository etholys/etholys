/**
 * Gravação local no browser (fora do iframe Jitsi).
 * O External API `startRecording({ mode: 'local' })` falha de forma fiável dentro do iframe;
 * aqui usamos getDisplayMedia + MediaRecorder e pedimos destino com showSaveFilePicker.
 */

export type MeetLocalRecorder = {
  stop: () => Promise<{ blob: Blob; fileName: string; savedWithPicker: boolean }>;
  destroy: () => void;
};

function defaultFileName(): string {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return `chorus-${stamp}.webm`;
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
    // AbortError = utilizador cancelou
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

export async function startMeetLocalRecorder(): Promise<{
  recorder: MeetLocalRecorder;
  fileName: string;
  usedPicker: boolean;
}> {
  const fileName = defaultFileName();
  const fileHandle = await pickSaveHandle(fileName);

  const display = await navigator.mediaDevices.getDisplayMedia({
    video: {
      frameRate: 30,
      // Preferir a aba Etholys — uma única barra de partilha no Chrome
      displaySurface: 'browser',
    } as MediaTrackConstraints,
    audio: true,
    // Chrome / Edge
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

  let stopResolve: ((blob: Blob) => void) | null = null;
  mediaRecorder.onstop = () => {
    const blob = new Blob(chunks, { type: mediaRecorder.mimeType || 'video/webm' });
    stopResolve?.(blob);
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
    if (mediaRecorder.state === 'recording') mediaRecorder.stop();
  });

  mediaRecorder.start(1000);

  const recorder: MeetLocalRecorder = {
    async stop() {
      const blob =
        mediaRecorder.state === 'inactive'
          ? new Blob(chunks, { type: mediaRecorder.mimeType || 'video/webm' })
          : await new Promise<Blob>((resolve) => {
              stopResolve = resolve;
              mediaRecorder.stop();
            });
      cleanup();
      let savedWithPicker = false;
      if (fileHandle && blob.size > 0) {
        try {
          const writable = await fileHandle.createWritable();
          await writable.write(blob);
          await writable.close();
          savedWithPicker = true;
        } catch {
          triggerDownload(blob, fileName);
        }
      } else if (blob.size > 0) {
        triggerDownload(blob, fileName);
      }
      return { blob, fileName, savedWithPicker };
    },
    destroy() {
      try {
        if (mediaRecorder.state === 'recording') mediaRecorder.stop();
      } catch {
        /* ignore */
      }
      cleanup();
    },
  };

  return { recorder, fileName, usedPicker: Boolean(fileHandle) };
}
