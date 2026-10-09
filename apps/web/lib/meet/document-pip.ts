/**
 * Janela flutuante do sistema (Document Picture-in-Picture).
 * Fica por cima das outras aplicações. Não se move o iframe já ligado:
 * isso recarrega a sala e derruba a chamada.
 */

type PipApi = {
  requestWindow: (opts?: { width?: number; height?: number }) => Promise<Window>;
  window?: Window | null;
};

export function supportsDocumentFloat(): boolean {
  return typeof window !== 'undefined' && 'documentPictureInPicture' in window;
}

function pipApi(): PipApi | null {
  if (!supportsDocumentFloat()) return null;
  return (window as Window & { documentPictureInPicture?: PipApi }).documentPictureInPicture ?? null;
}

function copyStyles(pipWindow: Window) {
  const head = pipWindow.document.head;
  for (const link of Array.from(document.querySelectorAll('link[rel="stylesheet"]'))) {
    const href = link.getAttribute('href');
    if (!href) continue;
    const clone = pipWindow.document.createElement('link');
    clone.rel = 'stylesheet';
    clone.href = href;
    head.appendChild(clone);
  }
}

export async function openDocumentFloatWindow(width = 420, height = 280): Promise<Window> {
  const api = pipApi();
  if (!api) throw new Error('unsupported');
  if (api.window && !api.window.closed) {
    api.window.focus();
    return api.window;
  }
  const pipWindow = await api.requestWindow({ width, height });
  copyStyles(pipWindow);
  const doc = pipWindow.document;
  doc.documentElement.style.height = '100%';
  doc.body.style.margin = '0';
  doc.body.style.height = '100%';
  doc.body.style.background = '#202124';
  doc.body.style.overflow = 'hidden';
  return pipWindow;
}

export function closeDocumentFloatWindow(pipWindow: Window | null | undefined) {
  if (!pipWindow || pipWindow.closed) return;
  try {
    pipWindow.close();
  } catch {
    /* já fechada */
  }
}
