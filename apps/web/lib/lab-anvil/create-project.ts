import { prisma } from '@/lib/prisma';
import type {
  LabAnvilDeployKind,
  LabAnvilRelation,
  LabAnvilVisibility,
  LabAnvilWorkspaceKind,
} from './types';

function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64) || 'projeto';
}

export type CreateAnvilProjectInput = {
  name: string;
  description?: string;
  visibility?: LabAnvilVisibility;
  relation?: LabAnvilRelation;
  workspaceKind?: LabAnvilWorkspaceKind;
  repoUrl?: string;
  repoPath?: string;
  defaultBranch?: string;
  allowedReuse?: string[];
  parentProjectId?: string;
  createdById: string;
  createdByEmail: string;
};

export async function createAnvilProject(input: CreateAnvilProjectInput) {
  const visibility = input.visibility || 'private';
  const relation = input.relation || 'standalone';
  let workspaceKind: LabAnvilWorkspaceKind =
    input.workspaceKind ||
    (relation === 'etholys_core' || relation === 'whitelabel_instance'
      ? 'etholys_monorepo'
      : 'sandbox');

  if (visibility === 'public_oss' && workspaceKind === 'etholys_monorepo') {
    workspaceKind = 'external_repo';
  }
  if (visibility === 'public_oss' && relation === 'etholys_core') {
    throw new Error('public_oss incompatível com etholys_core');
  }

  let slug = slugify(input.name);
  const existing = await prisma.labAnvilProject.findUnique({ where: { slug } });
  if (existing) slug = `${slug}-${Date.now().toString(36)}`;

  const project = await prisma.labAnvilProject.create({
    data: {
      slug,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      visibility,
      relation,
      workspaceKind,
      repoUrl: input.repoUrl?.trim() || null,
      repoPath: input.repoPath?.trim() || null,
      defaultBranch: input.defaultBranch?.trim() || 'main',
      allowedReuse: input.allowedReuse || [],
      parentProjectId: input.parentProjectId || null,
      createdById: input.createdById,
      agent: { create: { status: 'idle' } },
      deployTargets: {
        create: [
          {
            kind: 'preview' satisfies LabAnvilDeployKind,
            label: 'Preview',
            isDefault: true,
            status: 'ready',
          },
        ],
      },
      members: {
        create: {
          email: input.createdByEmail.toLowerCase(),
          userId: input.createdById,
          role: 'owner',
          status: 'active',
          invitedById: input.createdById,
        },
      },
    },
    include: {
      agent: true,
      deployTargets: true,
      members: true,
    },
  });

  return project;
}

/** Garante projeto raiz Etholys core na primeira utilização. */
export async function ensureEtholysCoreProject(createdById: string, email: string) {
  const existing = await prisma.labAnvilProject.findUnique({
    where: { slug: 'etholys-core' },
    include: { agent: true, deployTargets: true },
  });
  if (existing) return existing;

  return createAnvilProject({
    name: 'Etholys Core',
    description:
      'Monorepo Etholys (ATLAS, SIEP, FORGE, Meet, Lab…). Agente com contexto interno para consistência e reuso.',
    visibility: 'private',
    relation: 'etholys_core',
    workspaceKind: 'etholys_monorepo',
    repoPath: '.',
    defaultBranch: 'main',
    allowedReuse: [],
    createdById,
    createdByEmail: email,
  });
}
