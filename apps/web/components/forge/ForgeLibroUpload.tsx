'use client';

import { useCallback, useEffect, useState } from 'react';
import { FileUp, BookOpen, ScanText } from 'lucide-react';
import { useForgeT } from '@/lib/forge/use-forge-t';

export function ForgeLibroUpload({
  courseId,
  hasLibro,
  fileName,
  ocrStatus,
  onDone,
}: {
  courseId: string;
  hasLibro?: boolean;
  fileName?: string | null;
  ocrStatus?: string | null;
  onDone?: () => void;
}) {
  const ft = useForgeT();
  const [busy, setBusy] = useState(false);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [ocr, setOcr] = useState(ocrStatus ?? null);

  useEffect(() => {
    setOcr(ocrStatus ?? null);
  }, [ocrStatus]);

  const uploadPdf = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        setMsg('Solo PDF');
        return;
      }
      setBusy(true);
      setMsg(null);

      const presignRes = await fetch(`/api/forge/courses/${courseId}/libro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'presign', fileName: file.name }),
      });
      const presign = await presignRes.json();
      if (!presignRes.ok) {
        setMsg(presign.error || 'Error');
        setBusy(false);
        return;
      }

      if (presign.mode === 'local') {
        const fd = new FormData();
        fd.append('file', file);
        const up = await fetch(presign.uploadUrl, { method: 'POST', body: fd });
        const d = await up.json();
        setBusy(false);
        if (!up.ok) {
          setMsg(d.error || 'Error');
          return;
        }
        setMsg(file.name);
        setOcr('pending');
        onDone?.();
        return;
      }

      const put = await fetch(presign.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/pdf' },
        body: file,
      });
      if (!put.ok) {
        setBusy(false);
        setMsg('S3 error');
        return;
      }

      const confirm = await fetch(`/api/forge/courses/${courseId}/libro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'confirm',
          storagePath: presign.storagePath,
          fileName: file.name,
        }),
      });
      setBusy(false);
      if (!confirm.ok) {
        setMsg('Error');
        return;
      }
      setMsg(file.name);
      setOcr('pending');
      onDone?.();
    },
    [courseId, onDone]
  );

  async function runOcr() {
    setOcrBusy(true);
    const res = await fetch(`/api/forge/courses/${courseId}/libro/ocr`, { method: 'POST' });
    const d = await res.json();
    setOcrBusy(false);
    setOcr(d.status ?? (res.ok ? 'done' : 'failed'));
    onDone?.();
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files[0];
    if (f) void uploadPdf(f);
  }

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-3">
      <h4 className="flex items-center gap-2 text-sm font-bold text-indigo-950">
        <BookOpen className="h-4 w-4" />
        {ft('forge.libro.upload')}
      </h4>
      {hasLibro && (
        <p className="text-xs text-indigo-800">
          <strong>{fileName || 'libro.pdf'}</strong> —{' '}
          <a href={`/hub/forge/cursos/${courseId}/libro`} className="underline">
            Lector
          </a>
        </p>
      )}
      {ocr === 'pending' && (
        <p className="text-xs text-amber-700">{ft('forge.libro.ocrPending')}</p>
      )}
      {ocr === 'done' && (
        <p className="text-xs text-emerald-700">{ft('forge.libro.ocrDone')}</p>
      )}
      {ocr === 'failed' && (
        <p className="text-xs text-red-600">{ft('forge.libro.ocrFailed')}</p>
      )}
      {hasLibro && (
        <button
          type="button"
          disabled={ocrBusy}
          onClick={() => void runOcr()}
          className="inline-flex items-center gap-2 rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-xs font-bold text-indigo-900 hover:bg-indigo-50 disabled:opacity-50"
        >
          <ScanText className="h-3.5 w-3.5" />
          {ocrBusy ? '…' : ft('forge.libro.runOcr')}
        </button>
      )}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        className={`rounded-xl border-2 border-dashed p-8 text-center transition ${
          drag ? 'border-indigo-500 bg-indigo-100/50' : 'border-indigo-300 bg-white'
        }`}
      >
        <FileUp className="mx-auto h-8 w-8 text-indigo-500" />
        <p className="mt-2 text-sm text-slate-600">{ft('forge.libro.drag')}</p>
        <label className="mt-2 inline-block cursor-pointer rounded-lg bg-indigo-700 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-800">
          {busy ? '…' : ft('forge.libro.choose')}
          <input
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadPdf(f);
            }}
          />
        </label>
      </div>
      {msg && <p className="text-sm text-emerald-700">{msg}</p>}
    </div>
  );
}
