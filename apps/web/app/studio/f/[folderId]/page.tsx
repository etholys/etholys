'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, FileText, Folder, Loader2 } from 'lucide-react';

type DocRow = { id: string; title: string; format: string };

/** Vista de pasta para convidado (ou atalho interno). */
export default function StudioSharedFolderPage() {
  const params = useParams();
  const folderId = String(params?.folderId || '');
  const [name, setName] = useState('Pasta');
  const [documents, setDocuments] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!folderId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/studio/documents?folderId=${encodeURIComponent(folderId)}`, {
        cache: 'no-store',
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      const folder = (d.folders || d.allFolders || []).find((f: { id: string }) => f.id === folderId);
      if (folder?.name) setName(folder.name);
      else {
        const af = (d.allFolders || []).find((f: { id: string }) => f.id === folderId);
        if (af?.name) setName(af.name);
      }
      setDocuments(d.documents || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      setLoading(false);
    }
  }, [folderId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
      <header className="border-b border-amber-200/60 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <Link href="/studio/shared" className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <Folder className="h-5 w-5 text-amber-600" />
          <span className="font-bold text-slate-900">{name}</span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        ) : error ? (
          <p className="text-sm text-red-700">{error}</p>
        ) : (
          <div className="grid gap-3">
            {documents.map((d) => (
              <Link
                key={d.id}
                href={`/hub/studio/${d.id}`}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 hover:border-orange-300"
              >
                <FileText className="h-5 w-5 text-orange-600" />
                <div>
                  <p className="font-semibold text-slate-900">{d.title}</p>
                  <p className="text-xs text-slate-500">{d.format}</p>
                </div>
              </Link>
            ))}
            {documents.length === 0 && (
              <p className="text-sm text-slate-500">Pasta vazia ou sem documentos visíveis.</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
