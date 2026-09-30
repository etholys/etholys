export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildExecutionPassport } from '@/lib/fundhub/build-execution-passport';
import { resolveOpportunityCompanyId } from '@/lib/opportunity/resolve-company';
import { readOpportunityBriefing } from '@/lib/opportunity/briefing';

/**
 * GET /api/fundhub/network-snapshot?companyId=
 * Contagens e ligações Perfil ↔ Aliados ↔ Donantes (dashboard Rede).
 */
export async function GET(req: NextRequest) {
  const ctx = await resolveOpportunityCompanyId(req.nextUrl.searchParams.get('companyId'));
  if (!ctx) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const [passport, partners, catalogTotal, pipelineOpen, briefing] = await Promise.all([
    buildExecutionPassport(ctx.companyId),
    prisma.fundhubPartner.count({ where: { companyId: ctx.companyId } }),
    prisma.fund.count({ where: { companyId: ctx.companyId, isActive: true } }),
    prisma.fund.count({
      where: {
        companyId: ctx.companyId,
        isActive: true,
        pipelineStatus: { in: ['decide', 'prepare', 'submitted'] },
      },
    }),
    readOpportunityBriefing(ctx.companyId),
  ]);

  const themes = briefing?.themes?.length ?? 0;
  const countries = briefing?.countries?.length ?? 0;
  const orgKind = Boolean(briefing?.orgKind);
  const profileReady = orgKind && (themes > 0 || countries > 0);

  const links: Array<{ from: string; to: string; pt: string; es: string; en: string; active: boolean }> = [
    {
      from: 'perfil',
      to: 'donantes',
      pt: 'Temas e países do perfil filtram e priorizam financiadores conhecidos e a busca.',
      es: 'Temas y países del perfil filtran y priorizan financiadores conocidos y la búsqueda.',
      en: 'Profile themes and countries filter and prioritize known funders and search.',
      active: profileReady && catalogTotal > 0,
    },
    {
      from: 'perfil',
      to: 'aliados',
      pt: 'Se falta registo no país ou tipo de org, os aliados cobrem a elegibilidade em co-postulação.',
      es: 'Si falta registro en el país o tipo de org, los aliados cubren elegibilidad en co-postulación.',
      en: 'If country registration or org type is missing, allies cover eligibility via co-application.',
      active: !profileReady || partners > 0,
    },
    {
      from: 'aliados',
      to: 'donantes',
      pt: 'Aliados locais entram em propostas com financiadores que exigem partner in-country.',
      es: 'Aliados locales entran en propuestas con financiadores que exigen partner in-country.',
      en: 'Local allies join proposals when funders require an in-country partner.',
      active: partners > 0 && catalogTotal > 0,
    },
    {
      from: 'donantes',
      to: 'pipeline',
      pt: 'Financiadores importados alimentam Em curso e propostas.',
      es: 'Financiadores importados alimentan En curso y propuestas.',
      en: 'Imported funders feed In progress and proposals.',
      active: catalogTotal > 0 && pipelineOpen > 0,
    },
  ];

  return NextResponse.json({
    companyId: ctx.companyId,
    readinessPct: passport?.stats?.readinessScore ?? 0,
    profile: {
      ready: profileReady,
      orgKind: orgKind ? briefing?.orgKind ?? null : null,
      themes,
      countries,
    },
    partners,
    funders: catalogTotal,
    pipelineOpen,
    links,
  });
}
