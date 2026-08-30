import type { PrismaClient } from '@prisma/client';
import type { StudioCopilotMode } from '@/lib/studio/copilot-modes';
import type { StudioStructureSessionState } from '@/lib/studio/structure-apply';

export type StudioCopilotSessionState = {
  mode: StudioCopilotMode;
  structureState: StudioStructureSessionState | null;
};

type SessionMirror = {
  studioCopilot?: StudioCopilotSessionState;
};

function parseMirror(raw: unknown): SessionMirror {
  if (!raw || typeof raw !== 'object') return {};
  return raw as SessionMirror;
}

export function readStudioCopilotSessionFromMirror(
  mirror: unknown,
): StudioCopilotSessionState | null {
  const m = parseMirror(mirror).studioCopilot;
  if (!m || typeof m !== 'object') return null;
  const mode = m.mode;
  if (mode !== 'discuss' && mode !== 'propose' && mode !== 'apply' && mode !== 'edit_selection') {
    return null;
  }
  return {
    mode,
    structureState: m.structureState ?? null,
  };
}

export async function loadStudioCopilotSession(
  prisma: PrismaClient,
  sessionId: string,
): Promise<StudioCopilotSessionState | null> {
  const row = await prisma.aiAdvisorSession.findUnique({
    where: { id: sessionId },
    select: { nexusMirror: true },
  });
  return readStudioCopilotSessionFromMirror(row?.nexusMirror);
}

export async function saveStudioCopilotSession(
  prisma: PrismaClient,
  sessionId: string,
  state: StudioCopilotSessionState,
): Promise<void> {
  const row = await prisma.aiAdvisorSession.findUnique({
    where: { id: sessionId },
    select: { nexusMirror: true },
  });
  const prev = parseMirror(row?.nexusMirror);
  await prisma.aiAdvisorSession.update({
    where: { id: sessionId },
    data: {
      nexusMirror: {
        ...prev,
        studioCopilot: state,
      } as object,
    },
  });
}
