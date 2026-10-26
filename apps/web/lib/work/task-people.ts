import { prisma } from '@/lib/prisma';

export type TaskPersonRoleCode = 'EXECUTOR' | 'RESPONSIBLE' | 'REVIEWER';

export const TASK_PERSON_ROLES: TaskPersonRoleCode[] = ['EXECUTOR', 'RESPONSIBLE', 'REVIEWER'];

/** Chave em customFields — funciona em produção sem migração de coluna nova. */
export const ROLE_MEMBERS_CUSTOM_KEY = '__roleMemberIds';

const MAX_PER_ROLE = 20;

export const peopleSelect = {
  id: true,
  userId: true,
  role: true,
  sortOrder: true,
  user: { select: { id: true, name: true, email: true, avatar: true } },
} as const;

type PersonRow = { userId: string; role: string; sortOrder?: number };

export type RoleMemberIds = {
  executor?: string[];
  responsible?: string[];
  reviewer?: string[];
};

function roleJsonKey(role: TaskPersonRoleCode): keyof RoleMemberIds {
  if (role === 'EXECUTOR') return 'executor';
  if (role === 'RESPONSIBLE') return 'responsible';
  return 'reviewer';
}

export function parseRoleMemberIds(raw: unknown): RoleMemberIds {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const take = (v: unknown) =>
    Array.isArray(v) ? [...new Set(v.map((id) => String(id).trim()).filter(Boolean))] : undefined;
  return {
    executor: take(o.executor),
    responsible: take(o.responsible),
    reviewer: take(o.reviewer),
  };
}

function roleMembersFromCustomFields(customFields: unknown): RoleMemberIds {
  if (!customFields || typeof customFields !== 'object' || Array.isArray(customFields)) return {};
  return parseRoleMemberIds((customFields as Record<string, unknown>)[ROLE_MEMBERS_CUSTOM_KEY]);
}

function roleMembersFromTask(task: {
  roleMemberIds?: unknown;
  customFields?: unknown;
}): RoleMemberIds {
  const fromCol = parseRoleMemberIds(task.roleMemberIds);
  if (fromCol.executor?.length || fromCol.responsible?.length || fromCol.reviewer?.length) {
    return fromCol;
  }
  return roleMembersFromCustomFields(task.customFields);
}

/** IDs de um papel a partir de `people` (ordenado). */
export function idsForRole(people: PersonRow[] | null | undefined, role: TaskPersonRoleCode): string[] {
  if (!Array.isArray(people) || !people.length) return [];
  return [...people]
    .filter((p) => p.role === role)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((p) => p.userId)
    .filter(Boolean);
}

/** Executores: arrays API → roleMemberIds/customFields → TaskPerson → assignee + collaborators. */
export function executorIdsFromTask(task: {
  assigneeId?: string | null;
  collaboratorIds?: unknown;
  roleMemberIds?: unknown;
  customFields?: unknown;
  people?: PersonRow[] | null;
  assigneeIds?: string[] | null;
}): string[] {
  if (Array.isArray(task.assigneeIds) && task.assigneeIds.length) {
    return [...new Set(task.assigneeIds.map(String).filter(Boolean))];
  }
  const fromJson = roleMembersFromTask(task).executor;
  if (fromJson?.length) return fromJson;
  if (Array.isArray(task.people) && task.people.some((p) => p.role === 'EXECUTOR')) {
    return idsForRole(task.people, 'EXECUTOR');
  }
  const extra = Array.isArray(task.collaboratorIds)
    ? task.collaboratorIds.map((id) => String(id)).filter(Boolean)
    : [];
  return [...new Set([task.assigneeId, ...extra].filter((id): id is string => Boolean(id)))];
}

export function responsibleIdsFromTask(task: {
  responsibleId?: string | null;
  roleMemberIds?: unknown;
  customFields?: unknown;
  people?: PersonRow[] | null;
  responsibleIds?: string[] | null;
}): string[] {
  if (Array.isArray(task.responsibleIds) && task.responsibleIds.length) {
    return [...new Set(task.responsibleIds.map(String).filter(Boolean))];
  }
  const fromJson = roleMembersFromTask(task).responsible;
  if (fromJson?.length) return fromJson;
  if (Array.isArray(task.people) && task.people.some((p) => p.role === 'RESPONSIBLE')) {
    return idsForRole(task.people, 'RESPONSIBLE');
  }
  return task.responsibleId ? [task.responsibleId] : [];
}

export function reviewerIdsFromTask(task: {
  reviewerId?: string | null;
  roleMemberIds?: unknown;
  customFields?: unknown;
  people?: PersonRow[] | null;
  reviewerIds?: string[] | null;
}): string[] {
  if (Array.isArray(task.reviewerIds) && task.reviewerIds.length) {
    return [...new Set(task.reviewerIds.map(String).filter(Boolean))];
  }
  const fromJson = roleMembersFromTask(task).reviewer;
  if (fromJson?.length) return fromJson;
  if (Array.isArray(task.people) && task.people.some((p) => p.role === 'REVIEWER')) {
    return idsForRole(task.people, 'REVIEWER');
  }
  return task.reviewerId ? [task.reviewerId] : [];
}

export function taskHasExecutor(task: Parameters<typeof executorIdsFromTask>[0], userId: string | null | undefined) {
  if (!userId) return false;
  return executorIdsFromTask(task).includes(userId);
}

export function taskHasNoExecutor(task: Parameters<typeof executorIdsFromTask>[0]) {
  return executorIdsFromTask(task).length === 0;
}

/** Enrich API payloads with role id arrays (keeps legacy single FKs). */
export function withRoleIdArrays<T extends {
  assigneeId?: string | null;
  responsibleId?: string | null;
  reviewerId?: string | null;
  collaboratorIds?: unknown;
  roleMemberIds?: unknown;
  customFields?: unknown;
  people?: PersonRow[] | null;
}>(task: T) {
  return {
    ...task,
    assigneeIds: executorIdsFromTask(task),
    responsibleIds: responsibleIdsFromTask(task),
    reviewerIds: reviewerIdsFromTask(task),
  };
}

export function normalizeRoleIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map((id) => String(id).trim()).filter(Boolean))].slice(0, MAX_PER_ROLE);
}

async function filterCompanyMembers(userIds: string[], companyIds: string[]) {
  if (!userIds.length || !companyIds.length) return [] as string[];
  const members = await prisma.user.findMany({
    where: { id: { in: userIds }, companyUsers: { some: { companyId: { in: companyIds } } } },
    select: { id: true },
  });
  const allowed = new Set(members.map((m) => m.id));
  return userIds.filter((id) => allowed.has(id));
}

function legacyFieldsForRole(role: TaskPersonRoleCode, ids: string[]) {
  const primary = ids[0] || null;
  if (role === 'EXECUTOR') {
    return {
      assigneeId: primary,
      collaboratorIds: ids.slice(1),
    };
  }
  if (role === 'RESPONSIBLE') return { responsibleId: primary };
  return { reviewerId: primary };
}

/**
 * Substitui todas as pessoas de um papel.
 * 1) FKs + collaboratorIds + customFields.__roleMemberIds (sempre — sem migração)
 * 2) roleMemberIds coluna (se existir)
 * 3) TaskPerson join (se existir)
 */
export async function replaceTaskRolePeople(opts: {
  taskId: string;
  role: TaskPersonRoleCode;
  userIds: string[];
  companyIds: string[];
}): Promise<string[]> {
  const ids = await filterCompanyMembers(normalizeRoleIds(opts.userIds), opts.companyIds);
  const current = await prisma.task.findFirst({
    where: { id: opts.taskId },
    select: { roleMemberIds: true, customFields: true },
  });
  const merged: RoleMemberIds = {
    ...roleMembersFromTask(current || {}),
    [roleJsonKey(opts.role)]: ids,
  };

  const prevCustom =
    current?.customFields && typeof current.customFields === 'object' && !Array.isArray(current.customFields)
      ? (current.customFields as Record<string, unknown>)
      : {};

  // Sempre: FKs + customFields (coluna já existente em produção)
  await prisma.task.update({
    where: { id: opts.taskId },
    data: {
      ...legacyFieldsForRole(opts.role, ids),
      customFields: { ...prevCustom, [ROLE_MEMBERS_CUSTOM_KEY]: merged },
    },
  });

  // Coluna roleMemberIds (após migração)
  try {
    await prisma.task.update({
      where: { id: opts.taskId },
      data: { roleMemberIds: merged },
    });
  } catch (err) {
    console.warn('[task-people] roleMemberIds column skipped:', err instanceof Error ? err.message : err);
  }

  // Join TaskPerson (após migração)
  try {
    await prisma.taskPerson.deleteMany({
      where: { taskId: opts.taskId, role: opts.role },
    });
    if (ids.length) {
      await prisma.taskPerson.createMany({
        data: ids.map((userId, sortOrder) => ({
          taskId: opts.taskId,
          userId,
          role: opts.role,
          sortOrder,
        })),
        skipDuplicates: true,
      });
    }
  } catch (err) {
    console.warn('[task-people] TaskPerson sync skipped:', err instanceof Error ? err.message : err);
  }

  return ids;
}

/** Após create com FKs/arrays: materializa papéis multi. */
export async function syncTaskPeopleFromLegacy(opts: {
  taskId: string;
  companyIds: string[];
  assigneeIds?: string[] | null;
  responsibleIds?: string[] | null;
  reviewerIds?: string[] | null;
  assigneeId?: string | null;
  responsibleId?: string | null;
  reviewerId?: string | null;
  collaboratorIds?: unknown;
}) {
  const executors =
    opts.assigneeIds != null
      ? normalizeRoleIds(opts.assigneeIds)
      : [
          ...(opts.assigneeId ? [String(opts.assigneeId)] : []),
          ...(Array.isArray(opts.collaboratorIds)
            ? opts.collaboratorIds.map((id) => String(id)).filter(Boolean)
            : []),
        ];
  const responsible =
    opts.responsibleIds != null
      ? normalizeRoleIds(opts.responsibleIds)
      : opts.responsibleId
        ? [String(opts.responsibleId)]
        : [];
  const reviewers =
    opts.reviewerIds != null
      ? normalizeRoleIds(opts.reviewerIds)
      : opts.reviewerId
        ? [String(opts.reviewerId)]
        : [];

  await replaceTaskRolePeople({
    taskId: opts.taskId,
    role: 'EXECUTOR',
    userIds: executors,
    companyIds: opts.companyIds,
  });
  await replaceTaskRolePeople({
    taskId: opts.taskId,
    role: 'RESPONSIBLE',
    userIds: responsible,
    companyIds: opts.companyIds,
  });
  await replaceTaskRolePeople({
    taskId: opts.taskId,
    role: 'REVIEWER',
    userIds: reviewers,
    companyIds: opts.companyIds,
  });
}

/** Prisma filter: user is any executor (FK + Json — sem depender de migração). */
export function executorFilter(userId: string) {
  return {
    OR: [
      { assigneeId: userId },
      { collaboratorIds: { array_contains: userId } },
      {
        customFields: {
          path: [ROLE_MEMBERS_CUSTOM_KEY, 'executor'],
          array_contains: userId,
        },
      },
    ],
  };
}

/** Prisma filter: task has no executors. */
export function unassignedExecutorFilter() {
  return {
    AND: [{ assigneeId: null }, { collaboratorIds: { equals: null } }],
  };
}
