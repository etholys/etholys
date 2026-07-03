'use client';

import { useState } from 'react';
import {
  AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, HelpCircle, ListChecks, Sparkles, XCircle,
} from 'lucide-react';
import type { DonorFileValidation } from '@/lib/siep/donor-report-analyze';

const COMPONENT_LABELS: Record<string, string> = {
  narrative: 'Narrativo / actividades',
  me_indicators: 'Planilha M&E',
  financial: 'Financeiro',
  evidence_links: 'Anexos / links',
  other: 'Outro',
};

const CADENCE_LABELS: Record<string, string> = {
  monthly: 'Mensal (reembolso)',
  quarterly: 'Trimestral',
  annual: 'Anual',
  unknown: 'Indeterminado',
};

function confidenceStyle(pct: number) {
  if (pct >= 80) return { bar: 'bg-emerald-500', text: 'text-emerald-800', bg: 'bg-emerald-50 border-emerald-200' };
  if (pct >= 55) return { bar: 'bg-amber-500', text: 'text-amber-800', bg: 'bg-amber-50 border-amber-200' };
  return { bar: 'bg-red-500', text: 'text-red-800', bg: 'bg-red-50 border-red-200' };
}

type Props = {
  validation: DonorFileValidation & { error?: string };
  defaultOpen?: boolean;
  onConfirm?: () => void;
  confirmed?: boolean;
};

function BulletList({
  items,
  icon: Icon,
  className,
  empty,
}: {
  items: string[];
  icon: typeof CheckCircle2;
  className: string;
  empty?: string;
}) {
  if (!items.length) {
    return empty ? <p className="text-[11px] text-gray-400 italic">{empty}</p> : null;
  }
  return (
    <ul className="space-y-1">
      {items.map((item, i) => (
        <li key={i} className={`flex items-start gap-1.5 text-[11px] ${className}`}>
          <Icon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function DonorFileValidationCard({ validation: v, defaultOpen = true, onConfirm, confirmed }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  if (v.error) {
    return (
      <div className="mt-2 p-2 rounded-lg bg-red-50 border border-red-100 text-[11px] text-red-700">
        <p className="font-medium flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> Erro na análise</p>
        <p className="mt-1">{v.error}</p>
      </div>
    );
  }

  const pct = Math.round((v.confidence ?? 0) * 100);
  const style = confidenceStyle(pct);
  const lowExtraction = v.extractionCharCount !== undefined && v.extractionCharCount < 80;
  const isStale = v.warnings.some((w) => w.includes('incompleta ou antiga'));

  return (
    <div className={`mt-2 rounded-lg border ${style.bg} overflow-hidden`}>
      {(lowExtraction || v.extractionIssue) && (
        <div className="px-3 py-2 bg-amber-100/90 border-b border-amber-200 text-[10px] text-amber-950">
          <p className="font-semibold flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> Leitura do ficheiro limitada
          </p>
          <p className="mt-0.5">
            {v.extractionCharCount ?? 0} caracteres extraídos
            {v.extractionMethod ? ` (${v.extractionMethod})` : ''}.
            {v.extractionIssue ? ` ${v.extractionIssue}` : ''}
          </p>
          <p className="mt-1 text-amber-900/90">
            «Validar estrutura» só revê o Word/PDF subido. Para <strong>construir</strong> o informe, use o passo ③ «Gerar borrador del informe».
          </p>
        </div>
      )}
      {isStale && !lowExtraction && (
        <div className="px-3 py-1.5 bg-violet-100/80 border-b border-violet-200 text-[10px] text-violet-900">
          Análise desactualizada — clique «Validar estrutura (IA)» outra vez para resultados completos.
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/40 transition"
      >
        {open ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
        <Sparkles className={`w-4 h-4 ${style.text}`} />
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-semibold ${style.text}`}>Análise IA — {pct}% conforme</p>
          <p className="text-[10px] text-gray-600 truncate">{v.confidenceReason}</p>
        </div>
        <div className="w-16 h-1.5 rounded-full bg-white/80 overflow-hidden flex-shrink-0">
          <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${pct}%` }} />
        </div>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3 border-t border-white/60 bg-white/50">
          <div className="grid sm:grid-cols-2 gap-2 pt-2">
            <div className="text-[10px] text-gray-600">
              <span className="font-medium text-gray-700">Tipo detectado:</span>{' '}
              {COMPONENT_LABELS[v.detectedComponent] || v.detectedComponent}
            </div>
            <div className="text-[10px] text-gray-600">
              <span className="font-medium text-gray-700">Cadência:</span>{' '}
              {CADENCE_LABELS[v.detectedCadence] || v.detectedCadence}
            </div>
            {v.suggestedPeriod && (
              <div className="text-[10px] text-gray-600 sm:col-span-2">
                <span className="font-medium text-gray-700">Período sugerido:</span> {v.suggestedPeriod}
              </div>
            )}
          </div>

          <section>
            <p className="text-[10px] font-semibold text-gray-700 uppercase tracking-wide mb-1 flex items-center gap-1">
              <HelpCircle className="w-3 h-3" /> O que a IA entendeu
            </p>
            <p className="text-[11px] text-gray-700 leading-relaxed bg-white rounded-md p-2 border border-gray-100">
              {v.interpretation}
            </p>
          </section>

          {v.summary && v.summary !== v.interpretation && (
            <p className="text-[11px] text-gray-600 italic">{v.summary}</p>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            <section>
              <p className="text-[10px] font-semibold text-emerald-700 mb-1">Secções / campos encontrados</p>
              <BulletList
                items={[...v.sectionsFound, ...v.fieldsComplete]}
                icon={CheckCircle2}
                className="text-emerald-800"
                empty="Nenhuma secção identificada claramente."
              />
            </section>
            <section>
              <p className="text-[10px] font-semibold text-red-700 mb-1">Em falta ou incompletos</p>
              <BulletList
                items={[...v.sectionsMissing, ...v.fieldsMissing]}
                icon={XCircle}
                className="text-red-800"
                empty="Nada crítico identificado (pode estar incompleto na extração)."
              />
            </section>
          </div>

          {v.warnings.length > 0 && (
            <section>
              <p className="text-[10px] font-semibold text-amber-800 mb-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Avisos
              </p>
              <BulletList items={v.warnings} icon={AlertTriangle} className="text-amber-900" />
            </section>
          )}

          {v.improvements.length > 0 && (
            <section className="rounded-md bg-indigo-50/80 border border-indigo-100 p-2">
              <p className="text-[10px] font-semibold text-indigo-900 mb-1.5 flex items-center gap-1">
                <ListChecks className="w-3 h-3" /> Como melhorar o informe
              </p>
              <ol className="list-decimal list-inside space-y-1 text-[11px] text-indigo-950">
                {v.improvements.map((step, i) => (
                  <li key={i} className="leading-snug">{step}</li>
                ))}
              </ol>
            </section>
          )}

          {v.feedsQuarterlyReport && (
            <p className="text-[10px] text-emerald-700 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Este ficheiro pode alimentar o pacote trimestral oficial.
            </p>
          )}

          {onConfirm && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={onConfirm}
                disabled={confirmed}
                className={`text-[10px] px-2.5 py-1 rounded-md border ${
                  confirmed
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200 cursor-default'
                    : 'bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50'
                }`}
              >
                {confirmed ? 'Revisto / OK' : 'Marcar como revisto / OK'}
              </button>
              {v.analyzedAt && (
                <span className="text-[9px] text-gray-400">
                  Analisado {new Date(v.analyzedAt).toLocaleString('pt-PT')}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
