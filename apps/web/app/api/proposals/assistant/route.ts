export const dynamic = 'force-dynamic';
export const maxDuration = 120;

import { NextResponse, NextRequest } from 'next/server';
import { llmGenerateContent, publicLlmErrorMessage } from '@/lib/llm-client';
import { prisma } from '@/lib/prisma';
import { resolveOpportunityCompanyId } from '@/lib/opportunity/resolve-company';
import { FUNDHUB_DISCOVERY_MODEL } from '@/lib/opportunity/fundhub-llm';
import {
  buildFundhubProposalSystemPrompt,
  buildFundhubProposalUserPrompt,
  fundhubLanguageName,
  normalizeFundhubLocale,
  normalizeFundhubMode,
  type FundhubProposalContext,
} from '@/lib/agents/fundhub-proposal-prompt';
import {
  emptyContentLibrary,
  parseContentLibrary,
} from '@/lib/opportunity/content-library';
import { checklistFromCandidateFields } from '@/lib/opportunity/rfp-checklist';

function formatContentLibraryBlock(raw: unknown): string {
  const lib = parseContentLibrary(raw) ?? emptyContentLibrary();
  const parts: string[] = [];
  if (lib.voiceNotes?.trim()) parts.push(`Tom / voz: ${lib.voiceNotes.trim()}`);
  for (const s of lib.snippets.slice(0, 12)) {
    parts.push(`[${s.kind}] ${s.title}\n${s.body}`);
  }
  return parts.join('\n\n');
}

async function loadOrgProfileText(companyId: string): Promise<{
  orgProfile: string;
  contentLibraryBlock: string;
}> {
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
      select: { themesCsv: true, countriesCsv: true, preferencesJson: true },
    }),
  ]);
  if (!company) return { orgProfile: '', contentLibraryBlock: '' };
  const lines = [
    `Nome: ${company.name}`,
    company.shortName && company.shortName !== company.name ? `Nome curto: ${company.shortName}` : '',
    company.description ? `Descrição: ${company.description}` : '',
    company.businessActivity ? `Sector: ${company.businessActivity}` : '',
    company.incorporationCountry ? `País: ${company.incorporationCountry}` : '',
    profile?.themesCsv ? `Temas: ${profile.themesCsv}` : '',
    profile?.countriesCsv ? `Países de actuação: ${profile.countriesCsv}` : '',
  ].filter(Boolean);

  let contentLibraryBlock = '';
  if (profile?.preferencesJson) {
    try {
      const prefs = JSON.parse(profile.preferencesJson) as Record<string, unknown>;
      contentLibraryBlock = formatContentLibraryBlock(prefs.contentLibrary);
    } catch {
      contentLibraryBlock = '';
    }
  }

  return { orgProfile: lines.join('\n'), contentLibraryBlock };
}

function contextChars(ctx: FundhubProposalContext): number {
  return (ctx.sourceExcerpt?.trim().length ?? 0) + (ctx.basesText?.trim().length ?? 0);
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as FundhubProposalContext & {
      userMessage?: string;
      mode?: unknown;
      companyId?: string;
    };

    const mode = normalizeFundhubMode(body.mode);
    const locale = normalizeFundhubLocale(body.locale);
    const userMessage = typeof body.userMessage === 'string' ? body.userMessage : '';

    if (mode !== 'brainstorm' && mode !== 'structure' && mode !== 'understand' && !userMessage.trim()) {
      return NextResponse.json({ error: 'É necessário informar a pergunta ou instrução.' }, { status: 400 });
    }

    let orgProfile = typeof body.orgProfile === 'string' ? body.orgProfile : '';
    let contentLibraryBlock =
      typeof body.contentLibraryBlock === 'string' ? body.contentLibraryBlock : '';
    const tenant = await resolveOpportunityCompanyId(body.companyId ?? req.nextUrl.searchParams.get('companyId'));
    if (tenant) {
      const loaded = await loadOrgProfileText(tenant.companyId);
      if (!orgProfile.trim()) orgProfile = loaded.orgProfile;
      if (!contentLibraryBlock.trim()) contentLibraryBlock = loaded.contentLibraryBlock;
    }

    const documents = Array.isArray(body.documents)
      ? body.documents.filter((d) => d && (d.title || d.url)).slice(0, 12)
      : undefined;

    const rfpChecklist = Array.isArray(body.rfpChecklist)
      ? body.rfpChecklist
          .filter((i) => i && typeof i.label === 'string' && i.label.trim())
          .slice(0, 14)
          .map((i) => ({
            id: typeof i.id === 'string' ? i.id : undefined,
            label: String(i.label).slice(0, 200),
            kind: typeof i.kind === 'string' ? i.kind : undefined,
          }))
      : checklistFromCandidateFields(
          {
            basesText: body.basesText,
            sourceExcerpt: body.sourceExcerpt,
            eligibility: null,
            whoCanApply: null,
            requirements: body.editalSummary,
          },
          locale,
        ).map((i) => ({ id: i.id, label: i.label, kind: i.kind }));

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
      contentLibraryBlock: contentLibraryBlock || undefined,
      rfpChecklist: rfpChecklist.length ? rfpChecklist : undefined,
      sourceExcerpt: body.sourceExcerpt,
      basesText: body.basesText,
      documents,
      locale,
    };

    const lang = fundhubLanguageName(locale);
    const defaultMessage =
      mode === 'understand'
        ? `Read the official call and write the briefing in ${lang}. Do not ask for the PDF if excerpt/bases are already in context. Do not invent a login wall.`
        : mode === 'brainstorm'
          ? `Brainstorm for this proposal in ${lang} — only after the call is understood.`
          : mode === 'structure'
            ? `Generate the proposal section titles in ${lang}.`
            : userMessage;

    const excerptLen = contextChars(ctx);
    const thin = excerptLen < 400;
    const wantSearch =
      Boolean(ctx.editalLink?.trim()) &&
      (mode === 'understand' || ((mode === 'brainstorm' || mode === 'chat') && thin));

    const maxOutputTokens = mode === 'structure' ? 800 : mode === 'understand' ? 3500 : mode === 'brainstorm' ? 2500 : 2000;
    const temperature = mode === 'structure' || mode === 'understand' ? 0.15 : mode === 'brainstorm' ? 0.4 : 0.25;

    const { text: answer } = await llmGenerateContent({
      systemInstruction: buildFundhubProposalSystemPrompt(mode, locale),
      userText: buildFundhubProposalUserPrompt(mode, ctx, userMessage || defaultMessage),
      maxOutputTokens,
      temperature,
      webSearch: wantSearch,
      model: thin && mode === 'understand' ? FUNDHUB_DISCOVERY_MODEL : undefined,
      timeoutMs: wantSearch ? 90_000 : undefined,
    });

    return NextResponse.json({ answer, mode, usedWebSearch: wantSearch });
  } catch (error: unknown) {
    console.error('[proposals/assistant] LLM', error);
    return NextResponse.json({ error: publicLlmErrorMessage(error) }, { status: 503 });
  }
}
