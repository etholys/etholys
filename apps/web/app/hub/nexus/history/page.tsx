'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { History, Trash2, FileDown } from 'lucide-react';
import { useApp } from '@/app/providers';
import {
  exportSnapshotsMarkdown,
  loadDiagnosisHistory,
  removeDiagnosisSnapshot,
  type NexusDiagnosisSnapshot,
} from '@/lib/nexus-diagnosis-history';

function NexusHistoryInner() {
  const { locale, activeCompanyId } = useApp();
  const searchParams = useSearchParams();
  const networkId = searchParams.get('network');

  const withNet = (href: string) =>
    networkId ? `${href.split('?')[0]}?network=${encodeURIComponent(networkId)}` : href;

  const scope = useMemo(
    () => ({ companyId: activeCompanyId ?? null, networkId: networkId ?? null }),
    [activeCompanyId, networkId],
  );

  const [items, setItems] = useState<NexusDiagnosisSnapshot[]>([]);

  const refresh = useCallback(() => {
    setItems(loadDiagnosisHistory(scope));
  }, [scope]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const t =
    locale === 'es'
      ? {
          title: 'Historial del diagnóstico',
          intro:
            'Cada vez que termináis el cuestionario (resumen final), guardamos aquí una captura ligada a la empresa activa y —si aplica— a la red en la URL. Los datos viven sólo en este navegador.',
          empty: 'Aún no hay diagnósticos guardados completando el cuestionario en este contexto.',
          overall: 'Score global',
          sectors: 'Sectores',
          weak: 'Atención',
          del: 'Eliminar esta entrada',
          export: 'Exportar Markdown',
          roadmap: 'Ruta viva',
          diagnosis: 'Nuevo diagnóstico',
        }
      : locale === 'en'
        ? {
            title: 'Diagnostic history',
            intro:
              'Each time you finish the questionnaire (summary screen), a snapshot is stored for the active company and —when relevant— the network in the URL. Data stays in this browser only.',
            empty: 'No saved diagnostics yet for this context. Complete the questionnaire once.',
            overall: 'Overall score',
            sectors: 'Sectors',
            weak: 'Focus',
            del: 'Remove this snapshot',
            export: 'Export Markdown',
            roadmap: 'Live roadmap',
            diagnosis: 'New diagnostic',
          }
        : {
            title: 'Histórico do diagnóstico',
            intro:
              'Cada vez que concluirem o questionário (ecrã de resultado), ficamos com uma cópia associada à empresa activa e —se aplicável— à rede na URL. Os dados ficam só neste browser.',
            empty: 'Ainda não há diagnósticos guardados neste contexto. Concluí o questionário uma vez.',
            overall: 'Score global',
            sectors: 'Sectores',
            weak: 'Atenção',
            del: 'Remover esta entrada',
            export: 'Exportar Markdown',
            roadmap: 'Rota viva',
            diagnosis: 'Novo diagnóstico',
          };

  function onDelete(id: string) {
    removeDiagnosisSnapshot(scope, id);
    refresh();
  }

  function onExportMd() {
    const md = exportSnapshotsMarkdown(
      scope,
      items,
      `${t.title} (${new Date().toISOString().slice(0, 10)})`,
    );
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexus-diagnostico-${scope.companyId ?? 'empresa'}${networkId ? `-${networkId.slice(0, 8)}` : ''}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start gap-3 text-gray-900">
        <History className="h-8 w-8 shrink-0 text-violet-600" />
        <div>
          <h1 className="text-2xl font-bold">{t.title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">{t.intro}</p>
        </div>
      </header>

      {items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onExportMd}
            className="inline-flex items-center gap-2 rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-sm font-medium text-violet-900 shadow-sm hover:bg-violet-50"
          >
            <FileDown className="h-4 w-4" />
            {t.export}
          </button>
          <Link
            href={withNet('/hub/nexus/diagnosis')}
            className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-50"
          >
            {t.diagnosis}
          </Link>
          <Link
            href={withNet('/hub/nexus/roadmap')}
            className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-50"
          >
            {t.roadmap}
          </Link>
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-6 text-sm text-violet-950">
          <p>{t.empty}</p>
          <Link
            href={withNet('/hub/nexus/diagnosis')}
            className="mt-3 inline-block font-semibold text-violet-900 underline underline-offset-2 hover:text-violet-800"
          >
            {t.diagnosis} →
          </Link>
        </div>
      ) : (
        <ul className="space-y-4">
          {items.map((s) => (
            <li
              key={s.id}
              className="relative rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-400">
                    {new Date(s.savedAt).toLocaleString(
                      locale === 'es' ? 'es-UY' : locale === 'en' ? 'en-GB' : 'pt-PT',
                      { dateStyle: 'medium', timeStyle: 'short' },
                    )}
                  </p>
                  <p className="mt-1 text-lg font-bold text-gray-900">
                    {t.overall}: {s.overallScore}/100
                  </p>
                </div>
                <button
                  type="button"
                  title={t.del}
                  onClick={() => onDelete(s.id)}
                  className="rounded-lg border border-transparent p-1.5 text-gray-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{t.sectors}</p>
                <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                  {s.sectorScores.map((sec) => (
                    <div
                      key={`${s.id}-${sec.slug}`}
                      className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-2 py-1 text-xs"
                    >
                      <span className="truncate font-medium text-gray-800">{sec.name}</span>
                      <span className="shrink-0 font-mono text-gray-600">{sec.score}</span>
                    </div>
                  ))}
                </div>
              </div>
              {s.weakestSectorNames.length > 0 && (
                <p className="mt-3 text-xs text-gray-600">
                  <span className="font-semibold text-gray-700">{t.weak}: </span>
                  {s.weakestSectorNames.join(' · ')}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function NexusHistoryPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[24vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500/30 border-t-violet-600" />
        </div>
      }
    >
      <NexusHistoryInner />
    </Suspense>
  );
}
