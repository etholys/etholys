export const dynamic = 'force-dynamic';
export const maxDuration = 120;

import { NextResponse, NextRequest } from 'next/server';
import { llmCompleteText, publicLlmErrorMessage } from '@/lib/llm-client';
import { prisma } from '@/lib/prisma';
import { resolveOpportunityCompanyId } from '@/lib/opportunity/resolve-company';
import {
  buildFundhubProposalSystemPrompt,
  buildFundhubProposalUserPrompt,
  normalizeFundhubMode,
  type FundhubProposalContext,
} from '@/lib/agents/fundhub-proposal-prompt';

async function loadOrgProfileText(companyId: string): Promise<string> {
  const [company, profile] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      select: {
        name: true,
        shortName: true,
        description: true,
        businessActivity: true,
        incorporationCountry: true,
      },
    }),
    prisma.fundingCaptureProfile.findUnique({
      where: { companyId },
      select: { themesCsv: true, countriesCsv: true },
    }),
  ]);
  if (!company) return '';
  const lines = [
    `Nome: ${company.name}`,
    company.shortName && company.shortName !== company.name ? `Nome curto: ${company.shortName}` : '',
    company.description ? `Descrição: ${company.description}` : '',
    company.businessActivity ? `Sector: ${company.businessActivity}` : '',
    company.incorporationCountry ? `País: ${company.incorporationCountry}` : '',
    profile?.themesCsv ? `Temas: ${profile.themesCsv}` : '',
    profile?.countriesCsv ? `Países de actuação: ${profile.countriesCsv}` : '',
  ].filter(Boolean);
  return lines.join('\n');
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as FundhubProposalContext & {
      userMessage?: string;
      mode?: unknown;
      companyId?: string;
    };

    const mode = normalizeFundhubMode(body.mode);
    const userMessage =
      typeof body.userMessage === 'string' ? body.userMessage : '';

    if (mode !== 'brainstorm' && mode !== 'structure' && !userMessage.trim()) {
      return NextResponse.json({ error: 'É necessário informar a pergunta ou instrução.' }, { status: 400 });
    }

    let orgProfile = typeof body.orgProfile === 'string' ? body.orgProfile : '';
    const tenant = await resolveOpportunityCompanyId(body.companyId ?? req.nextUrl.searchParams.get('companyId'));
    if (tenant && !orgProfile.trim()) {
      orgProfile = await loadOrgProfileText(tenant.companyId);
    }

    const ctx: FundhubProposalContext = {
      fundName: body.fundName,
      fundInstitution: body.fundInstitution,
      editalLink: body.editalLink,
      editalSummary: body.editalSummary,
      documentMarkdown: body.documentMarkdown,
      proposalOutline: body.proposalOutline,
      sectionTitle: body.sectionTitle,
      sectionContent: body.sectionContent,
      orgProfile,
    };

    const defaultMessage =
      mode === 'brainstorm'
        ? 'Chuva de ideias inicial para esta proposta.'
        : mode === 'structure'
          ? 'Gera a estrutura da proposta.'
          : userMessage;

    const maxOutputTokens = mode === 'structure' ? 800 : mode === 'brainstorm' ? 2500 : 2000;
    const temperature = mode === 'structure' ? 0.15 : mode === 'brainstorm' ? 0.4 : 0.25;

    const answer = await llmCompleteText(
      buildFundhubProposalSystemPrompt(mode),
      buildFundhubProposalUserPrompt(mode, ctx, userMessage || defaultMessage),
      { maxOutputTokens, temperature },
    );

    return NextResponse.json({ answer, mode });
  } catch (error: unknown) {
    console.error('[proposals/assistant] LLM', error);
    return NextResponse.json({ error: publicLlmErrorMessage(error) }, { status: 503 });
  }
}
