import 'server-only';

import { getForgeDb } from '@/lib/forge/db';
import { getForgeFacilitatorUserIdsForCourse } from '@/lib/forge/facilitator-access';
import { getCourseProgressPercent } from '@/lib/forge/progress';

export type EditionStatus = 'preparation' | 'running' | 'finished' | 'archived';

export type EditionAttentionItem = {
  id: string;
  editionId: string;
  editionName: string;
  kind: 'no_groups' | 'empty_group' | 'starts_soon' | 'at_risk';
  label: string;
  href?: string;
};

export type EditionSummary = {
  id: string;
  name: string;
  status: EditionStatus;
  effectiveStatus: EditionStatus;
  startsAt: string | null;
  endsAt: string | null;
  groupCount: number;
  learnerCount: number;
  emptyGroupCount: number;
  atRiskCount: number;
  attentionCount: number;
  createdAt: string;
};

function parseStatus(raw: string): EditionStatus {
  if (raw === 'running' || raw === 'finished' || raw === 'archived') return raw;
  return 'preparation';
}

/** Status shown on cards — respects manual status unless archived; auto-running from dates. */
export function effectiveEditionStatus(
  status: string,
  startsAt: Date | null,
  endsAt: Date | null
): EditionStatus {
  const s = parseStatus(status);
  if (s === 'archived' || s === 'finished') return s;
  const now = Date.now();
  if (endsAt && endsAt.getTime() < now) return 'finished';
  if (startsAt && startsAt.getTime() <= now && (!endsAt || endsAt.getTime() >= now)) {
    return s === 'preparation' ? 'running' : s;
  }
  return s;
}

export async function listEditionSummaries(courseId: string): Promise<EditionSummary[]> {
  const db = getForgeDb();
  const editions = await db.forgeCourseEdition.findMany({
    where: { courseId },
    orderBy: [{ startsAt: 'desc' }, { createdAt: 'desc' }],
    include: {
      playGroups: {
        include: { _count: { select: { enrollments: true } } },
      },
    },
  });

  const course = await db.forgeCourse.findUnique({
    where: { id: courseId },
    select: { companyId: true, createdById: true },
  });
  const facilitatorIds = course
    ? await getForgeFacilitatorUserIdsForCourse(courseId, course.companyId, course.createdById)
    : new Set<string>();

  const summaries: EditionSummary[] = [];
  for (const ed of editions) {
    const groupIds = ed.playGroups.map((g) => g.id);
    const learnerCount = ed.playGroups.reduce((n, g) => n + g._count.enrollments, 0);
    const emptyGroupCount = ed.playGroups.filter((g) => g._count.enrollments === 0).length;

    let atRiskCount = 0;
    if (groupIds.length > 0) {
      const enrollments = await db.forgeEnrollment.findMany({
        where: {
          courseId,
          playGroupId: { in: groupIds },
          status: 'active',
        },
      });
      for (const e of enrollments) {
        if (facilitatorIds.has(e.userId)) continue;
        const pct = await getCourseProgressPercent(courseId, e.userId);
        const days = (Date.now() - e.enrolledAt.getTime()) / (1000 * 60 * 60 * 24);
        if (pct < 25 && days > 5) atRiskCount += 1;
      }
    }

    const effective = effectiveEditionStatus(ed.status, ed.startsAt, ed.endsAt);
    let attentionCount = emptyGroupCount;
    if (ed.playGroups.length === 0) attentionCount += 1;
    if (atRiskCount > 0) attentionCount += atRiskCount;
    if (
      effective === 'preparation' &&
      ed.startsAt &&
      ed.startsAt.getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000 &&
      ed.startsAt.getTime() > Date.now()
    ) {
      attentionCount += 1;
    }

    summaries.push({
      id: ed.id,
      name: ed.name,
      status: parseStatus(ed.status),
      effectiveStatus: effective,
      startsAt: ed.startsAt?.toISOString() ?? null,
      endsAt: ed.endsAt?.toISOString() ?? null,
      groupCount: ed.playGroups.length,
      learnerCount,
      emptyGroupCount,
      atRiskCount,
      attentionCount,
      createdAt: ed.createdAt.toISOString(),
    });
  }
  return summaries;
}

export async function collectEditionAttention(
  courseId: string,
  summaries: EditionSummary[]
): Promise<EditionAttentionItem[]> {
  const db = getForgeDb();
  const items: EditionAttentionItem[] = [];
  const now = Date.now();
  const week = 7 * 24 * 60 * 60 * 1000;

  for (const s of summaries) {
    if (s.effectiveStatus === 'archived' || s.effectiveStatus === 'finished') continue;
    const baseHref = `/hub/forge/cursos/${courseId}/turmas/${s.id}`;

    if (s.groupCount === 0) {
      items.push({
        id: `${s.id}-no-groups`,
        editionId: s.id,
        editionName: s.name,
        kind: 'no_groups',
        label: `${s.name}: criar empresas/grupos`,
        href: baseHref,
      });
    }

    if (s.startsAt) {
      const start = new Date(s.startsAt).getTime();
      if (s.effectiveStatus === 'preparation' && start > now && start - now < week) {
        const days = Math.ceil((start - now) / (24 * 60 * 60 * 1000));
        items.push({
          id: `${s.id}-starts-soon`,
          editionId: s.id,
          editionName: s.name,
          kind: 'starts_soon',
          label: `${s.name}: começa em ${days} dia(s)`,
          href: baseHref,
        });
      }
    }

    if (s.emptyGroupCount > 0) {
      const groups = await db.forgePlayGroup.findMany({
        where: { editionId: s.id },
        include: { _count: { select: { enrollments: true } } },
      });
      for (const g of groups) {
        if (g._count.enrollments === 0) {
          items.push({
            id: `${g.id}-empty`,
            editionId: s.id,
            editionName: s.name,
            kind: 'empty_group',
            label: `${s.name} · ${g.name}: sem participantes`,
            href: baseHref,
          });
        }
      }
    }

    if (s.atRiskCount > 0) {
      items.push({
        id: `${s.id}-at-risk`,
        editionId: s.id,
        editionName: s.name,
        kind: 'at_risk',
        label: `${s.name}: ${s.atRiskCount} aluno(s) em risco`,
        href: `${baseHref}#alunos`,
      });
    }
  }
  return items.slice(0, 12);
}
