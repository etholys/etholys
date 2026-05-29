import type { AiAdvisorSessionKind } from '@prisma/client';

export function parseAdvisorSessionKindBody(raw: unknown): AiAdvisorSessionKind {
  return raw === 'NEXUS_COPILOT' ? 'NEXUS_COPILOT' : 'WORKSPACE_ADVISOR';
}
