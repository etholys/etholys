export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { isCompanyAdmin } from '@/lib/integrated-workspace';
import { isSystemAdmin } from '@/lib/platform-access';
import { isLikelyDbId } from '@/lib/utils';
import { buildExecutionPassport } from '@/lib/fundhub/build-execution-passport';

function asText(value: unknown, max: number): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function asList(value: unknown, maxItems = 20): string[] {
  const raw = Array.isArray(value)
    ? value.map((item) => String(item ?? ''))
    : String(value ?? '').split(/[,;\n]+/);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const next = item.trim().slice(0, 80);
    if (!next) continue;
    const key = next.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(next);
    if (out.length >= maxItems) break;
  }
  return out;
}

async function resolveEditor(companyIdRaw: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: NextResponse.json({ error: 'Não autorizado' }, { status: 401 }) };

  const tenant = await getUserCompanyIds();
  if (!tenant) return { error: NextResponse.json({ error: 'Não autorizado' }, { status: 401 }) };

  const companyId = companyIdRaw.trim();
  if (!isLikelyDbId(companyId)) {
    return { error: NextResponse.json({ error: 'Empresa inválida' }, { status: 400 }) };
  }

  const master = isSystemAdmin(session.user.email);
  if (!master && !tenant.companyIds.includes(companyId)) {
    return { error: NextResponse.json({ error: 'Empresa inválida' }, { status: 403 }) };
  }

  const exists = await prisma.company.findFirst({
    where: { id: companyId, isActive: true },
    select: { id: true },
  });
  if (!exists) return { error: NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 }) };

  const canEdit = master || (await isCompanyAdmin(tenant.userId, companyId));
  return { companyId, userId: tenant.userId, canEdit };
}

export async function GET(req: NextRequest) {
  const resolved = await resolveEditor(req.nextUrl.searchParams.get('companyId') ?? '');
  if ('error' in resolved) return resolved.error;
  return NextResponse.json({ companyId: resolved.companyId, canEdit: resolved.canEdit });
}

export async function PUT(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const resolved = await resolveEditor(String(body.companyId ?? ''));
  if ('error' in resolved) return resolved.error;
  if (!resolved.canEdit) {
    return NextResponse.json(
      { error: 'Sem permissão para editar o perfil desta empresa.' },
      { status: 403 },
    );
  }

  const name = asText(body.name, 160);
  const shortName = asText(body.shortName, 40) || name.slice(0, 40);
  if (!name) {
    return NextResponse.json({ error: 'O nome da organização é obrigatório.' }, { status: 400 });
  }

  const description = asText(body.description, 2000) || null;
  const sector = asText(body.sector, 120) || null;
  const country = asText(body.country, 80) || null;
  const currency = asText(body.currency, 8).toUpperCase() || 'USD';
  const themes = asList(body.themes);
  const countries = asList(body.countries);

  await prisma.$transaction([
    prisma.company.update({
      where: { id: resolved.companyId },
      data: {
        name,
        shortName,
        description,
        businessActivity: sector,
        incorporationCountry: country,
        currency,
      },
    }),
    prisma.fundingCaptureProfile.upsert({
      where: { companyId: resolved.companyId },
      create: {
        companyId: resolved.companyId,
        themesCsv: themes.join(', ') || null,
        countriesCsv: countries.join(', ') || null,
      },
      update: {
        themesCsv: themes.join(', ') || null,
        countriesCsv: countries.join(', ') || null,
      },
    }),
  ]);

  const passport = await buildExecutionPassport(resolved.companyId);
  return NextResponse.json({ ok: true, canEdit: true, ...passport });
}
