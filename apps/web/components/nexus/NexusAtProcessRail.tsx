'use client';

import Link from 'next/link';

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
  hasOpenCases,
  hasDiagnosisHint,
  es,
}: Props) {
  const dxBase = selectedCompanyId
    ? `/hub/nexus/diagnosis?company=${encodeURIComponent(selectedCompanyId)}&engagement=${encodeURIComponent(engagementId)}`
    : null;
  const planHref = dxBase ? `${dxBase}&resume=plan` : null;
  const roadmapHref = selectedCompanyId
    ? `/hub/nexus/roadmap?company=${encodeURIComponent(selectedCompanyId)}`
    : '/hub/nexus/roadmap';

  const steps = [
    {
      id: 'legal',
      label: es ? '1. Contrato' : '1. Contrato',
      done: clientCount > 0,
      href: null as string | null,
      hint:
        clientCount > 0
          ? es
            ? `${clientCount} MIPYME · sector y oferta`
            : `${clientCount} MIPYME · setor e oferta`
          : es
            ? 'Registra la empresa, el sector y qué vende'
            : 'Regista a empresa, o setor e o que vende',
    },
    {
      id: 'dx',
      label: es ? '2. Diagnóstico 360' : '2. Diagnóstico 360',
      done: hasDiagnosisHint,
      href: dxBase,
      hint: es
        ? 'Estructura, gestión, producción y comercial'
        : 'Estrutura, gestão, produção e comercial',
    },
    {
      id: 'plan',
      label: es ? '3. Plan' : '3. Plano',
      done: hasOpenCases,
      href: hasOpenCases ? roadmapHref : planHref,
      hint: es
        ? 'Acciones, compras, fechas, indicadores'
        : 'Ações, compras, datas, indicadores',
    },
    {
      id: 'campo',
      label: es ? '4. Módulo' : '4. Módulo',
      done: false,
      href: selectedCompanyId
        ? `/hub/nexus/campo?company=${encodeURIComponent(selectedCompanyId)}&engagement=${encodeURIComponent(engagementId)}`
        : null,
      hint: es ? 'Cuaderno y sensores del sector' : 'Caderno e sensores do setor',
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
              {s.href ? (
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
      {clientCount > 0 && !selectedCompanyId && (
        <p className="mt-2 text-xs text-amber-800">
          {es
            ? 'Selecciona una MIPYME en la lista para continuar.'
            : 'Seleciona uma MIPYME na lista para continuar.'}
        </p>
      )}
      <p className="mt-2 text-[11px] text-slate-400">
        {es
          ? 'Contrato permanente: cada año se vuelve a diagnosticar. Proyecto o puntual: se cierra al terminar el plan.'
          : 'Contrato permanente: cada ano volta-se a diagnosticar. Projeto ou pontual: fecha-se ao terminar o plano.'}
      </p>
    </div>
  );
}
