/**
 * Vínculos persistentes documento ↔ sistemas Etholys (Studio + Core Docs).
 * Spec: criação nunca “solta” — AT, SIEP, propostas, etc.
 */
import { prisma } from '@/lib/prisma';
import {
  DOC_LINK_SYSTEMS,
  isDocLinkEntityType,
  isDocLinkSystemKey,
  type DocLinkEntityType,
  type DocLinkSystemKey,
  type DocLinkTargetType,
} from '@/lib/document-links-shared';

export type { DocLinkEntityType, DocLinkSystemKey, DocLinkTargetType };
export { DOC_LINK_SYSTEMS, isDocLinkEntityType, isDocLinkSystemKey };

export type DocLinkInput = {
  systemKey: DocLinkSystemKey | string;
  entityType: DocLinkEntityType | string;
  entityId: string;
  label?: string | null;
  meta?: Record<string, unknown> | null;
};

export function serializeDocLink(row: {
  id: string;
  targetType: string;
  studioDocumentId: string | null;
  coreDocumentId: string | null;
  companyId: string;
  systemKey: string;
  entityType: string;
  entityId: string;
  label: string | null;
  meta: unknown;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    targetType: row.targetType,
    studioDocumentId: row.studioDocumentId,
    coreDocumentId: row.coreDocumentId,
    companyId: row.companyId,
    systemKey: row.systemKey,
    entityType: row.entityType,
    entityId: row.entityId,
    label: row.label,
    meta: row.meta,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listDocumentLinks(opts: {
  targetType: DocLinkTargetType;
  studioDocumentId?: string | null;
  coreDocumentId?: string | null;
}) {
  const where =
    opts.targetType === 'studio'
      ? { targetType: 'studio' as const, studioDocumentId: opts.studioDocumentId || undefined }
      : { targetType: 'core' as const, coreDocumentId: opts.coreDocumentId || undefined };
  const rows = await prisma.etholysDocumentLink.findMany({
    where,
    orderBy: [{ systemKey: 'asc' }, { createdAt: 'asc' }],
  });
  return rows.map(serializeDocLink);
}

export async function createDocumentLink(opts: {
  targetType: DocLinkTargetType;
  companyId: string;
  studioDocumentId?: string | null;
  coreDocumentId?: string | null;
  userId?: string | null;
  link: DocLinkInput;
}) {
  const systemKey = String(opts.link.systemKey || '').toUpperCase();
  const entityType = String(opts.link.entityType || '').toLowerCase();
  const entityId = String(opts.link.entityId || '').trim();
  if (!isDocLinkSystemKey(systemKey)) throw new Error('systemKey inválido');
  if (!isDocLinkEntityType(entityType)) throw new Error('entityType inválido');
  if (!entityId) throw new Error('entityId obrigatório');

  if (opts.targetType === 'studio' && !opts.studioDocumentId) {
    throw new Error('studioDocumentId obrigatório');
  }
  if (opts.targetType === 'core' && !opts.coreDocumentId) {
    throw new Error('coreDocumentId obrigatório');
  }

  let label = (opts.link.label || '').trim() || null;
  if (!label) {
    label = await resolveEntityLabel(systemKey, entityType, entityId, opts.companyId);
  }

  const existing = await prisma.etholysDocumentLink.findFirst({
    where: {
      targetType: opts.targetType,
      studioDocumentId: opts.studioDocumentId || null,
      coreDocumentId: opts.coreDocumentId || null,
      systemKey,
      entityType,
      entityId,
    },
  });
  if (existing) {
    const updated = await prisma.etholysDocumentLink.update({
      where: { id: existing.id },
      data: {
        label,
        meta: opts.link.meta ?? undefined,
      },
    });
    return serializeDocLink(updated);
  }

  const created = await prisma.etholysDocumentLink.create({
    data: {
      targetType: opts.targetType,
      companyId: opts.companyId,
      studioDocumentId: opts.studioDocumentId || null,
      coreDocumentId: opts.coreDocumentId || null,
      systemKey,
      entityType,
      entityId,
      label,
      meta: opts.link.meta ?? undefined,
      createdById: opts.userId || null,
    },
  });
  return serializeDocLink(created);
}

export async function deleteDocumentLink(id: string, companyIds: string[]) {
  const row = await prisma.etholysDocumentLink.findUnique({ where: { id } });
  if (!row || !companyIds.includes(row.companyId)) return false;
  await prisma.etholysDocumentLink.delete({ where: { id } });
  return true;
}

async function resolveEntityLabel(
  systemKey: DocLinkSystemKey,
  entityType: DocLinkEntityType,
  entityId: string,
  companyId: string,
): Promise<string | null> {
  try {
    if (entityType === 'company') {
      const c = await prisma.company.findUnique({
        where: { id: entityId },
        select: { name: true, shortName: true },
      });
      return c?.shortName || c?.name || null;
    }
    if (systemKey === 'SIEP' && entityType === 'project') {
      const p = await prisma.project.findFirst({
        where: { id: entityId, companyId },
        select: { name: true },
      });
      return p?.name || null;
    }
    if (systemKey === 'SIEP' && entityType === 'report') {
      const r = await prisma.mEReport.findFirst({
        where: { id: entityId },
        select: { title: true },
      });
      return r?.title || null;
    }
    if (systemKey === 'FUNDHUB' && entityType === 'proposal') {
      const p = await prisma.proposal.findFirst({
        where: { id: entityId, companyId },
        select: { title: true },
      });
      return p?.title || null;
    }
    if (systemKey === 'NEXUS' && entityType === 'engagement') {
      const e = await prisma.nexusAtEngagement.findFirst({
        where: { id: entityId },
        select: { title: true },
      });
      return e?.title || null;
    }
    if (systemKey === 'NEXUS' && entityType === 'network') {
      const n = await prisma.nexusNetwork.findFirst({
        where: { id: entityId },
        select: { name: true },
      });
      return n?.name || null;
    }
    if (systemKey === 'FORGE' && entityType === 'course') {
      const c = await prisma.forgeCourse.findFirst({
        where: { id: entityId, companyId },
        select: { title: true },
      });
      return c?.title || null;
    }
    if (systemKey === 'MEET' && entityType === 'meet_session') {
      const m = await prisma.meetSession.findFirst({
        where: { id: entityId, companyId },
        select: { title: true },
      });
      return m?.title || null;
    }
  } catch {
    /* label opcional */
  }
  return null;
}

export type DocLinkOption = {
  entityType: DocLinkEntityType;
  entityId: string;
  label: string;
  hint?: string;
};

/** Lista entidades linkáveis por sistema (para o picker). */
export async function listDocLinkOptions(opts: {
  systemKey: DocLinkSystemKey;
  companyId: string;
  companyIds: string[];
}): Promise<DocLinkOption[]> {
  const { systemKey, companyId, companyIds } = opts;
  const out: DocLinkOption[] = [];

  if (systemKey === 'CORE' || systemKey === 'ATLAS' || systemKey === 'NEXUS') {
    const companies = await prisma.company.findMany({
      where: { id: { in: companyIds } },
      select: { id: true, name: true, shortName: true },
      orderBy: { name: 'asc' },
      take: 80,
    });
    for (const c of companies) {
      out.push({
        entityType: 'company',
        entityId: c.id,
        label: c.shortName || c.name,
        hint: systemKey === 'NEXUS' ? 'Empresa (Nexus / AT)' : 'Empresa',
      });
    }
  }

  if (systemKey === 'NEXUS') {
    try {
      const engagements = await prisma.nexusAtEngagement.findMany({
        where: {
          isActive: true,
          OR: [
            { operatorCompanyId: { in: companyIds } },
            { members: { some: { companyId: { in: companyIds } } } },
          ],
        },
        select: { id: true, title: true, kind: true, status: true },
        orderBy: { updatedAt: 'desc' },
        take: 40,
      });
      for (const e of engagements) {
        out.push({
          entityType: 'engagement',
          entityId: e.id,
          label: e.title,
          hint: `AT · ${e.kind} · ${e.status}`,
        });
      }
      const networks = await prisma.nexusNetwork.findMany({
        where: {
          OR: [
            { anchorCompanyId: { in: companyIds } },
            { members: { some: { companyId: { in: companyIds } } } },
          ],
        },
        select: { id: true, name: true },
        orderBy: { updatedAt: 'desc' },
        take: 20,
      });
      for (const n of networks) {
        out.push({
          entityType: 'network',
          entityId: n.id,
          label: n.name,
          hint: 'Rede Nexus',
        });
      }
    } catch {
      /* nexus models may vary */
    }
  }

  if (systemKey === 'SIEP') {
    const projects = await prisma.project.findMany({
      where: { companyId },
      select: { id: true, name: true, status: true },
      orderBy: { updatedAt: 'desc' },
      take: 40,
    });
    for (const p of projects) {
      out.push({
        entityType: 'project',
        entityId: p.id,
        label: p.name,
        hint: p.status || 'SIEP',
      });
    }
  }

  if (systemKey === 'FUNDHUB') {
    const proposals = await prisma.proposal.findMany({
      where: { companyId },
      select: { id: true, title: true, status: true },
      orderBy: { updatedAt: 'desc' },
      take: 40,
    });
    for (const p of proposals) {
      out.push({
        entityType: 'proposal',
        entityId: p.id,
        label: p.title,
        hint: p.status || 'FUNDHUB',
      });
    }
  }

  if (systemKey === 'FORGE') {
    try {
      const courses = await prisma.forgeCourse.findMany({
        where: { companyId },
        select: { id: true, title: true, status: true },
        orderBy: { updatedAt: 'desc' },
        take: 40,
      });
      for (const c of courses) {
        out.push({
          entityType: 'course',
          entityId: c.id,
          label: c.title,
          hint: c.status || 'FORGE',
        });
      }
    } catch {
      /* */
    }
  }

  if (systemKey === 'MEET') {
    try {
      const meets = await prisma.meetSession.findMany({
        where: { companyId },
        select: { id: true, title: true, status: true },
        orderBy: { updatedAt: 'desc' },
        take: 30,
      });
      for (const m of meets) {
        out.push({
          entityType: 'meet_session',
          entityId: m.id,
          label: m.title || m.id,
          hint: m.status || 'Meet',
        });
      }
    } catch {
      /* */
    }
  }

  return out;
}

/**
 * Contexto dos vínculos para a IA — tratado como escolhido pelo utilizador
 * (sem pedirem consentimento de catálogo genérico).
 */
export async function loadDocumentLinksContext(opts: {
  targetType: DocLinkTargetType;
  studioDocumentId?: string | null;
  coreDocumentId?: string | null;
}): Promise<string> {
  const links = await listDocumentLinks(opts);
  if (!links.length) return '';

  const parts: string[] = [
    'Vínculos persistentes deste documento (escolhidos pelo utilizador — usar como contexto):',
  ];

  for (const link of links) {
    parts.push(
      `- ${link.systemKey}/${link.entityType} «${link.label || link.entityId}» (id=${link.entityId})`,
    );
    try {
      if (link.entityType === 'company') {
        const c = await prisma.company.findUnique({
          where: { id: link.entityId },
          select: {
            name: true,
            shortName: true,
            currency: true,
            description: true,
            businessActivity: true,
            incorporationCountry: true,
          },
        });
        if (c) parts.push(`  dados: ${JSON.stringify(c)}`);
      } else if (link.systemKey === 'NEXUS' && link.entityType === 'engagement') {
        const e = await prisma.nexusAtEngagement.findUnique({
          where: { id: link.entityId },
          select: {
            id: true,
            title: true,
            kind: true,
            status: true,
            description: true,
            contractRef: true,
            operatorCompanyId: true,
            members: { select: { companyId: true, memberRole: true }, take: 20 },
            projects: { select: { id: true, name: true, status: true }, take: 12 },
          },
        });
        if (e) parts.push(`  dados: ${JSON.stringify(e)}`);
      } else if (link.systemKey === 'SIEP' && link.entityType === 'project') {
        const p = await prisma.project.findUnique({
          where: { id: link.entityId },
          select: { id: true, name: true, status: true, description: true },
        });
        if (p) parts.push(`  dados: ${JSON.stringify(p)}`);
      } else if (link.systemKey === 'FUNDHUB' && link.entityType === 'proposal') {
        const p = await prisma.proposal.findUnique({
          where: { id: link.entityId },
          select: { id: true, title: true, status: true },
        });
        if (p) parts.push(`  dados: ${JSON.stringify(p)}`);
      } else if (link.systemKey === 'FORGE' && link.entityType === 'course') {
        const c = await prisma.forgeCourse.findUnique({
          where: { id: link.entityId },
          select: { id: true, title: true, status: true },
        });
        if (c) parts.push(`  dados: ${JSON.stringify(c)}`);
      } else if (link.systemKey === 'MEET' && link.entityType === 'meet_session') {
        const m = await prisma.meetSession.findUnique({
          where: { id: link.entityId },
          select: { id: true, title: true, status: true, summaryText: true },
        });
        if (m) {
          parts.push(
            `  dados: ${JSON.stringify({
              ...m,
              summaryText: m.summaryText ? String(m.summaryText).slice(0, 600) : null,
            })}`,
          );
        }
      }
    } catch {
      parts.push('  (detalhe indisponível)');
    }
  }

  return parts.join('\n');
}
