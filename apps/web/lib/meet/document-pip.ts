/**
 * Janela flutuante do sistema (por cima das outras apps).
 * Não move o iframe da reunião: isso recarrega a sala e derruba a chamada.
 * Espelha o palco num <video> e usa Picture-in-Picture do browser.
 */

export function supportsSystemFloat(): boolean {
  return (
    typeof document !== 'undefined' &&
    typeof HTMLVideoElement !== 'undefined' &&
    'requestPictureInPicture' in HTMLVideoElement.prototype &&
    document.pictureInPictureEnabled !== false
  );
}

type CropCapableTrack = MediaStreamTrack & {
  cropTo?: (target: unknown) => Promise<void>;
};

type CaptureOpts = DisplayMediaStreamOptions & {
  preferCurrentTab?: boolean;
  selfBrowserSurface?: 'include' | 'exclude';
  monitorTypeSurfaces?: 'include' | 'exclude';
  surfaceSwitching?: 'include' | 'exclude';
};

export async function captureMeetStage(stageEl: HTMLElement): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    audio: false,
    video: { displaySurface: 'browser' },
    preferCurrentTab: true,
    selfBrowserSurface: 'include',
    monitorTypeSurfaces: 'exclude',
    surfaceSwitching: 'exclude',
  } as CaptureOpts);

  const [track] = stream.getVideoTracks();
  const cropTarget = (
    window as Window & { CropTarget?: { fromElement: (el: Element) => Promise<unknown> } }
  ).CropTarget;
  const cropTrack = track as CropCapableTrack | undefined;
  if (track && cropTarget && cropTrack?.cropTo) {
    try {
      const target = await cropTarget.fromElement(stageEl);
      await cropTrack.cropTo(target);
    } catch {
      /* Sem recorte: a janela mostra o separador inteiro. A chamada continua. */
    }
  }
  return stream;
}

export function stopMeetStageCapture(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((track) => {
    try {
      track.stop();
    } catch {
      /* ignore */
    }
  });
}

export async function enterVideoPictureInPicture(video: HTMLVideoElement): Promise<void> {
  if (document.pictureInPictureElement === video) return;
  if (document.pictureInPictureElement) {
    await document.exitPictureInPicture();
  }
  await video.requestPictureInPicture();
}

export async function exitVideoPictureInPicture(): Promise<void> {
  if (!document.pictureInPictureElement) return;
  try {
    await document.exitPictureInPicture();
  } catch {
    /* já fechada */
  }
}
