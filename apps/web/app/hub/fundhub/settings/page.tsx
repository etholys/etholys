'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, BookOpen, Building2, HandCoins, Radar, ShieldCheck } from 'lucide-react';
import { useApp } from '@/app/providers';
import { ContentLibraryPanel } from '@/components/fundhub/ContentLibraryPanel';
import { EligibilityProfileForm } from '@/components/fundhub/EligibilityProfileForm';
import { SuccessFeePanel } from '@/components/fundhub/SuccessFeePanel';
import { MonitoredSourcesPanel } from '@/components/opportunity/MonitoredSourcesPanel';
import { isLikelyDbId } from '@/lib/utils';
import type { CompanyIdentityPayload } from '@/lib/fundhub/company-identity-types';

type Section = 'eligibility' | 'voice' | 'fees' | 'sources';

const SECTIONS = new Set<Section>(['eligibility', 'voice', 'fees', 'sources']);

export default function FundHubSettingsPage() {
  return (
    <Suspense fallback={null}>
      <FundHubSettingsInner />
    </Suspense>
  );
}

function FundHubSettingsInner() {
  const { locale, activeCompanyId } = useApp();
  const search = useSearchParams();
  const raw = search.get('s');
  const section: Section | null = raw && SECTIONS.has(raw as Section) ? (raw as Section) : null;
  const t = (pt: string, es: string, en: string) =>
    locale === 'pt' ? pt : locale === 'es' ? es : en;

  return (
    <div className="mx-auto max-w-3xl text-gray-100">
      <Link href="/hub/fundhub" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-100">
        <ArrowLeft className="h-4 w-4" />
        FundHub
      </Link>
      {section ? (
        <SectionView section={section} t={t} />
      ) : (
        <>
          <h1 className="mt-3 text-3xl font-bold text-white">{t('Definições', 'Ajustes', 'Settings')}</h1>
          <p className="mt-2 text-sm text-gray-400">
            {t(
              'Uma coisa de cada vez. A ficha da empresa edita-se na administração.',
              'Una cosa a la vez. La ficha de la empresa se edita en la administración.',
              'One thing at a time. The company record is edited in administration.',
            )}
          </p>
          <CompanySummary t={t} companyId={String(activeCompanyId ?? '')} />
          <ul className="mt-6 divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10">
            <IndexRow
              href="/hub/fundhub/settings?s=eligibility"
              icon={Building2}
              title={t('Elegibilidade', 'Elegibilidad', 'Eligibility')}
              hint={t(
                'Tipo, países de atuação, anos, maturidade e auditoria.',
                'Tipo, países de actuación, años, madurez y auditoría.',
                'Type, countries of operation, years, maturity and audit.',
              )}
            />
            <IndexRow
              href="/hub/fundhub/settings?s=voice"
              icon={BookOpen}
              title={t('Voz para propostas', 'Voz para propuestas', 'Proposal voice')}
              hint={t(
                'Textos reutilizáveis. A missão oficial fica na administração.',
                'Textos reutilizables. La misión oficial queda en la administración.',
                'Reusable text. The official mission stays in administration.',
              )}
            />
            <IndexRow
              href="/hub/fundhub/settings?s=fees"
              icon={HandCoins}
              title={t('Honorários', 'Honorarios', 'Fees')}
              hint={t('Success fee.', 'Success fee.', 'Success fee.')}
            />
            <IndexRow
              href="/hub/fundhub/settings?s=sources"
              icon={Radar}
              title={t('Fontes', 'Fuentes', 'Sources')}
              hint={t('Portais oficiais extra.', 'Portales oficiales extra.', 'Extra official portals.')}
            />
          </ul>
          <ul className="mt-4 divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10">
            <IndexRow
              href="/hub/fundhub/crm/aliados"
              icon={ArrowRight}
              title={t('Aliados e doadores', 'Aliados y donantes', 'Allies and donors')}
              hint={t('A rede. Não é a ficha da empresa.', 'La red. No es la ficha de la empresa.', 'The network. Not the company record.')}
            />
            <IndexRow
              href="/hub/admin?s=access"
              icon={ShieldCheck}
              title={t('Acesso ao sistema', 'Acceso al sistema', 'System access')}
              hint={t('Quem abre o FundHub.', 'Quién abre FundHub.', 'Who can open FundHub.')}
            />
            <IndexRow
              href="/hub/fundhub/discover"
              icon={Radar}
              title={t('Buscar', 'Buscar', 'Search')}
              hint={t('Critérios de busca.', 'Criterios de búsqueda.', 'Search criteria.')}
            />
          </ul>
        </>
      )}
    </div>
  );
}

function SectionView({
  section,
  t,
}: {
  section: Section;
  t: (pt: string, es: string, en: string) => string;
}) {
  const title =
    section === 'eligibility'
      ? t('Elegibilidade', 'Elegibilidad', 'Eligibility')
      : section === 'voice'
        ? t('Voz para propostas', 'Voz para propuestas', 'Proposal voice')
        : section === 'fees'
          ? t('Honorários', 'Honorarios', 'Fees')
          : t('Fontes', 'Fuentes', 'Sources');

  return (
    <div className="mt-4 space-y-4">
      <Link href="/hub/fundhub/settings" className="text-sm text-amber-300 hover:underline">
        {t('← Ajustes', '← Ajustes', '← Settings')}
      </Link>
      <h1 className="text-2xl font-bold text-white">{title}</h1>
      {section === 'eligibility' && <EligibilityProfileForm />}
      {section === 'voice' && <ContentLibraryPanel />}
      {section === 'fees' && <SuccessFeePanel />}
      {section === 'sources' && <MonitoredSourcesPanel />}
    </div>
  );
}

function IndexRow({
  href,
  icon: Icon,
  title,
  hint,
}: {
  href: string;
  icon: typeof Building2;
  title: string;
  hint: string;
}) {
  return (
    <li>
      <Link href={href} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.04]">
        <Icon className="h-4 w-4 shrink-0 text-amber-300/80" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-white">{title}</span>
          <span className="block truncate text-xs text-gray-400">{hint}</span>
        </span>
        <ArrowRight className="h-4 w-4 shrink-0 text-gray-500" />
      </Link>
    </li>
  );
}

function CompanySummary({
  t,
  companyId,
}: {
  t: (pt: string, es: string, en: string) => string;
  companyId: string;
}) {
  const [identity, setIdentity] = useState<CompanyIdentityPayload | null>(null);
  const ok = isLikelyDbId(companyId);

  useEffect(() => {
    if (!ok) return;
    let cancel = false;
    void fetch(`/api/fundhub/identity?companyId=${encodeURIComponent(companyId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancel && data) setIdentity(data as CompanyIdentityPayload);
      })
      .catch(() => {});
    return () => {
      cancel = true;
    };
  }, [companyId, ok]);

  const bits = [
    identity?.atlas.entityType,
    identity?.atlas.country,
    identity?.company.mission ? t('missão preenchida', 'misión cargada', 'mission filled') : t('missão por preencher', 'misión pendiente', 'mission missing'),
  ].filter(Boolean);

  return (
    <Link
      href="/hub/admin?s=org-profile"
      className="mt-6 flex items-center justify-between gap-3 rounded-2xl border border-white/10 px-4 py-3 hover:bg-white/[0.04]"
    >
      <span>
        <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500">
          {t('Da empresa', 'De la empresa', 'From the company')}
        </span>
        <span className="mt-1 block text-sm font-medium text-white">
          {identity?.company.name || t('Perfil da organização', 'Perfil de la organización', 'Organization profile')}
        </span>
        <span className="block text-xs text-gray-400">{bits.join(' · ') || '—'}</span>
      </span>
      <span className="shrink-0 text-xs font-medium text-amber-300">
        {t('Editar na administração', 'Editar en la administración', 'Edit in administration')}
      </span>
    </Link>
  );
}
