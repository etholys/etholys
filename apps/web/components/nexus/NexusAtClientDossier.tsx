'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { sectorProgramSummary } from '@/lib/nexus-at-sector-playbook';
import { loadDiagnosisHistory, type NexusDiagnosisSnapshot } from '@/lib/nexus-diagnosis-history';
import { sectorBadgeLabel } from '@/components/nexus/NexusAtSectorPlaybook';
import { NexusIncubationProcessPanel } from '@/components/nexus/NexusIncubationProcessPanel';

type Locale = 'es' | 'pt' | 'en';

type Props = {
  companyId: string;
  companyName: string;
  sectorId: string | null | undefined;
  locale: Locale;
  es: boolean;
  engagementId?: string | null;
  networkId?: string | null;
};

export function NexusAtClientDossier({
  companyId,
  companyName,
  sectorId,
  locale,
  es,
  engagementId,
  networkId,
}: Props) {
  const program = sectorProgramSummary(sectorId, locale);
  const sectorLabel = sectorBadgeLabel(sectorId, locale);
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
        {sectorLabel && (
          <p className="mt-1 text-xs text-teal-800">
            {es ? 'Sector' : 'Setor'}: {sectorLabel}
          </p>
        )}

        {program && (
          <div className="mt-3">
            <p className="text-[11px] font-medium uppercase text-slate-500">
              {es ? 'Líneas de intervención AT' : 'Linhas de intervenção AT'}
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
          <div className="mt-3 rounded-lg border border-indigo-100 bg-indigo-50/60 px-3 py-2 text-xs text-indigo-950">
            <p className="font-medium">
              {es ? 'Último diagnóstico (local)' : 'Último diagnóstico (local)'} · {lastDx.overallScore}/100
            </p>
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href={diagnosisHref}
            className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
          >
            {lastDx ? (es ? 'Repetir diagnóstico' : 'Repetir diagnóstico') : es ? 'Correr diagnóstico' : 'Correr diagnóstico'}
          </Link>
        </div>
      </div>

      <NexusIncubationProcessPanel
        companyId={companyId}
        networkId={networkId}
        locale={locale}
        compact
        engagementId={engagementId}
      />
    </div>
  );
}
