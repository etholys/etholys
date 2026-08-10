import type { ReactNode } from 'react';

/** Inline: **bold**, *italic*, _italic_, `code` */
export function renderInlineMarkdown(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_|`[^`]+`)/g);
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**') && p.length > 4) {
      return (
        <strong key={i} className="font-semibold text-slate-900">
          {p.slice(2, -2)}
        </strong>
      );
    }
    if (
      ((p.startsWith('*') && p.endsWith('*')) || (p.startsWith('_') && p.endsWith('_'))) &&
      p.length > 2 &&
      !p.startsWith('**')
    ) {
      return <em key={i}>{p.slice(1, -1)}</em>;
    }
    if (p.startsWith('`') && p.endsWith('`') && p.length > 2) {
      return (
        <code key={i} className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.9em] text-slate-800">
          {p.slice(1, -1)}
        </code>
      );
    }
    return <span key={i}>{p}</span>;
  });
}

/** Escapar + markdown-lite → HTML (export PDF/DOCX). */
export function markdownLiteToHtml(text: string): string {
  const esc = (s: string) =>
    String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const inline = (s: string) =>
    esc(s)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/_([^_]+)_/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');

  const lines = (text || '').split(/\r?\n/);
  const out: string[] = [];
  let listBuf: string[] = [];

  const flushList = () => {
    if (!listBuf.length) return;
    out.push(`<ul>${listBuf.map((i) => `<li>${inline(i)}</li>`).join('')}</ul>`);
    listBuf = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const t = line.trim();
    if (!t) {
      flushList();
      out.push('<p>&nbsp;</p>');
      continue;
    }
    if (/^#{1,3}\s+/.test(t)) {
      flushList();
      const level = (t.match(/^#+/)?.[0].length || 1) as 1 | 2 | 3;
      const body = t.replace(/^#{1,3}\s+/, '');
      const tag = level === 1 ? 'h2' : level === 2 ? 'h3' : 'h4';
      out.push(`<${tag}>${inline(body)}</${tag}>`);
      continue;
    }
    if (/^[-*•]\s+/.test(t)) {
      listBuf.push(t.replace(/^[-*•]\s+/, ''));
      continue;
    }
    flushList();
    out.push(`<p>${inline(t)}</p>`);
  }
  flushList();
  return out.join('\n') || '<p>&nbsp;</p>';
}

type StudioMarkdownProps = {
  text: string;
  variant?: 'body' | 'heading' | 'callout' | 'bullets';
  className?: string;
  emptyHint?: string;
};

/** Preview tipográfico de markdown-lite no canvas do Studio. */
export function StudioMarkdown({
  text,
  variant = 'body',
  className,
  emptyHint,
}: StudioMarkdownProps) {
  const raw = text || '';
  if (!raw.trim()) {
    return (
      <p className={`text-[15px] italic text-slate-400 ${className || ''}`}>
        {emptyHint || '…'}
      </p>
    );
  }

  if (variant === 'heading') {
    return (
      <h2 className={`text-2xl font-bold leading-snug text-slate-900 ${className || ''}`}>
        {renderInlineMarkdown(raw.replace(/^#+\s*/, ''))}
      </h2>
    );
  }

  if (variant === 'bullets') {
    const items = raw
      .split(/\r?\n/)
      .map((l) => l.replace(/^[-*•]\s*/, '').trim())
      .filter(Boolean);
    return (
      <ul className={`list-disc space-y-1.5 pl-5 text-[15px] leading-[1.7] text-slate-800 ${className || ''}`}>
        {items.map((item, i) => (
          <li key={i}>{renderInlineMarkdown(item)}</li>
        ))}
      </ul>
    );
  }

  if (variant === 'callout') {
    return (
      <div
        className={`rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-3 text-[15px] leading-[1.7] text-amber-950 ${className || ''}`}
      >
        {raw.split(/\r?\n/).map((line, i) => (
          <p key={i} className={i > 0 ? 'mt-2' : undefined}>
            {renderInlineMarkdown(line) || '\u00a0'}
          </p>
        ))}
      </div>
    );
  }

  const lines = raw.split(/\r?\n/);
  const nodes: ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = (keyBase: number) => {
    if (!listItems.length) return;
    nodes.push(
      <ul key={`ul-${keyBase}`} className="my-2 list-disc space-y-1 pl-5">
        {listItems.map((item, j) => (
          <li key={j}>{renderInlineMarkdown(item)}</li>
        ))}
      </ul>,
    );
    listItems = [];
  };

  lines.forEach((line, i) => {
    const t = line.trim();
    if (!t) {
      flushList(i);
      nodes.push(<div key={`sp-${i}`} className="h-2" />);
      return;
    }
    if (/^###\s+/.test(t)) {
      flushList(i);
      nodes.push(
        <h4 key={i} className="mt-3 text-base font-bold text-slate-800">
          {renderInlineMarkdown(t.slice(4))}
        </h4>,
      );
      return;
    }
    if (/^##\s+/.test(t)) {
      flushList(i);
      nodes.push(
        <h3 key={i} className="mt-4 text-lg font-bold text-slate-900">
          {renderInlineMarkdown(t.slice(3))}
        </h3>,
      );
      return;
    }
    if (/^#\s+/.test(t)) {
      flushList(i);
      nodes.push(
        <h2 key={i} className="mt-4 text-xl font-bold text-slate-900">
          {renderInlineMarkdown(t.slice(2))}
        </h2>,
      );
      return;
    }
    if (/^[-*•]\s+/.test(t)) {
      listItems.push(t.replace(/^[-*•]\s+/, ''));
      return;
    }
    flushList(i);
    nodes.push(
      <p key={i} className="text-[15px] leading-[1.7] text-slate-800">
        {renderInlineMarkdown(t)}
      </p>,
    );
  });
  flushList(lines.length);

  return <div className={`space-y-0.5 ${className || ''}`}>{nodes}</div>;
}
