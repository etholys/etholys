const PROMPT_VERSION = 'fundhub-proposal-v2';

export type FundhubProposalMode = 'chat' | 'structure' | 'draft_section' | 'brainstorm' | 'understand';
export type FundhubLocale = 'es' | 'pt' | 'en';

export function normalizeFundhubLocale(raw: unknown): FundhubLocale {
  if (raw === 'pt' || raw === 'en' || raw === 'es') return raw;
  return 'es';
}

export function fundhubLanguageName(locale: FundhubLocale): string {
  if (locale === 'pt') return 'português';
  if (locale === 'en') return 'English';
  return 'español';
}

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
  sourceExcerpt?: string | null;
  basesText?: string | null;
  documents?: Array<{ title?: string; url?: string }> | null;
  /** Hub UI locale — source of truth for the reply language */
  locale?: FundhubLocale | null;
};

function buildContextBlock(ctx: FundhubProposalContext): string {
  const locale = normalizeFundhubLocale(ctx.locale);
  const lines: string[] = [`Idioma da interface do Hub: ${locale} (${fundhubLanguageName(locale)})`];
  if (ctx.fundName) lines.push(`Fundo / chamada: ${ctx.fundName}`);
  if (ctx.fundInstitution) lines.push(`Instituição doadora: ${ctx.fundInstitution}`);
  if (ctx.editalLink) lines.push(`Link do edital: ${ctx.editalLink}`);
  if (ctx.editalSummary?.trim()) lines.push(`Resumo / notas do edital:\n${ctx.editalSummary.trim()}`);
  if (ctx.documents?.length) {
    lines.push(
      `Documentos oficiais extraídos:\n${ctx.documents
        .map((d) => `- ${d.title || 'Documento'}: ${d.url || ''}`)
        .join('\n')}`,
    );
  }
  if (ctx.sourceExcerpt?.trim()) lines.push(`Texto da página oficial:\n${ctx.sourceExcerpt.trim().slice(0, 7000)}`);
  if (ctx.basesText?.trim()) lines.push(`Texto das bases / PDFs:\n${ctx.basesText.trim().slice(0, 10000)}`);
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
- És o assistente de propostas FundHub (${PROMPT_VERSION}) — especialista em propostas a doadores/editais.
- Não inventes requisitos do edital, orçamentos, percentagens, resultados passados ou elegibilidade.
- Se o CONTEXTO já tem texto da página ou das bases, USA-O. Não digas que não consegues aceder ao site.
- Não peças ao utilizador para colar o PDF inteiro se já há excerpt/bases.
- Não inventes barreiras de login/UUID/registo salvo o CONTEXTO dizer HTTP 401/403.
- Se faltar um dado pontual depois de ler o que há, marca no máximo 1–2 [FALTA: …]. Nunca abras com uma lista de [FALTA].
- Não faças diagnóstico de negócio NEXUS, informes SIEP, layout Studio nem prioridades do Workspace Advisor.
- Não menciones nomes internos de produto (FUNDHUB, OPPORTUNITY, license keys). Diz FundHub se precisares de te nomear.
- Tom profissional, claro, alinhado ao doador quando o edital o permitir.`;

function languageRule(locale: FundhubLocale): string {
  const name = fundhubLanguageName(locale);
  return `- IDIOMA OBRIGATÓRIO: o Hub está em ${locale} (${name}). Escreve TODA a resposta em ${name}. Ignora o idioma destas instruções, o da página oficial e o das notas internas. Só muda se o utilizador pedir explicitamente outro idioma nesta mensagem.`;
}

export function buildFundhubProposalSystemPrompt(mode: FundhubProposalMode, locale: FundhubLocale = 'es'): string {
  const rules = `## REGRAS
${languageRule(locale)}
${SHARED_RULES.replace('## REGRAS\n', '')}`;

  if (mode === 'structure') {
    return `${rules}

## TRABALHO (estrutura)
Analisa o edital/notas e propõe uma estrutura de secções para a proposta.
- Secções específicas ao edital (não genéricas vazias).
- Ordem lógica: elegibilidade/contexto → objectivos → actividades → resultados → orçamento → equipa → anexos (só se fizer sentido).
- SAÍDA OBRIGATÓRIA: APENAS os títulos das secções, uma por linha, numeradas (1. 2. 3. …). Sem introdução, sem bullets extras, sem explicações.`;
  }

  if (mode === 'draft_section') {
    return `${rules}

## TRABALHO (rascunho de secção)
Redige ou melhora a secção activa com base no edital e no perfil disponível.
- Texto pronto a colar na proposta (parágrafos claros).
- Marca [FALTA: …] onde precisares de dados concretos.
- Não reescrevas a proposta inteira — só a secção pedida.`;
  }

  if (mode === 'understand') {
    return `${rules}

## TRABALHO (entender o edital)
Primeiro passo obrigatório: ler a convocatória. Ainda NÃO faças chuva de ideias nem rascunho de candidatura.
- O que é o fundo (1 parágrafo).
- Quem pode candidatar e onde.
- Janela, montante, tipo (grant/crédito).
- Requisitos e anexos oficiais (com URL se existirem no contexto).
- 3 pontos a confirmar na postulação.
- Tom de briefing institucional. Sem tabelas markdown partidas. Sem pedir o edital outra vez se o texto já veio no contexto.
- Escreve o briefing no idioma da interface, mesmo que a convocatória esteja em inglês ou outro idioma.`;
  }

  if (mode === 'brainstorm') {
    return `${rules}

## TRABALHO (chuva de ideias)
Só depois do edital lido: ideia geral do que desenvolver NESTE fundo para ESTA organização.
- 4–7 ideias concretas (não genéricas) do que escrever / como enquadrar.
- Diz o encaixe só com dados do perfil; se faltar, [FALTA: …].
- 2–4 riscos ou pontos a verificar no edital oficial.
- Um próximo passo.
- Curto e operacional. Não escrevas a proposta inteira. Sem tutorial, sem “como usar”.`;
  }

  return `${rules}

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
  if (mode === 'understand') {
    return `${block}

Pedido: briefing do edital — o que a convocatória diz de facto. Sem postulação ainda. Resposta no idioma da interface (${fundhubLanguageName(normalizeFundhubLocale(ctx.locale))}).`;
  }
  if (mode === 'brainstorm') {
    return `${block}

Pedido: chuva de ideias — só depois de o edital estar lido. O que desenvolver nesta proposta (este fundo + este perfil).

${userMessage.trim() ? `Nota: ${userMessage.trim()}` : ''}`.trim();
  }
  return `${block}

Mensagem do utilizador:
${userMessage.trim()}`;
}

export function normalizeFundhubMode(raw: unknown): FundhubProposalMode {
  if (raw === 'structure' || raw === 'draft_section' || raw === 'chat' || raw === 'brainstorm' || raw === 'understand') {
    return raw;
  }
  return 'chat';
}
