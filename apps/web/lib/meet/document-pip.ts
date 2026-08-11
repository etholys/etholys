/**
 * Document Picture-in-Picture: move o contentor da sala para uma janela flutuante
 * (continua a mesma sessão Jitsi — sem segundo join).
 */

export function supportsDocumentPictureInPicture(): boolean {
  return typeof window !== 'undefined' && 'documentPictureInPicture' in window;
}

type PipApi = {
  requestWindow: (opts?: { width?: number; height?: number }) => Promise<Window>;
};

export async function openMeetDocumentPip(opts: {
  stageEl: HTMLElement;
  homeEl: HTMLElement;
  onClose?: () => void;
}): Promise<Window> {
  const api = (window as Window & { documentPictureInPicture?: PipApi }).documentPictureInPicture;
  if (!api) {
    throw new Error('Document Picture-in-Picture not supported');
  }

  const pipWindow = await api.requestWindow({ width: 480, height: 320 });
  const { stageEl, homeEl, onClose } = opts;

  try {
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        const rules = sheet.cssRules;
        if (!rules) continue;
        const style = pipWindow.document.createElement('style');
        let text = '';
        for (const rule of Array.from(rules)) text += `${rule.cssText}\n`;
        style.textContent = text;
        pipWindow.document.head.appendChild(style);
      } catch {
        /* CSS cross-origin — ignorar */
      }
    }
  } catch {
    /* ignore */
  }

  pipWindow.document.documentElement.style.height = '100%';
  pipWindow.document.body.style.margin = '0';
  pipWindow.document.body.style.height = '100%';
  pipWindow.document.body.style.background = '#202124';
  pipWindow.document.body.style.overflow = 'hidden';

  stageEl.style.width = '100%';
  stageEl.style.height = '100%';
  pipWindow.document.body.appendChild(stageEl);

  const restore = () => {
    if (stageEl.parentElement !== homeEl) {
      homeEl.appendChild(stageEl);
      stageEl.style.width = '';
      stageEl.style.height = '';
    }
    onClose?.();
  };

  pipWindow.addEventListener('pagehide', restore, { once: true });
  return pipWindow;
}
