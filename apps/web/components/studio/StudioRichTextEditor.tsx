'use client';

import { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import {
  studioEditorHtmlToText,
  studioEditorSelectionAtDocEnd,
  studioEditorSelectionAtDocStart,
  studioSafeEditorSerializedText,
  studioTextToEditorHtml,
} from '@/lib/studio/rich-text';
import {
  consumeStudioWriteBlockCaret,
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
  /** Backspace no início de bloco com texto — fundir com o anterior */
  onMergeWithPrev?: () => boolean | void;
  /** Seta ↓ no fim → bloco seguinte */
  onFocusNext?: () => void;
  /** Enter — novo parágrafo (split); Shift+Enter — quebra de linha */
  onSplitAfter?: (afterText: string) => void;
  /** Delete no fim — fundir com o bloco seguinte */
  onMergeWithNext?: () => void;
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
  onMergeWithPrev,
  onFocusNext,
  onFocusPrev,
  onSplitAfter,
  onMergeWithNext,
}: Props) {
  const cbs = useRef({
    onChange,
    onInsertAfter,
    onBackspaceEmpty,
    onMergeWithPrev,
    onFocusNext,
    onFocusPrev,
    onSplitAfter,
    onMergeWithNext,
  });
  cbs.current = {
    onChange,
    onInsertAfter,
    onBackspaceEmpty,
    onMergeWithPrev,
    onFocusNext,
    onFocusPrev,
    onSplitAfter,
    onMergeWithNext,
  };
  /** Evita que o efeito de sync prop→editor restaure texto obsoleto ao mudar para o chat. */
  const lastEmittedRef = useRef(text);

  const emitSerialized = (ed: { getHTML: () => string; state: { doc: { textContent: string } } }) => {
    const safe = studioSafeEditorSerializedText(ed.getHTML(), ed.state.doc.textContent.length);
    if (safe === null) return;
    lastEmittedRef.current = safe;
    cbs.current.onChange(safe);
  };

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        hardBreak: { keepMarks: true },
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
        if (event.key === 'Enter' && !event.metaKey && !event.ctrlKey && !event.altKey) {
          if (event.shiftKey) return false;
          if (cbs.current.onSplitAfter) {
            const { empty, $from } = view.state.selection;
            if (empty) {
              const plain = view.state.doc.textContent;
              const offset = $from.parentOffset;
              const before = plain.slice(0, offset);
              const after = plain.slice(offset);
              event.preventDefault();
              cbs.current.onChange(before);
              cbs.current.onSplitAfter(after);
              return true;
            }
          }
        }
        if (event.key === 'Delete' && cbs.current.onMergeWithNext) {
          const plain = view.state.doc.textContent;
          const { empty, $to } = view.state.selection;
          if (
            studioEditorSelectionAtDocEnd($to, empty) &&
            plain.trim()
          ) {
            event.preventDefault();
            cbs.current.onMergeWithNext();
            return true;
          }
        }
        if (event.key === 'Backspace') {
          const plain = view.state.doc.textContent;
          const { empty, $from } = view.state.selection;
          if (studioEditorSelectionAtDocStart($from, empty)) {
            if (!plain.trim() && cbs.current.onBackspaceEmpty) {
              event.preventDefault();
              cbs.current.onBackspaceEmpty();
              return true;
            }
            if (plain.trim() && cbs.current.onMergeWithPrev) {
              const merged = cbs.current.onMergeWithPrev();
              if (merged) {
                event.preventDefault();
                return true;
              }
            }
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
      emitSerialized(ed);
    },
    onFocus: ({ editor: ed }) => {
      setStudioWriteFocus({ editor: ed, blockId, pageId });
    },
    onBlur: ({ editor: ed }) => {
      emitSerialized(ed);
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
    if (current === text) {
      lastEmittedRef.current = text;
      return;
    }
    if (editor.isFocused) return;
    // Parent ainda não recebeu o último onChange — não clobber o editor
    if (current === lastEmittedRef.current && text !== lastEmittedRef.current) return;
    editor.commands.setContent(studioTextToEditorHtml(text, kind), false);
    lastEmittedRef.current = text;
  }, [editor, text, kind]);

  useEffect(() => {
    return subscribeStudioWriteBlockFocus((id) => {
      if (id !== blockId || !editor || editor.isDestroyed) return;
      const caret = consumeStudioWriteBlockCaret(blockId);
      if (typeof caret === 'number') {
        const pos = Math.min(Math.max(1, caret + 1), editor.state.doc.content.size);
        editor.chain().focus().setTextSelection(pos).run();
      } else {
        editor.commands.focus('end');
      }
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
