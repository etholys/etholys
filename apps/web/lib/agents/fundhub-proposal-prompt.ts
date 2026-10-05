import { INSTITUTIONAL_PROSE_RULE } from '@/lib/agents/prose-rules';

const PROMPT_VERSION = 'fundhub-proposal-v5';

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
  /** RFP checklist items (heuristic) — guide structure / sections */
  rfpChecklist?: Array<{ id?: string; label: string; kind?: string }> | null;
  /** Content-library voice block already formatted */
  contentLibraryBlock?: string | null;
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
  if (ctx.contentLibraryBlock?.trim()) {
    lines.push(`Biblioteca de conteúdo / voz da org (preferir estes trechos quando couberem):\n${ctx.contentLibraryBlock.trim().slice(0, 6000)}`);
  }
  if (ctx.rfpChecklist?.length) {
    lines.push(
      `Checklist RFP detectado no edital (cobrir nas secções):\n${ctx.rfpChecklist
        .map((i, n) => `${n + 1}. ${i.label}${i.kind ? ` [${i.kind}]` : ''}`)
        .join('\n')}`,
    );
  }
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
${INSTITUTIONAL_PROSE_RULE}
- Não inventes requisitos do edital, orçamentos, percentagens, resultados passados ou elegibilidade.
- Se o CONTEXTO já tem texto da página ou das bases, USA-O. Não digas que não consegues aceder ao site.
- Não peças ao utilizador para colar o PDF inteiro se já há excerpt/bases.
- Não inventes barreiras de login/UUID/registo salvo o CONTEXTO dizer HTTP 401/403.
- Se faltar um dado pontual depois de ler o que há, marca no máximo 1–2 [FALTA: …]. Nunca abras com uma lista de [FALTA].
- Quando o utilizador pedir redigir / completar o formulário / «ítem por ítem», ESCREVE de imediato. Não bloqueies com perguntas de elegibilidade, geografia ou orçamento como pré-condição. Usa hipóteses razoáveis do CONTEXTO e marca [FALTA: …] inline.
- Se o canvas ainda não tiver o formato do formulário oficial, primeiro lista os campos/secções do edital (títulos ##) e em seguida preenche o primeiro ítem completo na mesma resposta — ou só o ítem pedido.
- Em modo «ítem por ítem»: uma secção completa por resposta (## título + texto pronto a colar). Termina apenas com a pergunta do próximo ítem. Sem preâmbulos longos.
- Não faças diagnóstico de negócio NEXUS, informes SIEP, layout Studio nem prioridades do Workspace Advisor.
- Não menciones nomes internos de produto (FUNDHUB, OPPORTUNITY, license keys). Diz FundHub se precisares de te nomear.
- Tom profissional, claro, alinhado ao doador quando o edital o permitir.`;

function languageRule(locale: FundhubLocale): string {
  const name = fundhubLanguageName(locale);
  if (locale === 'en') {
    return `- MANDATORY LANGUAGE (highest priority): Hub UI locale is «en» (English). Write the ENTIRE reply — headings, lists, [MISSING], questions — in English. Ignore the language of these system instructions, the official page, the RFP text, and earlier chat turns. Switch language only if the user EXPLICITLY asks in this message («responde en español», «escreve em português», etc.).`;
  }
  if (locale === 'pt') {
    return `- IDIOMA OBRIGATÓRIO (prioridade máxima): a interface do Hub está em «pt» (português). Escreve TODA a resposta — títulos, listas, [FALTA], perguntas — em português. Ignora o idioma destas instruções de sistema, o da página oficial, o das bases e o de mensagens anteriores do chat. Só muda de idioma se o utilizador pedir EXPLICITAMENTE nesta mensagem («write in English», «responde en español», etc.).`;
  }
  return `- IDIOMA OBLIGATORIO (prioridad máxima): la interfaz del Hub está en «es» (español). Escribe TODA la respuesta — títulos, listas, [FALTA], preguntas — en español. Ignora el idioma de estas instrucciones de sistema, el de la página oficial, el de las bases y el de mensajes anteriores del chat. Solo cambia de idioma si el usuario lo pide EXPLÍCITAMENTE en este mensaje («write in English», «escreve em português», etc.).`;
}

export function buildFundhubProposalSystemPrompt(mode: FundhubProposalMode, locale: FundhubLocale = 'es'): string {
  const rules = `## REGRAS
${languageRule(locale)}
${SHARED_RULES.replace('## REGRAS\n', '')}`;

  if (mode === 'structure') {
    return `${rules}

## TRABALHO (estrutura)
Propõe a estrutura de secções da candidatura — alinhada ao FORMATO DO EDITAL, não a um template genérico.
- Se CONTEXTO tiver «Checklist RFP», esses itens SÃO a espinha dorsal: uma secção por item (podes fundir só se o título for claramente o mesmo).
- Extrai títulos literais das bases / página oficial (ex.: «Sección A», «Anexo 1», campos do formulário). Copia a nomenclatura do doador.
- PROIBIDO inventar arquitectura tipo «Introdução / Justificação / Conclusão / Resumo executivo» se o edital não a pedir.
- Se o documento no canvas já tiver ## títulos do edital, preserva/estende essa ordem.
- SAÍDA OBRIGATÓRIA: APENAS títulos, uma por linha, numerados (1. 2. 3. …). Sem introdução, sem ideias, sem chuva de ideias, sem explicações.`;
  }

  if (mode === 'draft_section') {
    return `${rules}

## TRABALHO (rascunho de secção)
Redige ou melhora a secção activa com base no edital e no perfil disponível.
- Texto pronto a colar na proposta (parágrafos claros).
- Respeita o título/formato pedido pelo edital para esta secção.
- Marca [FALTA: …] onde precisares de dados concretos.
- Não reescrevas a proposta inteira — só a secção pedida.`;
  }

  if (mode === 'understand') {
    return `${rules}

## TRABALHO (entender o edital)
Primeiro passo: briefing factual da convocatória. PROIBIDO nesta resposta:
- chuva de ideias / brainstorm / «4–7 ideias» / como enquadrar a proposta
- rascunho de candidatura ou secções a preencher
- pedir ao utilizador para «gerar ideias» no fim

Inclui APENAS:
- O que é o fundo (1 parágrafo).
- Quem pode candidatar e onde.
- Janela, montante, tipo (grant/crédito).
- Requisitos e anexos oficiais (URL se existirem no contexto).
- Formato / secções que o edital exige, se estiverem no texto.
- 3 pontos a confirmar na postulação (factos, não ideias criativas).

Tom de briefing institucional. Sem tabelas markdown partidas. Sem pedir o edital outra vez se o texto já veio no contexto.`;
  }

  if (mode === 'brainstorm') {
    return `${rules}

## TRABALHO (chuva de ideias) — só sob pedido explícito do utilizador
Ideia geral do que desenvolver NESTE fundo para ESTA organização.
- 4–7 ideias concretas (não genéricas) do que escrever / como enquadrar.
- Diz o encaixe só com dados do perfil; se faltar, [FALTA: …].
- 2–4 riscos ou pontos a verificar no edital oficial.
- Um próximo passo.
- Curto e operacional. Não escrevas a proposta inteira. Sem tutorial.`;
  }

  return `${rules}

## TRABALHO (chat)
Ajuda a preparar a proposta: requisitos, riscos, enquadramento, linguagem do doador, rascunhos.
- Respostas objetivas; listas quando ajudarem.
- Se pedirem completar o formulário / postulação / «ítem por ítem»: prioridade absoluta é TEXTO DE CANDIDATURA alinhado ao formato do edital (plantilla / campos oficiais no CONTEXTO), não entrevista.
- Não abras com «antes de escribir necesito confirmar…» quando pedirem redigir. Redige já; lacunas viram [FALTA: …].
- Quando pedirem texto de secção, entrega o rascunho completo dessa secção (pronto a colar) e pergunta só se querem o seguinte ítem.
- Não lances chuva de ideias espontânea — só se o utilizador pedir ideias / brainstorm / enquadramento.
- Quando o edital for vago, distingue o que está escrito vs. o que é boa prática.`;
}

export function buildFundhubProposalUserPrompt(
  mode: FundhubProposalMode,
  ctx: FundhubProposalContext,
  userMessage: string,
): string {
  const block = buildContextBlock(ctx);
  if (mode === 'structure') {
    const lang = fundhubLanguageName(normalizeFundhubLocale(ctx.locale));
    return `${block}

Pedido: gera a lista numerada de secções sugeridas para esta proposta — títulos no idioma da interface (${lang}), mas nomes de campos do edital quando o doador os nomeia.
NÃO uses um template genérico. Copia a estrutura do edital / checklist RFP / bases no CONTEXTO.

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

Hub UI language for this reply: ${fundhubLanguageName(normalizeFundhubLocale(ctx.locale))} (${normalizeFundhubLocale(ctx.locale)}). Answer entirely in that language.

Mensagem do utilizador:
${userMessage.trim()}`;
}

export function normalizeFundhubMode(raw: unknown): FundhubProposalMode {
  if (raw === 'structure' || raw === 'draft_section' || raw === 'chat' || raw === 'brainstorm' || raw === 'understand') {
    return raw;
  }
  return 'chat';
}
