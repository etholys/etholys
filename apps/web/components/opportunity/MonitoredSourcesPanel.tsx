'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '@/app/providers';
import { isLikelyDbId } from '@/lib/utils';
import { Link2, Loader2, Plus, Trash2 } from 'lucide-react';

type Source = {
  id: string;
  label: string;
  url: string;
  languages: string;
};

export function MonitoredSourcesPanel({ compact }: { compact?: boolean }) {
  const { locale, activeCompanyId } = useApp();
  const companyId = useMemo(() => {
    const s = String(activeCompanyId ?? '').trim();
    return isLikelyDbId(s) ? s : '';
  }, [activeCompanyId]);

  const t = (pt: string, es: string, en: string) =>
    locale === 'pt' ? pt : locale === 'es' ? es : en;

  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const q = (path: string) =>
    `${path}${path.includes('?') ? '&' : '?'}companyId=${encodeURIComponent(companyId)}`;

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const r = await fetch(q('/api/opportunity/sources'), { cache: 'no-store' });
      const d = (await r.json()) as { sources?: Source[] };
      if (r.ok) setSources(d.sources ?? []);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const add = async () => {
    if (!url.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(q('/api/opportunity/sources'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: label.trim() || url.trim(), url: url.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Erro');
      setLabel('');
      setUrl('');
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (sourceId: string) => {
    setBusy(true);
    try {
      await fetch(`${q('/api/opportunity/sources')}&sourceId=${encodeURIComponent(sourceId)}`, {
        method: 'DELETE',
      });
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (!companyId) return null;

  return (
    <div className={compact ? 'mt-4 border-t border-gray-100 pt-4' : 'rounded-xl border border-gray-200 bg-white p-5'}>
      <div className="flex items-center gap-2">
        <Link2 className="h-4 w-4 text-amber-600" />
        <h3 className="text-sm font-semibold text-gray-900">
          {t('Portais que já conheço (extra)', 'Portales que ya conozco (extra)', 'Portals I already know (extra)')}
        </h3>
      </div>
      <p className="mt-1 text-xs text-gray-500">
        {t(
          'Opcional — só se já conhece um portal específico e quer que a próxima varredura o cruze. A descoberta principal vem do briefing, não disto.',
          'Opcional — solo si ya conoce un portal y quiere cruzarlo. La búsqueda principal viene del briefing.',
          'Optional — only if you already know a portal and want the next scan to cross-check it. Main discovery comes from the briefing.',
        )}
      </p>

      <div className={`mt-3 flex gap-2 ${compact ? 'flex-col' : 'flex-col sm:flex-row'}`}>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t('Nome (opcional)', 'Nombre (opcional)', 'Name (optional)')}
          className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
        />
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
          className="flex-[2] rounded-lg border border-gray-200 px-3 py-2 text-sm"
        />
        <button
          type="button"
          disabled={busy || !url.trim()}
          onClick={() => void add()}
          className="inline-flex items-center justify-center gap-1 rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {t('Adicionar', 'Añadir', 'Add')}
        </button>
      </div>
      {err && <p className="mt-2 text-xs text-red-600">{err}</p>}

      {loading ? (
        <p className="mt-3 text-xs text-gray-400">{t('A carregar…', 'Cargando…', 'Loading…')}</p>
      ) : sources.length === 0 ? (
        <p className="mt-3 text-xs text-gray-500">
          {t(
            'Nenhum extra configurado — normal. A varredura descobre a partir do briefing.',
            'Sin extras — normal. El barrido descubre desde el briefing.',
            'No extras configured — that is normal. Scans discover from the briefing.',
          )}
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {sources.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-800">{s.label}</p>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate text-xs text-amber-700 hover:underline"
                >
                  {s.url}
                </a>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void remove(s.id)}
                className="shrink-0 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                title={t('Remover', 'Eliminar', 'Remove')}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
