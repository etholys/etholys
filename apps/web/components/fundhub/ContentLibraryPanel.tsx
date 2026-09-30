'use client';

import { useCallback, useEffect, useState } from 'react';
import { useApp } from '@/app/providers';
import { isLikelyDbId } from '@/lib/utils';
import {
  newSnippet,
  type ContentLibrary,
  type ContentLibrarySnippet,
} from '@/lib/opportunity/content-library';
import { BookOpen, Loader2, Plus, Trash2 } from 'lucide-react';

const KINDS: Array<ContentLibrarySnippet['kind']> = [
  'mission',
  'win',
  'capacity',
  'indicator',
  'other',
];

export function ContentLibraryPanel() {
  const { locale, activeCompanyId } = useApp();
  const companyId = String(activeCompanyId ?? '').trim();
  const ok = isLikelyDbId(companyId);
  const t = (pt: string, es: string, en: string) =>
    locale === 'pt' ? pt : locale === 'es' ? es : en;

  const [lib, setLib] = useState<ContentLibrary>({ snippets: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [kind, setKind] = useState<ContentLibrarySnippet['kind']>('mission');

  const load = useCallback(async () => {
    if (!ok) return;
    setLoading(true);
    try {
      const r = await fetch(
        `/api/fundhub/content-library?companyId=${encodeURIComponent(companyId)}`,
        { cache: 'no-store' },
      );
      const d = (await r.json()) as { library?: ContentLibrary };
      if (r.ok && d.library) setLib(d.library);
    } finally {
      setLoading(false);
    }
  }, [companyId, ok]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (next: ContentLibrary) => {
    if (!ok) return;
    setSaving(true);
    try {
      const r = await fetch(
        `/api/fundhub/content-library?companyId=${encodeURIComponent(companyId)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ library: next }),
        },
      );
      const d = (await r.json()) as { library?: ContentLibrary };
      if (r.ok && d.library) setLib(d.library);
    } finally {
      setSaving(false);
    }
  };

  const add = () => {
    if (!title.trim() || !body.trim()) return;
    const next = {
      ...lib,
      snippets: [newSnippet(title, body, kind), ...lib.snippets].slice(0, 40),
    };
    setTitle('');
    setBody('');
    void save(next);
  };

  const remove = (id: string) => {
    void save({ ...lib, snippets: lib.snippets.filter((s) => s.id !== id) });
  };

  if (!ok) return null;

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <BookOpen className="h-5 w-5 text-amber-700" />
        <h2 className="text-base font-semibold text-gray-900">
          {t('Biblioteca de conteúdo', 'Biblioteca de contenido', 'Content library')}
        </h2>
      </div>
      <p className="mt-1 text-sm text-gray-600">
        {t(
          'Missão, vitórias e capacidade — base para a voz nas propostas (R3).',
          'Misión, logros y capacidad — base para la voz en propuestas (R3).',
          'Mission, wins and capacity — voice base for proposals (R3).',
        )}
      </p>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" /> …
        </div>
      ) : (
        <>
          <div className="mt-4 grid gap-2 sm:grid-cols-[8rem_1fr]">
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as ContentLibrarySnippet['kind'])}
              className="rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm text-gray-900"
            >
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('Título', 'Título', 'Title')}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
            />
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder={t('Texto reutilizável…', 'Texto reutilizable…', 'Reusable text…')}
            className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
          />
          <button
            type="button"
            disabled={saving || !title.trim() || !body.trim()}
            onClick={add}
            className="mt-2 inline-flex items-center gap-1 rounded-lg bg-amber-700 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            {t('Adicionar', 'Añadir', 'Add')}
          </button>

          <ul className="mt-4 max-h-56 space-y-2 overflow-y-auto">
            {lib.snippets.map((s) => (
              <li
                key={s.id}
                className="flex items-start justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-xs font-medium text-amber-800">{s.kind}</p>
                  <p className="text-sm font-semibold text-gray-900">{s.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-gray-600">{s.body}</p>
                </div>
                <button
                  type="button"
                  onClick={() => remove(s.id)}
                  className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
            {lib.snippets.length === 0 && (
              <li className="py-3 text-center text-xs text-gray-500">
                {t('Ainda sem snippets.', 'Aún sin snippets.', 'No snippets yet.')}
              </li>
            )}
          </ul>
        </>
      )}
    </section>
  );
}
