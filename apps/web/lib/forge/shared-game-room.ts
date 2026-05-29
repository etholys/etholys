import type { ForgeSharedGameRoom } from '@prisma/client';
import { parseGameSpecV1 } from '@/lib/forge/schemas/game-spec-v1';
import { getForgeEngine, validateAndPrepareSpec } from '@/lib/forge/engines';
import type { GameAction } from '@/lib/forge/engines/types';

export type SerializedSharedGameRoom = {
  id: string;
  activityId: string;
  courseId: string;
  liveSessionId: string | null;
  facilitatorUserId: string;
  state: Record<string, unknown>;
  status: string;
  version: number;
  lastEvents: { type?: string; message?: string }[];
  updatedAt: string;
};

export function serializeSharedGameRoom(row: ForgeSharedGameRoom): SerializedSharedGameRoom {
  const events = Array.isArray(row.lastEvents) ? row.lastEvents : [];
  return {
    id: row.id,
    activityId: row.activityId,
    courseId: row.courseId,
    liveSessionId: row.liveSessionId,
    facilitatorUserId: row.facilitatorUserId,
    state: (row.state ?? {}) as Record<string, unknown>,
    status: row.status,
    version: row.version,
    lastEvents: events as { type?: string; message?: string }[],
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function applySharedGameAction(
  definition: unknown,
  prevState: Record<string, unknown>,
  action: GameAction
): { state: Record<string, unknown>; events: { type?: string; message?: string }[]; score: number; done: boolean } {
  const spec = validateAndPrepareSpec(parseGameSpecV1(definition));
  const engine = getForgeEngine(spec.engine);
  const { state, events } = engine.applyAction(prevState, action, spec);
  const score = engine.computeScore(state, spec);
  const done = engine.isComplete(state, spec);
  return { state: state as Record<string, unknown>, events, score, done };
}

export function canFacilitateSharedGame(
  tenant: { userId: string; companyIds: string[] },
  courseCompanyId: string,
  roomFacilitatorUserId?: string
): boolean {
  if (!tenant.companyIds.includes(courseCompanyId)) return false;
  if (roomFacilitatorUserId && roomFacilitatorUserId !== tenant.userId) {
    return tenant.companyIds.includes(courseCompanyId);
  }
  return true;
}
