const PROMPT_VERSION = 'fundhub-proposal-v1';

export type FundhubProposalMode = 'chat' | 'structure' | 'draft_section' | 'brainstorm';

export type FundhubProposalContext = {
  fundName?: string | null;
  fundInstitution?: string | null;
  editalLink?: string | null;
  editalSummary?: string | null;
  /** Full document currently on the canvas */
  documentMarkdown?: string | null;
  /** Optional outline already on the canvas */
  proposalOutline?: string[] | null;
  /** Active section when drafting or asking about one section */
  sectionTitle?: string | null;
  sectionContent?: string | null;
  /** Short org profile (mission, geography, track record) — never invent if missing */
  orgProfile?: string | null;
};

function buildContextBlock(ctx: FundhubProposalContext): string {
  const lines: string[] = [];
  if (ctx.fundName) lines.push(`Fundo / chamada: ${ctx.fundName}`);
  if (ctx.fundInstitution) lines.push(`Instituição doadora: ${ctx.fundInstitution}`);
  if (ctx.editalLink) lines.push(`Link do edital: ${ctx.editalLink}`);
  if (ctx.editalSummary?.trim()) lines.push(`Resumo / notas do edital:\n${ctx.editalSummary.trim()}`);
  if (ctx.orgProfile?.trim()) lines.push(`Perfil da organização (usar; não inventar para além disto):\n${ctx.orgProfile.trim()}`);
  if (ctx.documentMarkdown?.trim()) {
    lines.push(`Documento actual no canvas:\n${ctx.documentMarkdown.trim().slice(0, 8000)}`);
  }
  if (ctx.proposalOutline?.length) {
    lines.push(`Esboço actual da proposta:\n${ctx.proposalOutline.map((s, i) => `${i + 1}. ${s}`).join('\n')}`);
  }
  if (ctx.sectionTitle) {
    lines.push(`Secção activa: ${ctx.sectionTitle}`);
    if (ctx.sectionContent?.trim()) {
      lines.push(`Conteúdo actual da secção:\n${ctx.sectionContent.trim().slice(0, 6000)}`);
    }
  }
  return lines.length ? `CONTEXTO:\n${lines.join('\n\n')}` : 'CONTEXTO: (sem edital/fundo carregado — pergunta o mínimo necessário.)';
}

const SHARED_RULES = `## REGRAS
- És o assistente de propostas OPPORTUNITY (${PROMPT_VERSION}) — especialista em propostas a doadores/editais.
- Não inventes requisitos do edital, orçamentos, percentagens, resultados passados ou elegibilidade.
- Se faltar informação, diz o que falta e propõe 1–3 perguntas concretas. Marca [FALTA: …].
- Não faças diagnóstico de negócio NEXUS, informes SIEP, layout Studio nem prioridades do Workspace Advisor.
- Não menciones nomes internos de produto (FUNDHUB, license keys). Diz OPPORTUNITY se precisares de te nomear.
- Tom profissional, claro, alinhado ao doador quando o edital o permitir.
- Responde no idioma do utilizador (pt/es/en) salvo pedido explícito.`;

export function buildFundhubProposalSystemPrompt(mode: FundhubProposalMode): string {
  if (mode === 'structure') {
    return `${SHARED_RULES}

## TRABALHO (estrutura)
Analisa o edital/notas e propõe uma estrutura de secções para a proposta.
- Secções específicas ao edital (não genéricas vazias).
- Ordem lógica: elegibilidade/contexto → objectivos → actividades → resultados → orçamento → equipa → anexos (só se fizer sentido).
- SAÍDA OBRIGATÓRIA: APENAS os títulos das secções, uma por linha, numeradas (1. 2. 3. …). Sem introdução, sem bullets extras, sem explicações.`;
  }

  if (mode === 'draft_section') {
    return `${SHARED_RULES}

## TRABALHO (rascunho de secção)
Redige ou melhora a secção activa com base no edital e no perfil disponível.
- Texto pronto a colar na proposta (parágrafos claros).
- Marca [FALTA: …] onde precisares de dados concretos.
- Não reescrevas a proposta inteira — só a secção pedida.`;
  }

  if (mode === 'brainstorm') {
    return `${SHARED_RULES}

## TRABALHO (chuva de ideias)
Abre a sessão com uma ideia geral do que desenvolver NESTE fundo para ESTA organização.
- 4–7 ideias concretas (não genéricas) do que escrever / como enquadrar.
- Diz o encaixe só com dados do perfil; se faltar, [FALTA: …].
- 2–4 riscos ou pontos a verificar no edital oficial.
- Um próximo passo.
- Curto e operacional. Não escrevas a proposta inteira. Sem tutorial, sem “como usar”.`;
  }

  return `${SHARED_RULES}

## TRABALHO (chat)
Ajuda a preparar a proposta: requisitos, riscos, enquadramento, linguagem do doador, próximos passos.
- Respostas objetivas; listas quando ajudarem.
- Quando pedirem texto de secção, oferece um rascunho curto e pergunta se querem expandir.
- Quando o edital for vago, distingue o que está escrito vs. o que é boa prática.`;
}

export function buildFundhubProposalUserPrompt(
  mode: FundhubProposalMode,
  ctx: FundhubProposalContext,
  userMessage: string,
): string {
  const block = buildContextBlock(ctx);
  if (mode === 'structure') {
    return `${block}

Pedido: gera a lista numerada de secções sugeridas para esta proposta.

${userMessage.trim() ? `Nota do utilizador: ${userMessage.trim()}` : ''}`.trim();
  }
  if (mode === 'draft_section') {
    return `${block}

Pedido de rascunho / melhoria da secção activa:
${userMessage.trim()}`;
  }
  if (mode === 'brainstorm') {
    return `${block}

Pedido: chuva de ideias inicial — o que desenvolver nesta proposta (este fundo + este perfil).

${userMessage.trim() ? `Nota: ${userMessage.trim()}` : ''}`.trim();
  }
  return `${block}

Mensagem do utilizador:
${userMessage.trim()}`;
}

export function normalizeFundhubMode(raw: unknown): FundhubProposalMode {
  if (raw === 'structure' || raw === 'draft_section' || raw === 'chat' || raw === 'brainstorm') return raw;
  return 'chat';
}
