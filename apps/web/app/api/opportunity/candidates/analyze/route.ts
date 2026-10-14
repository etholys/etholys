export const dynamic = 'force-dynamic';
export const maxDuration = 120;

import { NextRequest, NextResponse } from 'next/server';
import { llmCompleteText } from '@/lib/llm-client';
import { prisma } from '@/lib/prisma';
import {
  fundhubLanguageName,
  normalizeFundhubLocale,
} from '@/lib/agents/fundhub-proposal-prompt';
import { COMPANY_SECTORS, type CompanyContextSetup } from '@/lib/company-context-setup';
import { formatApplicantProfileForAnalysis } from '@/lib/opportunity/applicant-profile';
import { readOpportunityBriefing } from '@/lib/opportunity/briefing';
import { resolveOpportunityCompanyId } from '@/lib/opportunity/resolve-company';
import type { ScanCandidate } from '@/lib/opportunity/scan-types';

function sectorLabels(ctx: CompanyContextSetup | null): string[] {
  const ids = [...(ctx?.sectorIds ?? []), ...(ctx?.sectorId ? [ctx.sectorId] : [])];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    const found = COMPANY_SECTORS.find((s) => s.id === id);
    out.push(found?.label.pt ?? id);
  }
  return out;
}

async function loadApplicantBlock(companyId: string): Promise<string> {
  const [company, briefing] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      select: {
        name: true,
        shortName: true,
        description: true,
        businessActivity: true,
        incorporationCountry: true,
        entityType: true,
        contextSetupJson: true,
      },
    }),
    readOpportunityBriefing(companyId),
  ]);
  if (!company) return '';
  const ctx =
    company.contextSetupJson &&
    typeof company.contextSetupJson === 'object' &&
    (company.contextSetupJson as { v?: unknown }).v === 1
      ? (company.contextSetupJson as CompanyContextSetup)
      : null;
  return formatApplicantProfileForAnalysis({
    name: company.name,
    shortName: company.shortName,
    description: company.description,
    sector: company.businessActivity,
    country: company.incorporationCountry,
    entityType: company.entityType,
    entityKind: ctx?.entityKind,
    sectorLabels: sectorLabels(ctx),
    notesForAdvisor: ctx?.notesForAdvisor,
    briefing,
  }).block;
}

type ChatMessage = { role: 'user' | 'assistant'; content: string };

function candidateBrief(c: ScanCandidate): string {
  return [
    `Nome: ${c.name}`,
    `Instituição: ${c.institution}`,
    `Tipo: ${c.type}`,
    c.category ? `Categoria: ${c.category}` : '',
    c.description ? `Descrição: ${c.description}` : '',
    c.whoCanApply ? `Quem pode candidatar: ${c.whoCanApply}` : '',
    c.eligibility ? `Elegibilidade: ${c.eligibility}` : '',
    c.requirements ? `Requisitos: ${c.requirements}` : '',
    c.howToApply ? `Como candidatar: ${c.howToApply}` : '',
    c.risksCaveats ? `Riscos / avisos: ${c.risksCaveats}` : '',
    c.amount != null ? `Montante: ${c.amount} ${c.currency ?? 'USD'}` : '',
    c.opensAt || c.closesAt || c.deadline
      ? `Janela: ${c.opensAt ?? '?'} → ${c.closesAt ?? c.deadline ?? '?'}`
      : '',
    c.applicationWindow ? `Janela (texto): ${c.applicationWindow}` : '',
    c.eligibleCountries || c.countries
      ? `Países elegíveis: ${c.eligibleCountries ?? c.countries}`
      : '',
    c.sectors ? `Sectores: ${c.sectors}` : '',
    c.availabilityStatus ? `Disponibilidade: ${c.availabilityStatus}` : '',
    c.availabilityNote ? `Nota disponibilidade: ${c.availabilityNote}` : '',
    c.matchJustification ? `Match: ${c.matchJustification}` : '',
    c.classification ? `Classificação sugerida: ${c.classification}` : '',
    c.classificationNote ? `Nota classificação: ${c.classificationNote}` : '',
    c.callUrl ? `Página da convocatória: ${c.callUrl}` : '',
    c.institutionUrl && c.institutionUrl !== c.callUrl ? `Site da instituição: ${c.institutionUrl}` : '',
    c.linkOficial && !c.callUrl ? `Link oficial: ${c.linkOficial}` : '',
    !c.callUrl && !c.linkOficial ? '(sem página oficial da convocatória — não inventar factos)' : '',
    c.documents?.length
      ? `Documentos oficiais:\n${c.documents.map((d) => `- ${d.title}: ${d.url}`).join('\n')}`
      : '',
    c.sourceExcerpt ? `Excerto da página oficial:\n${c.sourceExcerpt.slice(0, 6000)}` : '',
    c.basesText
      ? `Texto extraído das bases oficiais (citar; não inventar o que não estiver aqui):\n${c.basesText.slice(0, 12000)}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export async function POST(req: NextRequest) {
  const ctx = await resolveOpportunityCompanyId(req.nextUrl.searchParams.get('companyId'));
  if (!ctx) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const body = (await req.json()) as {
    candidate?: ScanCandidate;
    message?: string;
    history?: ChatMessage[];
    mode?: 'chat' | 'brief';
    locale?: unknown;
  };

  if (!body.candidate?.name || !body.candidate?.institution) {
    return NextResponse.json({ error: 'candidate obrigatório' }, { status: 400 });
  }

  const locale = normalizeFundhubLocale(body.locale);
  const lang = fundhubLanguageName(locale);
  const mode = body.mode === 'brief' ? 'brief' : 'chat';
  const system = `És um analista sénior de captação de fundos (FundHub / Etholys).
Responde SEMPRE em ${lang} (idioma da interface do Hub: ${locale}). Mesmo que a pergunta venha noutro idioma, responde em ${lang}.
Baseia-te nos dados do candidato, na página da convocatória, nos documentos oficiais, no texto extraído das bases e no perfil da organização já registado.
O perfil da empresa JÁ existe. Nunca digas que não sabes que empresa é, nem perguntes o tipo de organização, o sector ou o país se esses dados estiverem no perfil.
Se faltar um campo, diz só qual parte do registo inicial completar para o encaixe ficar mais preciso.
Se o utilizador pedir para ver as bases, cita só o texto extraído.
Se não houver página/documentos oficiais, diz que a oportunidade pode ser genérica ou não verificada.
Não inventes deadlines, montantes, elegibilidade nem anexos.
Quando útil, sugere perguntas a verificar no site oficial e riscos (contrapartida, elegibilidade, timeline).
Sê concreto e operacional.`;

  const applicantBlock = await loadApplicantBlock(ctx.companyId);

  const briefBlock = candidateBrief(body.candidate);

  try {
    if (mode === 'brief') {
      const text = await llmCompleteText(
        system,
        `Elabora um RESUMO EXECUTIVO estruturado deste fundo/oportunidade para a equipa decidir.\n\nPERFIL DA ORGANIZAÇÃO (registo já feito):\n${applicantBlock || '(perfil não carregado)'}\n\nDADOS DO FUNDO:\n${briefBlock}\n\nSecções:\n1) O que é\n2) Quem pode candidatar — cruza com o tipo de organização do perfil\n3) Janela e montante\n4) Encaixe com ESTA organização\n5) Riscos / o que falta no registo inicial, se mudar o encaixe\n6) Próximos passos sugeridos`,
        { maxOutputTokens: 4096, temperature: 0.3 },
      );
      return NextResponse.json({ reply: text, mode: 'brief' });
    }

    const message = body.message?.trim();
    if (!message) {
      return NextResponse.json({ error: 'message obrigatório' }, { status: 400 });
    }

    const history = (body.history ?? []).slice(-8);
    const historyBlock = history
      .map((m) => `${m.role === 'user' ? 'Utilizador' : 'Analista'}: ${m.content}`)
      .join('\n');

    const text = await llmCompleteText(
      system,
      `PERFIL DA ORGANIZAÇÃO (registo já feito — usa isto, não peças o perfil de novo):\n${applicantBlock || '(perfil não carregado)'}\n\nDADOS DO FUNDO:\n${briefBlock}\n\n${historyBlock ? `CONVERSA ANTERIOR:\n${historyBlock}\n\n` : ''}PERGUNTA ACTUAL:\n${message}`,
      { maxOutputTokens: 4096, temperature: 0.35 },
    );

    return NextResponse.json({ reply: text, mode: 'chat' });
  } catch (e) {
    console.error('[POST /api/opportunity/candidates/analyze]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Falha na análise' },
      { status: 500 },
    );
  }
}
