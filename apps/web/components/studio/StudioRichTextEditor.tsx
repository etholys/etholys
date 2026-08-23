'use client';

import { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import {
  studioEditorHtmlToText,
  studioTextToEditorHtml,
} from '@/lib/studio/rich-text';
import { getStudioWriteFocus, setStudioWriteFocus } from '@/lib/studio/write-editor-bus';

type Props = {
  blockId: string;
  pageId: string;
  text: string;
  kind?: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  onChange: (text: string) => void;
};

/**
 * Editor rico (TipTap) para modo Redação — seleção real + ribbon.
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
}: Props) {
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
    },
    onUpdate: ({ editor: ed }) => {
      onChange(studioEditorHtmlToText(ed.getHTML()));
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
