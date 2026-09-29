export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getUserCompanyIds } from '@/lib/tenant';
import { canAccessNexusOpsCompany } from '@/lib/nexus-ops';
import {
  confirmAuroraDiagBlock,
  loadAuroraDiagnostic,
  openAuroraDiagBlock,
  runAuroraDiagTurn,
} from '@/lib/aurora-diagnostic-turn';
import { AURORA_DIAG_BLOCKS, type AuroraDiagBlockId, type AuroraMaturity } from '@/lib/aurora-diagnostic';
import { publicLlmErrorMessage } from '@/lib/llm-client';
import type { AuroraLocale } from '@/lib/aurora-interview';

function localeOf(value: unknown): AuroraLocale {
  return value === 'es' || value === 'en' ? value : 'pt';
}

function blockOf(value: unknown): AuroraDiagBlockId | null {
  const id = String(value || '');
  return AURORA_DIAG_BLOCKS.some((b) => b.id === id) ? (id as AuroraDiagBlockId) : null;
}

function levelOf(value: unknown): AuroraMaturity | null {
  const n = Number(value);
  return n === 1 || n === 2 || n === 3 || n === 4 || n === 5 ? n : null;
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
  const g = await gate(companyId, engagementId);
  if (g.error || !g.tenant) return g.error;
  const data = await loadAuroraDiagnostic(companyId);
  return NextResponse.json({ ok: true, ...data });
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
  const locale = localeOf(body.locale);
  const blockId = blockOf(body.blockId);

  if (body.open === true) {
    if (!blockId) return NextResponse.json({ error: 'Bloco inválido.' }, { status: 400 });
    const result = await openAuroraDiagBlock({
      companyId,
      userId: g.tenant.userId,
      blockId,
      locale,
    });
    return NextResponse.json({ ok: true, ...result });
  }

  if (body.confirm === true) {
    if (!blockId) return NextResponse.json({ error: 'Bloco inválido.' }, { status: 400 });
    const level = levelOf(body.level);
    const situation = String(body.situation || '').trim();
    if (!level || situation.length < 12) {
      return NextResponse.json({ error: 'Confirma o nível e a situação real.' }, { status: 400 });
    }
    const result = await confirmAuroraDiagBlock({
      companyId,
      userId: g.tenant.userId,
      blockId,
      level,
      situation,
      gap: String(body.gap || '').trim(),
      potential: String(body.potential || '').trim(),
      locale,
      autoNext: body.autoNext !== false,
    });
    return NextResponse.json({ ok: true, ...result });
  }

  if (!blockId) return NextResponse.json({ error: 'Bloco inválido.' }, { status: 400 });
  const message = String(body.message || '').trim();
  if (!message) return NextResponse.json({ error: 'Conta o que se passa no negócio.' }, { status: 400 });

  try {
    const result = await runAuroraDiagTurn({
      companyId,
      userId: g.tenant.userId,
      blockId,
      message,
      locale,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error('[aurora-diag] route', e);
    return NextResponse.json({ error: publicLlmErrorMessage(e) }, { status: 503 });
  }
}
