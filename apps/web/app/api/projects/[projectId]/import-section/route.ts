export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { geminiGenerateContent } from '@/lib/gemini-client';
import { extractFirstJsonObject } from '@/lib/extract-json-object';
import { buildImportSectionContent } from '@/lib/siep/import-file-parts';
import { applyImportSectionToProject } from '@/lib/siep/apply-import-section';
import {
  buildSectionPrompt,
  type ImportSectionKey,
} from '@/lib/siep/import-section-prompts';

const VALID_SECTIONS = new Set<ImportSectionKey>([
  'budgetLines',
  'risks',
  'milestones',
  'sow',
  'objectives',
]);

export async function POST(req: Request, { params }: { params: { projectId: string } }) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const project = await prisma.project.findUnique({
      where: { id: params.projectId },
      select: { id: true, companyId: true },
    });
    if (!project || !tenant.companyIds.includes(project.companyId)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const formData = await req.formData();
    const section = formData.get('section') as ImportSectionKey;
    const mode = (formData.get('mode') as string) === 'append' ? 'append' : 'replace';
    const contextRaw = formData.get('context') as string | null;
    const files = formData.getAll('files') as File[];

    if (!section || !VALID_SECTIONS.has(section)) {
      return NextResponse.json(
        { error: 'Secção não suportada para projeto existente (use: budgetLines, risks, milestones, sow, objectives)' },
        { status: 400 },
      );
    }
    if (!files?.length) {
      return NextResponse.json({ error: 'Envie pelo menos um arquivo ou foto' }, { status: 400 });
    }

    const { userParts, fileNames } = await buildImportSectionContent(files);
    const systemPrompt = buildSectionPrompt(section, contextRaw || undefined);

    const { text } = await geminiGenerateContent({
      systemInstruction: systemPrompt,
      userParts,
      temperature: 0.05,
      responseMimeType: 'application/json',
    });

    const jsonStr = extractFirstJsonObject(text) || text.trim();
    const partial = JSON.parse(jsonStr) as Record<string, unknown>;

    const result = await applyImportSectionToProject(params.projectId, section, partial, mode);

    return NextResponse.json({
      section,
      mode,
      applied: result.applied,
      filesProcessed: fileNames,
      partial,
    });
  } catch (error: unknown) {
    console.error('[Import] project import-section error:', error);
    const msg = error instanceof Error ? error.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
