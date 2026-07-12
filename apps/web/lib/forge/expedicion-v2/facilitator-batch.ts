import { Prisma } from '@prisma/client';
import { getForgeDb } from '@/lib/forge/db';
import { applyV2Action } from '@/lib/forge/expedicion-v2/apply-v2-action';
import { mergeV2IntoRoomState, v2FromRoomState } from '@/lib/forge/expedicion-v2/room-v2-store';
import { parseMulti } from '@/lib/forge/expedicion-board-multi';

const BATCH_TO_SINGLE: Record<string, string> = {
  open_pre_quiz_all: 'open_pre_quiz',
  open_post_quiz_all: 'open_post_quiz',
  return_to_lobby_all: 'return_to_lobby',
  reset_v2_all: 'reset_v2',
  start_playing_all: 'start_playing',
};

export async function applyFacilitatorBatchV2(courseId: string, action: string) {
  const single = BATCH_TO_SINGLE[action];
  if (!single) return { updated: 0 };

  const rooms = await getForgeDb().forgeSharedGameRoom.findMany({
    where: { courseId, status: 'open', playGroupId: { not: null } },
    take: 48,
  });

  let updated = 0;
  for (const room of rooms) {
    const prev = (room.state ?? {}) as Record<string, unknown>;
    const multi = parseMulti(prev);
    if (!multi?.teamPlay) continue;
    const v2 = applyV2Action(v2FromRoomState(prev), { action: single });
    await getForgeDb().forgeSharedGameRoom.update({
      where: { id: room.id },
      data: {
        state: mergeV2IntoRoomState(prev, v2) as Prisma.InputJsonValue,
        version: { increment: 1 },
      },
    });
    updated += 1;
  }
  return { updated };
}

export function isBatchFacilitatorAction(action: string) {
  return action in BATCH_TO_SINGLE;
}
