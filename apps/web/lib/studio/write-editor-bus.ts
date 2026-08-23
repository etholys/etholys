'use client';

import type { Editor } from '@tiptap/react';

export type StudioWriteCommand =
  | { type: 'bold' }
  | { type: 'italic' }
  | { type: 'underline' }
  | { type: 'heading' }
  | { type: 'paragraph' }
  | { type: 'bulletList' }
  | { type: 'align'; align: 'left' | 'center' | 'right' | 'justify' };

type Focused = {
  editor: Editor;
  blockId: string;
  pageId: string;
};

let focused: Focused | null = null;
const listeners = new Set<() => void>();
const focusTargetListeners = new Set<(blockId: string) => void>();

function notify() {
  listeners.forEach((l) => l());
}

export function setStudioWriteFocus(next: Focused | null) {
  focused = next;
  notify();
}

export function getStudioWriteFocus(): Focused | null {
  return focused;
}

export function subscribeStudioWriteFocus(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Pede foco ao TipTap de um bloco (após criar secção / setas). */
export function requestStudioWriteBlockFocus(blockId: string) {
  focusTargetListeners.forEach((l) => l(blockId));
}

export function subscribeStudioWriteBlockFocus(fn: (blockId: string) => void): () => void {
  focusTargetListeners.add(fn);
  return () => focusTargetListeners.delete(fn);
}

/** Executa comando na seleção TipTap focada. Devolve false se não houver editor. */
export function runStudioWriteCommand(cmd: StudioWriteCommand): boolean {
  const ed = focused?.editor;
  if (!ed || ed.isDestroyed) return false;
  const chain = ed.chain().focus();
  switch (cmd.type) {
    case 'bold':
      chain.toggleBold().run();
      return true;
    case 'italic':
      chain.toggleItalic().run();
      return true;
    case 'underline':
      chain.toggleUnderline().run();
      return true;
    case 'heading':
      chain.toggleHeading({ level: 2 }).run();
      return true;
    case 'paragraph':
      chain.setParagraph().run();
      return true;
    case 'bulletList':
      chain.toggleBulletList().run();
      return true;
    case 'align':
      chain.setTextAlign(cmd.align).run();
      return true;
    default:
      return false;
  }
}
