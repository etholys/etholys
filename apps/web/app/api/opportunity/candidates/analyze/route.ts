export const dynamic = 'force-dynamic';
export const maxDuration = 120;

import { NextRequest, NextResponse } from 'next/server';
import { llmCompleteText } from '@/lib/llm-client';
import { resolveOpportunityCompanyId } from '@/lib/opportunity/resolve-company';
import type { ScanCandidate } from '@/lib/opportunity/scan-types';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

function candidateBrief(c: ScanCandidate): string {
  return [
    `Nome: ${c.name}`,
    `Instituição: ${c.institution}`,
    `Tipo: ${c.type}`,
    c.category ? `Categoria: ${c.category}` : '',
    c.description ? `Descrição: ${c.description}` : '',
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
    c.linkOficial ? `Link oficial: ${c.linkOficial}` : '(sem link oficial)',
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
  };

  if (!body.candidate?.name || !body.candidate?.institution) {
    return NextResponse.json({ error: 'candidate obrigatório' }, { status: 400 });
  }

  const mode = body.mode === 'brief' ? 'brief' : 'chat';
  const system = `És um analista sénior de captação de fundos (OPPORTUNITY / Etholys).
Responde em português (ou no idioma da pergunta do utilizador).
Baseia-te nos dados do candidato; se algo for incerto, diga-o claramente.
Não inventes deadlines, montantes ou elegibilidade.
Quando útil, sugere perguntas a verificar no site oficial e riscos (contrapartida, elegibilidade, timeline).
Sê concreto e operacional.`;

  const briefBlock = candidateBrief(body.candidate);

  try {
    if (mode === 'brief') {
      const text = await llmCompleteText(
        system,
        `Elabora um RESUMO EXECUTIVO estruturado deste fundo/oportunidade para a equipa decidir:\n\n${briefBlock}\n\nSecções:\n1) O que é\n2) Quem pode candidatar\n3) Janela e montante\n4) Encaixe potencial\n5) Riscos / dúvidas a verificar\n6) Próximos passos sugeridos`,
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
      `DADOS DO FUNDO:\n${briefBlock}\n\n${historyBlock ? `CONVERSA ANTERIOR:\n${historyBlock}\n\n` : ''}PERGUNTA ACTUAL:\n${message}`,
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
