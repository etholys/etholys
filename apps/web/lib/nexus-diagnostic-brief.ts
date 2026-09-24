/**
 * Pós-diagnóstico NEXUS: fase inferida + análise técnica + narrativa de intervenção + esboço estratégico.
 * A fase da jornada NÃO é escolhida pelo utilizador — sai do diagnóstico.
 */

import { AT_QUAD_LABELS, inferOfferKind, type AtOfferKind } from './nexus-at-cycle';
import type { DxLocale, FullDiagnosticResult } from './nexus-sector-diagnostic';
import type { VentureStageId } from './nexus-venture';
import { stageLabel, stageSummary } from './nexus-venture';
import { sectorLabel } from './nexus-economic-sectors';

export type TechnicalBrief = {
  inferredStage: VentureStageId;
  stageRationale: string;
  overallReading: string;
  theoreticalLenses: string[];
  references: string[];
  tripleImpact: { economic: string; social: string; environmental: string };
  priorityGaps: string[];
  potentials: string[];
  offerKind: AtOfferKind | null;
  quantitative: string;
  qualitative: string;
};

export type InterventionNarrative = {
  opening: string;
  levers: Array<{ title: string; why: string; approach: string }>;
  dialoguePrompt: string;
};

export type StrategicDraft = {
  businessModel: { valueProp: string; customers: string; channels: string; revenue: string; costs: string };
  commercialPlan: { focus: string; actions: string[]; kpis: string[] };
  execution: { hires: string[]; purchases: string[]; tools: string[]; milestones: string[]; indicators: string[] };
  nextDialogueQuestion: string;
};

function L(es: string, pt: string, en: string, locale: DxLocale) {
  if (locale === 'pt') return pt;
  if (locale === 'en') return en;
  return es;
}

/** Deriva fase da jornada a partir das respostas + score — nunca input manual. */
export function inferVentureStageFromAnswers(
  answerIds: Record<string, string>,
  overall: number
): { stage: VentureStageId; rationale: { es: string; pt: string; en: string } } {
  const core = answerIds.core_stage;
  const scale = answerIds.core_scale;
  const model = answerIds.core_model;

  if (core === 'idea' || (core === 'surviving' && overall < 45)) {
    return {
      stage: 'DISCOVER',
      rationale: {
        es: 'El diagnóstico indica arranque o supervivencia: aún hay que clarificar modelo, cliente y oferta mínima.',
        pt: 'O diagnóstico indica arranque ou sobrevivência: ainda é preciso clarificar modelo, cliente e oferta mínima.',
        en: 'Diagnostic indicates startup/survival: model, customer and minimum offer still need clarity.',
      },
    };
  }
  if (core === 'surviving' || model === 'unclear' || model === 'me') {
    return {
      stage: 'FOCUS',
      rationale: {
        es: 'Hay operación, pero el foco (segmento, propuesta, métricas) aún no está consolidado.',
        pt: 'Há operação, mas o foco (segmento, proposta, métricas) ainda não está consolidado.',
        en: 'There is operation, but focus (segment, value prop, metrics) is not yet consolidated.',
      },
    };
  }
  if (core === 'stable' || (core === 'growing' && overall < 72)) {
    return {
      stage: 'BUILD',
      rationale: {
        es: 'Base estable: toca construir procesos, equipo comercial y controles que aguanten crecimiento.',
        pt: 'Base estável: é preciso construir processos, equipa comercial e controlos que aguentem crescimento.',
        en: 'Stable base: build processes, commercial capacity and controls that sustain growth.',
      },
    };
  }
  if (core === 'growing' || (core === 'scaling' && overall < 85)) {
    return {
      stage: 'MEASURE',
      rationale: {
        es: 'Hay tracción: la prioridad es medir, ritmar revisiones y mejorar con datos.',
        pt: 'Há tração: a prioridade é medir, ritmar revisões e melhorar com dados.',
        en: 'There is traction: priority is measuring, review cadence and data-driven improvement.',
      },
    };
  }
  if (core === 'scaling' || scale === 'structured') {
    return {
      stage: 'SCALE_GLOBAL',
      rationale: {
        es: 'Estructura y escala permiten plantear mercados más amplios / internacionalización con control.',
        pt: 'Estrutura e escala permitem equacionar mercados mais amplios / internacionalização com controlo.',
        en: 'Structure and scale allow considering broader / international markets with control.',
      },
    };
  }
  if (overall < 50) {
    return {
      stage: 'DISCOVER',
      rationale: {
        es: 'Score global bajo: conviene volver a bases de modelo y operación antes de escalar.',
        pt: 'Score global baixo: convém voltar às bases de modelo e operação antes de escalar.',
        en: 'Low overall score: return to model and operations basics before scaling.',
      },
    };
  }
  return {
    stage: 'BUILD',
    rationale: {
      es: 'Perfil intermedio: construir capacidades operativas y comerciales de forma ordenada.',
      pt: 'Perfil intermédio: construir capacidades operativas e comerciais de forma ordenada.',
      en: 'Intermediate profile: build operational and commercial capabilities in order.',
    },
  };
}

export function buildTechnicalBrief(
  sectorId: string,
  computed: FullDiagnosticResult,
  answerIds: Record<string, string>,
  locale: DxLocale
): TechnicalBrief {
  const inferred = inferVentureStageFromAnswers(answerIds, computed.overall);
  const sectorName = sectorLabel(sectorId, locale) || computed.sectorName;
  const stageName = stageLabel(inferred.stage, locale);

  return {
    inferredStage: inferred.stage,
    stageRationale: inferred.rationale[locale] || inferred.rationale.es,
    overallReading: L(
      `Lectura: ${sectorName} con score ${computed.overall}/100. Fase inferida: ${stageName}. ${stageSummary(inferred.stage, locale)}`,
      `Leitura: ${sectorName} com score ${computed.overall}/100. Fase inferida: ${stageName}. ${stageSummary(inferred.stage, locale)}`,
      `Reading: ${sectorName} at ${computed.overall}/100. Inferred stage: ${stageName}. ${stageSummary(inferred.stage, locale)}`,
      locale
    ),
    theoreticalLenses: [
      L(
        'Canvas / modelo de negocio (Osterwalder): claridad de propuesta, segmentos y canales.',
        'Canvas / modelo de negócio (Osterwalder): clareza de proposta, segmentos e canais.',
        'Business Model Canvas (Osterwalder): clarity of offer, segments and channels.',
        locale
      ),
      L(
        'Cadena de valor (Porter) adaptada a MIPYME: eslabones críticos de producción→comercialización.',
        'Cadeia de valor (Porter) adaptada a MIPYME: elos críticos de produção→comercialização.',
        'Value chain (Porter) adapted to MSMEs: critical production→commercialization links.',
        locale
      ),
      L(
        'Capacidades dinámicas: qué rutinas permiten adaptarse sin depender solo del dueño.',
        'Capacidades dinâmicas: que rotinas permitem adaptar-se sem depender só do dono.',
        'Dynamic capabilities: routines that allow adaptation beyond owner dependence.',
        locale
      ),
      L(
        'Triple impacto: viabilidad económica + inclusión/empleo + prácticas ambientales del sector.',
        'Triplo impacto: viabilidade económica + inclusão/emprego + práticas ambientais do setor.',
        'Triple bottom line: economic viability + inclusion/jobs + sector environmental practices.',
        locale
      ),
    ],
    references: [
      'Osterwalder & Pigneur — Business Model Generation',
      'Porter — Competitive Advantage (cadena de valor)',
      'Teece — Dynamic Capabilities',
      'Elkington — Triple Bottom Line',
      L(
        'FAO / CEPAL — marcos de desarrollo rural y MIPYME agroalimentaria (según sector)',
        'FAO / CEPAL — marcos de desenvolvimento rural e MIPYME agroalimentar (conforme setor)',
        'FAO / ECLAC — rural development and agrifood MSME frameworks (by sector)',
        locale
      ),
    ],
    tripleImpact: {
      economic: L(
        computed.overall < 55
          ? 'Económico: margen y caja aún frágiles — priorizar registro de costos y precio con cobertura.'
          : 'Económico: hay base; consolidar margen por línea y previsión de caja.',
        computed.overall < 55
          ? 'Económico: margem e caixa ainda frágeis — priorizar registo de custos e preço com cobertura.'
          : 'Económico: há base; consolidar margem por linha e previsão de caixa.',
        computed.overall < 55
          ? 'Economic: margin and cash still fragile — prioritize cost records and cost-covering price.'
          : 'Economic: there is a base; consolidate margin by line and cash forecast.',
        locale
      ),
      social: L(
        'Social: roles, continuidad si falta el dueño, y condiciones de quien ayuda (familia/colaboradores).',
        'Social: papéis, continuidade se o dono falta, e condições de quem ajuda (família/colaboradores).',
        'Social: roles, continuity if the owner is away, and conditions for helpers (family/staff).',
        locale
      ),
      environmental: L(
        'Ambiental: mermas, insumos y prácticas del sector (agua, residuos, inocuidad) como riesgo y oportunidad.',
        'Ambiental: perdas, insumos e práticas do setor (água, resíduos, inocuidade) como risco e oportunidade.',
        'Environmental: waste, inputs and sector practices (water, waste, food safety) as risk and opportunity.',
        locale
      ),
    },
    priorityGaps: computed.weaknesses.slice(0, 8).map((w) => w.label),
    potentials: computed.potentials.slice(0, 6).map((p) => p.label),
    offerKind: computed.offerKind || inferOfferKind(answerIds),
    quantitative: (() => {
      const quads = computed.quads || [];
      const bits = quads.map((q) => {
        const name = AT_QUAD_LABELS[q.id][locale] || AT_QUAD_LABELS[q.id].es;
        return `${name} ${q.score}/100`;
      });
      return L(
        `Cuantitativo: score global ${computed.overall}/100. ${bits.join(' · ')}. ${computed.weaknesses.length} brechas, ${computed.potentials.length} potenciales, ${computed.strengths.length} fortalezas.`,
        `Quantitativo: score global ${computed.overall}/100. ${bits.join(' · ')}. ${computed.weaknesses.length} lacunas, ${computed.potentials.length} potenciais, ${computed.strengths.length} forças.`,
        `Quantitative: overall ${computed.overall}/100. ${bits.join(' · ')}. ${computed.weaknesses.length} gaps, ${computed.potentials.length} potentials, ${computed.strengths.length} strengths.`,
        locale
      );
    })(),
    qualitative: (() => {
      const weakest = [...(computed.quads || [])].sort((a, b) => a.score - b.score)[0];
      const offer =
        computed.offerKind === 'service'
          ? L('vende servicio', 'vende serviço', 'sells a service', locale)
          : computed.offerKind === 'both'
            ? L('vende producto y servicio', 'vende produto e serviço', 'sells product and service', locale)
            : L('vende producto', 'vende produto', 'sells a product', locale);
      const extra = weakest?.reading || '';
      return L(
        `Cualitativo: ${sectorName} ${offer}. La lectura no es solo el número — es dónde se rompe el 360. ${extra}`,
        `Qualitativo: ${sectorName} ${offer}. A leitura não é só o número — é onde o 360 parte. ${extra}`,
        `Qualitative: ${sectorName} ${offer}. The reading is not just the number — it is where the 360 breaks. ${extra}`,
        locale
      );
    })(),
  };
}

export function buildInterventionNarrative(
  brief: TechnicalBrief,
  locale: DxLocale
): InterventionNarrative {
  const levers = brief.priorityGaps.slice(0, 5).map((gap, i) => ({
    title: L(`Palanca ${i + 1}`, `Alavanca ${i + 1}`, `Lever ${i + 1}`, locale),
    why: gap,
    approach: L(
      `Para sanar o potenciar esto, podemos trabajar: diagnóstico de causa → acción piloto de 2–4 semanas → evidencia simple → ajuste.`,
      `Para sanar ou potenciar isto, podemos trabalhar: diagnóstico de causa → ação piloto de 2–4 semanas → evidência simples → ajuste.`,
      `To fix or strengthen this, we can work: root-cause check → 2–4 week pilot → simple evidence → adjust.`,
      locale
    ),
  }));

  if (brief.potentials[0]) {
    levers.push({
      title: L('Potencial', 'Potencial', 'Potential', locale),
      why: brief.potentials[0],
      approach: L(
        'Ya hay base — subir un nivel con un piloto medible, sin reinventar todo el negocio.',
        'Já há base — subir um nível com um piloto mensurável, sem reinventar o negócio todo.',
        'There is already a base — raise one level with a measurable pilot, without reinventing the business.',
        locale
      ),
    });
  }

  return {
    opening: L(
      `A partir del diagnóstico (fase ${stageLabel(brief.inferredStage, 'es')}), proponemos una intervención gradual. No asumimos que todo ya existe: construimos lo mínimo viable en cada frente.`,
      `A partir do diagnóstico (fase ${stageLabel(brief.inferredStage, 'pt')}), propomos uma intervenção gradual. Não assumimos que tudo já existe: construímos o mínimo viável em cada frente.`,
      `From the diagnostic (stage ${stageLabel(brief.inferredStage, 'en')}), we propose a gradual intervention. We do not assume everything already exists: we build the minimum viable on each front.`,
      locale
    ),
    levers,
    dialoguePrompt: L(
      '¿Con cuál de estas palancas quiere empezar el diálogo? Puede corregir, priorizar o añadir contexto del territorio.',
      'Com qual destas alavancas quer começar o diálogo? Pode corrigir, priorizar ou acrescentar contexto do território.',
      'Which lever should we start the dialogue with? You can correct, prioritize or add local context.',
      locale
    ),
  };
}

export function buildStrategicDraft(
  brief: TechnicalBrief,
  locale: DxLocale,
  dialogueNotes?: string
): StrategicDraft {
  const notes = (dialogueNotes || '').trim();
  return {
    businessModel: {
      valueProp: L(
        'Propuesta de valor a explicitar con el cliente ideal (1 frase + prueba de campo).',
        'Proposta de valor a explicitar com o cliente ideal (1 frase + prova de campo).',
        'Value proposition to make explicit with ICP (1 sentence + field test).',
        locale
      ),
      customers: L(
        'Segmentos prioritarios según canales ya usados en el diagnóstico comercial.',
        'Segmentos prioritários conforme canais já usados no diagnóstico comercial.',
        'Priority segments based on channels already used in the commercial diagnostic.',
        locale
      ),
      channels: L(
        'Canal principal + canal de respaldo; reglas de precio y entrega.',
        'Canal principal + canal de recurso; regras de preço e entrega.',
        'Primary channel + backup; price and delivery rules.',
        locale
      ),
      revenue: L(
        'Cómo cobra (contado, pedido, contrato) y ticket mínimo viable.',
        'Como cobra (pronto, encomenda, contrato) e ticket mínimo viável.',
        'How you get paid (cash, order, contract) and minimum viable ticket.',
        locale
      ),
      costs: L(
        'Costos directos críticos + fijos mínimos a registrar semanalmente.',
        'Custos diretos críticos + fixos mínimos a registar semanalmente.',
        'Critical direct costs + minimum fixed costs to log weekly.',
        locale
      ),
    },
    commercialPlan: {
      focus: brief.priorityGaps.find((g) => /client|canal|precio|venda|venta|comercial/i.test(g)) ||
        L('Adquisición y retención de clientes prioritarios', 'Aquisição e retenção de clientes prioritários', 'Acquisition and retention of priority customers', locale),
      actions: [
        L('Mapa de 10–20 contactos / puntos de venta', 'Mapa de 10–20 contactos / pontos de venda', 'Map of 10–20 contacts / points of sale', locale),
        L('Rutina mínima de venta (preguntas → oferta → cierre)', 'Rotina mínima de venda (perguntas → oferta → fecho)', 'Minimum sales routine (questions → offer → close)', locale),
        L('Seguimiento postventa a clientes clave', 'Seguimento pós-venda a clientes-chave', 'Post-sale follow-up with key customers', locale),
      ],
      kpis: [
        L('Nº de contactos / semana', 'Nº de contactos / semana', 'Contacts / week', locale),
        L('Conversión a venta', 'Conversão a venda', 'Conversion to sale', locale),
        L('Ticket medio / margen aproximado', 'Ticket médio / margem aproximada', 'Average ticket / approx margin', locale),
      ],
    },
    execution: {
      hires: [
        L(
          'Solo si el volumen lo justifica: apoyo en venta/entrega o registro (medio tiempo).',
          'Só se o volume justificar: apoio em venda/entrega ou registo (meio tempo).',
          'Only if volume justifies it: sales/delivery or record-keeping support (part-time).',
          locale
        ),
      ],
      purchases: [
        L(
          'Compras del plan: lo que el diagnóstico exige (insumo, sensor, registro) — con fecha y dueño, no una lista de deseos.',
          'Compras do plano: o que o diagnóstico exige (insumo, sensor, registo) — com data e dono, não uma lista de desejos.',
          'Plan purchases: what the diagnosis requires (input, sensor, record) — with date and owner, not a wish list.',
          locale
        ),
      ],
      tools: [
        L('Hoja / app simple de caja y clientes', 'Folha / app simples de caixa e clientes', 'Simple sheet/app for cash and customers', locale),
        L('WhatsApp Business o canal ya usado, con plantillas', 'WhatsApp Business ou canal já usado, com templates', 'WhatsApp Business or existing channel with templates', locale),
        L('Carpeta de evidencias (fotos, tickets, acuerdos)', 'Pasta de evidências (fotos, tickets, acordos)', 'Evidence folder (photos, tickets, agreements)', locale),
      ],
      milestones: [
        L('Semana 2: modelo mínimo escrito y validado oralmente', 'Semana 2: modelo mínimo escrito e validado oralmente', 'Week 2: minimum model written and orally validated', locale),
        L('Mes 1: rutina comercial + caja en marcha', 'Mês 1: rotina comercial + caixa a funcionar', 'Month 1: commercial routine + cash tracking live', locale),
        L('Mes 3: revisión de KPIs y ajuste del plan', 'Mês 3: revisão de KPIs e ajuste do plano', 'Month 3: KPI review and plan adjustment', locale),
        ...(notes
          ? [L(`Acuerdo del diálogo: ${notes.slice(0, 120)}`, `Acordo do diálogo: ${notes.slice(0, 120)}`, `Dialogue agreement: ${notes.slice(0, 120)}`, locale)]
          : []),
      ],
      indicators: [
        L('Caja semanal (entra / sale)', 'Caixa semanal (entra / sai)', 'Weekly cash (in / out)', locale),
        L('Líneas reales en el cuaderno del módulo', 'Linhas reais no caderno do módulo', 'Real lines in the module book', locale),
        L('Brecha 360 más débil: subir 8 puntos en 90 días', 'Lacuna 360 mais fraca: subir 8 pontos em 90 dias', 'Weakest 360 quad: +8 points in 90 days', locale),
      ],
    },
    nextDialogueQuestion: L(
      '¿Qué restricción real (tiempo, capital, clima, mercado) debemos respetar al priorizar el plan?',
      'Que restrição real (tempo, capital, clima, mercado) devemos respeitar ao priorizar o plano?',
      'What real constraint (time, capital, climate, market) must we respect when prioritizing the plan?',
      locale
    ),
  };
}
