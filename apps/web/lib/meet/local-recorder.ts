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

/** Identifica esta página no Capture Handle (Chrome) para rejeitar auto-gravação. */
export const CHORUS_EXTERNAL_CAPTURE_HANDLE = 'etholys-chorus-external-capture';

export const MEET_CAPTURE_SELF_TAB_CODE = 'MEET_CAPTURE_SELF_TAB';

export function isMeetCaptureSelfTabError(err: unknown): boolean {
  return Boolean(
    err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code?: string }).code === MEET_CAPTURE_SELF_TAB_CODE,
  );
}

/** Regista a página de captura externa para detetar se o utilizador partilhou esta aba. */
export function registerExternalCaptureHandle(): void {
  try {
    const md = navigator.mediaDevices as MediaDevices & {
      setCaptureHandleConfig?: (cfg: {
        handle: string;
        permittedOrigins?: string[];
        exposeOrigin?: boolean;
      }) => void;
    };
    md.setCaptureHandleConfig?.({
      handle: CHORUS_EXTERNAL_CAPTURE_HANDLE,
      permittedOrigins: ['*'],
      exposeOrigin: true,
    });
  } catch {
    /* API opcional */
  }
}

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

export async function saveMeetRecordingBlob(blob: Blob, fileName: string): Promise<boolean> {
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
   * Captura externa (Zoom/Teams): rejeita a aba do CHORUS.
   * Na sala nativa a aba actual TEM de aparecer — é a chamada.
   */
  forbidSelfTab?: boolean;
  /** @deprecated use forbidSelfTab */
  forbidBrowserTab?: boolean;
  /** Se false, não pede mic extra (evita conflito com a câmara/mic da sala). */
  captureMicrophone?: boolean;
  /**
   * `external` = reunião Zoom/Meet/Teams: exclui esta aba Etholys/CHORUS.
   * `room` = sala CHORUS nativa (preferCurrentTab + incluir self).
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

function selfTabError(message: string): Error {
  return Object.assign(new Error(message), { code: MEET_CAPTURE_SELF_TAB_CODE });
}

/** Detecta se o utilizador partilhou a própria aba Etholys/CHORUS (captura externa). */
function isSelfChorusTabCapture(track: MediaStreamTrack): boolean {
  try {
    const handle = (
      track as MediaStreamTrack & {
        getCaptureHandle?: () => { handle?: string; origin?: string } | null;
      }
    ).getCaptureHandle?.();
    if (handle?.handle === CHORUS_EXTERNAL_CAPTURE_HANDLE) return true;
  } catch {
    /* ignore */
  }

  const label = (track.label || '').toLowerCase().trim();
  const title = (typeof document !== 'undefined' ? document.title : '').toLowerCase();
  const href = (typeof location !== 'undefined' ? location.href : '').toLowerCase();
  const host = (typeof location !== 'undefined' ? location.hostname : '').toLowerCase();
  const onChorusCapture =
    href.includes('/hub/meet/capture') ||
    href.includes('/hub/meet') ||
    host.includes('etholys');

  if (!label) {
    // Sem label: Capture Handle é a via fiável; se falhou, não bloquear por defeito.
    return false;
  }

  if (title.length >= 6) {
    const tip = title.slice(0, Math.min(40, title.length));
    if (label.includes(tip)) return true;
  }

  if (host && label.includes(host) && onChorusCapture) return true;

  if (
    (label.includes('chorus') ||
      label.includes('etholys') ||
      label.includes('fábrica') ||
      label.includes('fabrica') ||
      label.includes('reunion externa') ||
      label.includes('reunião externa') ||
      label.includes('reunión externa')) &&
    onChorusCapture
  ) {
    return true;
  }

  return false;
}

type DisplayMediaOpts = DisplayMediaStreamOptions & {
  preferCurrentTab?: boolean;
  selfBrowserSurface?: 'include' | 'exclude';
  systemAudio?: 'include' | 'exclude';
  monitorTypeSurfaces?: 'include' | 'exclude';
  surfaceSwitching?: 'include' | 'exclude';
};

export async function startMeetLocalRecorder(opts?: MeetLocalRecorderOptions): Promise<{
  recorder: MeetLocalRecorder;
  fileName: string;
}> {
  const fileName = defaultFileName(opts?.suggestedTitle);
  const captureMode = opts?.captureMode || 'room';
  const recordingThisCall = captureMode === 'room';
  const forbidSelfTab = Boolean(
    opts?.forbidSelfTab || opts?.forbidBrowserTab || captureMode === 'external',
  );
  const captureMicrophone = opts?.captureMicrophone !== false;

  if (captureMode === 'external') {
    registerExternalCaptureHandle();
  }

  // Sala CHORUS: a aba desta chamada entra na lista (preferCurrentTab + selfBrowserSurface).
  // Captura externa: esconde a aba do CHORUS; deixa Window/Screen/Tab (outra) para Zoom/Teams/Meet.
  const videoConstraints: MediaTrackConstraints & { displaySurface?: string } = {
    frameRate: { ideal: 30 },
    width: { ideal: 1920 },
    height: { ideal: 1080 },
  };
  // Só na sala forçamos preferência por aba do browser (a própria chamada).
  if (recordingThisCall) {
    videoConstraints.displaySurface = 'browser';
  }

  const displayMediaOpts: DisplayMediaOpts = {
    video: videoConstraints,
    audio: true,
    preferCurrentTab: recordingThisCall,
    selfBrowserSurface: recordingThisCall ? 'include' : 'exclude',
    systemAudio: 'include',
    monitorTypeSurfaces: 'include',
    surfaceSwitching: recordingThisCall ? 'include' : 'exclude',
  };

  const display = await navigator.mediaDevices.getDisplayMedia(displayMediaOpts);

  const videoTrack = display.getVideoTracks()[0];
  if (videoTrack && forbidSelfTab && isSelfChorusTabCapture(videoTrack)) {
    stopStream(display);
    throw selfTabError(
      'SELF_TAB: escolheste a aba do CHORUS — isso não grava a reunião externa.',
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
        ? 'Sem vídeo. No diálogo do browser escolhe a aba/janela da reunião externa (Zoom, Teams, Meet) com áudio da aba — nunca a aba do CHORUS.'
        : 'Partilha sem vídeo. No diálogo escolhe esta aba do CHORUS (áudio da aba ligado), uma janela ou o ecrã inteiro.',
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
      const savedWithPicker = saveToDisk ? await saveMeetRecordingBlob(blob, fileName) : false;
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
