'use client';

import { useMemo, useState } from 'react';
import {
  Upload, X, FileText, Loader2, CheckCircle2, Download, FileSpreadsheet, Sparkles, AlertTriangle,
} from 'lucide-react';

type ML = { es: string; pt: string; en: string };
const ml = (en: string, es: string, pt: string): ML => ({ en, es, pt });

const TYPE_CONFIG: Record<string, { labels: ML }> = {
  INCOME: { labels: ml('Income', 'Ingreso', 'Receita') },
  EXPENSE: { labels: ml('Expense', 'Gasto', 'Despesa') },
  TRANSFER_IN: { labels: ml('Transfer in', 'Transferencia entrada', 'Transferência entrada') },
  TRANSFER_OUT: { labels: ml('Transfer out', 'Transferencia salida', 'Transferência saída') },
};

type AtlasImportIssue = {
  field: 'amount' | 'date' | 'type';
  message: string;
  raw: string;
};

function liveIssues(t: { amount: number; date: string; type: string; sourceRow?: number }): AtlasImportIssue[] {
  const line = t.sourceRow ?? '?';
  const issues: AtlasImportIssue[] = [];
  if (!Number.isFinite(t.amount) || t.amount <= 0) {
    issues.push({
      field: 'amount',
      raw: String(t.amount ?? ''),
      message: `Fila ${line}: monto inválido «${t.amount}». Debe ser un número mayor que 0.`,
    });
  }
  if (!t.date || !/^\d{4}-\d{2}-\d{2}$/.test(t.date)) {
    issues.push({
      field: 'date',
      raw: t.date || '(vacío)',
      message: `Fila ${line}: fecha inválida «${t.date || '(vacío)'}». Use YYYY-MM-DD.`,
    });
  }
  if (!TYPE_CONFIG[t.type]) {
    issues.push({
      field: 'type',
      raw: t.type || '(vacío)',
      message: `Fila ${line}: tipo inválido «${t.type || '(vacío)'}».`,
    });
  }
  return issues;
}

type ImportTx = {
  title: string;
  description?: string | null;
  type: string;
  amount: number;
  currency: string;
  category: string;
  date: string;
  note?: string | null;
  executionStatus?: string;
  sourceRow?: number;
  issues?: AtlasImportIssue[];
};

type ImportMode = 'template' | 'ai';

export function FinanceImportModal({
  locale,
  activeCompanyId,
  companies,
  onClose,
  onImported,
}: {
  locale: 'es' | 'pt' | 'en' | string;
  activeCompanyId: string | null | undefined;
  companies: { id: string }[];
  onClose: () => void;
  onImported: () => void;
}) {
  const L = (m: ML) => m[locale as keyof ML] || m.en;
  const [mode, setMode] = useState<ImportMode>('template');
  const [importLoading, setImportLoading] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportTx[] | null>(null);
  const [importSummary, setImportSummary] = useState('');
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [importFileName, setImportFileName] = useState('');
  const [importError, setImportError] = useState('');
  const [onlyErrors, setOnlyErrors] = useState(false);

  const templateHref = `/api/transactions/import/template?format=xlsx&locale=${encodeURIComponent(locale || 'es')}`;
  const csvHref = `/api/transactions/import/template?format=csv`;

  const errorCount = useMemo(
    () => (importPreview ?? []).filter((t) => (t.issues?.length ?? 0) > 0).length,
    [importPreview],
  );

  const visibleRows = useMemo(() => {
    if (!importPreview) return [];
    return importPreview
      .map((t, index) => ({ t, index }))
      .filter(({ t }) => !onlyErrors || errorCount === 0 || (t.issues?.length ?? 0) > 0);
  }, [importPreview, onlyErrors, errorCount]);

  const handleImportFile = async (file: File) => {
    setImportLoading(true);
    setImportPreview(null);
    setImportSummary('');
    setImportWarnings([]);
    setImportFileName(file.name);
    setImportError('');
    setOnlyErrors(false);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('mode', mode);
      if (activeCompanyId) fd.append('companyId', activeCompanyId);
      const res = await fetch('/api/transactions/import', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      const txs: ImportTx[] = data.transactions || [];
      setImportPreview(txs);
      setImportSummary(data.summary || '');
      setImportWarnings(Array.isArray(data.warnings) ? data.warnings : []);
      setOnlyErrors(txs.some((t) => (t.issues?.length ?? 0) > 0));
    } catch (err: any) {
      setImportError(err.message || 'Error importing file');
    }
    setImportLoading(false);
  };

  const confirmImport = async () => {
    if (!importPreview || importPreview.length === 0) return;
    if (errorCount > 0) {
      setImportError(
        L(ml(
          `Fix or delete the ${errorCount} row(s) in red before importing. Nothing is saved until then.`,
          `Corrija o elimine las ${errorCount} fila(s) en rojo antes de importar. Nada se guarda hasta entonces.`,
          `Corrija ou elimine as ${errorCount} linha(s) em vermelho antes de importar. Nada é gravado até lá.`,
        )),
      );
      setOnlyErrors(true);
      return;
    }
    const compId = activeCompanyId || companies[0]?.id;
    if (!compId) {
      setImportError('No hay empresa seleccionada. Selecciona una empresa primero.');
      return;
    }
    setImportLoading(true);
    setImportError('');
    try {
      const items = importPreview.map((t) => ({
        companyId: compId,
        type: t.type,
        amount: t.amount,
        currency: t.currency,
        title: t.title,
        description: t.description,
        category: t.category,
        date: t.date ? new Date(t.date).toISOString() : new Date().toISOString(),
        note: t.note || null,
        registerAsExecuted: t.executionStatus !== 'FORECAST',
        executionStatus: t.executionStatus === 'FORECAST' ? 'FORECAST' : 'EXECUTED',
      }));
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al importar');
      void data;
      onImported();
      onClose();
    } catch (err: any) {
      setImportError(err.message || 'Error al importar transacciones');
    } finally {
      setImportLoading(false);
    }
  };

  const removeImportRow = (idx: number) => {
    if (!importPreview) return;
    setImportPreview(importPreview.filter((_, i) => i !== idx));
    setImportError('');
  };

  const updateImportRow = (idx: number, field: string, value: unknown) => {
    if (!importPreview) return;
    const copy = [...importPreview];
    const next = { ...copy[idx], [field]: value };
    next.issues = liveIssues({
      amount: Number(next.amount),
      date: String(next.date || ''),
      type: String(next.type || ''),
      sourceRow: next.sourceRow,
    });
    copy[idx] = next;
    setImportPreview(copy);
    setImportError('');
  };

  const resetFile = () => {
    setImportPreview(null);
    setImportSummary('');
    setImportWarnings([]);
    setImportFileName('');
    setImportError('');
    setOnlyErrors(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-xl w-full max-w-5xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Upload className="w-5 h-5 text-teal-600" />
            {L(ml('Import Transactions', 'Importar Transacciones', 'Importar Transações'))}
          </h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {!importPreview && !importLoading && (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => { setMode('template'); setImportError(''); }}
                  className={`text-left rounded-xl border-2 p-4 transition ${
                    mode === 'template' ? 'border-teal-500 bg-teal-50/70' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2 font-semibold text-gray-900 text-sm">
                    <FileSpreadsheet className="w-4 h-4 text-teal-700" />
                    {L(ml('ATLAS spreadsheet', 'Formato ATLAS', 'Formato ATLAS'))}
                  </div>
                  <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">
                    {L(ml(
                      'Download the official file, fill the columns, upload. Columns are already mapped — you only confirm. No AI.',
                      'Descargue el modelo, complete las columnas, súbalo. Las columnas ya están vinculadas — solo confirma. Sin IA.',
                      'Baixe o modelo, preencha as colunas, envie. As colunas já estão vinculadas — só confirma. Sem IA.',
                    ))}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => { setMode('ai'); setImportError(''); }}
                  className={`text-left rounded-xl border-2 p-4 transition ${
                    mode === 'ai' ? 'border-violet-500 bg-violet-50/70' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2 font-semibold text-gray-900 text-sm">
                    <Sparkles className="w-4 h-4 text-violet-600" />
                    {L(ml('AI import', 'Importar con IA', 'Importar com IA'))}
                    <span className="text-[10px] uppercase tracking-wide font-bold text-violet-700 bg-violet-100 px-1.5 py-0.5 rounded">
                      Premium
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">
                    {L(ml(
                      'PDF, photos, or bank statements. Uses AI credits. Requires the ATLAS Smart Import add-on when billing is on.',
                      'PDF, fotos o extractos bancarios. Usa créditos de IA. Requiere el add-on ATLAS Smart Import cuando la facturación está activa.',
                      'PDF, fotos ou extratos bancários. Usa créditos de IA. Exige o add-on ATLAS Smart Import quando a faturação está ativa.',
                    ))}
                  </p>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 border px-3 py-2.5">
                <Download className="w-4 h-4 text-teal-700 shrink-0" />
                <span className="text-xs text-gray-700 flex-1 min-w-[12rem]">
                  {L(ml(
                    'Official ATLAS template (columns already match the system).',
                    'Modelo oficial ATLAS (columnas ya equivalentes al sistema).',
                    'Modelo oficial ATLAS (colunas já equivalentes ao sistema).',
                  ))}
                </span>
                <a
                  href={templateHref}
                  className="text-xs font-medium px-2.5 py-1 rounded-md bg-teal-600 text-white hover:bg-teal-700"
                >
                  Excel
                </a>
                <a
                  href={csvHref}
                  className="text-xs font-medium px-2.5 py-1 rounded-md bg-white border text-gray-700 hover:bg-gray-100"
                >
                  CSV
                </a>
              </div>

              {mode === 'template' && (
                <p className="text-xs text-gray-500">
                  {L(ml(
                    'Required columns: fecha, tipo, monto. Optional: moneda, titulo, descripcion, categoria, estado, nota.',
                    'Columnas obligatorias: fecha, tipo, monto. Opcionales: moneda, titulo, descripcion, categoria, estado, nota.',
                    'Colunas obrigatórias: fecha, tipo, monto. Opcionais: moneda, titulo, descripcion, categoria, estado, nota.',
                  ))}
                </p>
              )}

              {importError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{importError}</div>
              )}

              <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-teal-400 hover:bg-teal-50/50 transition">
                <FileText className="w-10 h-10 text-gray-300 mb-2" />
                <span className="text-sm text-gray-500 font-medium">
                  {L(ml('Click to select file', 'Clic para seleccionar archivo', 'Clique para selecionar arquivo'))}
                </span>
                <span className="text-xs text-gray-400 mt-1">
                  {mode === 'template' ? 'XLSX, XLS, CSV' : 'PDF, XLSX, XLS, CSV, JPG, PNG, DOCX'}
                </span>
                <input
                  type="file"
                  className="hidden"
                  accept={mode === 'template' ? '.xlsx,.xls,.csv' : '.pdf,.xlsx,.xls,.csv,.jpg,.jpeg,.png,.webp,.docx,.txt'}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleImportFile(f);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
          )}
          {importLoading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-10 h-10 text-teal-600 animate-spin mb-3" />
              <p className="text-sm text-gray-600 font-medium">
                {mode === 'ai'
                  ? L(ml('AI is reading the file...', 'La IA está leyendo el archivo...', 'A IA está lendo o arquivo...'))
                  : L(ml('Reading ATLAS spreadsheet...', 'Leyendo la planilla ATLAS...', 'Lendo a planilha ATLAS...'))}
              </p>
              <p className="text-xs text-gray-400 mt-1">{importFileName}</p>
            </div>
          )}
          {importPreview && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-gray-700">
                  <span className="font-semibold text-teal-700">{importPreview.length}</span>{' '}
                  {L(ml('transactions found', 'transacciones encontradas', 'transações encontradas'))}
                  {errorCount > 0 && (
                    <span className="ml-2 font-semibold text-red-700">
                      — {errorCount} {L(ml('with error', 'con error', 'com erro'))}
                    </span>
                  )}
                  {importSummary && errorCount === 0 && <span className="text-gray-400 ml-2">— {importSummary}</span>}
                </p>
                <button type="button" onClick={resetFile} className="text-xs text-gray-500 hover:text-gray-700">
                  {L(ml('Upload different file', 'Subir otro archivo', 'Enviar outro arquivo'))}
                </button>
              </div>
              {errorCount > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-950 space-y-1.5">
                  <p className="font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    {L(ml(
                      'Rows were not deleted. Fix the red rows (or delete them) — import is blocked until then.',
                      'Las filas no se eliminaron. Corrija las filas en rojo (o bórrelas) — no se puede importar hasta entonces.',
                      'As linhas não foram eliminadas. Corrija as linhas em vermelho (ou apague-as) — não dá para importar até lá.',
                    ))}
                  </p>
                  <div className="max-h-28 overflow-y-auto space-y-0.5">
                    {importWarnings.map((w, i) => (
                      <p key={`${i}-${w}`}>{w}</p>
                    ))}
                  </div>
                </div>
              )}
              {errorCount > 0 && (
                <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={onlyErrors}
                    onChange={(e) => setOnlyErrors(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  {L(ml(
                    `Show only error rows (${errorCount})`,
                    `Mostrar solo filas con error (${errorCount})`,
                    `Mostrar só linhas com erro (${errorCount})`,
                  ))}
                </label>
              )}
              {importError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{importError}</div>
              )}
              <div className="border rounded-lg overflow-auto max-h-[52vh]">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-2 py-2 text-left font-medium text-gray-500 w-12">{L(ml('Row', 'Fila', 'Linha'))}</th>
                      <th className="px-2 py-2 text-left font-medium text-gray-500">{L(ml('Title', 'Título', 'Título'))}</th>
                      <th className="px-2 py-2 text-left font-medium text-gray-500">Tipo</th>
                      <th className="px-2 py-2 text-right font-medium text-gray-500">{L(ml('Amount', 'Monto', 'Valor'))}</th>
                      <th className="px-2 py-2 text-left font-medium text-gray-500">{L(ml('Currency', 'Moneda', 'Moeda'))}</th>
                      <th className="px-2 py-2 text-left font-medium text-gray-500">{L(ml('Category', 'Categoría', 'Categoria'))}</th>
                      <th className="px-2 py-2 text-left font-medium text-gray-500">{L(ml('Date', 'Fecha', 'Data'))}</th>
                      <th className="px-2 py-2 w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {visibleRows.map(({ t, index: i }) => {
                      const issues = t.issues ?? [];
                      const hasErr = issues.length > 0;
                      const amountIssue = issues.find((x) => x.field === 'amount');
                      const dateIssue = issues.find((x) => x.field === 'date');
                      const typeIssue = issues.find((x) => x.field === 'type');
                      return (
                        <tr key={`${t.sourceRow ?? i}-${i}`} className={hasErr ? 'bg-red-50' : 'hover:bg-gray-50'}>
                          <td className="px-2 py-1.5 font-mono text-gray-500 whitespace-nowrap">
                            {t.sourceRow ?? i + 2}
                          </td>
                          <td className="px-2 py-1.5">
                            <input value={t.title} onChange={(e) => updateImportRow(i, 'title', e.target.value)} className="w-full min-w-[8rem] px-1 py-0.5 border rounded text-xs" />
                            {hasErr && (
                              <p className="text-[10px] text-red-700 mt-0.5 leading-snug">
                                {issues.map((x) => x.message).join(' · ')}
                              </p>
                            )}
                          </td>
                          <td className="px-2 py-1.5">
                            <select
                              value={TYPE_CONFIG[t.type] ? t.type : ''}
                              onChange={(e) => updateImportRow(i, 'type', e.target.value)}
                              className={`px-1 py-0.5 border rounded text-xs ${typeIssue ? 'border-red-500 bg-white' : ''}`}
                            >
                              {typeIssue && !TYPE_CONFIG[t.type] && (
                                <option value="">{typeIssue.raw || '—'}</option>
                              )}
                              {Object.entries(TYPE_CONFIG).map(([k, v]) => (
                                <option key={k} value={k}>{L(v.labels)}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="number"
                              step="0.01"
                              value={Number.isFinite(t.amount) && t.amount > 0 ? t.amount : ''}
                              placeholder={amountIssue && amountIssue.raw !== '(vacío)' ? amountIssue.raw : ''}
                              onChange={(e) => updateImportRow(i, 'amount', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                              className={`w-24 px-1 py-0.5 border rounded text-xs text-right ${amountIssue ? 'border-red-500' : ''}`}
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <select value={t.currency} onChange={(e) => updateImportRow(i, 'currency', e.target.value)} className="px-1 py-0.5 border rounded text-xs">
                              <option value="USD">USD</option>
                              <option value="UYU">UYU</option>
                              <option value="BRL">BRL</option>
                              <option value="EUR">EUR</option>
                              <option value="ARS">ARS</option>
                            </select>
                          </td>
                          <td className="px-2 py-1.5">
                            <input value={t.category} onChange={(e) => updateImportRow(i, 'category', e.target.value)} className="w-24 px-1 py-0.5 border rounded text-xs" />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="date"
                              value={t.date}
                              onChange={(e) => updateImportRow(i, 'date', e.target.value)}
                              className={`px-1 py-0.5 border rounded text-xs ${dateIssue ? 'border-red-500' : ''}`}
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <button
                              type="button"
                              title={L(ml('Remove this row', 'Quitar esta fila', 'Remover esta linha'))}
                              onClick={() => removeImportRow(i)}
                              className="p-0.5 text-gray-300 hover:text-red-500"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                  {L(ml('Cancel', 'Cancelar', 'Cancelar'))}
                </button>
                <button
                  type="button"
                  onClick={confirmImport}
                  disabled={importPreview.length === 0 || importLoading || errorCount > 0}
                  className="px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {errorCount > 0
                    ? L(ml(
                      `Fix ${errorCount} row(s) first`,
                      `Corrija ${errorCount} fila(s) primero`,
                      `Corrija ${errorCount} linha(s) primeiro`,
                    ))
                    : `${L(ml('Confirm & Import', 'Confirmar e Importar', 'Confirmar e Importar'))} (${importPreview.length})`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
