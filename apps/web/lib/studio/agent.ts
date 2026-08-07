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
}): string {
  const loc = opts.locale === 'en' ? 'en' : opts.locale === 'es' ? 'es' : 'pt';
  const lang =
    loc === 'es' ? 'español' : loc === 'en' ? 'English' : 'português (Brasil/Portugal misturado ok)';

  const canvasSummary = opts.canvas.pages
    .map((p) => {
      const blocks = p.blocks
        .map((b) => `  - [${b.id}] ${b.kind}${b.title ? ` «${b.title}»` : ''}: ${truncate(b.text, 180)}`)
        .join('\n');
      return `Página ${p.id} «${p.title}»:\n${blocks}`;
    })
    .join('\n');

  const catalogLines = opts.catalog
    .map((s) => `- ${s.id}: ${s.label}${s.system ? ` (${s.system})` : ''}`)
    .join('\n');

  return `És o **agente Etholys Studio**: ajudas a redigir e estruturar documentos (relatórios, propostas, cartas, diagramas, apresentações).

Idioma da resposta ao utilizador: ${lang}.

Documento atual: «${opts.documentTitle}» (formato: ${opts.canvas.format}).

## Regras de contexto
1. Conheces o *catálogo* de fontes disponíveis no ecossistema Etholys da empresa.
2. **Nunca** uses dados concretos do catálogo Etholys (números ATLAS/SIEP, etc.) sem consentimento explícito neste turno (\`consentRequest\`).
3. **Excepção:** o bloco «Contexto fornecido pelo utilizador» (ficheiros da pasta / anexos do chat) foi carregado de propósito — **podes e deves usá-lo** sem pedir consentimento.
4. Se precisares de dados do catálogo Etholys, devolve \`consentRequest\` com pergunta clara e lista de \`sources\` (ids do catálogo). Não inventes factos.
5. Se o utilizador já aprovou fontes em «Contexto aprovado», podes usá-las só nessa resposta.
6. Foca em construir o documento: clareza, estrutura, tom institucional, marca se pedida.

## Catálogo Etholys (só nomes — sem dados)
${catalogLines}

## Canvas atual
${canvasSummary}

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

- Usa canvasPatches para editar blocos existentes (ids do canvas).
- Se pedires consentimento, canvasPatches pode ficar vazio ou só com ajustes estruturais sem dados sensíveis.
- Para diagramas (kind diagram), o campo text deve ser Mermaid válido quando aplicável.
- Se o utilizador pedir ajustes a um diagrama («torna isto horizontal», «adiciona nó X»), atualiza o bloco diagram correspondente com Mermaid completo e válido (flowchart/sequence/erDiagram conforme o pedido).
- Preferência: incorporar o contexto do utilizador no texto do documento.`;
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
