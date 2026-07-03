import type { ReportCanvasState } from '@/lib/siep/report-canvas-types';
import type { CanvasPatch, CopilotCanvasPayload, ReportCanvasRegion, AddTableRowPayload, ReplaceTableRowsPayload } from '@/lib/siep/report-canvas-types';
import type { InformeDomain } from '@/lib/siep/informe-domains';
import { buildCanvasSectionsFromRegions } from '@/lib/siep/report-canvas-layout';
import { isResultsLikeColumn } from '@/lib/siep/informe-canvas-selection';

export type CopilotLocale = 'pt' | 'es' | 'en';

function informeDomainPromptLabel(domain: InformeDomain): string {
  if (domain === 'budget') return 'informe financeiro';
  if (domain === 'narrative') return 'informe narrativo';
  if (domain === 'field') return 'informe de terreno';
  if (domain.startsWith('custom:')) return 'informe personalizado';
  return 'informe M&E / narrativo';
}

export type ReportOutputLanguage = 'en' | 'es' | 'pt';

export function inferReportOutputLanguage(canvas: ReportCanvasState): ReportOutputLanguage {
  const headers = (canvas.sections ?? []).flatMap((s) => s.columns ?? []).join(' ');
  if (/\b(Date|Outcome|Activity|Results|Deliverable|Challenge|Lesson)\b/i.test(headers)) return 'en';
  if (/\b(Fecha|Actividad|Resultado|Entregable|Desafío|Lección)\b/i.test(headers)) return 'es';
  const sample = canvas.regions
    .filter((r) => r.text.trim())
    .slice(0, 8)
    .map((r) => r.text)
    .join(' ');
  if (/\b(the|and|with|were|was|activity)\b/i.test(sample)) return 'en';
  return 'pt';
}

function outputLanguageLabel(lang: ReportOutputLanguage): string {
  if (lang === 'en') return 'INGLÊS (English)';
  if (lang === 'es') return 'ESPANHOL (Español)';
  return 'PORTUGUÊS';
}

/** Ordena códigos M&E tipo A1.1a, A1.2, A3.2 para comparação. */
export function compareMeActivityCodes(a: string, b: string): number {
  const parse = (s: string) => {
    const m = s.trim().match(/A?(\d+)(?:\.(\d+))?([a-z])?/i);
    if (!m) return { major: 999, minor: 999, suffix: 'z' };
    return {
      major: Number(m[1]),
      minor: m[2] != null ? Number(m[2]) : 0,
      suffix: (m[3] || '').toLowerCase(),
    };
  };
  const pa = parse(a);
  const pb = parse(b);
  if (pa.major !== pb.major) return pa.major - pb.major;
  if (pa.minor !== pb.minor) return pa.minor - pb.minor;
  return pa.suffix.localeCompare(pb.suffix);
}

export function buildSiepReportSystemPrompt(opts: {
  locale: CopilotLocale;
  reportTitle: string;
  periodLabel: string;
  cadence: string;
  domain: InformeDomain;
  outputLanguage: ReportOutputLanguage;
  guideContext?: string;
  canvasSummary: string;
  projectContext: string;
}): string {
  const domainLabel = informeDomainPromptLabel(opts.domain);
  const chatLang =
    opts.locale === 'es'
      ? 'Responde en español en el chat.'
      : opts.locale === 'en'
        ? 'Respond in English in the chat.'
        : 'Responde em português no chat.';
  const docLang = outputLanguageLabel(opts.outputLanguage);

  return `És o assistente de redacção de ${domainLabel} no SIEP (Etholys).
${chatLang}

INFORME: ${opts.reportTitle}
PERÍODO: ${opts.periodLabel}
CADÊNCIA: ${opts.cadence}
IDIOMA DO DOCUMENTO (canvas): ${docLang} — TODO o conteúdo em "text" nos patches DEVE estar em ${docLang}. Nunca misture idiomas no documento.

O utilizador edita o informe no canvas à direita. Tu ajudas a preencher, corrigir e validar secções.

${opts.guideContext ? `--- MANUAL DO FINANCIADOR ---\n${opts.guideContext.slice(0, 60000)}\n--- FIM ---\n` : ''}

--- REGIÕES DO CANVAS (IDs para patches) ---
${opts.canvasSummary.slice(0, 40000)}

--- DADOS DO PROJECTO ---
${opts.projectContext.slice(0, 50000)}

INSTRUÇÕES:
- Responde de forma conversacional e útil (2–6 frases). NÃO repitas o JSON no texto visível.
- Quando alterares o informe, inclui NO FINAL um único bloco JSON (puro, SEM \`\`\`, SEM markdown):
{"canvasPatches":[],"addTableRows":[],"replaceTableRows":[],"missingRegionIds":[],"removeRegionIds":[]}

REGRAS CRÍTICAS:
1. IDIOMA: Se o utilizador pedir inglês/espanhol, ou o modelo tiver cabeçalhos em inglês, escreva TODO o documento nesse idioma. Traduza conteúdo antigo em outro idioma — não deixe texto antigo.
2. ESCOPO M&E: Use APENAS actividades/outcomes do «ESCOPO M&E DO PROJECTO» com código exacto (A1.1a, A1.2…). Não invente códigos novos.
3. ORDEM DAS ACTIVIDADES: Ordene linhas pela sequência lógica dos códigos (A1.1a antes de A1.2, antes de A1.6, etc.). A primeira linha de dados deve ser a actividade de menor código reportada no período.
4. REESCREVER / ACTUALIZAR TABELA COMPLETA: Use replaceTableRows — apaga linhas antigas e cria as novas na ordem correcta. NUNCA deixe linhas antigas E adicione linhas novas com o mesmo conteúdo (isso duplica dados).
   Exemplo: {"replaceTableRows":[{"sectionId":"sec-id","rows":[{"cells":[{"tableCol":0,"text":"2026-04-01"},{"tableCol":2,"text":"A1.1a"}]}]}]}
5. CORRECÇÕES PARCIAIS: canvasPatches com regionId exacto para alterar células existentes sem duplicar linhas.
6. LINHAS EXTRA (só se o modelo tiver menos linhas que actividades novas): addTableRows — uma entrada por linha genuinamente nova. Não use addTableRows para substituir conteúdo existente.
7. APLICAR: O JSON no final é OBRIGATÓRIO quando pedirem preenchimento — sem JSON o documento NÃO muda.
8. Números: use [VERIFICAR] se faltar dado confirmado.

- replaceTableRows: reescrita completa de tabela (preferir quando pedem actualizar/reordenar/traduzir tabela inteira)
- canvasPatches: alterações pontuais em regionIds existentes
- addTableRows: só linhas adicionais além das existentes
- removeRegionIds: apenas textos fixos (NUNCA células de tabela)

FORMATAÇÃO DE TEXTO (campos longos, coluna Results / Challenges / Lessons / Comments):
- NUNCA escreva tudo num parágrafo único corrido. Use quebras de linha (\\n) no JSON — elas aparecem no documento.
- Estrutura recomendada em inglês:
  Challenges:\\n- ponto 1\\n- ponto 2\\n\\nLessons learned:\\n- ponto 1\\n\\nComments:\\n- texto
- Em português: Desafios / Lições aprendidas / Comentários. Em espanhol: Desafíos / Lecciones aprendidas / Comentarios.
- Cada tema num bloco com rótulo + lista com "-" ou frases curtas separadas por \\n.
- Se o utilizador seleccionou uma célula/coluna Results, aplique esta formatação nesse âmbito.

FOCO DO UTILIZADOR:
- Quando a mensagem incluir «ELEMENTO SELECCIONADO», a conversa refere-se PRINCIPALMENTE a esse campo/linha/coluna/secção.
- Priorize patches nos regionIds listados no foco. Não altere outras partes do documento salvo pedido explícito.`;
}

function unescapeJsonString(s: string): string {
  return s.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
}

/** Extrai patches mesmo quando o JSON está truncado ou malformado. */
function extractLooseCanvasPatches(raw: string): CanvasPatch[] {
  const patches: CanvasPatch[] = [];
  const seen = new Set<string>();

  const re =
    /\{\s*"regionId"\s*:\s*"([^"]+)"\s*,\s*"text"\s*:\s*"((?:[^"\\]|\\.)*)"\s*(?:,\s*"[^"]*"\s*:\s*(?:"(?:[^"\\]|\\.)*"|\d+|true|false))*\s*\}/g;

  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const regionId = m[1];
    if (seen.has(regionId)) continue;
    seen.add(regionId);
    patches.push({ regionId, text: unescapeJsonString(m[2]) });
  }

  return patches;
}

function tryParseCanvasPatchesArray(jsonSlice: string): CanvasPatch[] | null {
  try {
    const arr = JSON.parse(jsonSlice) as unknown;
    if (!Array.isArray(arr)) return null;
    const parsed = parseCopilotPayloadObject({ canvasPatches: arr });
    return parsed?.patches.length ? parsed.patches : null;
  } catch {
    return null;
  }
}

function tryExtractPatchesArrayFromRaw(raw: string): CanvasPatch[] | null {
  const keyIdx = raw.indexOf('"canvasPatches"');
  if (keyIdx < 0) return null;
  const arrStart = raw.indexOf('[', keyIdx);
  if (arrStart < 0) return null;

  let depth = 0;
  for (let i = arrStart; i < raw.length; i += 1) {
    const ch = raw[i];
    if (ch === '[') depth += 1;
    else if (ch === ']') {
      depth -= 1;
      if (depth === 0) {
        const fromArray = tryParseCanvasPatchesArray(raw.slice(arrStart, i + 1));
        if (fromArray?.length) return fromArray;
        break;
      }
    }
  }

  const partial = raw.slice(arrStart);
  const fromPartial = tryParseCanvasPatchesArray(partial);
  if (fromPartial?.length) return fromPartial;

  const loose = extractLooseCanvasPatches(raw.slice(arrStart));
  return loose.length ? loose : null;
}

function parseCopilotPayloadObject(raw: unknown): {
  patches: CanvasPatch[];
  missingRegionIds: string[];
  removeRegionIds: string[];
  addTableRows: AddTableRowPayload[];
  replaceTableRows: ReplaceTableRowsPayload[];
} | null {
  if (!raw || typeof raw !== 'object') return null;
  const parsed = raw as CopilotCanvasPayload;
  if (
    !parsed.canvasPatches &&
    !parsed.removeRegionIds &&
    !parsed.missingRegionIds &&
    !parsed.addTableRows &&
    !parsed.replaceTableRows
  ) {
    return null;
  }

  const patches: CanvasPatch[] = (parsed.canvasPatches ?? [])
    .filter(
      (p) =>
        p.regionId &&
        (p.text != null ||
          p.label != null ||
          p.tableTitle != null ||
          p.columnLabel != null ||
          p.instruction != null ||
          p.fieldType != null),
    )
    .map((p) => ({
      regionId: String(p.regionId),
      ...(p.text != null ? { text: String(p.text) } : {}),
      ...(p.label != null ? { label: String(p.label) } : {}),
      ...(p.missing != null ? { missing: Boolean(p.missing) } : {}),
      ...(p.sectionId != null ? { sectionId: String(p.sectionId) } : {}),
      ...(p.tableId != null ? { tableId: String(p.tableId) } : {}),
      ...(p.tableTitle != null ? { tableTitle: String(p.tableTitle) } : {}),
      ...(p.columnLabel != null ? { columnLabel: String(p.columnLabel) } : {}),
      ...(p.tableRow != null ? { tableRow: Number(p.tableRow) } : {}),
      ...(p.tableCol != null ? { tableCol: Number(p.tableCol) } : {}),
      ...(p.instruction != null ? { instruction: String(p.instruction) } : {}),
      ...(p.fieldType != null
        ? { fieldType: p.fieldType as import('@/lib/siep/report-canvas-types').ReportCanvasFieldType }
        : {}),
    }));

  const addTableRows: AddTableRowPayload[] = (parsed.addTableRows ?? [])
    .filter((r) => r && typeof r.sectionId === 'string' && Array.isArray(r.cells))
    .map((r) => ({
      sectionId: String(r.sectionId),
      cells: (r.cells ?? [])
        .filter((c) => c != null && typeof c.tableCol === 'number')
        .map((c) => ({
          tableCol: Number(c.tableCol),
          ...(c.text != null ? { text: String(c.text) } : {}),
        })),
    }))
    .filter((r) => r.cells.length > 0);

  const replaceTableRows: ReplaceTableRowsPayload[] = (parsed.replaceTableRows ?? [])
    .filter((r) => r && typeof r.sectionId === 'string' && Array.isArray(r.rows))
    .map((r) => ({
      sectionId: String(r.sectionId),
      rows: (r.rows ?? [])
        .filter((row) => row && Array.isArray(row.cells))
        .map((row) => ({
          cells: (row.cells ?? [])
            .filter((c) => c != null && typeof c.tableCol === 'number')
            .map((c) => ({
              tableCol: Number(c.tableCol),
              ...(c.text != null ? { text: String(c.text) } : {}),
            })),
        }))
        .filter((row) => row.cells.length > 0),
    }))
    .filter((r) => r.rows.length > 0);

  return {
    patches,
    missingRegionIds: (parsed.missingRegionIds ?? []).map(String),
    removeRegionIds: (parsed.removeRegionIds ?? []).map(String),
    addTableRows,
    replaceTableRows,
  };
}

function tryParseJsonPayload(jsonStr: string) {
  const trimmed = jsonStr.trim();
  try {
    return parseCopilotPayloadObject(JSON.parse(trimmed));
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return parseCopilotPayloadObject(JSON.parse(trimmed.slice(start, end + 1)));
      } catch {
        const fromArray = tryExtractPatchesArrayFromRaw(trimmed);
        if (fromArray?.length) {
          return { patches: fromArray, missingRegionIds: [], removeRegionIds: [], addTableRows: [], replaceTableRows: [] };
        }
        const loose = extractLooseCanvasPatches(trimmed);
        if (loose.length) {
          return { patches: loose, missingRegionIds: [], removeRegionIds: [], addTableRows: [], replaceTableRows: [] };
        }
        return null;
      }
    }
    const fromArray = tryExtractPatchesArrayFromRaw(trimmed);
    if (fromArray?.length) {
      return { patches: fromArray, missingRegionIds: [], removeRegionIds: [], addTableRows: [], replaceTableRows: [] };
    }
    const loose = extractLooseCanvasPatches(trimmed);
    if (loose.length) {
      return { patches: loose, missingRegionIds: [], removeRegionIds: [], addTableRows: [], replaceTableRows: [] };
    }
    return null;
  }
}

function stripTrailingJson(text: string): string {
  return text
    .replace(/```(?:json)?\s*\{[\s\S]*?\}\s*```/gi, '')
    .replace(/\{[\s\S]*"(?:canvasPatches|addTableRows|replaceTableRows)"[\s\S]*\}\s*$/m, '')
    .trim();
}

export function extractCopilotPayload(assistantText: string): {
  visibleText: string;
  patches: CanvasPatch[];
  missingRegionIds: string[];
  removeRegionIds: string[];
  addTableRows: AddTableRowPayload[];
  replaceTableRows: ReplaceTableRowsPayload[];
} {
  const empty = {
    visibleText: assistantText.trim(),
    patches: [],
    missingRegionIds: [],
    removeRegionIds: [],
    addTableRows: [] as AddTableRowPayload[],
    replaceTableRows: [] as ReplaceTableRowsPayload[],
  };
  const raw = assistantText.trim();
  if (!raw) return empty;

  const fenceRe = /```(?:json)?\s*([\s\S]*?)```/gi;
  let fenceMatch: RegExpExecArray | null;
  while ((fenceMatch = fenceRe.exec(raw)) !== null) {
    const parsed = tryParseJsonPayload(fenceMatch[1]);
    if (parsed) {
      const visibleText = raw.slice(0, fenceMatch.index).trim() || stripTrailingJson(raw);
      return { visibleText, ...parsed };
    }
  }

  const inlineMatch = raw.match(/\{[\s\S]*"(?:canvasPatches|addTableRows|replaceTableRows)"[\s\S]*\}/);
  if (inlineMatch) {
    const parsed = tryParseJsonPayload(inlineMatch[0]);
    if (parsed) {
      const visibleText = raw.slice(0, inlineMatch.index).trim() || stripTrailingJson(raw);
      return { visibleText, ...parsed };
    }
    const looseFromInline = extractLooseCanvasPatches(inlineMatch[0]);
    if (looseFromInline.length) {
      const visibleText = raw.slice(0, inlineMatch.index).trim() || stripTrailingJson(raw);
      return {
        visibleText,
        patches: looseFromInline,
        missingRegionIds: [],
        removeRegionIds: [],
        addTableRows: [],
        replaceTableRows: [],
      };
    }
  }

  const removeOnly = raw.match(/\{[\s\S]*"removeRegionIds"[\s\S]*\}/);
  if (removeOnly) {
    const parsed = tryParseJsonPayload(removeOnly[0]);
    if (parsed) {
      const visibleText = raw.slice(0, removeOnly.index).trim() || stripTrailingJson(raw);
      return { visibleText, ...parsed };
    }
  }

  const loose = extractLooseCanvasPatches(raw);
  if (loose.length) {
    return {
      visibleText: stripTrailingJson(raw),
      patches: loose,
      missingRegionIds: [],
      removeRegionIds: [],
      addTableRows: [],
      replaceTableRows: [],
    };
  }

  const fromArray = tryExtractPatchesArrayFromRaw(raw);
  if (fromArray?.length) {
    return {
      visibleText: stripTrailingJson(raw),
      patches: fromArray,
      missingRegionIds: [],
      removeRegionIds: [],
      addTableRows: [],
      replaceTableRows: [],
    };
  }

  return empty;
}

export function summarizeCanvasForPrompt(canvas: ReportCanvasState): string {
  const sections = canvas.sections?.length
    ? canvas.sections
    : buildCanvasSectionsFromRegions(canvas.regions);
  const byId = new Map(canvas.regions.map((r) => [r.id, r]));
  const parts: string[] = [];

  for (const s of sections) {
    if (s.kind === 'table') {
      const cols = s.columns || [];
      parts.push(`\n══ TABELA [${s.id}] «${s.title}» ══`);
      parts.push(
        `Colunas: ${cols.length ? cols.map((c, i) => `${i}="${c}"`).join(' | ') : '(detectar por célula)'}`,
      );

      const regs = s.regionIds
        .map((id) => byId.get(id))
        .filter(Boolean) as ReportCanvasRegion[];
      const byRow = new Map<number, ReportCanvasRegion[]>();
      for (const r of regs) {
        const ri = r.tableRow ?? 0;
        if (!byRow.has(ri)) byRow.set(ri, []);
        byRow.get(ri)!.push(r);
      }

      for (const [row, cells] of [...byRow.entries()].sort((a, b) => a[0] - b[0])) {
        parts.push(`  Linha ${row}:`);
        for (const c of cells.sort((a, b) => (a.tableCol ?? 0) - (b.tableCol ?? 0))) {
          const colIdx = c.tableCol ?? 0;
          const colName = c.columnLabel || cols[colIdx] || `col${colIdx}`;
          const fmtHint = isResultsLikeColumn(colName) ? ' [usar \\n + Challenges/Lessons/Comments]' : '';
          const val = c.text.trim() ? `"${c.text.slice(0, 100)}"` : '(vazio — preencher com patch text)';
          parts.push(`    regionId="${c.id}" col${colIdx} (${colName})${fmtHint}: ${val}`);
        }
      }
      parts.push(
        `  → Linhas existentes: canvasPatches. Reescrita completa (actualizar/ordenar/traduzir): replaceTableRows com sectionId="${s.id}". Linhas extra: addTableRows.`,
      );
    } else {
      parts.push(`\n── Secção [${s.id}] ${s.kind} · ${s.title} ──`);
      for (const id of s.regionIds) {
        const r = byId.get(id);
        if (!r) continue;
        const val = r.text.trim() ? r.text.slice(0, 100) : '(vazio)';
        parts.push(`  [${r.id}] ${r.label || '(sem rótulo)'}: ${val}`);
      }
    }
  }

  const used = new Set(sections.flatMap((s) => s.regionIds));
  const orphans = canvas.regions.filter((r) => !used.has(r.id));
  if (orphans.length) {
    parts.push('\n── Regiões órfãs ──');
    for (const r of orphans) {
      parts.push(`  [${r.id}] ${r.label || r.kind}: ${r.text.trim() ? r.text.slice(0, 80) : '(vazio)'}`);
    }
  }

  return parts.join('\n');
}

export function bootstrapInformeMessage(locale: CopilotLocale): string {
  if (locale === 'es') {
    return 'Analicé la plantilla y los datos del proyecto. Indícame qué falta o pídeme que complete secciones concretas.';
  }
  if (locale === 'en') {
    return 'I reviewed the template and project data. Tell me what is missing or ask me to fill specific sections.';
  }
  return 'Formato validado. Diga o que falta neste período ou peça-me para preencher secções concretas.';
}

export function buildTemplateValidationPrompt(opts: {
  locale: CopilotLocale;
  domain: InformeDomain;
  templateFileName: string;
  canvasSummary: string;
  projectContext: string;
}): string {
  const lang =
    opts.locale === 'es'
      ? 'Responde en español.'
      : opts.locale === 'en'
        ? 'Respond in English.'
        : 'Responde em português.';
  const domainLabel = informeDomainPromptLabel(opts.domain);

  return `És o assistente de validação de FORMATO de ${domainLabel} no SIEP.
${lang}

Ficheiro modelo: ${opts.templateFileName}

O utilizador vê à direita uma PRÉ-VISUALIZAÇÃO VISUAL do formato final: secções, tabelas com colunas e campos.
Ajuda a confirmar se a estrutura está correta (tabelas de actividades, imprensa, blocos de assinatura, etc.).

NÃO preenchas dados do período — só valida estrutura e campos.

AÇÕES NO CANVAS (obrigatório aplicar via JSON quando o utilizador pedir ajustes):
- Renomear rótulo: {"regionId":"p-29","label":"Novo nome","text":""}
- Instrução (!): {"regionId":"p-29","instruction":"Texto de ajuda ao utilizador"}
- Tipo de campo: {"regionId":"p-29","fieldType":"short"|"long"|"table"|"other"}
- Ajustar agrupamento: {"regionId":"t-3-r-2-c-0","tableTitle":"Actividades mensais","columnLabel":"Data"}
- Remover da lista (texto fixo / título explicativo): add id a removeRegionIds
- Marcar em falta: add id a missingRegionIds

Ao responder, descreva a estrutura por secções: «Tabela Actividades — colunas X, Y…», «Bloco dados do prémio — N campos».

--- REGIÕES DETECTADAS (IDs para patches) ---
${opts.canvasSummary.slice(0, 40000)}

--- CONTEXTO DO PROJECTO ---
${opts.projectContext.slice(0, 30000)}

INSTRUÇÕES:
- Explica o que detectaste (campos vazios, tabelas, secções)
- Quando o utilizador pedir ajustes, APLICA via JSON no final (SEM \`\`\`):
{"canvasPatches":[{"regionId":"p-29","label":"Grant Agreement Number","text":""}],"missingRegionIds":[],"removeRegionIds":["p-17","p-21"]}
- removeRegionIds: parágrafos que são instruções ou títulos, NÃO campos editáveis`;
}
