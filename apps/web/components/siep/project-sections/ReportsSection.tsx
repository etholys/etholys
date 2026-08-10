'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { SectionProps } from './types';
import { SiepInformesSection } from '@/components/siep/SiepInformesSection';
import ActivityReportsSection from './ActivityReportsSection';
import { useSiepT } from '@/lib/siep/use-siep-t';
import {
  INFORME_DOMAINS,
  type CustomInformeDomain,
  type InformeDomain,
} from '@/lib/siep/informe-domains';
import {
  canViewAnyDonorInforme,
  canViewInformeDomain,
} from '@/lib/siep/permissions-shared';
import { FileStack, Plus } from 'lucide-react';

export function ReportsSection({ project, onRefresh }: SectionProps) {
  const st = useSiepT();
  const permList: string[] = Array.isArray(project?.siepPermissions?.permissions)
    ? project.siepPermissions.permissions
    : [];
  const permSet = useMemo(() => new Set(permList), [permList]);
  // Staff sem override explícito: ver tudo (compat)
  const isGuest = project?.accessMode === 'project_guest';
  const openAll = !isGuest && permList.length === 0;

  const canViewDomain = useCallback(
    (domain: InformeDomain | string) =>
      openAll || canViewInformeDomain(permSet, domain),
    [openAll, permSet],
  );

  const canSeeActivityReports =
    openAll ||
    permSet.has('siep.activities.report') ||
    permSet.has('siep.activities.view_all_reports') ||
    permSet.has('siep.activities.approve_reports');

  const canSeeDonorInformes = openAll || canViewAnyDonorInforme(permSet);
  const canEditReports = openAll || permSet.has('siep.reports.edit');

  const visibleBuiltIn = INFORME_DOMAINS.filter((d) => canViewDomain(d.id));

  const [customDomains, setCustomDomains] = useState<CustomInformeDomain[]>([]);
  const [addingType, setAddingType] = useState(false);

  const visibleCustom = customDomains.filter((d) => canViewDomain(d.id));

  const firstDomain: InformeDomain | 'activity' | null = visibleBuiltIn[0]?.id
    ?? visibleCustom[0]?.id
    ?? (canSeeActivityReports ? 'activity' : null);

  const [activeDomain, setActiveDomain] = useState<InformeDomain | 'activity'>(
    firstDomain === 'activity' ? 'activity' : firstDomain || 'narrative',
  );

  useEffect(() => {
    if (activeDomain === 'activity') {
      if (!canSeeActivityReports && firstDomain && firstDomain !== 'activity') {
        setActiveDomain(firstDomain);
      }
      return;
    }
    if (!canViewDomain(activeDomain) && firstDomain) {
      setActiveDomain(firstDomain === 'activity' ? 'activity' : firstDomain);
    }
  }, [activeDomain, canSeeActivityReports, canViewDomain, firstDomain]);

  const loadCustomDomains = useCallback(() => {
    if (!canSeeDonorInformes) {
      setCustomDomains([]);
      return;
    }
    fetch(`/api/siep/informes/domains?projectId=${project.id}`)
      .then((r) => r.json())
      .then((d) => setCustomDomains(d.domains ?? []))
      .catch(() => setCustomDomains([]));
  }, [project.id, canSeeDonorInformes]);

  useEffect(() => {
    loadCustomDomains();
  }, [loadCustomDomains]);

  const activeBuiltIn = INFORME_DOMAINS.find((d) => d.id === activeDomain);
  const activeCustom = customDomains.find((d) => d.id === activeDomain);
  const activeIntro =
    activeDomain === 'activity'
      ? st('siep.perm.act.reportDesc')
      : activeBuiltIn
        ? st(activeBuiltIn.introKey)
        : activeCustom?.intro || st('siep.informe.domain.customIntro');

  const handleAddType = async () => {
    if (!canEditReports) return;
    const label = window.prompt(st('siep.informe.domain.customPrompt'));
    if (!label?.trim()) return;

    setAddingType(true);
    try {
      const res = await fetch('/api/siep/informes/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, label: label.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      const created = data.domain as CustomInformeDomain;
      setCustomDomains((prev) => [...prev, created]);
      setActiveDomain(created.id);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : st('siep.informe.domain.customError');
      window.alert(msg);
    } finally {
      setAddingType(false);
    }
  };

  if (!canSeeDonorInformes && !canSeeActivityReports) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">
        Sin permiso para ver informes o reportes de avance.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-indigo-50/80 to-white">
          <h2 className="text-base font-semibold text-gray-900">{st('siep.informe.section.title')}</h2>
          <p className="text-xs text-gray-500 mt-1 max-w-2xl">{st('siep.informe.section.intro')}</p>
        </div>

        <div className="flex border-b border-gray-200 overflow-x-auto bg-slate-50/50 items-stretch">
          {visibleBuiltIn.map(({ id, labelKey, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveDomain(id)}
              className={`flex-shrink-0 px-4 py-3 text-sm font-medium transition whitespace-nowrap border-b-2 ${
                activeDomain === id
                  ? 'text-indigo-700 border-indigo-600 bg-white'
                  : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-white/60'
              }`}
            >
              <Icon className="w-4 h-4 inline mr-1.5 -mt-0.5" />
              {st(labelKey)}
            </button>
          ))}
          {visibleCustom.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveDomain(id)}
              className={`flex-shrink-0 px-4 py-3 text-sm font-medium transition whitespace-nowrap border-b-2 ${
                activeDomain === id
                  ? 'text-indigo-700 border-indigo-600 bg-white'
                  : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-white/60'
              }`}
            >
              <FileStack className="w-4 h-4 inline mr-1.5 -mt-0.5" />
              {label}
            </button>
          ))}
          {canSeeActivityReports && (
            <button
              type="button"
              onClick={() => setActiveDomain('activity')}
              className={`flex-shrink-0 px-4 py-3 text-sm font-medium transition whitespace-nowrap border-b-2 ${
                activeDomain === 'activity'
                  ? 'text-indigo-700 border-indigo-600 bg-white'
                  : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-white/60'
              }`}
            >
              {st('siep.informe.tab.field')}
            </button>
          )}
          {canEditReports && canSeeDonorInformes && (
            <button
              type="button"
              onClick={handleAddType}
              disabled={addingType}
              className="flex-shrink-0 px-3 py-3 text-sm font-medium text-indigo-600 hover:text-indigo-800 hover:bg-white/60 border-b-2 border-transparent disabled:opacity-50"
              title={st('siep.informe.domain.addType')}
            >
              <Plus className="w-4 h-4 inline mr-1 -mt-0.5" />
              {st('siep.informe.domain.addType')}
            </button>
          )}
        </div>

        <div className="p-5">
          <p className="text-xs text-gray-500 mb-4 max-w-2xl">{activeIntro}</p>

          {activeDomain === 'activity' ? (
            <ActivityReportsSection project={project} onRefresh={onRefresh} tr={st} />
          ) : activeDomain === 'field' && canViewDomain('field') ? (
            <div className="space-y-8">
              <SiepInformesSection projectId={project.id} companyId={project.companyId} domain="field" />
              {canSeeActivityReports && (
                <div className="border-t border-gray-100 pt-6">
                  <ActivityReportsSection project={project} onRefresh={onRefresh} tr={st} />
                </div>
              )}
            </div>
          ) : (
            <SiepInformesSection
              projectId={project.id}
              companyId={project.companyId}
              domain={activeDomain as InformeDomain}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default ReportsSection;
