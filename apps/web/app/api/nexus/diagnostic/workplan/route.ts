export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getUserCompanyIds } from '@/lib/tenant';
import { normalizeIncubationProgram, type IncubationProgram } from '@/lib/nexus-incubation-program';
import { computeFullDiagnosticResult, listDiagnosticQuestions } from '@/lib/nexus-sector-diagnostic';
import { buildIncubationWorkPlan } from '@/lib/nexus-incubation-workplan';

export async function POST(req: NextRequest) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });
  }

  const sectorId = String(body.sectorId || '').trim();
  const program = normalizeIncubationProgram(body.program as Partial<IncubationProgram>);
  const answerIds =
    body.answerIds && typeof body.answerIds === 'object' ? (body.answerIds as Record<string, string>) : {};
  const localeRaw = String(body.locale || 'es').trim();
  const locale = localeRaw === 'pt' || localeRaw === 'en' ? localeRaw : 'es';

  const questions = listDiagnosticQuestions(sectorId, program);
  const diagnostic = computeFullDiagnosticResult(sectorId, questions, answerIds, locale);
  const plan = buildIncubationWorkPlan(program, diagnostic, locale);

  return NextResponse.json({ ok: true, diagnostic, ...plan, program });
}
