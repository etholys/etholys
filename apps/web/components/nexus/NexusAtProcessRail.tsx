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
  sectorId,
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
      done: true,
      href: null as string | null,
      hint: es
        ? 'Permanente, proyecto o puntual — el contrato decide el loop'
        : 'Permanente, projeto ou pontual — o contrato decide o loop',
    },
    {
      id: 'clients',
      label: es ? '2. Sector y oferta' : '2. Setor e oferta',
      done: clientCount > 0,
      href: null,
      hint:
        clientCount > 0
          ? es
            ? `${clientCount} empresa(s) · qué vende cada una`
            : `${clientCount} empresa(s) · o que cada uma vende`
          : es
            ? 'Registrar cada MIPYME, sector y si vende producto/servicio'
            : 'Registar cada MIPYME, setor e se vende produto/serviço',
    },
    {
      id: 'dx',
      label: es ? '3. Diagnóstico 360' : '3. Diagnóstico 360',
      done: hasDiagnosisHint,
      href: dxBase,
      hint: deep
        ? es
          ? 'Estructura · gestión · producción 1/2/3 · comercial'
          : 'Estrutura · gestão · produção 1/2/3 · comercial'
        : es
          ? '360 del perfil: brechas, potenciales, madurez'
          : '360 do perfil: lacunas, potenciais, maturidade',
    },
    {
      id: 'plan',
      label: es ? '4. Documento + plan' : '4. Documento + plano',
      done: hasOpenCases,
      href: hasOpenCases ? roadmapHref : planHref,
      hint: es
        ? 'Quanti + quali · acciones, compras, fechas, indicadores'
        : 'Quanti + quali · ações, compras, datas, indicadores',
    },
    {
      id: 'campo',
      label: es ? '5. Ejecución / módulo' : '5. Execução / módulo',
      done: false,
      href: selectedCompanyId
        ? `/hub/nexus/campo?company=${encodeURIComponent(selectedCompanyId)}&engagement=${encodeURIComponent(engagementId)}`
        : null,
      hint: es ? 'Cuaderno y sensores del sector' : 'Caderno e sensores do setor',
    },
    {
      id: 'loop',
      label: es ? '6. Ciclo anual o cierre' : '6. Ciclo anual ou fecho',
      done: false,
      href: dxBase,
      hint: es
        ? 'Permanente: análisis del año + nuevo 360. Otro contrato: cierra.'
        : 'Permanente: análise do ano + novo 360. Outro contrato: fecha.',
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
            ? 'Selecciona una MIPYME en la lista para continuar el proceso.'
            : 'Seleciona uma MIPYME na lista para continuar o processo.'}
        </p>
      )}
    </div>
  );
}
