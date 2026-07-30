'use client';

import { useEffect, useId, useState } from 'react';

type Props = {
  source: string;
  className?: string;
};

/** Preview Mermaid no cliente (SSR-safe). */
export function StudioMermaidPreview({ source, className }: Props) {
  const reactId = useId().replace(/:/g, '');
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const code = (source || '').trim();
    if (!code) {
      setSvg(null);
      setError(null);
      return;
    }

    (async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: 'neutral',
          fontFamily: 'Segoe UI, Helvetica, Arial, sans-serif',
        });
        const id = `studio-mmd-${reactId}-${Date.now()}`;
        const { svg: out } = await mermaid.render(id, code);
        if (!cancelled) {
          setSvg(out);
          setError(null);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setSvg(null);
          setError(e instanceof Error ? e.message : 'Diagrama inválido');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [source, reactId]);

  if (!source.trim()) {
    return <p className="text-xs text-slate-400">(diagrama vazio)</p>;
  }
  if (error) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        {error}
      </div>
    );
  }
  if (!svg) {
    return <p className="text-xs text-slate-400">A renderizar diagrama…</p>;
  }
  return (
    <div
      className={className || 'overflow-x-auto rounded-lg border border-slate-200 bg-white p-3'}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
