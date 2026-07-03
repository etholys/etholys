export interface ProjectData {
  id: string;
  name: string;
  code?: string;
  description?: string;
  companyId: string;
  donorName?: string;
  donorContact?: string;
  status: string;
  priority: string;
  startDate?: string;
  endDate?: string;
  budget: number;
  spent: number;
  progress: number;
  country?: string;
  region?: string;
  currency: string;
  contentLocale?: string;
  color?: string;
  company?: { id?: string; name: string; shortName?: string; color?: string };
  tasks?: any[];
  milestones?: any[];
  risks?: any[];
  transactions?: any[];
  objectives?: any[];
  members?: any[];
  budgetLines?: { id: string; description: string; category?: string; isActive?: boolean }[];
  siepPermissions?: {
    permissions: string[];
    canViewBudgetAmounts: boolean;
    canViewProjectTotal: boolean;
    canViewTransactions: boolean;
    canViewTransactionAmounts: boolean;
    canReportActivities: boolean;
    canApproveReports: boolean;
    canViewAllReports: boolean;
  };
}

export interface SectionProps {
  project: ProjectData;
  onRefresh: () => void;
  tr: (key: string) => string;
}

export interface SectionInfo {
  id: string;
  label: string;
  icon: any;
  description: string;
  tooltip?: string;
}
