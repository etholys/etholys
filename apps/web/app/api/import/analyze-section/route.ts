export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getUserCompanyIds } from '@/lib/tenant';
import { geminiGenerateContent } from '@/lib/gemini-client';
import { extractFirstJsonObject } from '@/lib/extract-json-object';
import { buildImportSectionContent } from '@/lib/siep/import-file-parts';
import {
  buildSectionPrompt,
  type ImportSectionKey,
} from '@/lib/siep/import-section-prompts';
import { normalizeMilestonesPartial } from '@/lib/siep/import-activities';

const VALID_SECTIONS = new Set<ImportSectionKey>([
  'project',
  'sow',
  'objectives',
  'diagnostics',
  'budgetLines',
  'risks',
  'milestones',
]);

export async function POST(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const formData = await req.formData();
    const section = formData.get('section') as string;
    const contextRaw = formData.get('context') as string | null;
    const files = formData.getAll('files') as File[];

    if (!section || !VALID_SECTIONS.has(section as ImportSectionKey)) {
      return NextResponse.json({ error: 'section inválida' }, { status: 400 });
    }
    if (!files?.length) {
      return NextResponse.json({ error: 'Envie pelo menos um arquivo ou foto' }, { status: 400 });
    }

    const { userParts, fileNames } = await buildImportSectionContent(files);
    const systemPrompt = buildSectionPrompt(section as ImportSectionKey, contextRaw || undefined);

    let rawContent: string;
    try {
      const { text } = await geminiGenerateContent({
        systemInstruction: systemPrompt,
        userParts,
        temperature: 0.05,
        responseMimeType: 'application/json',
      });
      rawContent = text;
    } catch (llmErr: unknown) {
      const detail = llmErr instanceof Error ? llmErr.message : String(llmErr);
      return NextResponse.json(
        {
          error: 'Não foi possível re-analisar esta secção com IA.',
          detail,
        },
        { status: 502 },
      );
    }

    let partial: Record<string, unknown>;
    try {
      const jsonStr = extractFirstJsonObject(rawContent) || rawContent.trim();
      partial = JSON.parse(jsonStr) as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        {
          error: 'Resposta da IA não é JSON válido para esta secção.',
          rawPreview: rawContent.slice(0, 400),
        },
        { status: 422 },
      );
    }

    return NextResponse.json({
      section,
      partial: section === 'milestones' ? { ...partial, ...normalizeMilestonesPartial(partial) } : partial,
      filesProcessed: fileNames,
    });
  } catch (error: unknown) {
    console.error('[Import] analyze-section error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
