'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/app/providers';
import { isLikelyDbId } from '@/lib/utils';
import { StateEmpty, StateError, StateLoading } from '@/components/ui/StateBlocks';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Circle,
  FileText,
  Globe,
  HandCoins,
  MapPin,
  Printer,
  Sprout,
  Users,
} from 'lucide-react';
import { PassportSharePanel } from '@/components/fundhub/PassportSharePanel';

type PassportPayload = {
  company: {
    name: string;
    shortName?: string | null;
    description?: string | null;
    country?: string | null;
    currency?: string | null;
    sector?: string | null;
    website?: string | null;
  };
  captureProfile: {
    subscriptionTier: string;
    themes: string[];
    countries: string[];
    crossEtholysOptIn: boolean;
  } | null;
  stats: {
    readinessScore: number;
    signals: Record<string, boolean>;
    activeProjects: number;
    savedFunds: number;
    partners: number;
    complianceChecklists: number;
    proposals: Record<string, number>;
  };
  recentProposals: Array<{
    id?: string;
    title: string;
    status: string;
    updatedAt?: string;
    fund: { name: string; institution: string; deadline: string | null };
  }>;
  coalition?: Array<{ orgName: string; country?: string; role: string; contactEmail?: string }>;
  generatedAt?: string;
};

type ProfileItem = {
  key: string;
  pt: string;
  es: string;
  en: string;
  href: string;
  actionPt: string;
  actionEs: string;
  actionEn: string;
};

const PROFILE_ITEMS: ProfileItem[] = [
  {
    key: 'orgProfile',
    pt: 'Descrição, sector e país da organização',
    es: 'Descripción, sector y país de la organización',
    en: 'Organization description, sector, and country',
    href: '/hub/fundhub/settings',
    actionPt: 'Completar perfil',
    actionEs: 'Completar perfil',
    actionEn: 'Complete profile',
  },
  {
    key: 'captureProfile',
    pt: 'Preferências de captação (temas e países)',
    es: 'Preferencias de captación (temas y países)',
    en: 'Funding preferences (themes and countries)',
    href: '/hub/fundhub/settings',
    actionPt: 'Definir preferências',
    actionEs: 'Definir preferencias',
    actionEn: 'Set preferences',
  },
  {
    key: 'activeProjects',
    pt: 'Pelo menos um projeto SIEP activo',
    es: 'Al menos un proyecto SIEP activo',
    en: 'At least one active SIEP project',
    href: '/siep/projects',
    actionPt: 'Ver projetos',
    actionEs: 'Ver proyectos',
    actionEn: 'View projects',
  },
  {
    key: 'savedFunds',
    pt: 'Fundos de interesse guardados',
    es: 'Fondos de interés guardados',
    en: 'Saved funds of interest',
    href: '/hub/fundhub/discover',
    actionPt: 'Explorar fundos',
    actionEs: 'Explorar fondos',
    actionEn: 'Explore funds',
  },
  {
    key: 'proposals',
    pt: 'Proposta em rascunho ou submetida',
    es: 'Propuesta en borrador o enviada',
    en: 'Draft or submitted proposal',
    href: '/hub/fundhub/proposals',
    actionPt: 'Criar proposta',
    actionEs: 'Crear propuesta',
    actionEn: 'Create proposal',
  },
  {
    key: 'partners',
    pt: 'Parceiros locais registados',
    es: 'Socios locales registrados',
    en: 'Registered local partners',
    href: '/hub/fundhub/partners',
    actionPt: 'Adicionar parceiros',
    actionEs: 'Añadir socios',
    actionEn: 'Add partners',
  },
  {
    key: 'compliance',
    pt: 'Checklist de compliance',
    es: 'Checklist de compliance',
    en: 'Compliance checklist',
    href: '/hub/fundhub/compliance',
    actionPt: 'Abrir compliance',
    actionEs: 'Abrir compliance',
    actionEn: 'Open compliance',
  },
];

export default function InstitutionalProfilePage() {
  const { locale, activeCompanyId } = useApp();
  const companyId = useMemo(() => {
    const s = String(activeCompanyId ?? '').trim();
    return isLikelyDbId(s) ? s : '';
  }, [activeCompanyId]);

  const t = (pt: string, es: string, en: string) =>
    locale === 'pt' ? pt : locale === 'es' ? es : en;

  const [data, setData] = useState<PassportPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch(
        `/api/fundhub/execution-passport?companyId=${encodeURIComponent(companyId)}`,
        { cache: 'no-store' },
      );
      const d = (await r.json()) as PassportPayload & { error?: string };
      if (!r.ok) throw new Error(d.error || 'Erro');
      setData(d);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!companyId) {
    return (
      <StateEmpty
        title={t('Empresa não seleccionada', 'Empresa no seleccionada', 'No company selected')}
        description={t(
          'Escolha a empresa activa na barra lateral do FundHub.',
          'Elija la empresa activa en la barra lateral de FundHub.',
          'Pick the active company in the FundHub sidebar.',
        )}
      />
    );
  }

  if (loading) return <StateLoading className="min-h-[40vh]" />;
  if (err || !data) return <StateError message={err || 'Erro'} onRetry={() => void load()} />;

  const score = data.stats.readinessScore;
  const proposalCount =
    Object.values(data.stats.proposals).reduce((sum, n) => sum + n, 0);
  const completedCount = PROFILE_ITEMS.filter((item) => data.stats.signals[item.key]).length;
  const missingItems = PROFILE_ITEMS.filter((item) => !data.stats.signals[item.key]);

  return (
    <div className="profile-export-root space-y-6">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .profile-export-root, .profile-export-root * { visibility: visible; }
          .profile-export-root { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/hub/fundhub"
            className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('Voltar ao FundHub', 'Volver a FundHub', 'Back to FundHub')}
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900 md:text-3xl">
            {t('Perfil institucional', 'Perfil institucional', 'Institutional profile')}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            {t(
              'Resumo da sua organização para financiadores — quem somos, o que já entregamos e em que estamos a candidatar.',
              'Resumen de su organización para financiadores — quiénes somos, qué ya entregamos y a qué nos estamos postulando.',
              'Your organization at a glance for funders — who you are, what you deliver, and what you are applying for.',
            )}
          </p>
        </div>
        <div className="no-print flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            <Printer className="h-3.5 w-3.5" />
            {t('Imprimir / PDF', 'Imprimir / PDF', 'Print / PDF')}
          </button>
          <PassportSharePanel />
        </div>
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-amber-100">
            <Building2 className="h-7 w-7 text-amber-700" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold text-gray-900">{data.company.name}</h2>
            {data.company.shortName && (
              <p className="text-sm text-gray-500">{data.company.shortName}</p>
            )}
            <div className="mt-2 flex flex-wrap gap-3 text-sm text-gray-600">
              {data.company.sector && (
                <span className="inline-flex items-center gap-1">
                  <Building2 className="h-4 w-4" />
                  {data.company.sector}
                </span>
              )}
              {data.company.country && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {data.company.country}
                </span>
              )}
              {data.company.currency && <span>{data.company.currency}</span>}
            </div>
            {data.company.description ? (
              <p className="mt-3 text-sm leading-relaxed text-gray-700">{data.company.description}</p>
            ) : (
              <p className="mt-3 text-sm text-gray-500">
                {t(
                  'Sem descrição — adicione uma em Configurações para financiadores entenderem a missão da organização.',
                  'Sin descripción — añádala en Configuración para que los financiadores entiendan la misión.',
                  'No description yet — add one in Settings so funders understand your mission.',
                )}
              </p>
            )}
          </div>
        </div>

        {data.captureProfile && (data.captureProfile.themes.length > 0 || data.captureProfile.countries.length > 0) && (
          <div className="mt-5 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
            <span className="w-full text-xs font-medium uppercase tracking-wide text-gray-500">
              {t('Interesses de captação', 'Intereses de captación', 'Funding interests')}
            </span>
            {data.captureProfile.themes.map((theme) => (
              <span key={theme} className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900">
                {theme}
              </span>
            ))}
            {data.captureProfile.countries.map((c) => (
              <span key={c} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                {c}
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {t('Completude do perfil', 'Completitud del perfil', 'Profile completeness')}
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              {t(
                `${completedCount} de ${PROFILE_ITEMS.length} áreas preenchidas — quanto mais completo, mais credível perante um financiador.`,
                `${completedCount} de ${PROFILE_ITEMS.length} áreas completadas — cuanto más completo, más creíble ante un financiador.`,
                `${completedCount} of ${PROFILE_ITEMS.length} areas filled — a fuller profile builds funder trust.`,
              )}
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-amber-700">{score}%</p>
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-amber-500 transition-all"
            style={{ width: `${score}%` }}
          />
        </div>

        {missingItems.length > 0 && (
          <ul className="no-print mt-5 divide-y divide-gray-100 rounded-xl border border-gray-100">
            {missingItems.map((item) => (
              <li key={item.key} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <Circle className="mt-0.5 h-4 w-4 shrink-0 text-gray-300" />
                  <span className="text-sm text-gray-700">{t(item.pt, item.es, item.en)}</span>
                </div>
                <Link
                  href={item.href}
                  className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-amber-700 hover:text-amber-900"
                >
                  {t(item.actionPt, item.actionEs, item.actionEn)}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </li>
            ))}
          </ul>
        )}

        {missingItems.length === 0 && (
          <p className="mt-4 flex items-center gap-2 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            {t('Perfil completo — pronto para partilhar.', 'Perfil completo — listo para compartir.', 'Profile complete — ready to share.')}
          </p>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: t('Projetos activos', 'Proyectos activos', 'Active projects'),
            value: data.stats.activeProjects,
            icon: Sprout,
            href: '/siep/projects',
          },
          {
            label: t('Parceiros', 'Socios', 'Partners'),
            value: data.stats.partners,
            icon: Users,
            href: '/hub/fundhub/partners',
          },
          {
            label: t('Fundos guardados', 'Fondos guardados', 'Saved funds'),
            value: data.stats.savedFunds,
            icon: Globe,
            href: '/hub/fundhub/my-funds',
          },
          {
            label: t('Propostas', 'Propuestas', 'Proposals'),
            value: proposalCount,
            icon: FileText,
            href: '/hub/fundhub/proposals',
          },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <Link
              key={stat.label}
              href={stat.href}
              className="no-print rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-amber-200 hover:bg-amber-50/30"
            >
              <div className="flex items-center gap-2 text-gray-500">
                <Icon className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">{stat.label}</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-gray-900">{stat.value}</p>
            </Link>
          );
        })}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="flex items-center gap-2 font-semibold text-gray-900">
            <HandCoins className="h-5 w-5 text-amber-600" />
            {t('Candidaturas em curso', 'Candidaturas en curso', 'Applications in progress')}
          </h3>
          {data.recentProposals.length === 0 ? (
            <p className="mt-3 text-sm text-gray-600">
              {t(
                'Ainda não há propostas — quando começar a candidatar, aparecem aqui.',
                'Aún no hay propuestas — cuando empiece a postular, aparecerán aquí.',
                'No proposals yet — they will show here once you start applying.',
              )}
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {data.recentProposals.map((p, i) => (
                <li key={p.id ?? `${p.title}-${i}`} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                  <p className="text-sm font-medium text-gray-900">{p.title}</p>
                  <p className="text-xs text-gray-600">
                    {p.fund.institution} · {p.status}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/hub/fundhub/proposals"
            className="no-print mt-4 inline-flex items-center gap-1 text-sm font-medium text-amber-700 hover:underline"
          >
            {t('Ir para propostas', 'Ir a propuestas', 'Go to proposals')}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="flex items-center gap-2 font-semibold text-gray-900">
            <Users className="h-5 w-5 text-emerald-600" />
            {t('Rede e compliance', 'Red y compliance', 'Network & compliance')}
          </h3>
          <ul className="mt-3 space-y-2 text-sm text-gray-700">
            <li className="flex items-center justify-between">
              <span>{t('Parceiros locais', 'Socios locales', 'Local partners')}</span>
              <strong>{data.stats.partners}</strong>
            </li>
            <li className="flex items-center justify-between">
              <span>{t('Checklists compliance', 'Checklists compliance', 'Compliance checklists')}</span>
              <strong>{data.stats.complianceChecklists}</strong>
            </li>
            {data.coalition && data.coalition.length > 0 && (
              <li className="flex items-center justify-between">
                <span>{t('Membros da coalizão', 'Miembros de coalición', 'Coalition members')}</span>
                <strong>{data.coalition.length}</strong>
              </li>
            )}
          </ul>

          {data.coalition && data.coalition.length > 0 ? (
            <ul className="mt-4 space-y-1 border-t border-gray-100 pt-3">
              {data.coalition.map((m) => (
                <li key={`${m.orgName}-${m.role}`} className="text-xs text-gray-600">
                  <strong className="text-gray-800">{m.orgName}</strong>
                  {m.country ? ` (${m.country})` : ''} — {m.role}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-gray-500">
              {t(
                'Sem coalizão registada — útil para editais que exigem consórcio.',
                'Sin coalición registrada — útil para convocatorias que exigen consorcio.',
                'No coalition yet — useful for calls that require a consortium.',
              )}
            </p>
          )}

          <div className="no-print mt-4 flex flex-wrap gap-3">
            <Link href="/hub/fundhub/partners" className="text-sm font-medium text-amber-700 hover:underline">
              {t('Parceiros', 'Socios', 'Partners')}
            </Link>
            <Link href="/hub/fundhub/compliance" className="text-sm font-medium text-amber-700 hover:underline">
              Compliance
            </Link>
            <Link href="/hub/fundhub/coalition" className="text-sm font-medium text-amber-700 hover:underline">
              {t('Coalizão', 'Coalición', 'Coalition')}
            </Link>
          </div>

          {data.captureProfile?.crossEtholysOptIn && (
            <p className="mt-3 rounded-lg bg-violet-50 px-3 py-2 text-xs text-violet-900">
              {t(
                'Opt-in Etholys activo — pode incluir evidência ATLAS/SIEP quando o financiador pedir.',
                'Opt-in Etholys activo — puede incluir evidencia ATLAS/SIEP cuando el financiador lo pida.',
                'Etholys opt-in active — can include ATLAS/SIEP evidence when the funder requests it.',
              )}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
