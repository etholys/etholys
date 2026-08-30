import type { StudioCanvasState, StudioConsentSource, StudioCopilotPayload } from '@/lib/studio/types';

export const STUDIO_ECOSYSTEM_CATALOG: StudioConsentSource[] = [
  {
    id: 'company.profile',
    label: 'Perfil da empresa',
    system: 'Core',
    description: 'Nome, moeda, sector / contexto de setup',
  },
  {
    id: 'atlas.finance_summary',
    label: 'Resumo financeiro',
    system: 'ATLAS',
    description: 'Indicadores financeiros recentes (se licenciados)',
  },
  {
    id: 'siep.projects',
    label: 'Projetos SIEP',
    system: 'SIEP',
    description: 'Títulos e estado de projetos ativos',
  },
  {
    id: 'fundhub.proposals',
    label: 'Propostas FUNDHUB',
    system: 'FUNDHUB',
    description: 'Rascunhos e propostas em curso',
  },
  {
    id: 'forge.courses',
    label: 'Cursos FORGE',
    system: 'FORGE',
    description: 'Programas e cursos ativos',
  },
  {
    id: 'nexus.at_engagements',
    label: 'Assistência técnica / serviços NEXUS',
    system: 'NEXUS',
    description: 'Serviços AT, empresas e projetos vinculados',
  },
  {
    id: 'meet.recent',
    label: 'Reuniões Meet recentes',
    system: 'Meet',
    description: 'Títulos e resumos recentes',
  },
];

export function buildStudioSystemPrompt(opts: {
  locale: string;
  documentTitle: string;
  canvas: StudioCanvasState;
  catalog: StudioConsentSource[];
  approvedContext?: string | null;
  /** Ficheiros da pasta / anexos do chat — usar sem consentRequest */
  userUploadedContext?: string | null;
  /** Se definido, a IA só pode emitir patches destes blockIds */
  targetBlockIds?: string[] | null;
}): string {
  const loc = opts.locale === 'en' ? 'en' : opts.locale === 'es' ? 'es' : 'pt';
  const lang =
    loc === 'es' ? 'español' : loc === 'en' ? 'English' : 'português (Brasil/Portugal misturado ok)';

  const targets = (opts.targetBlockIds || []).filter(Boolean);
  const targetSet = new Set(targets);

  const canvasSummary = opts.canvas.pages
    .map((p) => {
      const blocks = p.blocks
        .filter((b) => !targetSet.size || targetSet.has(b.id))
        .map((b) => {
          const mark = targetSet.has(b.id) ? ' ★ÂMBITO' : '';
          return `  - [${b.id}] ${b.kind}${b.title ? ` «${b.title}»` : ''}${mark}: ${truncate(b.text, targetSet.size ? 1200 : 400)}`;
        })
        .join('\n');
      if (!blocks) return null;
      return `Página ${p.id} «${p.title}»:\n${blocks}`;
    })
    .filter(Boolean)
    .join('\n');

  const catalogLines = opts.catalog
    .map((s) => `- ${s.id}: ${s.label}${s.system ? ` (${s.system})` : ''}`)
    .join('\n');

  const scopeBlock = targets.length
    ? `
## ÂMBITO OBRIGATÓRIO (seleção do utilizador)
O utilizador selecionou **apenas** estes blocos para edição: ${targets.map((id) => `\`${id}\``).join(', ')}.
- \`canvasPatches\` **só** pode conter estes \`blockId\`. Qualquer outro id é PROIBIDO.
- Os restantes blocos do documento **não existem para edição** neste turno — não os menciones como alterados e não os reescrevas.
- Se o pedido não fizer sentido só com estes blocos, explica na \`message\` e devolve \`canvasPatches: []\`.
`
    : `
## Âmbito (sem seleção)
Não há secção selecionada. Ainda assim: **proibido** reescrever o documento inteiro. Se o pedido for sobre uma secção concreta e houver ambiguidade, pergunta qual bloco e devolve \`canvasPatches: []\`.
`;

  return `És o **agente de redação Etholys Studio** (nível Microsoft Word / Google Docs).
Ajudas a redigir com precisão cirúrgica — nunca “embelezes” o documento inteiro.

Idioma da resposta ao utilizador: ${lang}.

Documento atual: «${opts.documentTitle}» (formato: ${opts.canvas.format}).
${scopeBlock}
## Regras de edição do documento (críticas — violação = falha)
1. **Cirúrgico:** altera **apenas** o que o utilizador pediu. Não reescrevas, não «melhores» nem apagues blocos que não foram pedidos.
2. Em \`canvasPatches\`, inclui **só** os \`blockId\` que precisam de mudar. Omissões = blocos intactos. **Nunca** envies um patch por cada bloco «para atualizar o doc».
3. Se o pedido for acrescentar informação a um bloco, **preserva** o texto existente e acrescenta (não substituas o bloco inteiro a menos que peçam reescrever **esse** bloco).
4. Nunca esvazies um bloco (\`text: ""\`) — isso apaga conteúdo e é tratado como erro.
5. Se não tiveres a certeza de qual bloco editar, pergunta na \`message\` e devolve \`canvasPatches: []\`.
6. Não mudes \`suggestedTitle\` salvo o utilizador pedir novo título.
7. **Proibido absoluto:** apagar o resto do documento e deixar só a parte nova. O documento completo deve permanecer; só mudam os blocos alvo.
8. Preferência Word: títulos curtos, parágrafos claros, listas com \`- \`, tom consistente com o resto do doc.

## Regras de contexto
1. Conheces o *catálogo* de fontes disponíveis no ecossistema Etholys da empresa.
2. **Nunca** uses dados concretos do catálogo Etholys (números ATLAS/SIEP, etc.) sem consentimento explícito neste turno (\`consentRequest\`).
3. **Excepção:** o bloco «Contexto fornecido pelo utilizador» (ficheiros da pasta / anexos do chat) foi carregado de propósito — **podes e deves usá-lo** sem pedir consentimento.
4. Se precisares de dados do catálogo Etholys, devolve \`consentRequest\` com pergunta clara e lista de \`sources\` (ids do catálogo). Não inventes factos.
5. Se o utilizador já aprovou fontes em «Contexto aprovado», podes usá-las só nessa resposta.
6. **Excepção adicional:** «Vínculos persistentes deste documento» no contexto do utilizador foram escolhidos de propósito — **podes e deves usá-los** sem pedir consentimento.
7. Foca em construir o documento: clareza, estrutura, tom institucional, marca se pedida.
8. **Conversa multi-turno:** recebes o histórico da conversa no texto do utilizador. **Nunca** digas que não tens acesso ao historial — ele está incluído. Confirmações curtas («sim», «aprobado», «ok», «sí», «apruebo esta estructura») referem-se **sempre** à proposta imediata anterior do assistente — aplica-a com \`canvasPatches\`. **Não** peças «mais contexto» depois de uma confirmação.
9. Se propuseste uma estrutura/outline e o utilizador aprova, **implementa** essa estrutura no canvas neste turno (\`canvasPatches\` obrigatório). Não te limites a confirmar por chat — edita o documento.
10. Quando pedires aprovação de estrutura («¿Apruebas esta estructura?»), neste turno devolve \`canvasPatches: []\`. No turno **seguinte**, se o utilizador aprovar, aplica a estrutura aprovada.

## Catálogo Etholys (só nomes — sem dados)
${catalogLines}

## Canvas atual${targets.length ? ' (só blocos no âmbito + ids)' : ''}
${canvasSummary || '(sem blocos no âmbito)'}

${
  opts.userUploadedContext
    ? `## Contexto fornecido pelo utilizador (usar livremente)\n${opts.userUploadedContext}`
    : '## Contexto fornecido pelo utilizador\n(nenhum)'
}

${
  opts.approvedContext
    ? `## Contexto aprovado do catálogo Etholys (usar só se fizer sentido)\n${opts.approvedContext}`
    : '## Contexto aprovado do catálogo\n(nenhum neste turno)'
}

## Formato de saída
Responde **apenas** com JSON válido (sem markdown):
{
  "message": "texto curto para o utilizador",
  "canvasPatches": [{ "pageId": "opcional", "blockId": "id", "text": "novo texto", "title": "opcional" }],
  "consentRequest": null | { "question": "...", "sources": [{ "id": "...", "label": "...", "system": "..." }] },
  "suggestedTitle": null | "novo título"
}

- Usa canvasPatches **só** para os blocos que mudam (ids do canvas). Preferência: **1 patch** quando o pedido é pontual.
- Se pedires consentimento, canvasPatches pode ficar vazio ou só com ajustes estruturais sem dados sensíveis.
- Para diagramas (kind diagram), o campo text deve ser Mermaid válido quando aplicável (ou JSON Excalidraw se o bloco for visual).
- Se o utilizador pedir ajustes a um diagrama («torna isto horizontal», «adiciona nó X»), atualiza **só** o bloco diagram correspondente.
- Preferência: incorporar o contexto do utilizador no texto do documento.
- **Proibido:** reescrever o documento inteiro quando o pedido é pontual (ex. «acrescenta X», «melhora a secção 1.2»).`;
}

function truncate(s: string, n: number) {
  const t = (s || '').replace(/\s+/g, ' ').trim();
  return t.length <= n ? t : `${t.slice(0, n)}…`;
}

export function parseStudioCopilotJson(raw: string): StudioCopilotPayload {
  const trimmed = raw.trim();
  let jsonStr = trimmed;
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) jsonStr = fence[1].trim();
  const start = jsonStr.indexOf('{');
  const end = jsonStr.lastIndexOf('}');
  if (start >= 0 && end > start) jsonStr = jsonStr.slice(start, end + 1);

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonStr) as Record<string, unknown>;
  } catch {
    return { message: trimmed.slice(0, 2000), canvasPatches: [] };
  }

  const message = typeof parsed.message === 'string' ? parsed.message : 'Pronto.';
  const patchesRaw = Array.isArray(parsed.canvasPatches) ? parsed.canvasPatches : [];
  const canvasPatches = patchesRaw
    .map((p) => {
      if (!p || typeof p !== 'object') return null;
      const row = p as Record<string, unknown>;
      if (typeof row.blockId !== 'string') return null;
      return {
        pageId: typeof row.pageId === 'string' ? row.pageId : undefined,
        blockId: row.blockId,
        text: typeof row.text === 'string' ? row.text : undefined,
        title: typeof row.title === 'string' ? row.title : undefined,
      };
    })
    .filter(Boolean) as StudioCopilotPayload['canvasPatches'];

  let consentRequest: StudioCopilotPayload['consentRequest'] = null;
  const cr = parsed.consentRequest;
  if (cr && typeof cr === 'object') {
    const row = cr as Record<string, unknown>;
    const question = typeof row.question === 'string' ? row.question : '';
    const sourcesRaw = Array.isArray(row.sources) ? row.sources : [];
    const sources = sourcesRaw
      .map((s) => {
        if (!s || typeof s !== 'object') return null;
        const x = s as Record<string, unknown>;
        if (typeof x.id !== 'string' || typeof x.label !== 'string') return null;
        return {
          id: x.id,
          label: x.label,
          system: typeof x.system === 'string' ? x.system : undefined,
          description: typeof x.description === 'string' ? x.description : undefined,
        };
      })
      .filter(Boolean) as StudioConsentSource[];
    if (question && sources.length) consentRequest = { question, sources };
  }

  const suggestedTitle =
    typeof parsed.suggestedTitle === 'string' && parsed.suggestedTitle.trim()
      ? parsed.suggestedTitle.trim()
      : undefined;

  return { message, canvasPatches, consentRequest, suggestedTitle };
}
