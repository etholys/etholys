'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  X, Save, Download, Loader2, CheckCircle2, FileText, LayoutTemplate,
} from 'lucide-react';
import type { InformeCanvasSelection } from '@/lib/siep/informe-canvas-selection';
import { SiepInformeChatPanel } from '@/components/siep/SiepInformeChatPanel';
import { SiepInformeCanvas } from '@/components/siep/SiepInformeCanvas';
import type { ReportCanvasState } from '@/lib/siep/report-canvas-types';

type Props = {
  reportId: string;
  onClose: () => void;
  onSaved?: () => void;
};

type EditorMeta = {
  title: string;
  period: string;
  status: string;
  canvasFormat: string;
  aiSessionId: string | null;
  templateFileName?: string;
};

export function SiepInformeEditor({ reportId, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [meta, setMeta] = useState<EditorMeta | null>(null);
  const [canvas, setCanvas] = useState<ReportCanvasState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [editStructure, setEditStructure] = useState(false);
  const [chatSelection, setChatSelection] = useState<InformeCanvasSelection | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/siep/informes/${reportId}`);
      const data = await r.json();
      if (!r.ok) throw new Error(String(data.error || `Erro (${r.status})`));
      setMeta({
        title: data.report.title,
        period: data.report.period,
        status: data.report.status,
        canvasFormat: data.report.canvasFormat,
        aiSessionId: data.report.aiSessionId,
        templateFileName: data.templateFile?.fileName,
      });
      setCanvas(data.canvasState as ReportCanvasState);
      setDirty(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  }, [reportId]);

  useEffect(() => { void load(); }, [load]);

  const handleCanvasChange = (next: ReportCanvasState) => {
    setCanvas(next);
    setDirty(true);
  };

  const save = async () => {
    if (!canvas) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/siep/informes/${reportId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canvasState: canvas }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(String(data.error || 'Erro ao guardar'));
      setDirty(false);
      onSaved?.();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Erro ao guardar');
    } finally {
      setSaving(false);
    }
  };

  const exportFile = async () => {
    setExporting(true);
    try {
      if (dirty && canvas) await save();
      const r = await fetch(`/api/siep/informes/${reportId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'export' }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(String(data.error || 'Erro ao exportar'));
      const blob = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([blob], { type: data.mimeType }));
      const a = document.createElement('a');
      a.href = url;
      a.download = data.fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Erro ao exportar');
    } finally {
      setExporting(false);
    }
  };

  const approve = async () => {
    await fetch(`/api/siep/informes/${reportId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved' }),
    });
    setMeta((m) => (m ? { ...m, status: 'approved' } : m));
    onSaved?.();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[70] bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error || !meta || !canvas) {
    return (
      <div className="fixed inset-0 z-[70] bg-white flex flex-col items-center justify-center gap-3">
        <p className="text-red-600">{error || 'Informe não encontrado'}</p>
        <button type="button" onClick={onClose} className="text-sm text-indigo-600">Fechar</button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[70] bg-white flex flex-col">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 bg-white shrink-0">
        <FileText className="w-5 h-5 text-indigo-600 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold text-slate-900 truncate">{meta.title}</h1>
          <p className="text-[10px] text-slate-500">
            {meta.period}
            {meta.templateFileName ? ` · ${meta.templateFileName}` : ''}
            {dirty ? ' · alterações por guardar' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || !dirty}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Guardar
          </button>
          <button
            type="button"
            onClick={() => void exportFile()}
            disabled={exporting}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Exportar
          </button>
          {meta.status !== 'approved' && (
            <button
              type="button"
              onClick={() => void approve()}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Aprovar
            </button>
          )}
          <button type="button" onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        <aside className="w-full lg:w-[38%] xl:w-[34%] border-r border-slate-200 min-h-0 flex flex-col">
          {meta.aiSessionId ? (
            <SiepInformeChatPanel
              reportId={reportId}
              sessionId={meta.aiSessionId}
              canvas={canvas}
              selection={chatSelection}
              onClearSelection={() => setChatSelection(null)}
              onCanvasUpdate={(c) => {
                setCanvas(c);
                setDirty(true);
              }}
            />
          ) : (
            <p className="p-4 text-sm text-gray-500">Sessão IA indisponível.</p>
          )}
        </aside>
        <main className="flex-1 min-h-0 overflow-y-auto bg-slate-100/50">
          <div className="max-w-4xl mx-auto my-4 bg-white shadow-sm border border-slate-200 rounded-xl min-h-[calc(100%-2rem)]">
            <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                Documento · {meta.canvasFormat === 'xlsx' ? 'Excel' : meta.canvasFormat === 'docx' ? 'Word' : 'Texto'}
              </p>
              <button
                type="button"
                onClick={() => setEditStructure((v) => !v)}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium border ${
                  editStructure
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-200'
                }`}
              >
                <LayoutTemplate className="w-3 h-3" />
                {editStructure ? 'A editar estrutura' : 'Editar estrutura'}
              </button>
            </div>
            <SiepInformeCanvas
              canvas={canvas}
              onChange={handleCanvasChange}
              editableStructure={editStructure}
              selection={chatSelection}
              onSelectionChange={setChatSelection}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
