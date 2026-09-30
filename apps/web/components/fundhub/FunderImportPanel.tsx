'use client';

import { useCallback, useState } from 'react';
import { useApp } from '@/app/providers';
import { isLikelyDbId } from '@/lib/utils';
import type { FunderImportRow } from '@/lib/opportunity/funder-import';
import { Check, Loader2, Upload } from 'lucide-react';

export function FunderImportPanel({ companyId: companyIdProp }: { companyId?: string }) {
  const { locale, activeCompanyId } = useApp();
  const companyId = (() => {
    const s = String(companyIdProp ?? activeCompanyId ?? '').trim();
    return isLikelyDbId(s) ? s : '';
  })();
  const t = (pt: string, es: string, en: string) =>
    locale === 'pt' ? pt : locale === 'es' ? es : en;

  const [raw, setRaw] = useState('');
  const [rows, setRows] = useState<FunderImportRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const runPreview = useCallback(
    async (payload: { text?: string; file?: File }) => {
      if (!companyId) return;
      if (!payload.file && !payload.text?.trim()) return;
      setBusy(true);
      setMsg(null);
      try {
        let r: Response;
        if (payload.file) {
          const fd = new FormData();
          fd.append('file', payload.file);
          r = await fetch(
            `/api/opportunity/catalog/import?companyId=${encodeURIComponent(companyId)}`,
            { method: 'POST', body: fd },
          );
        } else {
          r = await fetch(
            `/api/opportunity/catalog/import?companyId=${encodeURIComponent(companyId)}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: payload.text }),
            },
          );
        }
        const d = (await r.json()) as { rows?: FunderImportRow[]; error?: string };
        if (!r.ok) throw new Error(d.error || 'preview failed');
        setRows(d.rows ?? []);
        if (payload.file) setFileName(payload.file.name);
      } catch (e) {
        setMsg(e instanceof Error ? e.message : 'Error');
      } finally {
        setBusy(false);
      }
    },
    [companyId],
  );

  const confirm = useCallback(async () => {
    if (!companyId || !rows?.length) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(
        `/api/opportunity/catalog/import?companyId=${encodeURIComponent(companyId)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ confirm: true, rows }),
        },
      );
      const d = (await r.json()) as { count?: number; error?: string };
      if (!r.ok) throw new Error(d.error || 'confirm failed');
      setMsg(
        t(
          `${d.count ?? 0} financiadores importados.`,
          `${d.count ?? 0} financiadores importados.`,
          `${d.count ?? 0} funders imported.`,
        ),
      );
      setRows(null);
      setRaw('');
      setFileName(null);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(false);
    }
  }, [companyId, rows, t]);

  if (!companyId) return null;

  return (
    <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
      <div className="flex items-center gap-2">
        <Upload className="h-5 w-5 text-amber-400" />
        <h2 className="text-base font-semibold text-white">
          {t('Importar financiadores', 'Importar financiadores', 'Import funders')}
        </h2>
      </div>
      <p className="mt-1 text-sm text-gray-400">
        {t(
          'Carregue a planilha (.xlsx / .csv) ou cole o texto. Pré-visualize, corrija e confirme.',
          'Suba la planilla (.xlsx / .csv) o pegue el texto. Previsualice, corrija y confirme.',
          'Upload a spreadsheet (.xlsx / .csv) or paste text. Preview, fix, and confirm.',
        )}
      </p>
      <label className="mt-3 flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-amber-500/40 bg-amber-950/20 px-4 py-6 text-center hover:bg-amber-950/40">
        <Upload className="mb-2 h-6 w-6 text-amber-400" />
        <span className="text-sm font-medium text-gray-100">
          {fileName
            ? fileName
            : t('Escolher ficheiro Excel/CSV', 'Elegir archivo Excel/CSV', 'Choose Excel/CSV file')}
        </span>
        <input
          type="file"
          accept=".xlsx,.xls,.csv,.tsv,.txt"
          className="hidden"
          onChange={(e) => void runPreview({ file: e.target.files?.[0] }).then(() => undefined)}
        />
      </label>
      <p className="mt-3 text-xs font-medium uppercase tracking-wide text-gray-500">
        {t('Ou colar', 'O pegar', 'Or paste')}
      </p>
      <textarea
        value={raw}
        onChange={(e) => {
          setRaw(e.target.value);
          setFileName(null);
        }}
        rows={5}
        className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 font-mono text-xs text-gray-100"
        placeholder={'Nombre | Institución | URL\nAECID Cooperación 2026 | AECID | https://www.aecid.es/...'}
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !raw.trim()}
          onClick={() => void runPreview({ text: raw })}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {t('Pré-visualizar texto', 'Previsualizar texto', 'Preview paste')}
        </button>
        {rows && (
          <button
            type="button"
            disabled={busy || !rows.some((r) => r.ok)}
            onClick={() => void confirm()}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
            {t('Confirmar importação', 'Confirmar importación', 'Confirm import')}
          </button>
        )}
      </div>
      {msg && <p className="mt-2 text-sm text-amber-200/90">{msg}</p>}

      {rows && (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm text-gray-200">
            <thead className="text-xs uppercase text-gray-500">
              <tr>
                <th className="py-2 pr-3">#</th>
                <th className="py-2 pr-3">{t('Nome', 'Nombre', 'Name')}</th>
                <th className="py-2 pr-3">{t('Instituição', 'Institución', 'Institution')}</th>
                <th className="py-2 pr-3">URL</th>
                <th className="py-2">{t('Estado', 'Estado', 'Status')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={row.rowIndex} className="border-t border-white/10">
                  <td className="py-2 pr-3 text-gray-500">{row.rowIndex}</td>
                  <td className="py-2 pr-3">
                    <input
                      className="w-full rounded border border-white/15 bg-slate-950 px-2 py-1"
                      value={row.name}
                      onChange={(e) => {
                        const next = [...rows];
                        next[idx] = {
                          ...row,
                          name: e.target.value,
                          ok: Boolean(e.target.value.trim() && row.institution.trim()),
                        };
                        setRows(next);
                      }}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      className="w-full rounded border border-white/15 bg-slate-950 px-2 py-1"
                      value={row.institution}
                      onChange={(e) => {
                        const next = [...rows];
                        next[idx] = {
                          ...row,
                          institution: e.target.value,
                          ok: Boolean(row.name.trim() && e.target.value.trim()),
                        };
                        setRows(next);
                      }}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      className="w-full rounded border border-white/15 bg-slate-950 px-2 py-1 font-mono text-xs"
                      value={row.linkOficial ?? ''}
                      onChange={(e) => {
                        const next = [...rows];
                        next[idx] = { ...row, linkOficial: e.target.value || undefined };
                        setRows(next);
                      }}
                    />
                  </td>
                  <td className="py-2">
                    {row.ok ? (
                      <span className="text-emerald-400">{t('OK', 'OK', 'OK')}</span>
                    ) : (
                      <span className="text-amber-400">{row.issues.join(', ')}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
