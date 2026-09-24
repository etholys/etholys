'use client';

import { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold,
  Heading1,
  Heading2,
  Italic,
  List,
  ListOrdered,
  Underline as UnderlineIcon,
} from 'lucide-react';
import {
  studioEditorHtmlToText,
  studioSafeEditorSerializedText,
  studioTextToEditorHtml,
} from '@/lib/studio/rich-text';
import { cn } from '@/lib/utils';

type Props = {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

function ToolBtn({
  active,
  onClick,
  label,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cn(
        'inline-flex h-7 w-7 items-center justify-center rounded-md text-current/70 transition hover:bg-white/10 hover:text-current',
        active && 'bg-white/12 text-current',
      )}
    >
      {children}
    </button>
  );
}

/** TipTap surface: headings/bold/lists on screen; markdown-lite on the wire. */
export function RichTextPane({ value, onChange, placeholder, disabled, className }: Props) {
  const lastEmitted = useRef(value);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
        blockquote: false,
        code: false,
      }),
      Underline,
      Placeholder.configure({
        placeholder: placeholder || 'Comece a escrever…',
      }),
    ],
    content: studioTextToEditorHtml(value),
    editable: !disabled,
    editorProps: {
      attributes: {
        class: 'etholys-prose min-h-full w-full px-5 py-4 outline-none',
      },
    },
    onUpdate: ({ editor: ed }) => {
      const safe = studioSafeEditorSerializedText(ed.getHTML(), ed.state.doc.textContent.length);
      if (safe === null) return;
      lastEmitted.current = safe;
      onChangeRef.current(safe);
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [editor, disabled]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const current = studioEditorHtmlToText(editor.getHTML());
    if (current === value) {
      lastEmitted.current = value;
      return;
    }
    if (editor.isFocused) return;
    if (current === lastEmitted.current && value !== lastEmitted.current) return;
    editor.commands.setContent(studioTextToEditorHtml(value), false);
    lastEmitted.current = value;
  }, [editor, value]);

  if (!editor) {
    return <div className={cn('min-h-0 flex-1', className)} />;
  }

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
      <div className="flex flex-wrap items-center gap-0.5 border-b border-white/10 px-2 py-1.5">
        <ToolBtn
          label="Título"
          active={editor.isActive('heading', { level: 1 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        >
          <Heading1 className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn
          label="Subtítulo"
          active={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn
          label="Negrito"
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn
          label="Itálico"
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn
          label="Sublinhado"
          active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn
          label="Lista"
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn
          label="Lista numerada"
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolBtn>
      </div>
      <div className="fh-pane-scroll min-h-0 flex-1">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
