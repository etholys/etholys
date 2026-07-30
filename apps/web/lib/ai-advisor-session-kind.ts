import type { AiAdvisorSessionKind } from '@prisma/client';
import { prismaHasEnumValue } from '@/lib/prisma-has-field';

export function parseAdvisorSessionKindBody(raw: unknown): AiAdvisorSessionKind {
  if (raw === 'NEXUS_COPILOT') return 'NEXUS_COPILOT';
  if (raw === 'SIEP_REPORT' && prismaHasEnumValue('AiAdvisorSessionKind', 'SIEP_REPORT')) {
    return 'SIEP_REPORT';
  }
  if (raw === 'STUDIO_DOC' && prismaHasEnumValue('AiAdvisorSessionKind', 'STUDIO_DOC')) {
    return 'STUDIO_DOC';
  }
  return 'WORKSPACE_ADVISOR';
}
