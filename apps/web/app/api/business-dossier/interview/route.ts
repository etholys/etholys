export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getUserCompanyIds } from '@/lib/tenant';
import { canAccessNexusOpsCompany } from '@/lib/nexus-ops';
import { loadDossier } from '@/lib/business-dossier';
import { publicLlmErrorMessage } from '@/lib/llm-client';
import { applyAuroraDraft, materializeAuroraBets, runAuroraTurn } from '@/lib/aurora-turn';
import {
  auroraOpening,
  readAuroraDraft,
  readAuroraSuggestions,
  readAuroraTech,
  readAuroraThread,
  type AuroraLocale,
} from '@/lib/aurora-interview';
import { prisma } from '@/lib/prisma';

function localeOf(value: unknown): AuroraLocale {
  return value === 'es' || value === 'en' ? value : 'pt';
}

async function gate(companyId: string, engagementId: string | null) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return { tenant: null as const, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!companyId || !(await canAccessNexusOpsCompany(tenant.companyIds, companyId, engagementId))) {
    return { tenant, error: NextResponse.json({ error: 'Empresa inválida.' }, { status: 403 }) };
  }
  return { tenant, error: null as NextResponse | null };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const companyId = String(url.searchParams.get('companyId') || '').trim();
  const engagementId = String(url.searchParams.get('engagementId') || '').trim() || null;
  const locale = localeOf(url.searchParams.get('locale'));
  const g = await gate(companyId, engagementId);
  if (g.error || !g.tenant) return g.error;
  const [data, company] = await Promise.all([
    loadDossier(companyId),
    prisma.company.findUnique({ where: { id: companyId }, select: { name: true } }),
  ]);
  return NextResponse.json({
    ok: true,
    companyName: company?.name || '',
    messages: readAuroraThread(data.dossier?.interviewJson),
    opening: auroraOpening(locale),
    draft: readAuroraDraft(data.dossier?.interviewJson),
    suggestions: readAuroraSuggestions(data.dossier?.interviewJson),
    tech: readAuroraTech(data.dossier?.interviewJson),
    ...data,
  });
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });
  }
  const companyId = String(body.companyId || '').trim();
  const engagementId = String(body.engagementId || '').trim() || null;
  const g = await gate(companyId, engagementId);
  if (g.error || !g.tenant) return g.error;

  if (body.apply === true) {
    try {
      const data = await applyAuroraDraft({ companyId, userId: g.tenant.userId });
      return NextResponse.json({ ok: true, applied: true, ...data, draft: readAuroraDraft(data.dossier?.interviewJson) });
    } catch (e) {
      const msg = e instanceof Error && e.message === 'aurora:no-draft' ? 'Ainda não há rascunho para aplicar.' : 'Falha';
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }

  if (body.adoptBet && typeof body.adoptBet === 'object') {
    const data = await loadDossier(companyId);
    if (!data.dossier?.hypothesisAccepted) {
      return NextResponse.json({ error: 'Aceita a hipótese antes de abrir apostas.' }, { status: 400 });
    }
    const raw = body.adoptBet as { title?: unknown; why?: unknown; indicator?: unknown };
    const created = await materializeAuroraBets(companyId, [
      {
        title: String(raw.title || '').slice(0, 200),
        why: String(raw.why || '').slice(0, 800),
        indicator: String(raw.indicator || '').slice(0, 200),
      },
    ]);
    return NextResponse.json({ ok: true, created, ...(await loadDossier(companyId)) });
  }

  if (body.materialize === true) {
    const data = await loadDossier(companyId);
    if (!data.dossier?.hypothesisAccepted) return NextResponse.json({ ok: true, created: 0, ...data });
    const proposed = readAuroraSuggestions(data.dossier.interviewJson);
    const created = await materializeAuroraBets(companyId, proposed);
    return NextResponse.json({ ok: true, created, ...(await loadDossier(companyId)) });
  }

  const message = String(body.message || '').trim();
  if (!message) return NextResponse.json({ error: 'Cola o que ouviste.' }, { status: 400 });

  try {
    const result = await runAuroraTurn({
      companyId,
      userId: g.tenant.userId,
      message,
      locale: localeOf(body.locale),
      screenPortrait: typeof body.portraitText === 'string' ? body.portraitText.slice(0, 8000) : undefined,
      screenHypothesis: typeof body.hypothesis === 'string' ? body.hypothesis.slice(0, 2000) : undefined,
    });
    return NextResponse.json(result);
  } catch (e) {
    console.error('[aurora] interview route', e);
    return NextResponse.json({ error: publicLlmErrorMessage(e) }, { status: 503 });
  }
}
