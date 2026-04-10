export const dynamic = 'force-dynamic';

import { NextResponse, NextRequest } from 'next/server';
import { geminiCompleteText } from '@/lib/gemini-client';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      fundName,
      fundInstitution,
      editalLink,
      editalSummary,
      userMessage,
      mode,
    } = body;

    if (!userMessage || typeof userMessage !== 'string') {
      return NextResponse.json({ error: 'É necessário informar a pergunta ou instrução.' }, { status: 400 });
    }

    const contextParts = [];
    if (fundName) contextParts.push(`Fundo: ${fundName}`);
    if (fundInstitution) contextParts.push(`Instituição: ${fundInstitution}`);
    if (editalLink) contextParts.push(`Link do edital: ${editalLink}`);
    if (editalSummary) contextParts.push(`Resumo do edital: ${editalSummary}`);

    const contextText = contextParts.length > 0 ? `${contextParts.join('\n')}\n\n` : '';

    let systemInstruction =
      'Você é um assistente de elaboração de propostas para editais. Responda de forma objetiva, com foco em requisitos, riscos e próximos passos para preparar a proposta.';
    let prompt = `${contextText}Usuário: ${userMessage}\n\nResposta:`;

    if (mode === 'structure') {
      systemInstruction =
        'Você é um especialista em análise de editais e estruturação de propostas. Você deve analisar cuidadosamente a estrutura do edital e sugerir uma estrutura clara de seções para a proposta. Cada seção sugerida deve ser clara, específica e alinhada com os requisitos do edital. Responda APENAS com os nomes das seções, uma por linha, numeradas (1. 2. 3. etc).';
      prompt = `Analise o seguinte edital e gere os nomes das seções sugeridas para uma proposta bem estruturada:\n\n${contextText}\n\nSeções sugeridas:\n`;
    } else if (mode === 'chat') {
      systemInstruction =
        'Você é um especialista em elaboração de propostas para editais de financiamento. Você tem profundo conhecimento em estrutura de projetos, viabilidade financeira, gestão de risco, e melhores práticas em propostas. Responda de forma clara, objetiva e prátitica, dando recomendações concretas baseadas nos requisitos do edital. Quando necessário, peça esclarecimentos sobre pontos específicos do projeto.';
    }

    const answer = await geminiCompleteText(systemInstruction, prompt, {
      maxOutputTokens: 800,
      temperature: mode === 'structure' ? 0.15 : 0.25,
    });

    return NextResponse.json({ answer });
  } catch (error: any) {
    const message = error?.message || 'Erro desconhecido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
