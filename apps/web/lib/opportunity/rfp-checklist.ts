/**
 * R3 — checklist RFP a partir do texto das bases / elegibilidade.
 * Heurística determinística (sem LLM): extrai obrigações e lacunas.
 */

export type RfpChecklistItem = {
  id: string;
  label: string;
  kind: 'required' | 'eligibility' | 'document' | 'deadline' | 'other';
  sourceHint?: string;
};

const RULES: Array<{
  id: string;
  kind: RfpChecklistItem['kind'];
  re: RegExp;
  pt: string;
  es: string;
  en: string;
}> = [
  {
    id: 'deadline',
    kind: 'deadline',
    re: /\b(deadline|fecha l[ií]mite|prazo|cierra|closes?|submission date|data de envio)\b/i,
    pt: 'Confirmar prazo de submissão',
    es: 'Confirmar plazo de envío',
    en: 'Confirm submission deadline',
  },
  {
    id: 'org_type',
    kind: 'eligibility',
    re: /\b(ong|ngo|osc|cso|empresa privada|private company|p[uú]blic|universidad|cooperativa|fundaci[oó]n)\b/i,
    pt: 'Verificar tipo de organização elegível',
    es: 'Verificar tipo de organización elegible',
    en: 'Verify eligible organization type',
  },
  {
    id: 'geo',
    kind: 'eligibility',
    re: /\b(pa[ií]s|country|countries|regi[oó]n|eligible geograph|nacionalidad|sede legal)\b/i,
    pt: 'Confirmar elegibilidade geográfica / registo',
    es: 'Confirmar elegibilidad geográfica / registro',
    en: 'Confirm geographic / registration eligibility',
  },
  {
    id: 'cofunding',
    kind: 'required',
    re: /\b(co-?financi|counterpart|contrapartida|match funding|aportaci[oó]n propia)\b/i,
    pt: 'Mapear cofinanciamento / contrapartida',
    es: 'Mapear cofinanciamiento / contrapartida',
    en: 'Map co-funding / match requirement',
  },
  {
    id: 'audit',
    kind: 'document',
    re: /\b(audit|auditor[ií]a|estados financieros|financial statements|demonstra[cç][oõ]es financeiras)\b/i,
    pt: 'Preparar auditoria / demonstrações financeiras',
    es: 'Preparar auditoría / estados financieros',
    en: 'Prepare audit / financial statements',
  },
  {
    id: 'loi',
    kind: 'document',
    re: /\b(loi|letter of interest|carta de intenci[oó]n|carta de inten[cç][aã]o|concept note)\b/i,
    pt: 'Preparar LOI / concept note',
    es: 'Preparar LOI / concept note',
    en: 'Prepare LOI / concept note',
  },
  {
    id: 'budget',
    kind: 'document',
    re: /\b(budget|presupuesto|or[cç]amento|cost proposal)\b/i,
    pt: 'Montar orçamento no formato pedido',
    es: 'Armar presupuesto en el formato pedido',
    en: 'Build budget in required format',
  },
  {
    id: 'consortium',
    kind: 'eligibility',
    re: /\b(consortium|cons[oó]rcio|coalici[oó]n|partnership|s[oó]cio local|lead applicant)\b/i,
    pt: 'Definir lead / sócios do consórcio',
    es: 'Definir lead / socios del consorcio',
    en: 'Define lead / consortium partners',
  },
  {
    id: 'language',
    kind: 'required',
    re: /\b(idioma|language|en espa[nñ]ol|in english|em portugu[eê]s|must be submitted in)\b/i,
    pt: 'Confirmar idioma da proposta',
    es: 'Confirmar idioma de la propuesta',
    en: 'Confirm proposal language',
  },
];

export function buildRfpChecklist(
  text: string,
  locale: string = 'es',
): RfpChecklistItem[] {
  const hay = text.replace(/\s+/g, ' ').trim();
  if (!hay || hay.length < 40) return [];
  const out: RfpChecklistItem[] = [];
  for (const rule of RULES) {
    const m = hay.match(rule.re);
    if (!m) continue;
    const label = locale === 'pt' ? rule.pt : locale === 'en' ? rule.en : rule.es;
    out.push({
      id: rule.id,
      label,
      kind: rule.kind,
      sourceHint: m[0],
    });
  }
  return out.slice(0, 12);
}

export function checklistFromCandidateFields(
  fields: {
    eligibility?: string | null;
    whoCanApply?: string | null;
    requirements?: string | null;
    basesText?: string | null;
    sourceExcerpt?: string | null;
  },
  locale?: string,
): RfpChecklistItem[] {
  const blob = [fields.basesText, fields.requirements, fields.eligibility, fields.whoCanApply, fields.sourceExcerpt]
    .filter(Boolean)
    .join('\n\n');
  return buildRfpChecklist(blob, locale);
}

/** Títulos de secção sugeridos a partir do checklist (para estrutura / canvas). */
export function checklistToSectionTitles(
  items: RfpChecklistItem[],
  locale: string = 'es',
): string[] {
  const t = (pt: string, es: string, en: string) =>
    locale === 'pt' ? pt : locale === 'en' ? en : es;

  const byId: Record<string, string> = {
    deadline: t('Prazos e cronograma', 'Plazos y cronograma', 'Deadlines and timeline'),
    org_type: t('Elegibilidade institucional', 'Elegibilidad institucional', 'Institutional eligibility'),
    geo: t('Elegibilidade geográfica', 'Elegibilidad geográfica', 'Geographic eligibility'),
    cofunding: t('Cofinanciamento / contrapartida', 'Cofinanciamiento / contrapartida', 'Co-funding / match'),
    audit: t('Anexos financeiros', 'Anexos financieros', 'Financial annexes'),
    loi: t('Carta de intenção / concept note', 'Carta de intención / concept note', 'LOI / concept note'),
    budget: t('Orçamento', 'Presupuesto', 'Budget'),
    consortium: t('Consórcio e papéis', 'Consorcio y roles', 'Consortium and roles'),
    language: t('Idioma e formato de envio', 'Idioma y formato de envío', 'Language and submission format'),
  };

  const titles: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const title = byId[item.id] || item.label;
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    titles.push(title);
  }

  // Secções base sempre úteis se há checklist
  if (titles.length) {
    const core = [
      t('Resumo executivo', 'Resumen ejecutivo', 'Executive summary'),
      t('Objectivos e resultados', 'Objetivos y resultados', 'Objectives and results'),
      t('Actividades', 'Actividades', 'Activities'),
    ];
    for (const c of core.reverse()) {
      if (!seen.has(c.toLowerCase())) titles.unshift(c);
    }
  }
  return titles.slice(0, 14);
}

/** Acrescenta secções vazias do checklist ao markdown (sem duplicar títulos). */
export function appendChecklistSections(
  md: string,
  items: RfpChecklistItem[],
  locale: string = 'es',
): string {
  const titles = checklistToSectionTitles(items, locale);
  if (!titles.length) return md;
  let text = md.trim();
  const extras: string[] = [];
  for (const title of titles) {
    const re = new RegExp(`^##\\s+${escapeRegExp(title)}\\b`, 'im');
    if (re.test(text)) continue;
    extras.push(`## ${title}\n\n- [ ] ${title}`);
  }
  if (!extras.length) return text;
  return `${text}\n\n${extras.join('\n\n')}`;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
