export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { loadNetworkForTenant } from '@/lib/nexus-network';
import { parseInternationalChecklist, type VentureStageId } from '@/lib/nexus-venture';
import {
  intlGapTemplates,
  journeyScopeTagPrefix,
  journeySlotTag,
  journeyIntlTag,
  pickLocalizedTemplate,
  templatesForStage,
} from '@/lib/nexus-journey-roadmap';

/**
 * Cria tarefas na rota viva (nexus:roadmap) a partir da fase actual da jornada
 * e, opcionalmente, gaps da checklist internacional — sem duplicar slots já existentes.
 */
export async function POST(req: NextRequest) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  const networkIdRaw = String(body.networkId || '').trim();
  const companyIdRaw = String(body.companyId || '').trim();
  const includeIntl = body.includeIntlGaps !== false;
  const maxIntl = Math.min(8, Math.max(0, Number(body.maxIntlGaps ?? 3) || 3));
  const localeRaw = String(body.locale || 'pt').toLowerCase();
  const locale = localeRaw.startsWith('es') ? 'es' : localeRaw.startsWith('en') ? 'en' : 'pt';

  let targetCompanyId: string;
  let projectId: string | null = null;
  let scopeKind: 'network' | 'company';
  let scopeId: string;
  let networkTag = '';

  if (networkIdRaw) {
    const network = await loadNetworkForTenant(networkIdRaw, tenant.companyIds);
    if (!network) return NextResponse.json({ error: 'Rede não encontrada.' }, { status: 404 });
    targetCompanyId = network.anchorCompanyId;
    projectId = network.siepProjectId ?? null;
    scopeKind = 'network';
    scopeId = network.id;
    networkTag = `,nexus:network:${network.id}`;
  } else {
    const companyId =
      companyIdRaw && tenant.companyIds.includes(companyIdRaw)
        ? companyIdRaw
        : tenant.companyIds[0] || null;
    if (!companyId) return NextResponse.json({ error: 'Sem empresa associada.' }, { status: 400 });
    targetCompanyId = companyId;
    scopeKind = 'company';
    scopeId = companyId;
  }

  const venture =
    scopeKind === 'network'
      ? await prisma.nexusVentureState.findUnique({ where: { networkId: scopeId } })
      : await prisma.nexusVentureState.findUnique({ where: { companyId: scopeId } });
  const stage = (venture?.stage as VentureStageId) || 'DISCOVER';
  const checklist = parseInternationalChecklist(venture?.internationalChecklist);

  const scopeTag = journeyScopeTagPrefix(scopeKind, scopeId);
  const baseTags = `nexus:roadmap,nexus:journey-derived,${scopeTag}${networkTag}`;

  const findExisting = async (extraContains: string) =>
    prisma.task.findFirst({
      where: {
        companyId: targetCompanyId,
        isActive: true,
        AND: [{ tags: { contains: extraContains } }, { tags: { contains: scopeTag } }],
      },
      select: { id: true },
    });

  const created: { id: string; title: string }[] = [];
  const skipped: string[] = [];

  const templates = templatesForStage(stage);
  for (const tmpl of templates) {
    const slotTag = journeySlotTag(tmpl.slotKey);
    const exists = await findExisting(slotTag);
    if (exists) {
      skipped.push(tmpl.slotKey);
      continue;
    }
    const { title, description } = pickLocalizedTemplate(tmpl, locale);
    const action = await prisma.task.create({
      data: {
        companyId: targetCompanyId,
        creatorId: tenant.userId,
        projectId: projectId || undefined,
        title: title.slice(0, 180),
        description: description.slice(0, 8000),
        priority: tmpl.priority,
        status: 'TODO',
        tags: `${baseTags},${slotTag}`,
        isActive: true,
      },
      select: { id: true, title: true },
    });
    created.push(action);
  }

  if (includeIntl && maxIntl > 0) {
    const gaps = intlGapTemplates(checklist, locale, maxIntl);
    for (const g of gaps) {
      const slotTag = journeyIntlTag(g.slotKey.replace(/^INTL-/, ''));
      const fullIntlSlot = `journey-slot:${g.slotKey}`;
      const exists = await findExisting(fullIntlSlot);
      if (exists) {
        skipped.push(g.slotKey);
        continue;
      }
      const action = await prisma.task.create({
        data: {
          companyId: targetCompanyId,
          creatorId: tenant.userId,
          projectId: projectId || undefined,
          title: g.title.slice(0, 180),
          description: g.description.slice(0, 8000),
          priority: g.priority,
          status: 'TODO',
          tags: `${baseTags},${fullIntlSlot},${slotTag}`,
          isActive: true,
        },
        select: { id: true, title: true },
      });
      created.push(action);
    }
  }

  return NextResponse.json({
    ok: true,
    stage,
    scope: scopeKind,
    created,
    skipped,
    counts: { created: created.length, skipped: skipped.length },
  });
}
