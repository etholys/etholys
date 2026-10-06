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

export type MeetLocalRecorderOptions = {
  suggestedTitle?: string;
  /**
   * Sala CHORUS nativa: rejeita só a aba ACTUAL desta reunião (Chrome apaga o vídeo).
   * Continua a permitir outras abas, janelas ou ecrã inteiro — como Meet/Zoom.
   */
  forbidSelfTab?: boolean;
  /** @deprecated use forbidSelfTab */
  forbidBrowserTab?: boolean;
  /** Se false, não pede mic extra (evita conflito com a câmara/mic da sala). */
  captureMicrophone?: boolean;
  /**
   * `external` = reunião Zoom/Meet/Teams: picker completo e abre na lista de abas
   * (o utilizador deve escolher a aba da reunião externa, NÃO a do CHORUS).
   * `room` = sala CHORUS nativa.
   */
  captureMode?: 'external' | 'room';
};

function stopStream(stream: MediaStream | null | undefined) {
  try {
    stream?.getTracks().forEach((t) => t.stop());
  } catch {
    /* ignore */
  }
}

/** Detecta se o utilizador partilhou a própria aba Etholys/CHORUS. */
function isSelfChorusTabCapture(track: MediaStreamTrack): boolean {
  const label = (track.label || '').toLowerCase();
  if (!label) return false;
  const title = (typeof document !== 'undefined' ? document.title : '').toLowerCase();
  const href = (typeof location !== 'undefined' ? location.href : '').toLowerCase();

  if (title.length >= 8) {
    const tip = title.slice(0, Math.min(40, title.length));
    if (label.includes(tip)) return true;
  }
  if (
    (label.includes('chorus') || label.includes('etholys') || label.includes('fábrica') || label.includes('fabrica')) &&
    (href.includes('/hub/meet') || href.includes('etholys.com') || title.includes('chorus') || title.includes('etholys'))
  ) {
    if (title && label.includes(title.slice(0, 12))) return true;
    // Captura externa: qualquer aba Etholys/CHORUS é a errada
    if (href.includes('/hub/meet/capture') || href.includes('/hub/meet')) return true;
  }
  return false;
}

export async function startMeetLocalRecorder(opts?: MeetLocalRecorderOptions): Promise<{
  recorder: MeetLocalRecorder;
  fileName: string;
}> {
  const fileName = defaultFileName(opts?.suggestedTitle);
  const captureMode = opts?.captureMode || 'room';
  const forbidSelfTab = Boolean(
    opts?.forbidSelfTab || opts?.forbidBrowserTab || captureMode === 'external',
  );
  const captureMicrophone = opts?.captureMicrophone !== false;

  // Picker completo: Pestaña | Ventana | Toda la pantalla.
  // NÃO usar preferCurrentTab — isso mostra só «¿Permitir ver esta pestaña?» (a do CHORUS).
  // Em captura externa, displaySurface:'browser' abre na lista de abas para escolher Meet/Zoom.
  const displayMediaOpts: DisplayMediaStreamOptions = {
    video: {
      frameRate: { ideal: 30 },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      ...(captureMode === 'external' ? { displaySurface: 'browser' as const } : {}),
    },
    audio: true,
    // Esconde a aba actual do CHORUS da lista quando o Chrome suporta
    selfBrowserSurface: 'exclude',
    systemAudio: 'include',
    monitorTypeSurfaces: 'include',
    surfaceSwitching: 'include',
  };

  const display = await navigator.mediaDevices.getDisplayMedia(displayMediaOpts);

  const videoTrack = display.getVideoTracks()[0];
  if (videoTrack && forbidSelfTab && isSelfChorusTabCapture(videoTrack)) {
    stopStream(display);
    throw new Error(
      captureMode === 'external'
        ? 'Escolheste a aba do CHORUS — isso não grava a reunião. Cancela e escolhe a aba do Google Meet, Zoom ou Teams (ou a janela / ecrã inteiro).'
        : 'Essa é a aba desta reunião — o Chrome apaga o vídeo. Escolhe outra aba, uma janela ou o ecrã inteiro.',
    );
  }

  let mic: MediaStream | null = null;
  if (captureMicrophone) {
    try {
      mic = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false,
      });
    } catch {
      /* só áudio do ecrã / sem mic */
    }
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
    stopStream(display);
    stopStream(mic);
    void audioCtx?.close().catch(() => undefined);
    throw new Error(
      captureMode === 'external'
        ? 'Sem vídeo. No diálogo do Chrome escolhe a aba do Meet/Zoom/Teams (com áudio da aba ligado), uma janela ou o ecrã inteiro — nunca a aba do CHORUS.'
        : 'Partilha de ecrã sem vídeo. Escolhe uma aba, uma janela ou o ecrã inteiro no diálogo do browser.',
    );
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
