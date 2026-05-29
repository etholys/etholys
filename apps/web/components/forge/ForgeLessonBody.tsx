'use client';

/** Renderização simples de corpo de aula (markdown-lite). */
export function ForgeLessonBody({ body }: { body: string }) {
  const lines = body.split('\n');
  const nodes: React.ReactNode[] = [];

  lines.forEach((line, i) => {
    const t = line.trim();
    if (!t) {
      nodes.push(<div key={i} className="h-2" />);
      return;
    }
    if (t.startsWith('### ')) {
      nodes.push(
        <h4 key={i} className="mt-4 text-sm font-bold text-slate-800">
          {inlineFormat(t.slice(4))}
        </h4>
      );
      return;
    }
    if (t.startsWith('## ')) {
      nodes.push(
        <h3 key={i} className="mt-4 text-base font-bold text-slate-900">
          {inlineFormat(t.slice(3))}
        </h3>
      );
      return;
    }
    if (t.startsWith('- ') || t.startsWith('* ')) {
      nodes.push(
        <li key={i} className="ml-4 list-disc text-slate-700 leading-relaxed">
          {inlineFormat(t.slice(2))}
        </li>
      );
      return;
    }
    nodes.push(
      <p key={i} className="text-slate-700 leading-relaxed">
        {inlineFormat(t)}
      </p>
    );
  });

  return <div className="prose-forge space-y-1 max-w-none">{nodes}</div>;
}

function inlineFormat(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-slate-900">
          {p.slice(2, -2)}
        </strong>
      );
    }
    if (p.startsWith('*') && p.endsWith('*') && !p.startsWith('**')) {
      return <em key={i}>{p.slice(1, -1)}</em>;
    }
    return <span key={i}>{p}</span>;
  });
}
