'use client';

import Link from 'next/link';
import { hasDeepSectorMatrix } from '@/lib/nexus-sector-matrices';

type Props = {
  engagementId: string;
  clientCount: number;
  selectedCompanyId: string;
  sectorId?: string | null;
  hasOpenCases: boolean;
  hasDiagnosisHint: boolean;
  es: boolean;
};

/**
 * Trilho do processo AT ponta a ponta no contrato.
 * Estado derivado (sem backend novo) para orientar o técnico.
 */
export function NexusAtProcessRail({
  engagementId,
  clientCount,
  selectedCompanyId,
  sectorId,
  hasOpenCases,
  hasDiagnosisHint,
  es,
}: Props) {
  const deep = hasDeepSectorMatrix(sectorId);
  const steps = [
    {
      id: 'legal',
      label: es ? '1. Marco legal' : '1. Marco legal',
      done: true,
      href: null as string | null,
      hint: es ? 'Contrato creado' : 'Contrato criado',
    },
    {
      id: 'clients',
      label: es ? '2. MIPYMEs' : '2. MIPYMEs',
      done: clientCount > 0,
      href: null,
      hint:
        clientCount > 0
          ? es
            ? `${clientCount} empresa(s)`
            : `${clientCount} empresa(s)`
          : es
            ? 'Importar lista'
            : 'Importar lista',
    },
    {
      id: 'dx',
      label: es ? '3. Diagnóstico CMM' : '3. Diagnóstico CMM',
      done: hasDiagnosisHint,
      href: selectedCompanyId
        ? `/hub/nexus/diagnosis?company=${encodeURIComponent(selectedCompanyId)}&engagement=${encodeURIComponent(engagementId)}`
        : null,
      hint: deep
        ? es
          ? 'Matriz sectorial 1–5'
          : 'Matriz setorial 1–5'
        : es
          ? 'Cuestionario sectorial'
          : 'Questionário setorial',
    },
    {
      id: 'plan',
      label: es ? '4. Plan de trabajo' : '4. Plano de trabalho',
      done: hasOpenCases,
      href: selectedCompanyId
        ? `/hub/nexus/diagnosis?company=${encodeURIComponent(selectedCompanyId)}&engagement=${encodeURIComponent(engagementId)}`
        : null,
      hint: es ? 'Capas + casos AT' : 'Camadas + casos AT',
    },
    {
      id: 'tools',
      label: es ? '5. Stack Etholys' : '5. Stack Etholys',
      done: false,
      href: null,
      hint: es ? 'Próximo: mapear brechas→módulos' : 'Próximo: mapear brechas→módulos',
    },
  ];

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">
        {es ? 'Proceso AT' : 'Processo AT'}
      </p>
      <ol className="flex flex-wrap gap-2">
        {steps.map((s) => {
          const cls = s.done
            ? 'border-teal-700 bg-teal-50 text-teal-950'
            : 'border-slate-200 bg-slate-50 text-slate-600';
          const inner = (
            <span className={`inline-flex flex-col rounded-lg border px-2.5 py-1.5 text-left ${cls}`}>
              <span className="text-[11px] font-semibold">{s.label}</span>
              <span className="text-[10px] opacity-80">{s.hint}</span>
            </span>
          );
          return (
            <li key={s.id}>
              {s.href && !s.done ? (
                <Link href={s.href} className="hover:opacity-90">
                  {inner}
                </Link>
              ) : (
                inner
              )}
            </li>
          );
        })}
      </ol>
      {clientCount > 0 && !hasDiagnosisHint && selectedCompanyId && (
        <p className="mt-2 text-xs text-slate-600">
          {es
            ? 'Siguiente: corre el diagnóstico CMM de la empresa seleccionada (agricultura/agroindustria usan matriz profunda).'
            : 'Seguinte: corre o diagnóstico CMM da empresa selecionada (agricultura/agroindústria usam matriz profunda).'}{' '}
          <Link
            href={`/hub/nexus/diagnosis?company=${encodeURIComponent(selectedCompanyId)}&engagement=${encodeURIComponent(engagementId)}`}
            className="font-medium text-teal-800 underline"
          >
            {es ? 'Abrir diagnóstico →' : 'Abrir diagnóstico →'}
          </Link>
        </p>
      )}
    </div>
  );
}
