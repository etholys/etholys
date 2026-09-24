import type { ReactNode } from 'react';

/** Inline: **bold**, *italic*, _italic_, `code`, <u>underline</u> */
export function renderInlineMarkdown(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_|`[^`]+`|<u>[\s\S]*?<\/u>)/gi);
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**') && p.length > 4) {
      return (
        <strong key={i} className="font-semibold">
          {p.slice(2, -2)}
        </strong>
      );
    }
    if (/^<u>/i.test(p) && /<\/u>$/i.test(p)) {
      return <u key={i}>{p.replace(/^<u>/i, '').replace(/<\/u>$/i, '')}</u>;
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
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/&lt;u&gt;([\s\S]*?)&lt;\/u&gt;/gi, '<u>$1</u>');

  const lines = (text || '').split(/\r?\n/);
  const out: string[] = [];
  let listBuf: string[] = [];
  let olBuf: string[] = [];

  const flushList = () => {
    if (!listBuf.length) return;
    out.push(`<ul>${listBuf.map((i) => `<li>${inline(i)}</li>`).join('')}</ul>`);
    listBuf = [];
  };

  const flushOl = () => {
    if (!olBuf.length) return;
    out.push(`<ol>${olBuf.map((i) => `<li>${inline(i)}</li>`).join('')}</ol>`);
    olBuf = [];
  };

  const flushAllLists = () => {
    flushList();
    flushOl();
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const t = line.trim();
    if (!t) {
      flushAllLists();
      out.push('<p>&nbsp;</p>');
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) {
      flushAllLists();
      out.push('<hr/>');
      continue;
    }
    if (/^#{1,3}\s+/.test(t)) {
      flushAllLists();
      const level = (t.match(/^#+/)?.[0].length || 1) as 1 | 2 | 3;
      const body = t.replace(/^#{1,3}\s+/, '');
      const tag = level === 1 ? 'h2' : level === 2 ? 'h3' : 'h4';
      out.push(`<${tag}>${inline(body)}</${tag}>`);
      continue;
    }
    if (/^[-*•]\s+/.test(t)) {
      flushOl();
      listBuf.push(t.replace(/^[-*•]\s+/, ''));
      continue;
    }
    if (/^\d+\.\s+/.test(t)) {
      flushList();
      olBuf.push(t.replace(/^\d+\.\s+/, ''));
      continue;
    }
    flushAllLists();
    out.push(`<p>${inline(t)}</p>`);
  }
  flushAllLists();
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
      <h2
        className={`text-[1.65rem] font-bold leading-snug tracking-tight [font-family:var(--font-etholys-display),ui-sans-serif,system-ui,sans-serif] ${className || ''}`}
      >
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
      <ul
        className={`list-disc space-y-2 pl-5 text-[15px] leading-[1.75] marker:text-current/40 ${className || ''}`}
      >
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
  let olItems: string[] = [];

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

  const flushOl = (keyBase: number) => {
    if (!olItems.length) return;
    nodes.push(
      <ol key={`ol-${keyBase}`} className="my-2 list-decimal space-y-1 pl-5">
        {olItems.map((item, j) => (
          <li key={j}>{renderInlineMarkdown(item)}</li>
        ))}
      </ol>,
    );
    olItems = [];
  };

  const flushAllLists = (keyBase: number) => {
    flushList(keyBase);
    flushOl(keyBase);
  };

  lines.forEach((line, i) => {
    const t = line.trim();
    if (!t) {
      flushAllLists(i);
      nodes.push(<div key={`sp-${i}`} className="h-2" />);
      return;
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) {
      flushAllLists(i);
      nodes.push(<hr key={i} className="my-3 border-gray-200" />);
      return;
    }
    if (/^###\s+/.test(t)) {
      flushAllLists(i);
      nodes.push(
        <h4 key={i} className="mt-3 text-base font-bold">
          {renderInlineMarkdown(t.slice(4))}
        </h4>,
      );
      return;
    }
    if (/^##\s+/.test(t)) {
      flushAllLists(i);
      nodes.push(
        <h3 key={i} className="mt-4 text-lg font-bold">
          {renderInlineMarkdown(t.slice(3))}
        </h3>,
      );
      return;
    }
    if (/^#\s+/.test(t)) {
      flushAllLists(i);
      nodes.push(
        <h2 key={i} className="mt-4 text-xl font-bold">
          {renderInlineMarkdown(t.slice(2))}
        </h2>,
      );
      return;
    }
    if (/^[-*•]\s+/.test(t)) {
      flushOl(i);
      listItems.push(t.replace(/^[-*•]\s+/, ''));
      return;
    }
    if (/^\d+\.\s+/.test(t)) {
      flushList(i);
      olItems.push(t.replace(/^\d+\.\s+/, ''));
      return;
    }
    flushAllLists(i);
    nodes.push(
      <p key={i} className="text-[15px] leading-[1.7]">
        {renderInlineMarkdown(t)}
      </p>,
    );
  });
  flushAllLists(lines.length);

  return <div className={`space-y-0.5 ${className || ''}`}>{nodes}</div>;
}
