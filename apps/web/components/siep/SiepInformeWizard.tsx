'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Upload, Loader2, Calendar, ChevronLeft, Bot, Send, CheckCircle2 } from 'lucide-react';
import { uploadProjectFile } from '@/lib/siep/upload-project-file';
import { isValidMeasurementPeriodRange } from '@/lib/siep/measurement-period';
import { useSiepT } from '@/lib/siep/use-siep-t';
import { SiepInformeCanvas } from '@/components/siep/SiepInformeCanvas';
import type { ReportCanvasState } from '@/lib/siep/report-canvas-types';
import type { InformeTemplateRow } from '@/lib/siep/informe-template-store';
import type { InformeDomain } from '@/lib/siep/informe-domains';
import { createBlankCanvas } from '@/lib/siep/report-canvas-builder';

type Props = {
  projectId: string;
  domain: InformeDomain;
  onClose: () => void;
  onCreated: (reportId: string) => void;
};

type Step = 'setup' | 'preview';
type TemplateMode = 'existing' | 'upload' | 'blank';

const CADENCE_OPTS = [
  { value: 'monthly', labelKey: 'siep.informe.cadence.monthly' },
  { value: 'quarterly', labelKey: 'siep.informe.cadence.quarterly' },
  { value: 'quarterly_final', labelKey: 'siep.informe.cadence.quarterly_final' },
  { value: 'annual', labelKey: 'siep.informe.cadence.annual' },
  { value: 'adhoc', labelKey: 'siep.informe.cadence.adhoc' },
] as const;

const ACCEPT = '.docx,.xlsx,.xls';

type ChatMsg = { role: 'user' | 'assistant'; content: string };

function pickValidFile(raw: File | undefined | null): File | null {
  if (!raw) return null;
  const name = raw.name.toLowerCase();
  if (name.endsWith('.docx') || name.endsWith('.xlsx') || name.endsWith('.xls')) return raw;
  return null;
}

export function SiepInformeWizard({ projectId, domain, onClose, onCreated }: Props) {
  const st = useSiepT();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const [step, setStep] = useState<Step>('setup');
  const [cadence, setCadence] = useState('monthly');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [templateMode, setTemplateMode] = useState<TemplateMode>('existing');
  const [templates, setTemplates] = useState<InformeTemplateRow[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [cloudStoragePath, setCloudStoragePath] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [canvas, setCanvas] = useState<ReportCanvasState | null>(null);
  const [canvasFormat, setCanvasFormat] = useState('docx');
  const [savedTemplateId, setSavedTemplateId] = useState<string>('');
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatSending, setChatSending] = useState(false);

  const activeDomain = domain;
  const validDates = periodStart && periodEnd && isValidMeasurementPeriodRange(periodStart, periodEnd);
  const validatedTemplates = templates.filter((t) => t.validated);

  const loadTemplates = useCallback(() => {
    setTemplatesLoading(true);
    fetch(`/api/siep/informes/templates?projectId=${projectId}&domain=${activeDomain}`)
      .then((r) => r.json())
      .then((d) => {
        const list = (d.templates ?? []) as InformeTemplateRow[];
        setTemplates(list);
        const first = list.find((t) => t.validated) || list[0];
        if (first) {
          setSelectedTemplateId(first.id);
          setTemplateMode('existing');
        } else {
          setTemplateMode('upload');
        }
      })
      .catch(() => setTemplates([]))
      .finally(() => setTemplatesLoading(false));
  }, [projectId, activeDomain]);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  useEffect(() => {
    const prevent = (e: DragEvent) => e.preventDefault();
    window.addEventListener('dragover', prevent);
    window.addEventListener('drop', prevent);
    return () => {
      window.removeEventListener('dragover', prevent);
      window.removeEventListener('drop', prevent);
    };
  }, []);

  const assignFile = useCallback((f: File | null) => {
    setError(null);
    if (!f) { setFile(null); return; }
    const valid = pickValidFile(f);
    if (!valid) { setError(st('siep.informe.wizard.fileInvalid')); return; }
    setFile(valid);
    setTemplateMode('upload');
  }, [st]);

  const goToPreview = async () => {
    if (!validDates || busy) return;
    setBusy(true);
    setError(null);
    setProgressLabel(st('siep.informe.progress.parse'));
    setProgressPct(30);

    try {
      let path = cloudStoragePath;
      let fileName = file?.name || '';
      let mime = file?.type;
      let size = file?.size;
      let templateId = '';
      let initialCanvas: ReportCanvasState | null = null;
      let format = 'docx';

      if (templateMode === 'existing' && selectedTemplateId) {
        const tpl = templates.find((t) => t.id === selectedTemplateId);
        if (!tpl) throw new Error(st('siep.informe.wizard.templateMissing'));
        path = tpl.cloudStoragePath;
        fileName = tpl.fileName;
        mime = tpl.mimeType || undefined;
        templateId = tpl.id;
        format = tpl.canvasFormat || 'docx';
        setSavedTemplateId(tpl.id);
        initialCanvas = null;
      } else if (templateMode === 'blank') {
        initialCanvas = createBlankCanvas(st('siep.informe.structure.customFormat'));
        format = 'markdown';
        setChatMessages([{
          role: 'assistant',
          content: st('siep.informe.wizard.blankReady'),
        }]);
      } else if (file) {
        setProgressLabel(st('siep.informe.progress.upload'));
        path = await uploadProjectFile(projectId, file, 'reports', (p) => {
          if (p.phase === 'upload') setProgressPct(10 + Math.round(p.percent * 0.5));
        });
        setCloudStoragePath(path);
        fileName = file.name;
        mime = file.type;
        size = file.size;
      } else {
        throw new Error(st('siep.informe.wizard.pickTemplate'));
      }

      if (!initialCanvas) {
        const parseRes = await fetch('/api/siep/informes/templates/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            cloudStoragePath: path,
            templateFileName: fileName,
            mimeType: mime,
          }),
        });
        const parseData = await parseRes.json();
        if (!parseRes.ok) throw new Error(String(parseData.error || 'Erro ao ler modelo'));
        initialCanvas = parseData.canvasState as ReportCanvasState;
        format = parseData.canvasFormat || format;
        setChatMessages([{
          role: 'assistant',
          content: st('siep.informe.preview.parseDone')
            .replace('{n}', String(initialCanvas.regions.length))
            .replace('{s}', String(initialCanvas.sections?.length ?? 0)),
        }]);
      }

      setCanvas(initialCanvas);
      setCanvasFormat(format);
      setProgressPct(100);
      setStep('preview');

      if ((templateMode === 'upload' && path && initialCanvas) || (templateMode === 'blank' && initialCanvas)) {
        const saveRes = await fetch('/api/siep/informes/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            domain: activeDomain,
            templateFileName: fileName || initialCanvas.templateFileName,
            cloudStoragePath: path || undefined,
            mimeType: mime,
            fileSizeBytes: size,
            canvasState: initialCanvas,
            canvasFormat: format,
            blankTemplate: templateMode === 'blank',
          }),
        });
        const saveData = await saveRes.json();
        if (saveRes.ok && saveData.template?.id) {
          setSavedTemplateId(saveData.template.id);
        }
      } else if (templateId) {
        setSavedTemplateId(templateId);
      }

      if (initialCanvas) {
        void runInitialAiAnalysis(initialCanvas);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : st('siep.informe.wizard.errorGeneric'));
    } finally {
      setBusy(false);
      setProgressLabel('');
      setProgressPct(0);
    }
  };

  const sendPreviewChat = async () => {
    if (!chatInput.trim() || !canvas || chatSending) return;
    const msg = chatInput.trim();
    setChatInput('');
    setChatMessages((prev) => [...prev, { role: 'user', content: msg }]);
    await callPreviewValidate(msg, canvas);
  };

  const callPreviewValidate = async (message: string, canvasState: ReportCanvasState) => {
    setChatSending(true);
    setError(null);
    try {
      const tpl = templates.find((t) => t.id === savedTemplateId);
      const res = await fetch('/api/siep/informes/templates/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          domain: activeDomain,
          message,
          canvasState,
          cloudStoragePath: tpl?.cloudStoragePath || cloudStoragePath,
          templateFileName: tpl?.fileName || file?.name,
          history: chatMessages.slice(-8),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(String(data.error || 'Erro'));
      setChatMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
      if (data.canvasState) setCanvas(data.canvasState as ReportCanvasState);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro no chat');
    } finally {
      setChatSending(false);
    }
  };

  const runInitialAiAnalysis = async (canvasState: ReportCanvasState) => {
    setChatMessages((prev) => [
      ...prev,
      { role: 'assistant', content: st('siep.informe.preview.analyzing') },
    ]);
    setChatSending(true);
    setError(null);
    try {
      const tpl = templates.find((t) => t.id === savedTemplateId);
      const res = await fetch('/api/siep/informes/templates/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          domain: activeDomain,
          message: st('siep.informe.preview.initialPrompt'),
          canvasState,
          cloudStoragePath: tpl?.cloudStoragePath || cloudStoragePath,
          templateFileName: tpl?.fileName || file?.name,
          history: [],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(String(data.error || 'Erro'));
      setChatMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
      if (data.canvasState) setCanvas(data.canvasState as ReportCanvasState);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro no chat');
    } finally {
      setChatSending(false);
    }
  };

  const confirmCreate = async () => {
    if (!canvas || !validDates || busy) return;
    setBusy(true);
    setError(null);
    setProgressLabel(st('siep.informe.progress.create'));
    setProgressPct(50);

    try {
      if (savedTemplateId && canvas) {
        await fetch('/api/siep/informes/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            domain: activeDomain,
            replaceFileId: savedTemplateId,
            templateFileName: canvas.templateFileName || file?.name,
            cloudStoragePath: cloudStoragePath || templates.find((t) => t.id === savedTemplateId)?.cloudStoragePath,
            canvasState: canvas,
            canvasFormat: canvas.format || canvasFormat,
          }),
        });
      }

      const res = await fetch('/api/siep/informes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          domain: activeDomain,
          cadence,
          periodStart,
          periodEnd,
          templateFileId: savedTemplateId || undefined,
          templateFileName: canvas.templateFileName || file?.name,
          cloudStoragePath: cloudStoragePath || templates.find((t) => t.id === savedTemplateId)?.cloudStoragePath,
          canvasState: canvas,
          canvasFormat: canvas.format || canvasFormat,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(String(data.error || `Erro (${res.status})`));
      setProgressPct(100);
      onCreated(data.reportId);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : st('siep.informe.wizard.errorGeneric'));
    } finally {
      setBusy(false);
      setProgressLabel('');
      setProgressPct(0);
    }
  };

  const canGoPreview =
    validDates &&
    ((templateMode === 'existing' && selectedTemplateId) ||
      (templateMode === 'upload' && file) ||
      templateMode === 'blank');

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
      <div className={`bg-white rounded-2xl shadow-xl w-full overflow-hidden flex flex-col ${step === 'preview' ? 'max-w-5xl max-h-[90vh]' : 'max-w-md'}`}>
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            {step === 'preview' && (
              <button type="button" onClick={() => setStep('setup')} disabled={busy} className="text-gray-400 hover:text-gray-600">
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <h2 className="text-lg font-semibold text-gray-900">
              {step === 'setup' ? st('siep.informe.wizard.new') : st('siep.informe.preview.title')}
            </h2>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {step === 'setup' && (
          <div className="p-5 space-y-4 overflow-y-auto">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{st('siep.informe.wizard.cadenceLabel')}</label>
              <select value={cadence} onChange={(e) => setCadence(e.target.value)} disabled={busy} className="w-full px-3 py-2 rounded-lg border text-sm">
                {CADENCE_OPTS.map((o) => (
                  <option key={o.value} value={o.value}>{st(o.labelKey)}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> {st('siep.informe.wizard.periodFrom')}
                </label>
                <input type="date" required disabled={busy} value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="w-full px-3 py-2 rounded-lg border text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{st('siep.informe.wizard.periodTo')}</label>
                <input type="date" required disabled={busy} value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="w-full px-3 py-2 rounded-lg border text-sm" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{st('siep.informe.wizard.template')}</label>
              <p className="text-[10px] text-gray-500 mb-2">{st('siep.informe.wizard.templateReuse')}</p>

              {templatesLoading ? (
                <div className="flex items-center gap-2 text-xs text-gray-500 py-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> {st('siep.informe.wizard.templatesLoading')}
                </div>
              ) : validatedTemplates.length > 0 && (
                <div className="mb-2 space-y-1">
                  {validatedTemplates.map((t) => (
                    <label key={t.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm ${templateMode === 'existing' && selectedTemplateId === t.id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-indigo-200'}`}>
                      <input
                        type="radio"
                        name="tpl"
                        checked={templateMode === 'existing' && selectedTemplateId === t.id}
                        onChange={() => { setTemplateMode('existing'); setSelectedTemplateId(t.id); setFile(null); }}
                      />
                      <span className="truncate flex-1">{t.fileName}</span>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    </label>
                  ))}
                </div>
              )}

              <p className="text-[10px] text-gray-500 mb-2">{st('siep.informe.wizard.orBlank')}</p>
              <button
                type="button"
                disabled={busy}
                onClick={() => { setTemplateMode('blank'); setFile(null); setSelectedTemplateId(''); }}
                className={`w-full mb-2 px-3 py-2.5 rounded-lg border text-sm text-left transition ${
                  templateMode === 'blank' ? 'border-indigo-500 bg-indigo-50 text-indigo-800' : 'border-gray-200 hover:border-indigo-200'
                }`}
              >
                {st('siep.informe.wizard.createBlank')}
              </button>

              <p className="text-[10px] text-gray-500 mb-1">{st('siep.informe.wizard.uploadNew')}</p>
              <div
                ref={dropRef}
                role="button"
                tabIndex={0}
                onClick={() => !busy && fileInputRef.current?.click()}
                onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={(e) => { e.preventDefault(); if (dropRef.current && !dropRef.current.contains(e.relatedTarget as Node)) setDragOver(false); }}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); if (!busy) assignFile(e.dataTransfer.files?.[0] ?? null); }}
                className={`flex flex-col items-center justify-center gap-2 px-4 py-5 border-2 border-dashed rounded-xl cursor-pointer transition select-none ${
                  dragOver ? 'border-indigo-500 bg-indigo-100/60' : templateMode === 'upload' && file ? 'border-emerald-300 bg-emerald-50/40' : 'border-indigo-200 bg-indigo-50/30'
                } ${busy ? 'opacity-60 pointer-events-none' : ''}`}
              >
                <Upload className="w-5 h-5 text-indigo-600" />
                <span className="text-sm text-indigo-800 font-medium text-center px-2 break-all">
                  {file ? file.name : st('siep.informe.wizard.drop')}
                </span>
                <input ref={fileInputRef} type="file" accept={ACCEPT} className="hidden" onChange={(e) => assignFile(e.target.files?.[0] ?? null)} />
              </div>
            </div>

            {busy && progressLabel && (
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-gray-600">
                  <span>{progressLabel}</span>
                  <span>{progressPct}%</span>
                </div>
                <div className="h-1 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full bg-indigo-600 transition-all" style={{ width: `${progressPct}%` }} />
                </div>
              </div>
            )}

            {error && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

            <button
              type="button"
              disabled={busy || !canGoPreview}
              onClick={() => void goToPreview()}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {st('siep.informe.wizard.validatePreview')}
            </button>
          </div>
        )}

        {step === 'preview' && canvas && (
          <div className="flex flex-col flex-1 min-h-0">
            <p className="px-5 py-2 text-xs text-gray-500 border-b bg-amber-50/80">{st('siep.informe.preview.hint')}</p>
            <div className="flex flex-1 min-h-0 divide-x">
              <div className="w-[38%] flex flex-col min-h-0 bg-slate-50">
                <div className="px-3 py-2 border-b bg-white text-xs font-medium text-slate-700 flex items-center gap-1.5">
                  <Bot className="w-3.5 h-3.5" /> {st('siep.informe.preview.chatTitle')}
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[200px]">
                  {chatMessages.map((m, i) => (
                    <div key={i} className={`text-xs rounded-lg px-2.5 py-2 ${m.role === 'user' ? 'bg-indigo-600 text-white ml-4' : 'bg-white border text-slate-800 mr-2'}`}>
                      {m.content}
                    </div>
                  ))}
                </div>
                <div className="p-2 border-t bg-white flex gap-1.5">
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && void sendPreviewChat()}
                    placeholder={st('siep.informe.preview.chatPh')}
                    className="flex-1 text-xs rounded-lg border px-2 py-1.5"
                  />
                  <button type="button" disabled={chatSending || !chatInput.trim()} onClick={() => void sendPreviewChat()} className="p-1.5 bg-indigo-600 text-white rounded-lg disabled:opacity-50">
                    {chatSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto p-3">
                <p className="text-[10px] text-gray-500 mb-2">
                  {canvas.sections?.length ?? 0} {st('siep.informe.preview.sectionsDetected')} ·{' '}
                  {canvas.regions.length} {st('siep.informe.preview.fieldsDetected')}
                </p>
                <SiepInformeCanvas canvas={canvas} onChange={setCanvas} editableStructure />
              </div>
            </div>
            <div className="px-5 py-3 border-t flex items-center justify-between gap-3 shrink-0 bg-white">
              {error && <p className="text-xs text-red-600 flex-1">{error}</p>}
              <button
                type="button"
                disabled={busy}
                onClick={() => void confirmCreate()}
                className="ml-auto flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {st('siep.informe.preview.confirmCreate')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
