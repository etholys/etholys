import { geminiCompleteJsonText } from '@/lib/gemini-client';
import { extractFirstJsonObject } from '@/lib/extract-json-object';

export type DonorFileValidation = {
  detectedComponent: 'narrative' | 'me_indicators' | 'financial' | 'evidence_links' | 'other';
  detectedCadence: 'monthly' | 'quarterly' | 'annual' | 'unknown';
  confidence: number;
  confidenceReason: string;
  interpretation: string;
  summary: string;
  sectionsFound: string[];
  sectionsMissing: string[];
  fieldsComplete: string[];
  fieldsMissing: string[];
  warnings: string[];
  improvements: string[];
  suggestedPeriod: string | null;
  feedsQuarterlyReport: boolean;
  extractionCharCount?: number;
  extractionMethod?: string;
  extractionIssue?: string;
  analyzedAt?: string;
};

const ANALYZE_PROMPT = `Eres un experto en informes de donantes (USAID, BID, UE, PNUD).
Analiza el documento subido y explica claramente qué entendiste, qué falta y cómo mejorarlo.

Responde SOLO JSON válido:
{
  "detectedComponent": "narrative|me_indicators|financial|evidence_links|other",
  "detectedCadence": "monthly|quarterly|annual|unknown",
  "confidence": 0.0,
  "confidenceReason": "1-2 frases explicando por qué ese puntaje (ej. faltan secciones obligatorias del manual)",
  "interpretation": "2-4 frases: qué tipo de informe es, para qué período parece ser, qué propósito cumple",
  "summary": "resumen ejecutivo en 1-2 frases",
  "sectionsFound": ["secciones/hojas/campos detectados con contenido"],
  "sectionsMissing": ["secciones/campos obligatorios NO encontrados o vacíos"],
  "fieldsComplete": ["campos que parecen completados"],
  "fieldsMissing": ["campos vacíos, placeholders o pendientes"],
  "warnings": ["problemas de formato, inconsistencias, datos dudosos"],
  "improvements": ["acciones concretas para mejorar el informe, ordenadas por prioridad"],
  "suggestedPeriod": "Mar-2025 o Q1 2025 o null",
  "feedsQuarterlyReport": true
}

Reglas:
- confidence: 1.0 = cumple manual; 0.5 = parcial; <0.4 = incompleto o tipo incorrecto
- improvements debe ser accionable (ej. "Completar la sección X con datos de Y")
- Si hay manual del financiador, compara campo a campo
- narrative: narrativo mensual de actividades / reembolso
- me_indicators: planilla M&E
- financial: presupuesto, SF-425, liquidación
- monthly vs quarterly: reembolso mensual vs informe oficial trimestral`;

function inferFromFileName(fileName: string): Pick<DonorFileValidation, 'detectedComponent' | 'detectedCadence' | 'suggestedPeriod'> {
  const lower = fileName.toLowerCase();
  let detectedComponent: DonorFileValidation['detectedComponent'] = 'other';
  if (/sf-?425|financial|financeiro|presupuesto|budget|liquidaci|liquidación/.test(lower)) {
    detectedComponent = 'financial';
  } else if (/indicator|indicador|m&e|me_|planilla|matrix/.test(lower)) {
    detectedComponent = 'me_indicators';
  } else if (/monthly|mensual|narrativ|report|informe|reembolso|reimburs/.test(lower)) {
    detectedComponent = 'narrative';
  } else if (/annex|anexo|evidence|evidencia|link/.test(lower)) {
    detectedComponent = 'evidence_links';
  }

  let detectedCadence: DonorFileValidation['detectedCadence'] = 'unknown';
  if (/monthly|mensual|month|reembolso|reimburs/.test(lower)) detectedCadence = 'monthly';
  else if (/quarter|trimest|q[1-4]/.test(lower)) detectedCadence = 'quarterly';
  else if (/annual|anual|year/.test(lower)) detectedCadence = 'annual';

  const periodMatch = lower.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*-?\d{2,4}\b|\bq[1-4]\s*\d{4}\b/);
  return {
    detectedComponent,
    detectedCadence,
    suggestedPeriod: periodMatch ? periodMatch[0].replace(/\b\w/g, (c) => c.toUpperCase()) : null,
  };
}

function isMeaningfulAnalysis(parsed: Partial<DonorFileValidation>): boolean {
  return Boolean(
    String(parsed.interpretation || '').trim().length > 40
    || String(parsed.summary || '').trim().length > 20
    || asStringArray(parsed.sectionsFound).length > 0
    || asStringArray(parsed.sectionsMissing).length > 0
    || String(parsed.confidenceReason || '').trim().length > 25,
  );
}

function buildFailedAnalysis(
  fileName: string,
  reason: string,
  extraction?: { charCount: number; method: string; issue?: string },
  hints?: string[],
): DonorFileValidation {
  const inferred = inferFromFileName(fileName);
  const charCount = extraction?.charCount ?? 0;
  return {
    detectedComponent: inferred.detectedComponent,
    detectedCadence: inferred.detectedCadence,
    confidence: 0,
    confidenceReason: reason,
    interpretation:
      `Não foi possível analisar «${fileName}» automaticamente. `
      + (extraction?.issue || 'A extração de texto ou a resposta da IA falhou.')
      + (inferred.detectedComponent !== 'other'
        ? ` Pelo nome do ficheiro, parece ser ${inferred.detectedComponent === 'narrative' ? 'narrativo' : inferred.detectedComponent}.`
        : ''),
    summary: reason,
    sectionsFound: [],
    sectionsMissing: ['Análise detalhada indisponível — revalide ou use «Gerar borrador del informe»'],
    fieldsComplete: [],
    fieldsMissing: [],
    warnings: [
      extraction?.issue || reason,
      charCount > 0 ? `${charCount} caracteres extraídos (${extraction?.method || '?'})` : 'Nenhum texto legível extraído',
    ],
    improvements: hints ?? [
      'Use «Gerar borrador del informe» (passo ③) — constrói o informe a partir dos dados do SIEP, não depende só de ler o Word',
      'Clique «Validar estrutura (IA)» outra vez após subir .docx com títulos de secção visíveis',
      'Carregue o manual do financiador no passo ① antes de validar',
    ],
    suggestedPeriod: inferred.suggestedPeriod,
    feedsQuarterlyReport: inferred.detectedCadence === 'monthly',
    extractionCharCount: charCount,
    extractionMethod: extraction?.method,
    extractionIssue: extraction?.issue || reason,
    analyzedAt: new Date().toISOString(),
  };
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).trim()).filter(Boolean);
}

function normalizeValidation(parsed: Partial<DonorFileValidation>): DonorFileValidation {
  const sectionsFound = asStringArray(parsed.sectionsFound);
  const sectionsMissing = asStringArray(parsed.sectionsMissing);
  const fieldsComplete = asStringArray(parsed.fieldsComplete);
  const fieldsMissing = asStringArray(parsed.fieldsMissing);
  const warnings = asStringArray(parsed.warnings);
  const improvements = asStringArray(parsed.improvements);

  const interpretation = String(parsed.interpretation || parsed.summary || '').trim();
  const confidenceReason = String(parsed.confidenceReason || '').trim();

  return {
    detectedComponent: parsed.detectedComponent || 'other',
    detectedCadence: parsed.detectedCadence || 'unknown',
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
    confidenceReason: confidenceReason || (interpretation ? 'Ver interpretación abajo.' : 'Análisis parcial del documento.'),
    interpretation: interpretation || 'Não foi possível obter uma interpretação detalhada — clique «Validar estrutura (IA)» novamente.',
    summary: String(parsed.summary || interpretation).trim(),
    sectionsFound,
    sectionsMissing,
    fieldsComplete,
    fieldsMissing,
    warnings,
    improvements: improvements.length
      ? improvements
      : sectionsMissing.length
        ? sectionsMissing.map((s) => `Completar o añadir: ${s}`)
        : warnings,
    suggestedPeriod: parsed.suggestedPeriod ?? null,
    feedsQuarterlyReport: Boolean(parsed.feedsQuarterlyReport),
  };
}

export async function analyzeDonorReportFile(
  fileName: string,
  textContent: string,
  donorFormat: string,
  reportGuideContext?: string,
  extraction?: { charCount: number; method: string; issue?: string },
): Promise<DonorFileValidation> {
  const trimmed = textContent.trim();
  const charCount = extraction?.charCount ?? trimmed.length;

  if (charCount < 80 || trimmed.startsWith('[')) {
    return buildFailedAnalysis(
      fileName,
      `Só ${charCount} caracteres legíveis — insuficiente para analisar o formulário.`,
      extraction,
      [
        'Use «Gerar borrador del informe» (passo ③) para preencher o formato com dados do projeto',
        'Se subir plantilla: guarde como .docx com texto editável ou PDF com texto seleccionável',
        'Formulários Word vazios (só caixas) não têm texto — isso é normal; o borrador IA preenche o conteúdo',
      ],
    );
  }

  const guideBlock = reportGuideContext?.trim()
    ? `\n\n--- MANUAL DE REPORTE DEL FINANCIADOR (validar campo a campo) ---\n${reportGuideContext.slice(0, 100000)}\n--- FIN MANUAL ---\n`
    : '\n(Sin manual del financiador cargado — validar contra buenas prácticas USAID/BID/UE.)\n';

  const userText = `Formato donante: ${donorFormat}
Archivo: ${fileName}
${guideBlock}
--- CONTENIDO (extracto) ---
${textContent.slice(0, 120000)}
--- FIN ---`;

  const raw = await geminiCompleteJsonText(ANALYZE_PROMPT, userText, { maxOutputTokens: 8192 });
  const jsonStr = extractFirstJsonObject(raw);
  if (!jsonStr) {
    return buildFailedAnalysis(
      fileName,
      'A IA não devolveu JSON válido — tente validar novamente.',
      { charCount, method: extraction?.method || 'unknown', issue: extraction?.issue },
    );
  }

  let parsed: Partial<DonorFileValidation>;
  try {
    parsed = JSON.parse(jsonStr) as Partial<DonorFileValidation>;
  } catch {
    return buildFailedAnalysis(
      fileName,
      'Resposta da IA ilegível — tente validar novamente.',
      { charCount, method: extraction?.method || 'unknown', issue: extraction?.issue },
    );
  }

  if (!isMeaningfulAnalysis(parsed)) {
    const inferred = inferFromFileName(fileName);
    parsed = {
      ...inferred,
      ...parsed,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.35,
      confidenceReason: String(parsed.confidenceReason || 'Análise superficial — poucos campos identificados no ficheiro.'),
      interpretation: String(parsed.interpretation || parsed.summary || '').trim()
        || `Plantilla «${fileName}» reconhecida parcialmente (${charCount} caracteres). `
        + 'Provavelmente é um formulário vazio ou com pouco texto — use «Gerar borrador del informe» para construir o conteúdo.',
      sectionsMissing: asStringArray(parsed.sectionsMissing).length
        ? asStringArray(parsed.sectionsMissing)
        : ['Conteúdo preenchido do informe (use passo ③)'],
      improvements: asStringArray(parsed.improvements).length
        ? asStringArray(parsed.improvements)
        : ['Gerar borrador del informe com dados do SIEP (passo ③)', 'Re-validar após editar o borrador'],
    };
  }

  const result = normalizeValidation(parsed);
  return {
    ...result,
    extractionCharCount: charCount,
    extractionMethod: extraction?.method,
    extractionIssue: extraction?.issue,
    analyzedAt: new Date().toISOString(),
  };
}

/** Normaliza validação guardada na BD (inclui formatos antigos só com confidence). */
export function normalizeStoredValidation(raw: unknown): (DonorFileValidation & { error?: string }) | null {
  if (!raw || typeof raw !== 'object') return null;
  const v = raw as Record<string, unknown>;
  if (v.error) return { ...normalizeValidation(v as Partial<DonorFileValidation>), error: String(v.error) };
  if (v.confidence === undefined && !v.summary && !v.interpretation) return null;
  const normalized = normalizeValidation(v as Partial<DonorFileValidation>);
  const stale =
    !v.analyzedAt
    || (!v.extractionCharCount && v.confidence !== undefined)
    || normalized.interpretation.includes('Não foi possível obter uma interpretação')
    || normalized.interpretation.includes('No se pudo extraer');
  if (stale) {
    normalized.warnings.unshift('Análise incompleta ou antiga — clique «Validar estrutura (IA)» de novo.');
    if (!normalized.improvements.some((s) => s.includes('Gerar borrador'))) {
      normalized.improvements.unshift('Use «Gerar borrador del informe» (passo ③) para construir o informe');
    }
  }
  return normalized;
}
