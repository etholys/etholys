export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { loadEngagementForTenant, userIsOperator } from '@/lib/nexus-at';
import { emptyContextSetup } from '@/lib/company-context-setup';
import { parseBulkMipymeText } from '@/lib/nexus-at-bulk-import';
import { parseEngagementSectorIds } from '@/lib/nexus-economic-sectors';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const engagement = await loadEngagementForTenant(id, tenant.companyIds);
  if (!engagement) return NextResponse.json({ error: 'Contrato não encontrado.' }, { status: 404 });
  if (!userIsOperator(engagement, tenant.companyIds)) {
    return NextResponse.json({ error: 'Só o operador pode importar empresas.' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });
  }

  const text = String(body.text || body.csv || '').trim();
  if (text.length < 2) {
    return NextResponse.json({ error: 'Cole ou carregue a lista de MIPYMEs.' }, { status: 400 });
  }

  const sectorIds = parseEngagementSectorIds(engagement.sectorIds);
  const defaultSector = engagement.primarySectorId || sectorIds[0] || null;
  const parsed = parseBulkMipymeText(text, defaultSector);

  if (parsed.rows.length === 0) {
    return NextResponse.json(
      { error: 'Nenhuma empresa válida na lista.', errors: parsed.errors },
      { status: 400 }
    );
  }
  if (parsed.rows.length > 200) {
    return NextResponse.json({ error: 'Máximo 200 empresas por importação.' }, { status: 400 });
  }

  const existingMemberIds = new Set(engagement.members.map((m) => m.companyId));
  let maxSort = engagement.members.reduce((acc, m) => Math.max(acc, m.sortOrder), 0);

  const created: string[] = [];
  const linked: string[] = [];
  let skippedCount = parsed.skipped;
  let imported = 0;

  for (const row of parsed.rows) {
    const match = await prisma.company.findFirst({
      where: {
        isActive: true,
        OR: [
          { name: { equals: row.name, mode: 'insensitive' } },
          { shortName: { equals: row.shortName || '', mode: 'insensitive' } },
        ],
      },
      select: { id: true, name: true },
    });

    let companyId = match?.id;
    if (!companyId) {
      const company = await prisma.company.create({
        data: {
          name: row.name,
          shortName: row.shortName || row.name.slice(0, 12),
          color: '#6366F1',
          ...(row.sectorId
            ? { contextSetupJson: { ...emptyContextSetup(), sectorId: row.sectorId } }
            : {}),
        },
        select: { id: true },
      });
      companyId = company.id;
      created.push(companyId);
    } else {
      linked.push(companyId);
    }

    if (
      companyId === engagement.operatorCompanyId ||
      companyId === engagement.sponsorCompanyId ||
      existingMemberIds.has(companyId)
    ) {
      skippedCount += 1;
      continue;
    }

    maxSort += 1;
    await prisma.nexusAtEngagementMember.create({
      data: {
        engagementId: engagement.id,
        companyId,
        memberRole: 'client',
        sortOrder: maxSort,
      },
    });
    existingMemberIds.add(companyId);
    imported += 1;
  }

  await prisma.nexusAtEngagement.update({
    where: { id: engagement.id },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json({
    ok: true,
    imported,
    createdCount: created.length,
    linkedCount: linked.length,
    skippedCount,
    parseErrors: parsed.errors,
    totalRows: parsed.rows.length,
  });
}
