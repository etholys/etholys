'use client';

import { useCallback, useEffect, useState } from 'react';
import { SectionProps } from './types';
import { SiepInformesSection } from '@/components/siep/SiepInformesSection';
import ActivityReportsSection from './ActivityReportsSection';
import { useSiepT } from '@/lib/siep/use-siep-t';
import {
  INFORME_DOMAINS,
  type CustomInformeDomain,
  type InformeDomain,
} from '@/lib/siep/informe-domains';
import { FileStack, Plus } from 'lucide-react';

export function ReportsSection({ project, onRefresh }: SectionProps) {
  const st = useSiepT();
  const [activeDomain, setActiveDomain] = useState<InformeDomain>('narrative');
  const [customDomains, setCustomDomains] = useState<CustomInformeDomain[]>([]);
  const [addingType, setAddingType] = useState(false);

  const loadCustomDomains = useCallback(() => {
    fetch(`/api/siep/informes/domains?projectId=${project.id}`)
      .then((r) => r.json())
      .then((d) => setCustomDomains(d.domains ?? []))
      .catch(() => setCustomDomains([]));
  }, [project.id]);

  useEffect(() => {
    loadCustomDomains();
  }, [loadCustomDomains]);

  const activeBuiltIn = INFORME_DOMAINS.find((d) => d.id === activeDomain);
  const activeCustom = customDomains.find((d) => d.id === activeDomain);
  const activeIntro = activeBuiltIn
    ? st(activeBuiltIn.introKey)
    : activeCustom?.intro || st('siep.informe.domain.customIntro');

  const handleAddType = async () => {
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

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-indigo-50/80 to-white">
          <h2 className="text-base font-semibold text-gray-900">{st('siep.informe.section.title')}</h2>
          <p className="text-xs text-gray-500 mt-1 max-w-2xl">{st('siep.informe.section.intro')}</p>
        </div>

        <div className="flex border-b border-gray-200 overflow-x-auto bg-slate-50/50 items-stretch">
          {INFORME_DOMAINS.map(({ id, labelKey, icon: Icon }) => (
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
          {customDomains.map(({ id, label }) => (
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
        </div>

        <div className="p-5">
          <p className="text-xs text-gray-500 mb-4 max-w-2xl">{activeIntro}</p>

          {activeDomain === 'field' ? (
            <div className="space-y-8">
              <SiepInformesSection projectId={project.id} companyId={project.companyId} domain="field" />
              <div className="border-t border-gray-100 pt-6">
                <ActivityReportsSection project={project} onRefresh={onRefresh} tr={st} />
              </div>
            </div>
          ) : (
            <SiepInformesSection projectId={project.id} companyId={project.companyId} domain={activeDomain} />
          )}
        </div>
      </div>
    </div>
  );
}

export default ReportsSection;
