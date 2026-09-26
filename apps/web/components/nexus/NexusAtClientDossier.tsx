'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { sectorProgramSummary } from '@/lib/nexus-at-sector-playbook';
import { loadDiagnosisHistory, type NexusDiagnosisSnapshot } from '@/lib/nexus-diagnosis-history';
import { sectorBadgeLabel } from '@/components/nexus/NexusAtSectorPlaybook';
import { NexusIncubationProcessPanel } from '@/components/nexus/NexusIncubationProcessPanel';
import { NexusModulePulse } from '@/components/nexus/NexusModulePulse';
import { hasDeepSectorMatrix } from '@/lib/nexus-sector-matrices';

type Locale = 'es' | 'pt' | 'en';

type Props = {
  companyId: string;
  companyName: string;
  sectorId: string | null | undefined;
  sectorIds?: string[] | null;
  locale: Locale;
  es: boolean;
  engagementId?: string | null;
  networkId?: string | null;
  /** Quando o CTA de diagnóstico já está na barra sticky do contrato */
  hideDiagnosisCta?: boolean;
};

export function NexusAtClientDossier({
  companyId,
  companyName,
  sectorId,
  sectorIds,
  locale,
  es,
  engagementId,
  networkId,
  hideDiagnosisCta = false,
}: Props) {
  const ids =
    sectorIds && sectorIds.length > 0 ? sectorIds : sectorId ? [sectorId] : [];
  const program = sectorProgramSummary(ids[0], locale);
  const sectorLabels = ids
    .map((sid) => sectorBadgeLabel(sid, locale))
    .filter(Boolean) as string[];
  const deepMatrix = hasDeepSectorMatrix(ids[0]);
  const [lastDx, setLastDx] = useState<NexusDiagnosisSnapshot | null>(null);

  useEffect(() => {
    const hist = loadDiagnosisHistory({ companyId, networkId: networkId || null });
    setLastDx(hist[0] || null);
  }, [companyId, networkId]);

  const diagnosisHref = `/hub/nexus/diagnosis?company=${encodeURIComponent(companyId)}${
    engagementId ? `&engagement=${encodeURIComponent(engagementId)}` : ''
  }${networkId ? `&network=${encodeURIComponent(networkId)}` : ''}`;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/80 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
          {es ? 'Ficha de consultoría' : 'Ficha de consultoria'}
        </p>
        <p className="mt-1 text-sm font-semibold text-slate-900">{companyName}</p>
        {sectorLabels.length > 0 && (
          <p className="mt-1 text-xs text-teal-800">
            {es ? 'Temáticas' : 'Temáticas'}: {sectorLabels.join(' · ')}
          </p>
        )}

        {!lastDx && (
          <p className="mt-3 text-xs leading-relaxed text-slate-600">
            {es
              ? 'El sector ya está. El plan, el cuaderno y las líneas de trabajo salen del diagnóstico 360 — todavía no hay nada que cumplir.'
              : 'O setor já está. O plano, o caderno e as linhas de trabalho saem do diagnóstico 360 — ainda não há nada a cumprir.'}
          </p>
        )}

        {lastDx && (
          <div className="mt-3 rounded-lg border border-indigo-100 bg-indigo-50/60 px-3 py-2 text-xs text-indigo-950">
            <p className="font-medium">
              {es ? 'Último diagnóstico' : 'Último diagnóstico'} · {lastDx.overallScore}/100
            </p>
          </div>
        )}

        {lastDx && program && (
          <div className="mt-3">
            <p className="text-[11px] font-medium uppercase text-slate-500">
              {es ? 'Líneas del plan (tras el 360)' : 'Linhas do plano (após o 360)'}
            </p>
            <ul className="mt-1.5 space-y-1">
              {program.focusAreas.map((line, i) => (
                <li key={i} className="flex gap-2 text-xs leading-relaxed text-slate-600">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-teal-600" />
                  {line}
                </li>
              ))}
            </ul>
          </div>
        )}

        {lastDx && (
          <div className="mt-3">
            <NexusModulePulse companyId={companyId} engagementId={engagementId} locale={locale} />
          </div>
        )}

        {!hideDiagnosisCta && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={diagnosisHref}
              className="rounded-md bg-teal-800 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-teal-900"
            >
              {lastDx
                ? es
                  ? 'Reabrir diagnóstico'
                  : 'Reabrir diagnóstico'
                : es
                  ? 'Iniciar diagnóstico 360'
                  : 'Iniciar diagnóstico 360'}
            </Link>
          </div>
        )}
        {lastDx && deepMatrix && (
          <p className="mt-2 text-[11px] text-slate-500">
            {es
              ? 'En profundidad se añade matriz CMM. El 360 estándar usa capas: negocio, gestión, producción y comercial.'
              : 'Em profundidade acrescenta-se matriz CMM. O 360 padrão usa camadas: negócio, gestão, produção e comercial.'}
          </p>
        )}
      </div>

      {lastDx ? (
        <NexusIncubationProcessPanel
          companyId={companyId}
          networkId={networkId}
          locale={locale}
          compact
          engagementId={engagementId}
          hideWhenEmpty
        />
      ) : null}
    </div>
  );
}
