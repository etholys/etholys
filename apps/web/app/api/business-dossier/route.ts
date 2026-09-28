export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getUserCompanyIds } from '@/lib/tenant';
import { canAccessNexusOpsCompany } from '@/lib/nexus-ops';
import { draftPortraitFromInterview, hydrateDossierFromNexus, hydrateDossiersForCompanies, loadDossier, upsertDossier } from '@/lib/business-dossier';

async function companyOk(req: NextRequest, companyId: string, engagementId?: string | null) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return { tenant: null as const, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!companyId) return { tenant, error: NextResponse.json({ error: 'companyId obrigatório.' }, { status: 400 }) };
  if (!(await canAccessNexusOpsCompany(tenant.companyIds, companyId, engagementId))) {
    return { tenant, error: NextResponse.json({ error: 'Empresa inválida.' }, { status: 403 }) };
  }
  return { tenant, error: null };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const companyId = String(url.searchParams.get('companyId') || '').trim();
  const engagementId = String(url.searchParams.get('engagementId') || '').trim() || null;
  const gate = await companyOk(req, companyId, engagementId);
  if (gate.error) return gate.error;
  const data = await loadDossier(companyId);
  if (url.searchParams.get('hydrateAll') === '1') {
    const n = await hydrateDossiersForCompanies(gate.tenant!.companyIds, gate.tenant!.userId);
    const fresh = await loadDossier(companyId);
    return NextResponse.json({ ...fresh, hydrated: n });
  }
  if (!data.dossier?.portraitText) {
    await hydrateDossierFromNexus(companyId, gate.tenant!.userId);
    return NextResponse.json(await loadDossier(companyId));
  }
  return NextResponse.json(data);
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
  const gate = await companyOk(req, companyId, engagementId);
  if (gate.error || !gate.tenant) return gate.error;

  if (body.fromInterview && body.interview && typeof body.interview === 'object') {
    const locale = body.locale === 'es' || body.locale === 'en' ? body.locale : 'pt';
    const draft = draftPortraitFromInterview(body.interview as Record<string, string>, locale);
    const dossier = await upsertDossier(companyId, gate.tenant.userId, {
      ...draft,
      interviewJson: body.interview as Record<string, string>,
      hypothesisAccepted: false,
    });
    return NextResponse.json({ ok: true, dossier, draft });
  }

  const dossier = await upsertDossier(companyId, gate.tenant.userId, {
    portraitText: body.portraitText != null ? String(body.portraitText) : undefined,
    hypothesis: body.hypothesis != null ? String(body.hypothesis) : undefined,
    hypothesisAccepted: typeof body.hypothesisAccepted === 'boolean' ? body.hypothesisAccepted : undefined,
    gaps: Array.isArray(body.gaps) ? (body.gaps as { text: string; evidence?: string }[]) : undefined,
    potentials: Array.isArray(body.potentials)
      ? (body.potentials as { text: string; evidence?: string }[])
      : undefined,
    pulsoModule: body.pulsoModule === null ? null : body.pulsoModule != null ? String(body.pulsoModule) : undefined,
  });
  return NextResponse.json({ ok: true, dossier });
}
