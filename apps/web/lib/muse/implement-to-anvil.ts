import { prisma } from '@/lib/prisma';
import {
  createAnvilProject,
  ensureEtholysCoreProject,
} from '@/lib/lab-anvil/create-project';
import type { LabAnvilRelation, LabAnvilWorkspaceKind } from '@/lib/lab-anvil/types';

type MuseSuggestionRow = {
  id: string;
  title: string;
  category: string;
  description: string;
  rationale: string | null;
  priority: string;
  status: string;
  anvilProjectId: string | null;
};

function buildBrief(s: MuseSuggestionRow): string {
  const parts = [
    '## Brief MUSE (handoff)',
    `**Sugestão:** ${s.title}`,
    `**Categoria:** ${s.category}`,
    `**Prioridade:** ${s.priority}`,
    '',
    '### Descrição',
    s.description || '(sem descrição)',
  ];
  if (s.rationale?.trim()) {
    parts.push('', '### Racional', s.rationale.trim());
  }
  parts.push(
    '',
    '### Instruções para o agente ANVIL',
    '- Este projeto nasceu de uma sugestão aceite no Lab MUSE.',
    '- Respeita a política de reuso/IP do tipo de projeto.',
    '- Propõe um plano concreto antes de alterar código.',
  );
  return parts.join('\n');
}

function inferProjectShape(category: string): {
  relation: LabAnvilRelation;
  workspaceKind: LabAnvilWorkspaceKind;
  useParentCore: boolean;
} {
  if (category === 'system' || category === 'improvement' || category === 'integration') {
    return {
      relation: 'etholys_core',
      workspaceKind: 'etholys_monorepo',
      useParentCore: true,
    };
  }
  return {
    relation: 'standalone',
    workspaceKind: 'sandbox',
    useParentCore: false,
  };
}

/**
 * Cria (ou reutiliza) um projeto ANVIL a partir de uma sugestão MUSE.
 * Atualiza status → IMPLEMENTING e liga anvilProjectId.
 */
export async function implementMuseSuggestionToAnvil(opts: {
  suggestionId: string;
  userId: string;
  email: string;
  /** Override opcional do tipo de projeto */
  relation?: LabAnvilRelation;
  workspaceKind?: LabAnvilWorkspaceKind;
}) {
  const suggestion = await prisma.museSuggestion.findUnique({
    where: { id: opts.suggestionId },
  });
  if (!suggestion) {
    throw Object.assign(new Error('Sugestão não encontrada'), { status: 404 });
  }

  if (suggestion.anvilProjectId) {
    const existing = await prisma.labAnvilProject.findUnique({
      where: { id: suggestion.anvilProjectId },
      include: { agent: true, deployTargets: true },
    });
    if (existing) {
      return {
        suggestion,
        project: existing,
        created: false as const,
      };
    }
  }

  if (suggestion.status === 'DISMISSED') {
    throw Object.assign(new Error('Sugestão descartada — não pode implementar'), {
      status: 400,
    });
  }
  if (suggestion.status === 'DONE') {
    throw Object.assign(new Error('Sugestão já está concluída'), { status: 400 });
  }

  const shape = inferProjectShape(suggestion.category);
  const relation = opts.relation || shape.relation;
  const workspaceKind = opts.workspaceKind || shape.workspaceKind;

  let parentProjectId: string | undefined;
  if (shape.useParentCore && relation === 'etholys_core') {
    const core = await ensureEtholysCoreProject(opts.userId, opts.email);
    parentProjectId = core.id;
  }

  const brief = buildBrief(suggestion);
  const description = [
    suggestion.description?.trim() || suggestion.title,
    '',
    `Origem: MUSE (${suggestion.id})`,
    suggestion.rationale?.trim() ? `Racional: ${suggestion.rationale.trim()}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const project = await createAnvilProject({
    name: suggestion.title.slice(0, 120),
    description,
    visibility: 'private',
    relation,
    workspaceKind,
    parentProjectId,
    systemPromptExtra: brief,
    createdById: opts.userId,
    createdByEmail: opts.email,
  });

  const session = await prisma.labAnvilSession.create({
    data: {
      projectId: project.id,
      createdById: opts.userId,
      title: 'Brief MUSE',
      status: 'open',
      messages: {
        create: {
          role: 'system',
          content: brief,
          metaJson: { source: 'muse_handoff', museSuggestionId: suggestion.id },
        },
      },
    },
  });

  const updated = await prisma.museSuggestion.update({
    where: { id: suggestion.id },
    data: {
      anvilProjectId: project.id,
      status: 'IMPLEMENTING',
    },
    include: {
      anvilProject: { select: { id: true, slug: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      company: { select: { id: true, shortName: true } },
      project: { select: { id: true, name: true } },
    },
  });

  return {
    suggestion: updated,
    project,
    sessionId: session.id,
    created: true as const,
  };
}
