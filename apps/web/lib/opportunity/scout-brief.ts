import type { OpportunityBriefing } from '@/lib/opportunity/scan-types';

const TYPE_MAP: Record<string, string> = {
  grant: 'Grant',
  credit: 'Crédito',
  alliance: 'Aliança',
  local_expert: 'Técnico local',
};

/** Briefing para o scout: temas/países/tipos mandam a busca; notas só pontuam. */
export function formatOpportunityScoutBrief(b: OpportunityBriefing): string {
  const kinds = b.kinds.map((k) => TYPE_MAP[k] ?? k).join(', ');
  const classLabels: Record<string, string> = {
    direct: 'candidatura directa pela nossa organização',
    client_bridge: 'fundos para possíveis clientes (nós somos a ponte)',
    joint: 'apresentação em conjunto / consórcio',
  };
  const classes = (b.classifications ?? ['direct'])
    .map((c) => classLabels[c] ?? c)
    .join('; ');
  return [
    b.scanName ? `Nome da varredura: ${b.scanName}` : '',
    `Temas: ${b.themes.join(', ') || 'inferir'}`,
    `Países elegíveis desejados: ${b.countries.join(', ') || 'inferir'}`,
    `Tipos: ${kinds}`,
    b.amountMax != null ? `Montante máximo preferido: ${b.amountMax} USD` : '',
    b.amountMin != null ? `Montante mínimo: ${b.amountMin} USD` : '',
    b.privateEligible ? 'Elegibilidade: empresas privadas OK' : '',
    b.reimbursable === false ? 'Só financiamento NÃO reembolsável (grants). Sem empréstimos.' : '',
    `Classificações a etiquetar: ${classes}`,
    b.notes
      ? `CRITÉRIOS DE PRIORIDADE (só para matchScore / justificação — NÃO excluir uma convocatória aberta real se coincidir só com parte disto):\n${b.notes}`
      : '',
    b.searchFeedback ? `ORIENTAÇÃO COMPLETA DO UTILIZADOR:\n${b.searchFeedback}` : '',
    `SEARCH vs RANK: hunt by themes, countries and types. Ranking notes (MiPymes, clima, bioeconomía, etc.) score fit — they are not a veto.`,
  ]
    .filter(Boolean)
    .join('\n');
}
