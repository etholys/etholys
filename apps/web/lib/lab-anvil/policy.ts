import type { LabAnvilProjectContext } from './types';
import {
  LAB_ANVIL_RELATIONS,
  LAB_ANVIL_VISIBILITIES,
  LAB_ANVIL_WORKSPACE_KINDS,
} from './types';

export function parseAllowedReuse(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
}

export function isPublicOss(project: Pick<LabAnvilProjectContext, 'visibility'>): boolean {
  return project.visibility === 'public_oss';
}

export function canTouchEtholysMonorepo(
  project: Pick<LabAnvilProjectContext, 'visibility' | 'relation' | 'workspaceKind'>,
): boolean {
  if (isPublicOss(project)) return false;
  if (project.relation === 'consumes_etholys_api') return false;
  return (
    project.relation === 'etholys_core' ||
    project.workspaceKind === 'etholys_monorepo' ||
    project.relation === 'whitelabel_instance'
  );
}

export type PolicyCheckResult = {
  ok: boolean;
  warnings: string[];
  blockedReasons: string[];
};

/** Valida combinação visibility/relation/workspace e intenção do utilizador. */
export function checkProjectPolicy(
  project: LabAnvilProjectContext,
  userMessage: string,
): PolicyCheckResult {
  const warnings: string[] = [];
  const blockedReasons: string[] = [];
  const msg = userMessage.toLowerCase();

  if (!LAB_ANVIL_VISIBILITIES.includes(project.visibility as never)) {
    warnings.push(`visibility desconhecida: ${project.visibility}`);
  }
  if (!LAB_ANVIL_RELATIONS.includes(project.relation as never)) {
    warnings.push(`relation desconhecida: ${project.relation}`);
  }
  if (!LAB_ANVIL_WORKSPACE_KINDS.includes(project.workspaceKind as never)) {
    warnings.push(`workspaceKind desconhecido: ${project.workspaceKind}`);
  }

  if (isPublicOss(project) && project.workspaceKind === 'etholys_monorepo') {
    blockedReasons.push(
      'Projeto public_oss não pode usar workspace etholys_monorepo — risco de expor código privado.',
    );
  }

  if (isPublicOss(project) && project.relation === 'etholys_core') {
    blockedReasons.push('public_oss incompatível com relation etholys_core.');
  }

  const wantsPrivateCopy =
    /copiar.*(forge|etholys|iot|premium)|colar.*(c[oó]digo|codigo).*(etholys|forge)|importar.*(apps\/web|monorepo)/i.test(
      msg,
    );

  if (isPublicOss(project) && wantsPrivateCopy) {
    blockedReasons.push(
      'Pedido pediria copiar código Etholys privado para repo OSS. Use API pública, pacote OSS aprovado ou reimplementação mínima.',
    );
  }

  if (isPublicOss(project) && !canTouchEtholysMonorepo(project)) {
    warnings.push(
      'Modo OSS: o agente só pode gerar código neste projeto e consumir allowedReuse / APIs públicas.',
    );
  }

  if (project.relation === 'consumes_etholys_api' && wantsPrivateCopy) {
    blockedReasons.push(
      'Projeto consumes_etholys_api: reutilize via API/SDK, não copie o monorepo.',
    );
  }

  const allowed = parseAllowedReuse(project.allowedReuse);
  if (isPublicOss(project) && allowed.length === 0) {
    warnings.push(
      'allowedReuse vazio — em OSS convém listar APIs/pacotes públicos permitidos.',
    );
  }

  return {
    ok: blockedReasons.length === 0,
    warnings,
    blockedReasons,
  };
}

export function policySummaryForPrompt(project: LabAnvilProjectContext): string {
  const allowed = parseAllowedReuse(project.allowedReuse);
  const monorepo = canTouchEtholysMonorepo(project);
  return [
    `visibility=${project.visibility}`,
    `relation=${project.relation}`,
    `workspaceKind=${project.workspaceKind}`,
    `pode_tocar_monorepo_etholys=${monorepo ? 'SIM' : 'NÃO'}`,
    `allowedReuse=${allowed.length ? allowed.join(', ') : '(vazio)'}`,
    monorepo
      ? 'Podes propor alterações no monorepo Etholys / caminhos internos.'
      : 'PROIBIDO ler ou copiar o monorepo Etholys privado. Reuso só via API/SDK/pacotes em allowedReuse, ou reimplementar o mínimo.',
  ].join('\n');
}
