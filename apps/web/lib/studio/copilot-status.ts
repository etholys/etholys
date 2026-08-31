import type { StudioCopilotMode } from '@/lib/studio/copilot-modes';
import type { StudioStructureSessionState } from '@/lib/studio/structure-apply';

export function copilotStatusHint(
  mode: StudioCopilotMode,
  structure: StudioStructureSessionState | null | undefined,
  locale: string,
): string | null {
  const loc = locale === 'es' ? 'es' : locale === 'en' ? 'en' : 'pt';

  if (structure?.status === 'pending_approval') {
    if (loc === 'es') return 'Plan de estructura pendiente · usa los botones para aprobar o ajustar';
    if (loc === 'en') return 'Structure plan pending · use buttons to approve or adjust';
    return 'Plano de estrutura pendente · usa os botões para aprovar ou ajustar';
  }

  if (structure?.status === 'approved') {
    if (loc === 'es') return 'Estructura aprobada · modo Aplicar activo · Esc cancela el plan';
    if (loc === 'en') return 'Structure approved · Apply mode active · Esc cancels plan';
    return 'Estrutura aprovada · modo Aplicar activo · Esc cancela o plano';
  }

  if (mode === 'propose') {
    if (loc === 'es') return 'Modo Planear · la IA no editará el documento hasta que apruebes';
    if (loc === 'en') return 'Plan mode · AI will not edit the document until you approve';
    return 'Modo Planear · a IA não edita o documento até aprovares';
  }

  if (mode === 'edit_selection') {
    if (loc === 'es') return 'Editar selección · solo los bloques marcados';
    if (loc === 'en') return 'Edit selection · selected blocks only';
    return 'Editar seleção · só blocos marcados';
  }

  if (mode === 'apply') {
    if (loc === 'es') return 'Modo Aplicar · los cambios se escriben en el documento';
    if (loc === 'en') return 'Apply mode · changes are written to the document';
    return 'Modo Aplicar · alterações são escritas no documento';
  }

  return null;
}
