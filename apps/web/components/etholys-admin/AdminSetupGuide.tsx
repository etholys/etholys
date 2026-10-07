'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  Check,
  CreditCard,
  Users,
  ArrowRight,
} from 'lucide-react';
import { useApp } from '@/app/providers';
import { isLikelyDbId } from '@/lib/utils';

export type AdminSetupStepId = 'organization' | 'team' | 'systems' | 'billing';

type StepStatus = {
  organization: boolean;
  team: boolean;
  systems: boolean;
  billing: boolean;
};

type Props = {
  companyId: string | null;
  onGoToStep?: (step: AdminSetupStepId) => void;
};

export function AdminSetupGuide({ companyId, onGoToStep }: Props) {
  const { locale } = useApp();
  const t = (pt: string, es: string, en: string) =>
    locale === 'pt' ? pt : locale === 'es' ? es : en;

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StepStatus>({
    organization: false,
    team: false,
    systems: false,
    billing: false,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const companiesRes = await fetch('/api/companies', { cache: 'no-store' });
        const companiesData = (await companiesRes.json().catch(() => ({}))) as {
          companies?: Array<{ id: string; _count?: { companyUsers?: number } }>;
        };
        const companies = Array.isArray(companiesData.companies) ? companiesData.companies : [];
        const hasOrg = companies.length > 0;
        const memberCount = companies.reduce(
          (n, c) => n + (c._count?.companyUsers ?? 0),
          0,
        );

        let hasInvite = false;
        let hasGrants = false;
        let hasBilling = false;

        const cid = companyId && isLikelyDbId(companyId) ? companyId : companies[0]?.id;

        if (hasOrg) {
          const invRes = await fetch('/api/invitations', { cache: 'no-store' });
          const invData = (await invRes.json().catch(() => ({}))) as {
            invitations?: Array<{ status?: string }>;
          };
          const invitations = Array.isArray(invData.invitations) ? invData.invitations : [];
          hasInvite =
            invitations.some((i) => i.status === 'pending' || i.status === 'accepted') ||
            memberCount > 1;

          if (cid) {
            const [accessRes, billRes] = await Promise.all([
              fetch(`/api/workspace/access?companyId=${encodeURIComponent(cid)}`, {
                cache: 'no-store',
              }),
              fetch(`/api/billing/subscription?companyId=${encodeURIComponent(cid)}`, {
                cache: 'no-store',
              }),
            ]);
            const access = (await accessRes.json().catch(() => ({}))) as {
              grants?: unknown[];
              me?: { systems?: string[] } | null;
            };
            const bill = (await billRes.json().catch(() => ({}))) as {
              billingEnforced?: boolean;
              planCode?: string | null;
              stripeConnected?: boolean;
              subscriptionStatus?: string | null;
            };
            hasGrants =
              (Array.isArray(access.grants) && access.grants.length > 0) ||
              (Array.isArray(access.me?.systems) && (access.me?.systems?.length ?? 0) > 0) ||
              memberCount > 1;
            hasBilling =
              bill.billingEnforced === false ||
              Boolean(bill.planCode) ||
              Boolean(bill.stripeConnected) ||
              Boolean(bill.subscriptionStatus);
          }
        }

        if (!cancelled) {
          setStatus({
            organization: hasOrg,
            team: hasInvite,
            systems: hasGrants,
            billing: hasBilling,
          });
        }
      } catch {
        if (!cancelled) {
          setStatus({
            organization: false,
            team: false,
            systems: false,
            billing: false,
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const steps: Array<{
    id: AdminSetupStepId;
    n: number;
    title: string;
    hint: string;
    done: boolean;
    href?: string;
  }> = [
    {
      id: 'organization',
      n: 1,
      title: t('Organização', 'Organización', 'Organization'),
      hint: t(
        'Crie ou edite a empresa activa.',
        'Cree o edite la empresa activa.',
        'Create or edit the active company.',
      ),
      done: status.organization,
      href: '/hub/admin?s=companies',
    },
    {
      id: 'team',
      n: 2,
      title: t('Utilizadores e permissões', 'Usuarios y permisos', 'Users & permissions'),
      hint: t(
        'Convide a equipa e defina sistemas e Tools de cada pessoa.',
        'Invite al equipo y defina sistemas y Tools de cada persona.',
        'Invite the team and set systems and Tools for each person.',
      ),
      done: status.team && status.systems,
      href: '/hub/admin?s=users',
    },
    {
      id: 'billing',
      n: 3,
      title: t('Licenças e pagamentos', 'Licencias y pagos', 'Licenses & billing'),
      hint: t(
        'Contrate produtos e veja o plano da empresa.',
        'Contrate productos y vea el plan de la empresa.',
        'Subscribe to products and review the company plan.',
      ),
      done: status.billing,
      href: '/hub/admin?s=billing',
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done) ?? null;
  const allDone = doneCount === steps.length;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-sm backdrop-blur-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">
            {t('Configuração guiada', 'Configuración guiada', 'Guided setup')}
          </h2>
          <p className="mt-1 text-sm text-white/55">
            {allDone
              ? t(
                  'Organização pronta. Pode voltar aqui quando precisar.',
                  'Organización lista. Puede volver aquí cuando lo necesite.',
                  'Organization ready. Come back here whenever you need.',
                )
              : t(
                  'Siga estes passos na ordem — comece pela empresa, depois a equipa.',
                  'Siga estos pasos en orden — empiece por la empresa, luego el equipo.',
                  'Follow these steps in order — start with the company, then the team.',
                )}
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70">
          {loading
            ? t('A verificar…', 'Comprobando…', 'Checking…')
            : t(
                `${doneCount} de ${steps.length} concluídos`,
                `${doneCount} de ${steps.length} completados`,
                `${doneCount} of ${steps.length} done`,
              )}
        </div>
      </div>

      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-teal-400/80 transition-all duration-500"
          style={{ width: `${loading ? 8 : (doneCount / steps.length) * 100}%` }}
        />
      </div>

      <ol className="space-y-2">
        {steps.map((step) => {
          const Icon =
            step.id === 'organization' ? Building2 : step.id === 'team' ? Users : CreditCard;
          const isNext = next?.id === step.id;
          return (
            <li
              key={step.id}
              className={`flex items-start gap-3 rounded-xl border px-3 py-3 transition ${
                isNext
                  ? 'border-teal-400/35 bg-teal-500/10'
                  : step.done
                    ? 'border-white/5 bg-white/[0.02]'
                    : 'border-white/10 bg-transparent'
              }`}
            >
              <span
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  step.done
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : isNext
                      ? 'bg-teal-500/25 text-teal-200'
                      : 'bg-white/10 text-white/50'
                }`}
              >
                {step.done ? <Check className="h-3.5 w-3.5" /> : step.n}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Icon className="h-3.5 w-3.5 text-white/45" />
                  <p className="text-sm font-medium text-white">{step.title}</p>
                  {isNext && (
                    <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-200/90">
                      {t('Seguinte', 'Siguiente', 'Next')}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-white/50">{step.hint}</p>
              </div>
              {isNext && (
                step.href ? (
                  <Link
                    href={step.href}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-teal-500/90 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-teal-400"
                  >
                    {t('Abrir', 'Abrir', 'Open')}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => onGoToStep?.(step.id)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-teal-500/90 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-teal-400"
                  >
                    {t('Ir', 'Ir', 'Go')}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
