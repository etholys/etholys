'use client';

import { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import {
  studioEditorHtmlToText,
  studioTextToEditorHtml,
} from '@/lib/studio/rich-text';
import {
  getStudioWriteFocus,
  setStudioWriteFocus,
  subscribeStudioWriteBlockFocus,
} from '@/lib/studio/write-editor-bus';

type Props = {
  blockId: string;
  pageId: string;
  text: string;
  kind?: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  onChange: (text: string) => void;
  /** Ctrl/Cmd+Enter — nova secção abaixo */
  onInsertAfter?: () => void;
  /** Backspace no início de bloco vazio */
  onBackspaceEmpty?: () => void;
  /** Seta ↓ no fim → bloco seguinte */
  onFocusNext?: () => void;
  /** Seta ↑ no início → bloco anterior */
  onFocusPrev?: () => void;
};

/**
 * Editor rico (TipTap) para modo Redação — seleção real + ribbon + teclas tipo Docs.
 * Persiste markdown-lite em `block.text` para IA/export.
 */
export function StudioRichTextEditor({
  blockId,
  pageId,
  text,
  kind,
  disabled,
  placeholder,
  className,
  onChange,
  onInsertAfter,
  onBackspaceEmpty,
  onFocusNext,
  onFocusPrev,
}: Props) {
  const cbs = useRef({ onChange, onInsertAfter, onBackspaceEmpty, onFocusNext, onFocusPrev });
  cbs.current = { onChange, onInsertAfter, onBackspaceEmpty, onFocusNext, onFocusPrev };

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
      }),
      Underline,
      Placeholder.configure({
        placeholder: placeholder || 'Comece a escrever…',
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
    ],
    content: studioTextToEditorHtml(text, kind),
    editable: !disabled,
    editorProps: {
      attributes: {
        class:
          className ||
          'studio-rich-editor min-h-[1.5em] w-full outline-none focus:outline-none',
      },
      handleKeyDown: (view, event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
          event.preventDefault();
          cbs.current.onInsertAfter?.();
          return true;
        }
        if (event.key === 'Backspace' && cbs.current.onBackspaceEmpty) {
          const plain = view.state.doc.textContent.trim();
          const { empty, $from } = view.state.selection;
          if (plain === '' && empty && $from.parentOffset === 0) {
            event.preventDefault();
            cbs.current.onBackspaceEmpty();
            return true;
          }
        }
        if (event.key === 'ArrowDown' && !event.shiftKey && cbs.current.onFocusNext) {
          const { $to } = view.state.selection;
          if ($to.pos >= view.state.doc.content.size - 1) {
            event.preventDefault();
            cbs.current.onFocusNext();
            return true;
          }
        }
        if (event.key === 'ArrowUp' && !event.shiftKey && cbs.current.onFocusPrev) {
          const { $from } = view.state.selection;
          if ($from.pos <= 1) {
            event.preventDefault();
            cbs.current.onFocusPrev();
            return true;
          }
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      cbs.current.onChange(studioEditorHtmlToText(ed.getHTML()));
    },
    onFocus: ({ editor: ed }) => {
      setStudioWriteFocus({ editor: ed, blockId, pageId });
    },
    onBlur: ({ editor: ed }) => {
      requestAnimationFrame(() => {
        const f = getStudioWriteFocus();
        if (f?.editor === ed) setStudioWriteFocus(null);
      });
    },
  });

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.setEditable(!disabled);
  }, [editor, disabled]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const current = studioEditorHtmlToText(editor.getHTML());
    if (current === text) return;
    if (editor.isFocused) return;
    editor.commands.setContent(studioTextToEditorHtml(text, kind), false);
  }, [editor, text, kind]);

  useEffect(() => {
    return subscribeStudioWriteBlockFocus((id) => {
      if (id !== blockId || !editor || editor.isDestroyed) return;
      editor.commands.focus('end');
      setStudioWriteFocus({ editor, blockId, pageId });
    });
  }, [editor, blockId, pageId]);

  useEffect(() => {
    return () => {
      const f = getStudioWriteFocus();
      if (f?.blockId === blockId) setStudioWriteFocus(null);
    };
  }, [blockId]);

  if (!editor) {
    return <div className="min-h-[1.5em] text-slate-400">{placeholder || '…'}</div>;
  }

  return <EditorContent editor={editor} />;
}
