/** RADAR Assistente — types shared by API + UI. */

export type RadarSectorAgentId = 'agriculture' | 'livestock' | 'agroindustry' | 'industry';

export type RadarAssistantActionType =
  | 'create_task'
  | 'open_space'
  | 'open_caderno'
  | 'open_automation'
  | 'open_tasks'
  | 'open_property';

export type RadarAssistantAction = {
  type: RadarAssistantActionType;
  label: string;
  href?: string;
  title?: string;
  description?: string;
  severity?: 'critical' | 'warning' | 'info';
  propertyId?: string | null;
  unitId?: string | null;
  taskId?: string;
};

export type RadarSetupGap = {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  message: { pt: string; es: string; en: string };
  href?: string;
};

export type RadarAssistantContextSnapshot = {
  companyId: string;
  propertyId: string | null;
  propertyName: string | null;
  moduleId: string | null;
  sectorAgent: RadarSectorAgentId;
  sectorLabel: { pt: string; es: string; en: string };
  checklist: RadarSetupGap[];
  alerts: Array<{
    id: string;
    severity: string;
    message: string;
    propertyId: string | null;
    href: string;
  }>;
  openTasks: Array<{
    id: string;
    title: string;
    status: string;
    severity: string;
    propertyId: string | null;
    href: string;
  }>;
  recentCaderno: Array<{
    id: string;
    kind: string;
    note: string | null;
    unitName: string | null;
    at: string;
  }>;
  sensors: Array<{
    id: string;
    name: string;
    metric: string;
    lastValue: number | null;
    lastSeenAt: string | null;
    unitName: string | null;
  }>;
  spaces: Array<{ id: string; name: string; propertyId: string; placed: boolean }>;
  visionSupported: true;
};
