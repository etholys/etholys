'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/app/providers';
import { isLikelyDbId } from '@/lib/utils';
import { EligibilityProfileForm } from '@/components/fundhub/EligibilityProfileForm';
import type { FunderImportRow } from '@/lib/opportunity/funder-import';
import {
  ArrowLeft,
  Building2,
  Check,
  Handshake,
  Loader2,
  Upload,
  Users,
} from 'lucide-react';

export default function FundHubCrmPage() {
  const { locale, activeCompanyId } = useApp();
  const companyId = useMemo(() => {
    const s = String(activeCompanyId ?? '').trim();
    return isLikelyDbId(s) ? s : '';
  }, [activeCompanyId]);
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

  const preview = useCallback(async () => {
    await runPreview({ text: raw });
  }, [raw, runPreview]);

  const onFile = useCallback(
    async (file: File | null) => {
      if (!file) return;
      setRaw('');
      await runPreview({ file });
    },
    [runPreview],
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

  if (!companyId) {
    return (
      <p className="p-6 text-sm text-gray-600">
        {t('Seleccione uma empresa.', 'Seleccione una empresa.', 'Select a company.')}
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <Link href="/hub/fundhub" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" />
          FundHub
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900 md:text-3xl">
          {t('CRM de captação', 'CRM de captación', 'Capture CRM')}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-600">
          {t(
            'Rede da organização: elegibilidade, financiadores conhecidos e sócios locais — o que a Salesforce cobre na prática de fundos.',
            'Red de la organización: elegibilidad, financiadores conocidos y socios locales — lo que Salesforce cubre en la práctica de fondos.',
            'Org network: eligibility, known funders, and local partners — Salesforce for funding practice.',
          )}
        </p>
      </div>

      <EligibilityProfileForm />

      <section className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/hub/fundhub/partners"
          className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:border-amber-300"
        >
          <div className="flex items-center gap-2 font-semibold text-gray-900">
            <Handshake className="h-5 w-5 text-amber-700" />
            {t('Sócios / aliados', 'Socios / aliados', 'Partners / allies')}
          </div>
          <p className="mt-2 text-sm text-gray-600">
            {t(
              'Quem pode co-postular quando falta registo no país ou tipo de org.',
              'Quién puede co-postular cuando falta registro en el país o tipo de org.',
              'Who can co-apply when country registration or org type is missing.',
            )}
          </p>
        </Link>
        <Link
          href="/hub/fundhub/my-funds"
          className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:border-amber-300"
        >
          <div className="flex items-center gap-2 font-semibold text-gray-900">
            <Building2 className="h-5 w-5 text-amber-700" />
            {t('Pipeline Em curso', 'Pipeline En curso', 'In-progress pipeline')}
          </div>
          <p className="mt-2 text-sm text-gray-600">
            {t(
              'Fundos guardados, estados Decide → Preparar → Submetido.',
              'Fondos guardados, estados Decidir → Preparar → Enviado.',
              'Saved funds, Decide → Prepare → Submitted.',
            )}
          </p>
        </Link>
        <Link
          href="/hub/fundhub/coalition"
          className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:border-amber-300"
        >
          <div className="flex items-center gap-2 font-semibold text-gray-900">
            <Users className="h-5 w-5 text-amber-700" />
            {t('Coalizão', 'Coalición', 'Coalition')}
          </div>
          <p className="mt-2 text-sm text-gray-600">
            {t('Consórcios e redes de proposta.', 'Consorcios y redes de propuesta.', 'Proposal consortia and networks.')}
          </p>
        </Link>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <Upload className="h-5 w-5 text-amber-700" />
          <h2 className="text-base font-semibold text-gray-900">
            {t('Importar financiadores', 'Importar financiadores', 'Import funders')}
          </h2>
        </div>
        <p className="mt-1 text-sm text-gray-600">
          {t(
            'Carregue a planilha (.xlsx / .csv) ou cole o texto. O sistema lê, mostra pré-visualização; corrija e confirme.',
            'Suba la planilla (.xlsx / .csv) o pegue el texto. El sistema lee, muestra vista previa; corrija y confirme.',
            'Upload the spreadsheet (.xlsx / .csv) or paste text. The system reads it, shows a preview; fix and confirm.',
          )}
        </p>
        <label className="mt-3 flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-amber-300 bg-amber-50/50 px-4 py-6 text-center hover:bg-amber-50">
          <Upload className="mb-2 h-6 w-6 text-amber-700" />
          <span className="text-sm font-medium text-gray-800">
            {fileName
              ? fileName
              : t('Escolher ficheiro Excel/CSV', 'Elegir archivo Excel/CSV', 'Choose Excel/CSV file')}
          </span>
          <span className="mt-1 text-xs text-gray-500">
            {t('Colunas: Nome, Instituição, URL…', 'Columnas: Nombre, Institución, URL…', 'Columns: Name, Institution, URL…')}
          </span>
          <input
            type="file"
            accept=".xlsx,.xls,.csv,.tsv,.txt"
            className="hidden"
            onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <p className="mt-3 text-xs font-medium uppercase tracking-wide text-gray-400">
          {t('Ou colar', 'O pegar', 'Or paste')}
        </p>
        <textarea
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value);
            setFileName(null);
          }}
          rows={5}
          className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-xs"
          placeholder={'Nombre | Institución | URL\nAECID Cooperación 2026 | AECID | https://www.aecid.es/...'}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !raw.trim()}
            onClick={() => void preview()}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
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
        {msg && <p className="mt-2 text-sm text-gray-700">{msg}</p>}

        {rows && (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
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
                  <tr key={row.rowIndex} className="border-t border-gray-100">
                    <td className="py-2 pr-3 text-gray-400">{row.rowIndex}</td>
                    <td className="py-2 pr-3">
                      <input
                        className="w-full rounded border border-gray-200 px-2 py-1"
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
                        className="w-full rounded border border-gray-200 px-2 py-1"
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
                        className="w-full rounded border border-gray-200 px-2 py-1 font-mono text-xs"
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
                        <span className="text-emerald-700">{t('OK', 'OK', 'OK')}</span>
                      ) : (
                        <span className="text-amber-700">{row.issues.join(', ')}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
