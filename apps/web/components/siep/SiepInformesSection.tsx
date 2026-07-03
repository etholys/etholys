'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, FileText, ChevronRight, Loader2, Trash2 } from 'lucide-react';
import { SiepInformeWizard } from '@/components/siep/SiepInformeWizard';
import { SiepInformeEditor } from '@/components/siep/SiepInformeEditor';
import { useSiepT, useSiepLocale } from '@/lib/siep/use-siep-t';
import { siepT } from '@/lib/siep/i18n';
import { INFORME_DOMAINS, type InformeDomain } from '@/lib/siep/informe-domains';

type Props = {
  projectId: string;
  companyId: string;
  domain: InformeDomain;
};

type InformeRow = {
  id: string;
  title: string;
  status: string;
  cadence?: string;
  period?: string;
  canvasFormat?: string;
  domain?: string;
  updatedAt: string;
};

const STATUS_KEYS: Record<string, { labelKey: string; cls: string }> = {
  draft: { labelKey: 'siep.informe.status.draft', cls: 'bg-slate-100 text-slate-600' },
  submitted: { labelKey: 'siep.informe.status.submitted', cls: 'bg-blue-100 text-blue-700' },
  approved: { labelKey: 'siep.informe.status.approved', cls: 'bg-emerald-100 text-emerald-700' },
};

const CADENCE_KEYS: Record<string, string> = {
  monthly: 'siep.informe.cadence.monthly',
  quarterly: 'siep.informe.cadence.quarterly',
  quarterly_final: 'siep.informe.cadence.quarterly_final',
  annual: 'siep.informe.cadence.annual',
  adhoc: 'siep.informe.cadence.adhoc',
};

export function SiepInformesSection({ projectId, domain }: Props) {
  const st = useSiepT();
  const locale = useSiepLocale();
  const domainConfig = INFORME_DOMAINS.find((d) => d.id === domain);
  const [informes, setInformes] = useState<InformeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [openReportId, setOpenReportId] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);
  const requestIdRef = useRef(0);

  const load = useCallback((opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? hasLoadedRef.current;
    const requestId = ++requestIdRef.current;
    if (!silent) setLoading(true);
    fetch(`/api/siep/informes?projectId=${projectId}&domain=${domain}`)
      .then(async (r) => {
        const d = await r.json();
        if (requestId !== requestIdRef.current) return;
        if (!r.ok) {
          setLoadError(typeof d.error === 'string' ? d.error : siepT('siep.informe.loadError', locale));
          setInformes([]);
        } else {
          setLoadError(null);
          setInformes(d.informes ?? []);
        }
        hasLoadedRef.current = true;
        setLoading(false);
      })
      .catch(() => {
        if (requestId !== requestIdRef.current) return;
        setLoadError(siepT('siep.informe.loadError', locale));
        setInformes([]);
        setLoading(false);
      });
  }, [projectId, domain, locale]);

  useEffect(() => {
    hasLoadedRef.current = false;
    load();
  }, [projectId, domain, load]);

  const deleteInforme = async (id: string) => {
    if (!confirm(st('siep.informe.deleteConfirm'))) return;
    await fetch(`/api/siep/informes/${id}`, { method: 'DELETE' });
    load({ silent: true });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold text-gray-900">{domainConfig ? st(domainConfig.labelKey) : domain}</h3>
        <button
          type="button"
          onClick={() => setShowWizard(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 shrink-0"
        >
          <Plus className="w-4 h-4" /> {st('siep.informe.btn.new')}
        </button>
      </div>

      {loadError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
        </div>
      ) : !loadError && informes.length === 0 ? (
        <div className="text-center py-14 rounded-xl border border-dashed border-gray-200 bg-gray-50/50">
          <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">{st('siep.informe.empty')}</p>
          <button
            type="button"
            onClick={() => setShowWizard(true)}
            className="mt-3 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
          >
            + {st('siep.informe.emptyCta')}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {informes.map((inf) => {
            const statusMeta = STATUS_KEYS[inf.status] || STATUS_KEYS.draft;
            return (
              <div
                key={inf.id}
                className="flex items-center gap-3 px-4 py-3 border border-gray-100 rounded-xl hover:bg-gray-50/80 group"
              >
                <button
                  type="button"
                  onClick={() => setOpenReportId(inf.id)}
                  className="flex-1 flex items-center gap-3 text-left min-w-0"
                >
                  <FileText className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{inf.title}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {inf.period || '—'}
                      {inf.cadence
                        ? ` · ${CADENCE_KEYS[inf.cadence] ? st(CADENCE_KEYS[inf.cadence]) : inf.cadence}`
                        : ''}
                      {inf.canvasFormat ? ` · ${inf.canvasFormat.toUpperCase()}` : ''}
                    </p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${statusMeta.cls}`}>
                    {st(statusMeta.labelKey)}
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-500" />
                </button>
                <button
                  type="button"
                  onClick={() => void deleteInforme(inf.id)}
                  className="p-1.5 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                  title={st('siep.informe.delete')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {showWizard && (
        <SiepInformeWizard
          projectId={projectId}
          domain={domain}
          onClose={() => setShowWizard(false)}
          onCreated={(reportId) => {
            setShowWizard(false);
            load({ silent: true });
            setOpenReportId(reportId);
          }}
        />
      )}

      {openReportId && (
        <SiepInformeEditor
          reportId={openReportId}
          onClose={() => setOpenReportId(null)}
          onSaved={() => load({ silent: true })}
        />
      )}
    </div>
  );
}
