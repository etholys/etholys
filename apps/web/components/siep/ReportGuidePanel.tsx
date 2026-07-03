'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { BookOpen, Upload, Trash2, Loader2, RefreshCw, CheckCircle2, AlertCircle, FileText } from 'lucide-react';
import { useSiepT } from '@/lib/siep/use-siep-t';
import { uploadProjectFile, postJson } from '@/lib/siep/upload-project-file';

type Guide = {
  id: string;
  title: string;
  fileName: string;
  extractionStatus: string;
  hasText: boolean;
  textPreview: string | null;
  uploadedBy?: { name: string } | null;
  createdAt: string;
};

type Props = {
  projectId: string;
  compact?: boolean;
  /** me | budget | general — filtra manuales del ámbito */
  domain?: 'me' | 'budget' | 'general';
};

export function ReportGuidePanel({ projectId, compact, domain }: Props) {
  const st = useSiepT();
  const fileRef = useRef<HTMLInputElement>(null);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [reindexing, setReindexing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = domain ? `?domain=${encodeURIComponent(domain)}` : '';
      const r = await fetch(`/api/projects/${projectId}/report-guides${qs}`);
      const d = await r.json();
      setGuides(d.guides ?? []);
    } catch {
      setGuides([]);
    } finally {
      setLoading(false);
    }
  }, [projectId, domain]);

  useEffect(() => {
    void load();
  }, [load]);

  const uploadFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    setUploadError(null);
    try {
      for (const file of Array.from(files)) {
        const cloudStoragePath = await uploadProjectFile(projectId, file, 'guides');

        const saved = await postJson(`/api/projects/${projectId}/report-guides`, {
          title: file.name.replace(/\.[^.]+$/, ''),
          fileName: file.name,
          cloudStoragePath,
          mimeType: file.type,
          fileSizeBytes: file.size,
          domain: domain || 'general',
        });
        if (!saved.ok) {
          throw new Error(String(saved.data.error || `Error al registrar manual (${saved.status})`));
        }
      }
      await load();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : st('siep.guide.error.upload');
      setUploadError(msg);
      alert(msg);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removeGuide = async (id: string) => {
    if (!confirm(st('siep.guide.confirmDelete'))) return;
    await fetch(`/api/projects/${projectId}/report-guides?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    await load();
  };

  const reextract = async (id: string) => {
    setReindexing(id);
    try {
      await fetch(`/api/projects/${projectId}/report-guides/${id}`, { method: 'POST' });
      await load();
    } finally {
      setReindexing(null);
    }
  };

  const statusIcon = (status: string, hasText: boolean) => {
    if (status === 'ready' && hasText) {
      return <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />;
    }
    if (status === 'pending' || status === 'processing') {
      return <Loader2 className="w-4 h-4 text-indigo-500 animate-spin shrink-0" />;
    }
    return <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />;
  };

  return (
    <div className={`rounded-xl border border-indigo-200 bg-indigo-50/40 ${compact ? 'p-4' : 'p-5'} space-y-3`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <BookOpen className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-gray-900">{st('siep.guide.title')}</h4>
            <p className="text-xs text-gray-600 mt-0.5 max-w-xl">{st('siep.guide.intro')}</p>
          </div>
        </div>
        <div>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.docx,.doc,.txt"
            multiple
            className="hidden"
            onChange={(e) => void uploadFiles(e.target.files)}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {st('siep.guide.upload')}
          </button>
        </div>
      </div>

      {uploadError && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{uploadError}</p>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-gray-500 py-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> {st('siep.guide.loading')}
        </div>
      ) : guides.length === 0 ? (
        <p className="text-xs text-gray-500 italic">{st('siep.guide.empty')}</p>
      ) : (
        <ul className="space-y-2">
          {guides.map((g) => (
            <li
              key={g.id}
              className="flex items-start gap-2 rounded-lg border border-white bg-white/90 px-3 py-2.5 shadow-sm"
            >
              {statusIcon(g.extractionStatus, g.hasText)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{g.title}</p>
                <p className="text-[10px] text-gray-400 flex items-center gap-1">
                  <FileText className="w-3 h-3" /> {g.fileName}
                  {g.uploadedBy?.name ? ` · ${g.uploadedBy.name}` : ''}
                </p>
                {g.textPreview && !compact && (
                  <p className="text-[10px] text-gray-500 mt-1 line-clamp-2">{g.textPreview}…</p>
                )}
                <p className="text-[10px] text-indigo-600 mt-0.5">
                  {g.extractionStatus === 'ready' && g.hasText
                    ? st('siep.guide.statusReady')
                    : g.extractionStatus === 'pending'
                      ? st('siep.guide.statusPending')
                      : st('siep.guide.statusFailed')}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  type="button"
                  title={st('siep.guide.reindex')}
                  disabled={reindexing === g.id}
                  onClick={() => void reextract(g.id)}
                  className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-indigo-600"
                >
                  {reindexing === g.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => void removeGuide(g.id)}
                  className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
