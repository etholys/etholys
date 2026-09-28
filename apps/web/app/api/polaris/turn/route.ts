export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getUserCompanyIds } from '@/lib/tenant';
import { canAccessNexusOpsCompany } from '@/lib/nexus-ops';
import { loadDossier } from '@/lib/business-dossier';
import { publicLlmErrorMessage } from '@/lib/llm-client';
import { materializePolarisSuggestions, runPolarisTurn } from '@/lib/polaris-turn';
import type { PolarisLocale } from '@/lib/polaris-map';

function localeOf(value: unknown): PolarisLocale {
  return value === 'es' || value === 'en' ? value : 'pt';
}

export async function POST(req: NextRequest) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });
  }

  const companyId = String(body.companyId || '').trim();
  const engagementId = String(body.engagementId || '').trim() || null;
  if (!companyId || !(await canAccessNexusOpsCompany(tenant.companyIds, companyId, engagementId))) {
    return NextResponse.json({ error: 'Empresa inválida.' }, { status: 403 });
  }

  if (body.materialize === true) {
    const data = await loadDossier(companyId);
    if (!data.dossier?.hypothesisAccepted) return NextResponse.json({ ok: true, created: 0 });
    const created = await materializePolarisSuggestions(companyId, data.dossier.interviewJson);
    return NextResponse.json({ ok: true, created, ...(await loadDossier(companyId)) });
  }

  const message = String(body.message || '').trim();
  if (!message) return NextResponse.json({ error: 'Escreve alguma coisa.' }, { status: 400 });

  try {
    const result = await runPolarisTurn({
      companyId,
      userId: tenant.userId,
      message,
      locale: localeOf(body.locale),
      screenPortrait: typeof body.portraitText === 'string' ? body.portraitText.slice(0, 8000) : undefined,
      screenHypothesis: typeof body.hypothesis === 'string' ? body.hypothesis.slice(0, 2000) : undefined,
    });
    return NextResponse.json(result);
  } catch (e) {
    console.error('[polaris] turn route', e);
    return NextResponse.json({ error: publicLlmErrorMessage(e) }, { status: 503 });
  }
}
