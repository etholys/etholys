export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getUserCompanyIds } from '@/lib/tenant';
import { analyzeSectorDiagnostic, type DiagnosticAnalyzeInput } from '@/lib/nexus-diagnostic-analyze';
import { normalizeEconomicSectorId } from '@/lib/nexus-economic-sectors';
import type { IncubationProgram } from '@/lib/nexus-incubation-program';

export async function POST(req: NextRequest) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });
  }

  const sectorId = normalizeEconomicSectorId(String(body.sectorId || ''));
  if (!sectorId) {
    return NextResponse.json({ error: 'Setor económico inválido.' }, { status: 400 });
  }

  const localeRaw = String(body.locale || 'es').trim();
  const locale = localeRaw === 'pt' || localeRaw === 'en' ? localeRaw : 'es';

  const answersRaw = body.answers;
  if (!Array.isArray(answersRaw) || answersRaw.length === 0) {
    return NextResponse.json({ error: 'Respostas em falta.' }, { status: 400 });
  }

  const answers = answersRaw
    .map((row) => {
      const r = row as Record<string, unknown>;
      return {
        id: String(r.id || ''),
        question: String(r.question || ''),
        answer: String(r.answer || ''),
        score: typeof r.score === 'number' ? r.score : undefined,
      };
    })
    .filter((r) => r.id && r.question && r.answer);

  const input: DiagnosticAnalyzeInput = {
    sectorId,
    locale,
    answers,
    finalize: body.finalize === true,
    program: body.program ? (body.program as IncubationProgram) : null,
    answerIds:
      body.answerIds && typeof body.answerIds === 'object'
        ? (body.answerIds as Record<string, string>)
        : undefined,
  };

  const result = await analyzeSectorDiagnostic(input);
  return NextResponse.json({ ok: true, ...result });
}
