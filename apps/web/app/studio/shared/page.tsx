'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { FileText, Folder, Loader2, PenLine, LogOut } from 'lucide-react';
import { signOut } from 'next-auth/react';

type FolderRow = { id: string; name: string };
type DocRow = { id: string; title: string; format: string; folderId: string | null };

/** Lista isolada para convidados externos (share_only). */
export default function StudioSharedHomePage() {
  const { status } = useSession();
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [documents, setDocuments] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/studio/documents', { cache: 'no-store' });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
        if (!cancelled) {
          setFolders(d.folders || []);
          setDocuments(d.documents || []);
        }
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erro');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status]);

  if (status === 'loading' || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
      <header className="border-b border-amber-200/60 bg-white/90 px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div className="flex items-center gap-2">
            <PenLine className="h-5 w-5 text-orange-600" />
            <span className="font-bold text-slate-900">Studio</span>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
              partilhado
            </span>
          </div>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800"
          >
            <LogOut className="h-3.5 w-3.5" /> Sair
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-xl font-bold text-slate-900">Os seus conteúdos partilhados</h1>
        <p className="mt-1 text-sm text-slate-600">
          Acesso limitado — não tem permissão para ver o resto da organização.
        </p>
        {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {folders.map((f) => (
            <Link
              key={f.id}
              href={`/studio/f/${f.id}`}
              className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 hover:border-orange-300"
            >
              <Folder className="h-5 w-5 text-amber-600" />
              <span className="font-semibold text-slate-900">{f.name}</span>
            </Link>
          ))}
          {documents.map((d) => (
            <Link
              key={d.id}
              href={`/hub/studio/${d.id}`}
              className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 hover:border-orange-300"
            >
              <FileText className="h-5 w-5 text-orange-600" />
              <div>
                <p className="font-semibold text-slate-900">{d.title}</p>
                <p className="text-xs text-slate-500">{d.format}</p>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
