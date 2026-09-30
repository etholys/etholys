export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getUserCompanyIds } from '@/lib/tenant';
import type { AuroraLocale } from '@/lib/aurora-interview';
import {
  appendAuroraRouteChat,
  canAccessAuroraFlow,
  canMutateAuroraFlow,
  canViewAuroraAttended,
  loadAuroraFlowBundle,
  logAuroraRouteWeek,
  markAuroraFlowLive,
  proposeAuroraRoute,
  saveAuroraRadiographyDraft,
  systematizeAuroraRadiography,
  updateAuroraRouteBet,
  validateAuroraRadiography,
} from '@/lib/aurora-flow-turn';
import { attendedAuroraView, normalizeAuroraBetStatus } from '@/lib/aurora-flow';

function localeOf(value: unknown): AuroraLocale {
  return value === 'es' || value === 'en' ? value : 'pt';
}

async function mutateGate(companyId: string, engagementId: string | null) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return { tenant: null as const, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!companyId || !(await canMutateAuroraFlow(tenant.companyIds, companyId, engagementId))) {
    return { tenant, error: NextResponse.json({ error: 'Solo el técnico/incubadora puede editar.' }, { status: 403 }) };
  }
  return { tenant, error: null as NextResponse | null };
}

async function techGate(companyId: string, engagementId: string | null) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return { tenant: null as const, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  // Leitura completa do fluxo: operador AT (não basta ser o negócio atendido).
  if (!companyId || !(await canMutateAuroraFlow(tenant.companyIds, companyId, engagementId))) {
    if (!(await canAccessAuroraFlow(tenant.companyIds, companyId, engagementId))) {
      return { tenant, error: NextResponse.json({ error: 'Empresa inválida.' }, { status: 403 }) };
    }
    // Atendido pode só ver view=attended; fluxo técnico completo exige mutação/operador.
    return { tenant, error: NextResponse.json({ error: 'Usa la vista de avance.' }, { status: 403 }) };
  }
  return { tenant, error: null as NextResponse | null };
}

function publicBundle(bundle: Awaited<ReturnType<typeof loadAuroraFlowBundle>>) {
  return {
    ok: true,
    companyName: bundle.companyName,
    phase: bundle.phase,
    diagnostic: bundle.diagnostic,
    progress: bundle.progress,
    radiography: bundle.radiography,
    validation: bundle.validation,
    routeChat: bundle.routeChat,
    portraitText: bundle.dossier?.portraitText || '',
    hypothesis: bundle.dossier?.hypothesis || '',
    hypothesisAccepted: Boolean(bundle.dossier?.hypothesisAccepted),
    gaps: Array.isArray(bundle.dossier?.gapsJson) ? bundle.dossier?.gapsJson : [],
    potentials: Array.isArray(bundle.dossier?.potentialsJson) ? bundle.dossier?.potentialsJson : [],
    bets: bundle.bets,
    rhythm: bundle.rhythm,
  };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const companyId = String(url.searchParams.get('companyId') || '').trim();
  const engagementId = String(url.searchParams.get('engagementId') || '').trim() || null;
  const view = String(url.searchParams.get('view') || '').trim();
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (view === 'attended') {
    if (!companyId || !(await canViewAuroraAttended(tenant.userId, tenant.companyIds, companyId, engagementId))) {
      return NextResponse.json({ error: 'Empresa inválida.' }, { status: 403 });
    }
    const bundle = await loadAuroraFlowBundle(companyId);
    const last = bundle.rhythm[0];
    return NextResponse.json({
      ok: true,
      attended: attendedAuroraView({
        companyName: bundle.companyName,
        portraitText: bundle.dossier?.portraitText || '',
        hypothesis: bundle.dossier?.hypothesis || '',
        hypothesisAccepted: Boolean(bundle.dossier?.hypothesisAccepted),
        gaps: (Array.isArray(bundle.dossier?.gapsJson) ? bundle.dossier!.gapsJson : []) as Array<{ text: string }>,
        potentials: (Array.isArray(bundle.dossier?.potentialsJson)
          ? bundle.dossier!.potentialsJson
          : []) as Array<{ text: string }>,
        radiography: bundle.radiography,
        bets: bundle.bets.map((b) => ({
          id: b.id,
          title: b.title,
          status: b.status,
          why: b.why,
          indicator: b.indicator,
          dueAt: b.dueAt ? b.dueAt.toISOString() : null,
        })),
        phase: bundle.phase,
        lastRhythm: last
          ? {
              happened: last.happened,
              blocked: last.blocked,
              nextStep: last.nextStep,
              createdAt: last.createdAt.toISOString(),
            }
          : null,
      }),
    });
  }

  const g = await techGate(companyId, engagementId);
  if (g.error || !g.tenant) return g.error;
  const bundle = await loadAuroraFlowBundle(companyId);
  return NextResponse.json(publicBundle(bundle));
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
  const g = await mutateGate(companyId, engagementId);
  if (g.error || !g.tenant) return g.error;
  const locale = localeOf(body.locale);
  const action = String(body.action || '').trim();

  try {
    if (action === 'systematize') {
      const bundle = await systematizeAuroraRadiography({
        companyId,
        userId: g.tenant.userId,
        locale,
        bodyOverride: typeof body.body === 'string' ? body.body : undefined,
        hypothesisOverride: typeof body.hypothesis === 'string' ? body.hypothesis : undefined,
      });
      return NextResponse.json(publicBundle(bundle));
    }
    if (action === 'saveRadiography') {
      const bundle = await saveAuroraRadiographyDraft({
        companyId,
        userId: g.tenant.userId,
        locale,
        body: String(body.body || ''),
        hypothesis: String(body.hypothesis || ''),
      });
      return NextResponse.json(publicBundle(bundle));
    }
    if (action === 'validate') {
      const bundle = await validateAuroraRadiography({
        companyId,
        userId: g.tenant.userId,
        locale,
        accept: body.accept !== false,
        techNotes: typeof body.techNotes === 'string' ? body.techNotes : '',
      });
      return NextResponse.json(publicBundle(bundle));
    }
    if (action === 'proposeRoute') {
      const bundle = await proposeAuroraRoute({
        companyId,
        userId: g.tenant.userId,
        locale,
      });
      return NextResponse.json({ ...publicBundle(bundle), created: bundle.created });
    }
    if (action === 'routeChat') {
      const bundle = await appendAuroraRouteChat({
        companyId,
        userId: g.tenant.userId,
        locale,
        message: String(body.message || ''),
      });
      return NextResponse.json(publicBundle(bundle));
    }
    if (action === 'updateBet') {
      const status = normalizeAuroraBetStatus(body.status);
      const betId = String(body.betId || body.id || '').trim();
      if (!betId || !status) return NextResponse.json({ error: 'Estado inválido.' }, { status: 400 });
      const bundle = await updateAuroraRouteBet({
        companyId,
        userId: g.tenant.userId,
        betId,
        status,
      });
      return NextResponse.json(publicBundle(bundle));
    }
    if (action === 'logWeek') {
      const bundle = await logAuroraRouteWeek({
        companyId,
        userId: g.tenant.userId,
        happened: String(body.happened || ''),
        blocked: String(body.blocked || ''),
        nextStep: String(body.nextStep || ''),
      });
      return NextResponse.json(publicBundle(bundle));
    }
    if (action === 'markLive') {
      const bundle = await markAuroraFlowLive({ companyId, userId: g.tenant.userId });
      return NextResponse.json(publicBundle(bundle));
    }
    return NextResponse.json({ error: 'Acción inválida.' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 400 });
  }
}
