/**
 * Document Picture-in-Picture: janela flutuante do sistema (Chrome/Edge 116+).
 * Move o contentor da sala sem recriar o iframe Jitsi.
 */

export function supportsDocumentPictureInPicture(): boolean {
  return typeof window !== 'undefined' && 'documentPictureInPicture' in window;
}

type PipApi = {
  requestWindow: (opts?: { width?: number; height?: number }) => Promise<Window>;
  window?: Window | null;
};

function copyStylesToPipWindow(pipWindow: Window) {
  const head = pipWindow.document.head;
  for (const link of Array.from(document.querySelectorAll('link[rel="stylesheet"]'))) {
    const href = link.getAttribute('href');
    if (!href) continue;
    const clone = pipWindow.document.createElement('link');
    clone.rel = 'stylesheet';
    clone.href = href;
    head.appendChild(clone);
  }
  try {
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        const rules = sheet.cssRules;
        if (!rules) continue;
        const style = pipWindow.document.createElement('style');
        let text = '';
        for (const rule of Array.from(rules)) text += `${rule.cssText}\n`;
        style.textContent = text;
        head.appendChild(style);
      } catch {
        /* CSS cross-origin */
      }
    }
  } catch {
    /* ignore */
  }
}

export async function openMeetDocumentPip(opts: {
  stageEl: HTMLElement;
  homeEl: HTMLElement;
  onClose?: () => void;
  width?: number;
  height?: number;
}): Promise<Window> {
  const api = (window as Window & { documentPictureInPicture?: PipApi }).documentPictureInPicture;
  if (!api) {
    throw new Error('Document Picture-in-Picture not supported');
  }

  if (api.window && !api.window.closed) {
    api.window.focus();
    return api.window;
  }

  const pipWindow = await api.requestWindow({
    width: opts.width ?? 420,
    height: opts.height ?? 280,
  });
  const { stageEl, homeEl, onClose } = opts;

  copyStylesToPipWindow(pipWindow);

  pipWindow.document.documentElement.style.height = '100%';
  pipWindow.document.body.style.margin = '0';
  pipWindow.document.body.style.height = '100%';
  pipWindow.document.body.style.background = '#0f172a';
  pipWindow.document.body.style.overflow = 'hidden';

  stageEl.style.width = '100%';
  stageEl.style.height = '100%';
  stageEl.style.position = 'relative';
  stageEl.style.inset = '';
  pipWindow.document.body.appendChild(stageEl);

  const restore = () => {
    if (stageEl.parentElement !== homeEl) {
      homeEl.appendChild(stageEl);
      stageEl.style.width = '';
      stageEl.style.height = '';
      stageEl.style.position = '';
      stageEl.style.inset = '';
    }
    onClose?.();
  };

  pipWindow.addEventListener('pagehide', restore, { once: true });
  return pipWindow;
}

export function closeMeetDocumentPipWindow(pipWindow: Window | null | undefined) {
  if (pipWindow && !pipWindow.closed) {
    try {
      pipWindow.close();
    } catch {
      /* ignore */
    }
  }
}
