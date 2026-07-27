/** Tipos partilhados do Lab ANVIL. Spec: docs/architecture/lab-anvil.md */

export const LAB_ANVIL_VISIBILITIES = ['private', 'public_oss'] as const;
export type LabAnvilVisibility = (typeof LAB_ANVIL_VISIBILITIES)[number];

export const LAB_ANVIL_RELATIONS = [
  'standalone',
  'etholys_core',
  'consumes_etholys_api',
  'whitelabel_instance',
] as const;
export type LabAnvilRelation = (typeof LAB_ANVIL_RELATIONS)[number];

export const LAB_ANVIL_WORKSPACE_KINDS = [
  'etholys_monorepo',
  'external_repo',
  'sandbox',
] as const;
export type LabAnvilWorkspaceKind = (typeof LAB_ANVIL_WORKSPACE_KINDS)[number];

export const LAB_ANVIL_DEPLOY_KINDS = ['preview', 'staging', 'contabo', 'custom'] as const;
export type LabAnvilDeployKind = (typeof LAB_ANVIL_DEPLOY_KINDS)[number];

export type LabAnvilProjectContext = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  visibility: string;
  relation: string;
  workspaceKind: string;
  repoUrl: string | null;
  repoPath: string | null;
  defaultBranch: string;
  allowedReuse: unknown;
  status: string;
};

export type LabAnvilAgentMeta = {
  plan?: string[];
  artifacts?: Array<{ path: string; summary: string; language?: string }>;
  policyWarnings?: string[];
  suggestedDeployKind?: LabAnvilDeployKind;
  reuseDecision?: 'api' | 'oss_package' | 'reimplement' | 'etholys_internal' | 'none';
};
