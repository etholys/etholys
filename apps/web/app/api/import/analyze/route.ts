export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getUserCompanyIds } from '@/lib/tenant';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { callImportLlm, getGeminiImportModel } from '@/lib/import-llm';
import { getGeminiModelCandidates } from '@/lib/gemini-client';
import { extractFirstJsonObject } from '@/lib/extract-json-object';
import { collectActivitiesFromObjectives } from '@/lib/siep/import-activities';
import { buildSourceLanguageInstruction } from '@/lib/siep/import-language';
import type { ContentLocale } from '@/lib/siep/i18n';

/** Shape of JSON returned by the import LLM; defaults are applied before the response. */
type ImportExtractedProject = {
  name: string;
  description: string;
  goal: string;
  donorName: string;
  country: string;
  region: string;
  currency: string;
  budget: number;
  startDate: string | null;
  endDate: string | null;
};

type ImportExtractedConfidence = {
  project: string;
  sow: string;
  objectives: string;
  budgetLines: string;
  risks: string;
  milestones: string;
};

type ImportExtractedPayload = {
  project: ImportExtractedProject;
  sow: unknown[];
  objectives: unknown[];
  budgetLines: unknown[];
  risks: unknown[];
  milestones: unknown[];
  confidence: ImportExtractedConfidence;
  diagnostics: unknown[];
};

const EXTRACTION_PROMPT = `Eres un experto en proyectos de cooperación internacional (USAID, BID, UE, FIDA, GIZ, PNUD).
Tu tarea es EXTRAER (NO reescribir) información estructurada de los documentos de un proyecto que te envían.

REGLA FUNDAMENTAL DE TRANSCRIPCIÓN:
- COPIA TEXTUAL: Transcribe EXACTAMENTE el texto tal como aparece en el documento fuente. NO parafrasees, NO resumas, NO reformules, NO mejores la redacción, NO cambies la estructura gramatical.
- Si el documento dice "Improved business, financial and digital literacy among participant MSMEs", tu output DEBE decir exactamente eso — NO "Improve business literacy for MSMEs" ni ninguna variación.
- Mantén el idioma original del documento. Si está en inglés, los títulos y descripciones van en inglés. Si está en español, van en español.
- Conserva imperfecciones gramaticales, redundancias y estilo del autor original. Tu trabajo es LOCALIZAR y COPIAR, no EDITAR.
- Los únicos campos donde puedes generar texto propio son: codes (OE1, R1, etc.) y campos de clasificación (type, category, level).

Debes responder ÚNICAMENTE con un JSON válido (sin markdown, sin backticks, solo el JSON).

ESTRUCTURA REQUERIDA:
{
  "project": {
    "name": "string - nombre del proyecto",
    "description": "string - descripción breve (1-2 oraciones)",
    "goal": "string - EL OBJETIVO GENERAL / PROJECT GOAL del proyecto (un solo enunciado de alto nivel)",
    "donorName": "string - financiador principal",
    "country": "string - país(es)",
    "region": "string - región geográfica",
    "currency": "string - moneda principal (USD, EUR, etc.)",
    "budget": 0,
    "startDate": "YYYY-MM-DD o null",
    "endDate": "YYYY-MM-DD o null"
  },
  "sow": [
    {
      "sectionKey": "background|objectives|methodology|deliverables|scope|target|partners|assumptions",
      "title": "Título de la sección",
      "items": ["item 1", "item 2", "..."],
      "content": "texto narrativo si no tiene sentido como lista"
    }
  ],
  "objectives": [
    {
      "type": "outcome",
      "code": "R1",
      "title": "Resultado / Outcome 1",
      "description": "...",
      "indicators": [
        {
          "name": "Nombre del indicador",
          "unitOfMeasure": "unidad de medida (number, %, person-hours, etc.)",
          "baseline": "valor base (ej: 0)",
          "target": "meta (ej: 59)",
          "dataSource": "fuente de datos",
          "reportingFreq": "frecuencia (quarterly, annually, etc.)",
          "responsibility": "responsable de medición"
        }
      ],
      "children": [
        {
          "type": "objective",
          "code": "OE1",
          "title": "Objetivo Específico 1",
          "description": "...",
          "indicators": [],
          "children": [
            {
              "type": "output",
              "code": "P1.1",
              "title": "Producto / Output 1.1",
              "description": "...",
              "indicators": [],
              "children": [
                {
                  "type": "activity",
                  "code": "A1.1a",
                  "title": "Actividad",
                  "description": "...",
                  "startDate": "YYYY-MM-DD o null",
                  "endDate": "YYYY-MM-DD o null",
                  "indicators": [],
                  "children": [
                    {
                      "type": "input",
                      "code": "I1.1a.1",
                      "title": "Insumo necesario",
                      "description": "..."
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ],
  "diagnostics": [
    {
      "type": "problem_statement|need|assumption|external_factor",
      "code": "PS1|N1|AS1|EF1",
      "title": "Título del elemento diagnóstico",
      "description": "descripción completa"
    }
  ],
  "budgetLines": [
    {
      "category": "personnel|fringe|travel|equipment|supplies|contractual|other_direct|indirect",
      "description": "string",
      "unit": "month|unit|trip|day|lump_sum|person|lot|etc.",
      "quantity": 1,
      "unitCost": 0,
      "total": 0,
      "narrative": "justificación del gasto",
      "fundSource": "federal|cost_share"
    }
  ],
  "risks": [
    {
      "title": "string",
      "description": "string",
      "level": "LOW|MEDIUM|HIGH|CRITICAL",
      "impact": "string",
      "mitigation": "string"
    }
  ],
  "milestones": [
    {
      "name": "string",
      "description": "string o null",
      "dueDate": "YYYY-MM-DD o null"
    }
  ],
  "confidence": {
    "project": "high|medium|low",
    "sow": "high|medium|low",
    "objectives": "high|medium|low",
    "budgetLines": "high|medium|low",
    "risks": "high|medium|low",
    "milestones": "high|medium|low"
  },
  "contentLocale": "es|pt|en"
}

REGLAS CRÍTICAS:

1. JERARQUÍA DEL MARCO LÓGICO (MUY IMPORTANTE — RESPETAR ESTE ORDEN):
   La cadena CORRECTA del marco lógico es (de arriba hacia abajo):
   
   PROJECT GOAL (PG) → Outcome (Resultado) → Objective Específico (OE) → Output (Producto) → Activity (Actividad) → Input (Insumo)
   
   - "project.goal" = el OBJETIVO GENERAL / PROJECT GOAL (un solo texto de alto nivel). Se creará automáticamente como nodo raíz.
   - "objectives[]" = empieza por los OUTCOMES (Resultados). Cada outcome contiene OEs como hijos.
   - CADA OE contiene outputs como hijos.
   - CADA output contiene activities como hijos.
   - CADA activity puede contener inputs como hijos.
   
   NUNCA invertir esta jerarquía. El OE NO es padre del outcome — al revés: outcome > OE.

2. DIAGNÓSTICOS SEPARADOS:
   Problem statements, necesidades, supuestos y factores externos van en el array "diagnostics" (separado de objectives).
   - "problem_statement" — enunciado del problema
   - "need" — necesidad identificada
   - "assumption" — supuesto crítico
   - "external_factor" — factor externo que influye
   Estos NO van dentro del árbol de objectives. Son elementos independientes.

3. INDICADORES SEPARADOS:
   - Cada indicador es un objeto independiente con: name, unitOfMeasure, baseline, target, dataSource, reportingFreq, responsibility.
   - NUNCA concatenar múltiples indicadores en un solo string.
   - Si hay 8 indicadores en un outcome, el array "indicators" debe tener 8 objetos.
   - Los indicadores pueden estar en CUALQUIER nivel (outcome, OE, output, activity).

4. ACTIVIDADES CON FECHAS:
   - Cada activity debe incluir startDate y endDate si están disponibles en el Activity Timeline o cronograma.
   - Las actividades DEBEN estar ubicadas bajo su output correspondiente en la jerarquía.

5. SOW COMO LISTAS:
   - Para secciones como "objectives" y "deliverables", usar el campo "items" (array de strings), NO un bloque de texto corrido.
   - Usar "content" solo para secciones narrativas (background, methodology).

6. PRESUPUESTO - COSTOS DE PERSONAL:
   - "unitCost" = el costo unitario que se CARGA AL PROYECTO.
   - NO poner el salario total/anual completo de la persona si solo dedica un % al proyecto.
   - "total" = quantity * unitCost (el costo real para el proyecto).

7. MILESTONES: Extraer hitos clave del proyecto (no actividades individuales).

8. CONFIANZA: high = datos explícitos encontrados, medium = inferido parcialmente, low = poca/ninguna info.

9. COMPLETITUD: TODA la información encontrada en el documento DEBE aparecer en ALGÚN lugar del JSON.
   - Si encuentras OEs → van como hijos de sus outcomes en objectives[].
   - Si encuentras actividades → van como hijos de sus outputs.
   - Si encuentras indicadores → van en el array indicators[] del nodo correspondiente.
   - Si encuentras supuestos → van en diagnostics[].
   - NUNCA omitir información que el documento contiene.

10. RECORDATORIO FINAL — TRANSCRIPCIÓN TEXTUAL:
    - Todos los campos "title", "description", "name", "narrative", "impact", "mitigation", "content", e "items[]" DEBEN contener texto COPIADO TEXTUALMENTE del documento.
    - NO inventes, NO parafrasees, NO traduzcas. COPIA tal cual está escrito en el documento original.
    - Si hay información en varios idiomas en el documento, respeta el idioma en el que aparece cada elemento.

11. OBJETIVO GENERAL (project.goal) — UBICACIÓN EN EL DOCUMENTO:
    - Busca explícitamente secciones o frases tituladas o equivalentes a: "Development Objective", "Objetivo de desarrollo", "Objetivo general", "Project goal", "Overall goal", "Objetivo del proyecto", "Finalidad".
    - project.goal debe ser UN solo enunciado de alto nivel copiado de ahí. Si hay varios párrafos, elige el que encabeza como objetivo general (no mezclar con resultados intermedios).

12. ACTIVIDADES DESDE PLANILLAS EXCEL / CRONOGRAMAS:
    - Si algún archivo es hoja de cálculo (.xlsx, .xls) o el texto incluye bloques "[Hoja: ...]" de Excel: identifica hojas cuyo nombre o encabezados sugieran actividades, cronograma, timeline, work plan, plan de trabajo, "Activities", "Actividades", "AWP", "Plan operativo".
    - Cada FILA de actividad con descripción fechada debe convertirse en un nodo type "activity" bajo el "output" / producto al que corresponda lógicamente; si no hay jerarquía clara, colócalas bajo el output más relacionado por tema o deja un output dedicado "Actividades del cronograma" con título copiado del documento.
    - Copia en "title" y "description" el texto de la fila (actividad, tarea, descripción); rellena startDate y endDate desde columnas de fecha si existen (formato YYYY-MM-DD).

13. PERSONAS CLAVE / EQUIPO (Word o PDF con sección explícita):
    - Busca secciones tituladas (o equivalentes): "Key personnel", "Personal clave", "Pessoas-chave", "Equipo del proyecto", "Project team", "Staff", "Consultores", "Roles y responsabilidades" cuando listan nombres y cargos.
    - Para cada persona o fila: añade a "sow" una entrada con sectionKey "partners" (o "target" si es más narrativo), con "items" como lista de strings en formato copiado literal, p.ej. "Nombre — Cargo — Organización" tal como en el documento.
    - NO omitas esta sección si existe una tabla o lista clara de personas en el Word/PDF.

14. CONTEXTO Y SOW:
    - "project.description" debe sintetizar en 1-2 oraciones el contexto del proyecto (beneficiarios, región, problema) SOLO con texto presente en el documento (copia/adjunta frases cortas verbales del origen).
    - En "sow", la sección "background" debe reflejar el contexto inicial del documento; "methodology" el cómo; no dejes sow vacío si el documento tiene apartados equivalentes.

15. IDIOMA ÚNICO EN LA SALIDA:
    - Ver instrucción de idioma del mensaje del usuario (bloque IDIOMA DEL CONTENIDO).
    - Incluye siempre "contentLocale" con el código del idioma usado en los textos extraídos.

Responde SOLO el JSON, nada más.`;

function buildExtractionPrompt(sourceLanguage: ContentLocale): string {
  return `${EXTRACTION_PROMPT}\n\n${buildSourceLanguageInstruction(sourceLanguage)}`;
}

export async function POST(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const formData = await req.formData();
    const files = formData.getAll('files') as File[];
    const rawLang = String(formData.get('sourceLanguage') || 'auto').trim();
    const sourceLanguage: ContentLocale =
      rawLang === 'es' || rawLang === 'pt' || rawLang === 'en' ? rawLang : 'auto';

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No se recibieron archivos' }, { status: 400 });
    }

    const namesLower = files.map((f) => f.name.toLowerCase());
    const hasExcel = namesLower.some((n) => /\.(xlsx|xls|ods)$/.test(n));
    const hasWord = namesLower.some((n) => n.endsWith('.docx'));
    const hintParts: string[] = [];
    if (hasExcel) {
      hintParts.push(
        'Hay archivo(s) Excel: recorre cada hoja y fila de cronograma/actividades y vuelca las actividades en el árbol objectives (type activity) con fechas si existen.'
      );
    }
    if (hasWord) {
      hintParts.push(
        'Hay Word: respeta títulos de sección (p. ej. personas clave, equipo) para ubicar bloques en sow[] y project.goal.'
      );
    }

    // Build messages array with file contents
    const userContent: any[] = [
      {
        type: 'text',
        text: `Analiza los siguientes ${files.length} documento(s) de un proyecto de cooperaci\u00f3n y extrae la informaci\u00f3n estructurada seg\u00fan las instrucciones del sistema.

Archivos recibidos: ${files.map((f) => f.name).join(', ')}
${hintParts.length ? `\nInstrucciones adicionales:\n- ${hintParts.join('\n- ')}` : ''}`,
      },
    ];

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const mimeType = file.type || 'application/octet-stream';
      const name = file.name.toLowerCase();

      try {
        if (mimeType === 'application/pdf' || name.endsWith('.pdf')) {
          // PDF: send as base64 file (LLM API supports PDF natively)
          const base64 = buffer.toString('base64');
          userContent.push({
            type: 'file',
            file: { filename: file.name, file_data: `data:application/pdf;base64,${base64}` },
          });
        } else if (name.endsWith('.docx') || mimeType.includes('wordprocessingml')) {
          // DOCX: extract text with mammoth
          const result = await mammoth.extractRawText({ buffer });
          const text = result.value || '';
          userContent.push({ type: 'text', text: `--- Archivo: ${file.name} (Word) ---\n${text}\n--- Fin archivo ---` });
        } else if (name.endsWith('.xlsx') || name.endsWith('.xls') || mimeType.includes('spreadsheetml') || mimeType.includes('ms-excel')) {
          // Excel: extract data with xlsx
          const workbook = XLSX.read(buffer, { type: 'buffer' });
          let allText = '';
          for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];
            const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
            allText += `[Hoja: ${sheetName}]\n${csv}\n\n`;
          }
          userContent.push({ type: 'text', text: `--- Archivo: ${file.name} (Excel) ---\n${allText}\n--- Fin archivo ---` });
        } else if (mimeType.includes('text/') || name.endsWith('.csv') || name.endsWith('.txt')) {
          // Plain text / CSV
          const text = buffer.toString('utf-8');
          userContent.push({ type: 'text', text: `--- Archivo: ${file.name} ---\n${text}\n--- Fin archivo ---` });
        } else {
          // Unknown format: try as text fallback
          const text = buffer.toString('utf-8');
          userContent.push({ type: 'text', text: `--- Archivo: ${file.name} (formato desconocido) ---\n${text}\n--- Fin archivo ---` });
        }
      } catch (extractErr: any) {
        console.warn(`[Import] Could not extract text from ${file.name}:`, extractErr.message);
        userContent.push({ type: 'text', text: `--- Archivo: ${file.name} (no se pudo extraer contenido) ---\n[Error al procesar este archivo]\n--- Fin archivo ---` });
      }
    }

    console.log(`[Import] Analyzing ${files.length} files: ${files.map(f => `${f.name} (${(f.size / 1024).toFixed(1)}KB)`).join(', ')}`);

    let rawContent: string;
    try {
      rawContent = await callImportLlm(buildExtractionPrompt(sourceLanguage), userContent);
    } catch (llmErr: any) {
      console.error('[Import] LLM error:', llmErr);
      const detail = String(llmErr?.message || llmErr);
      const geminiModel = getGeminiImportModel();
      return NextResponse.json(
        {
          error:
            'Não foi possível processar os documentos com IA (Google Gemini). Veja o detalhe abaixo e confira GEMINI_API_KEY e GEMINI_MODEL no .env.',
          detail,
          geminiModel,
          hint:
            'Modelos obsoletos (gemini-1.5-*, gemini-2.0-*) já não funcionam. Use GEMINI_MODEL=gemini-2.5-flash ou gemini-2.5-flash-lite. A app tenta automaticamente gemini-3.5-flash e gemini-2.5-pro se houver 503. Reinicie o servidor após alterar o .env.',
          modelsTried: getGeminiModelCandidates(),
        },
        { status: 502 }
      );
    }

    // Parse JSON (Gemini pode envolver em markdown ou texto extra; JSON mode ajuda mas não garante 100 %)
    let extracted!: ImportExtractedPayload;
    try {
      const trimmed = rawContent.trim();
      const candidates = [trimmed];
      const balanced = extractFirstJsonObject(rawContent);
      if (balanced && !candidates.includes(balanced)) candidates.push(balanced);

      let lastErr: unknown;
      for (const jsonStr of candidates) {
        try {
          extracted = JSON.parse(jsonStr) as ImportExtractedPayload;
          lastErr = undefined;
          break;
        } catch (e) {
          lastErr = e;
        }
      }
      if (lastErr !== undefined) throw lastErr;
    } catch (parseErr) {
      console.error('[Import] JSON parse error:', parseErr, '\nRaw (800):', rawContent.substring(0, 800));
      return NextResponse.json(
        {
          error:
            'La respuesta de la IA no era JSON válido (a veces por límite de tokens o texto extra). Pruebe con menos archivos a la vez o aumente GEMINI_MAX_OUTPUT_TOKENS en el servidor.',
          detail: String((parseErr as Error)?.message || parseErr),
          rawPreview: rawContent.substring(0, 400),
        },
        { status: 422 }
      );
    }

    // Validate minimum structure
    if (!extracted.project) {
      extracted.project = { name: '', description: '', goal: '', donorName: '', country: '', region: '', currency: 'USD', budget: 0, startDate: null, endDate: null };
    }
    if (!extracted.project.goal) extracted.project.goal = '';
    if (!extracted.sow) extracted.sow = [];
    if (!extracted.objectives) extracted.objectives = [];
    if (!extracted.budgetLines) extracted.budgetLines = [];
    if (!extracted.risks) extracted.risks = [];
    if (!extracted.milestones) extracted.milestones = [];
    if (!extracted.confidence) extracted.confidence = { project: 'low', sow: 'low', objectives: 'low', budgetLines: 'low', risks: 'low', milestones: 'low' };
    if (!extracted.diagnostics) extracted.diagnostics = [];

    const fromLogframe = collectActivitiesFromObjectives(extracted.objectives as never[]);
    if (fromLogframe.length > 0) {
      (extracted as ImportExtractedPayload & { activities?: unknown[] }).activities = fromLogframe;
    }

    console.log(`[Import] Extraction complete. Project: "${extracted.project.name}", Objectives: ${extracted.objectives.length}, Diagnostics: ${extracted.diagnostics.length}, Budget lines: ${extracted.budgetLines.length}, Risks: ${extracted.risks.length}, Milestones: ${extracted.milestones.length}, Activities: ${fromLogframe.length}`);

    return NextResponse.json({ extracted, filesProcessed: files.map(f => f.name) });
  } catch (error: any) {
    console.error('[Import] Analyze error:', error);
    return NextResponse.json({ error: 'Error interno al procesar archivos' }, { status: 500 });
  }
}
