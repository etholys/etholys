export { buildRadarAssistantContext } from '@/lib/radar/assistant/context';
export {
  buildContextBlock,
  buildSectorSystemPrompt,
  sectorAgentFromModuleId,
  SECTOR_AGENT_LABEL,
} from '@/lib/radar/assistant/sector-agents';
export { hrefForAction, parseAssistantLlmJson } from '@/lib/radar/assistant/parse-actions';
export type {
  RadarAssistantAction,
  RadarAssistantContextSnapshot,
  RadarSectorAgentId,
  RadarSetupGap,
} from '@/lib/radar/assistant/types';
