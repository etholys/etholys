/**
 * Banco de diagnóstico NEXUS em camadas:
 * 1) core — qualquer negócio
 * 2) level — nível geral de gestão
 * 3) commercial — comercialização
 * 4) sector — problemas específicos do setor
 * 5) production — produção / agroindústria / industrial (quando aplica)
 */

import { getEconomicSector } from './nexus-economic-sectors';
import type { DiagnosticDepth } from './nexus-incubation-program';

export type LayerSection = 'core' | 'level' | 'commercial' | 'sector' | 'production';

export type LayerOption = {
  id: string;
  label: { es: string; pt: string; en: string };
  score: number;
};

export type LayerQuestion = {
  id: string;
  sectorId?: string;
  source: 'base';
  section: LayerSection;
  pillarSlug?: string;
  areaName?: string;
  prompt: { es: string; pt: string; en: string };
  help?: { es: string; pt: string; en: string };
  options: LayerOption[];
  weight: number;
  multi?: boolean;
  exclusiveOptionId?: string;
};

type L3 = { es: string; pt: string; en: string };

const t = (es: string, pt: string, en: string): L3 => ({ es, pt, en });

function opts(rows: Array<{ id: string; es: string; pt: string; en: string; score: number }>): LayerOption[] {
  return rows.map((r) => ({
    id: r.id,
    label: { es: r.es, pt: r.pt, en: r.en },
    score: r.score,
  }));
}

function q(partial: Omit<LayerQuestion, 'source' | 'weight'> & { weight?: number }): LayerQuestion {
  return {
    source: 'base',
    weight: partial.weight ?? 1,
    ...partial,
  };
}

/** 1 — Qualquer negócio */
export const DX_CORE: LayerQuestion[] = [
  q({
    id: 'core_scale',
    section: 'core',
    areaName: 'Escala',
    prompt: t(
      'Hoy, ¿cómo es el tamaño y la forma de su negocio?',
      'Hoje, como é o tamanho e a forma do seu negócio?',
      'Today, what is the size and shape of your business?'
    ),
    help: t(
      'No hay respuesta «mejor». Sirve para no asumir equipos ni organigramas.',
      'Não há resposta «melhor». Serve para não assumir equipas nem organogramas.',
      'No «best» answer — stops us assuming teams or org charts.'
    ),
    options: opts([
      { id: 'solo', es: 'Trabajo solo / casi solo', pt: 'Trabalho sozinho / quase sozinho', en: 'Solo / nearly solo', score: 62 },
      { id: 'family', es: 'Yo + familia o 1–2 personas que ayudan', pt: 'Eu + família ou 1–2 pessoas que ajudam', en: 'Me + family or 1–2 helpers', score: 65 },
      { id: 'micro', es: 'Micro con algunos colaboradores (hasta ~10)', pt: 'Micro com alguns colaboradores (até ~10)', en: 'Micro with a few collaborators (~10)', score: 70 },
      { id: 'small', es: 'Pequeña empresa con roles más definidos', pt: 'Pequena empresa com papéis mais definidos', en: 'Small business with clearer roles', score: 78 },
      { id: 'structured', es: 'Empresa con equipos y procesos más formales', pt: 'Empresa com equipas e processos mais formais', en: 'Company with teams and formal processes', score: 85 },
    ]),
    weight: 0.9,
  }),
  q({
    id: 'core_offer',
    section: 'core',
    areaName: 'Oferta',
    prompt: t(
      '¿Qué vende principalmente: producto, servicio, o ambos?',
      'O que vende principalmente: produto, serviço, ou ambos?',
      'What do you mainly sell: product, service, or both?'
    ),
    help: t(
      'Define el diagnóstico 360: producción primaria/secundaria vs. servicio (terciaria).',
      'Define o diagnóstico 360: produção primária/secundária vs. serviço (terciária).',
      'Sets the 360 diagnosis: primary/secondary production vs. service (tertiary).',
    ),
    options: opts([
      { id: 'product', es: 'Producto (cosecha, lote, bien físico)', pt: 'Produto (colheita, lote, bem físico)', en: 'Product (crop, lot, physical good)', score: 70 },
      { id: 'service', es: 'Servicio (atiendo, asesoro, transformo para otro)', pt: 'Serviço (atendo, assessoro, transformo para outro)', en: 'Service (I serve, advise, process for others)', score: 70 },
      { id: 'both', es: 'Ambos: vendo un bien y un servicio', pt: 'Ambos: vendo um bem e um serviço', en: 'Both: I sell a good and a service', score: 78 },
    ]),
    weight: 1.05,
  }),
  q({
    id: 'core_model',
    section: 'core',
    areaName: 'Modelo',
    prompt: t(
      '¿Está claro qué vende, a quién y cómo cobra?',
      'Está claro o que vende, a quem e como cobra?',
      'Is it clear what you sell, to whom, and how you get paid?'
    ),
    help: t(
      'Si trabaja solo, «claro para mí» ya es una respuesta válida.',
      'Se trabalha sozinho, «claro para mim» já é uma resposta válida.',
      'If you work alone, “clear to me” is a valid answer.'
    ),
    options: opts([
      { id: 'unclear', es: 'Aún no está claro', pt: 'Ainda não está claro', en: 'Still unclear', score: 20 },
      { id: 'me', es: 'Claro solo para mí', pt: 'Claro só para mim', en: 'Clear only to me', score: 48 },
      { id: 'helpers', es: 'Claro para mí y quien me ayuda', pt: 'Claro para mim e quem me ajuda', en: 'Clear to me and helpers', score: 72 },
      { id: 'shared', es: 'Escrito o acordado; quien vende/atiende también lo sabe', pt: 'Escrito ou acordado; quem vende/atende também sabe', en: 'Written/agreed; sellers/attendees also know', score: 90 },
    ]),
    weight: 1.25,
  }),
  q({
    id: 'core_stage',
    section: 'core',
    areaName: 'Estado',
    prompt: t(
      '¿En qué momento está el negocio hoy?',
      'Em que momento está o negócio hoje?',
      'Where is the business today?'
    ),
    help: t(
      'Elija la opción más cercana a la realidad actual.',
      'Escolha a opção mais próxima da realidade atual.',
      'Pick the closest to current reality.'
    ),
    options: opts([
      { id: 'idea', es: 'Idea / arranque (aún irregular)', pt: 'Ideia / arranque (ainda irregular)', en: 'Idea / startup (still irregular)', score: 35 },
      { id: 'surviving', es: 'Opera, pero vive al día (caja justa)', pt: 'Opera, mas vive ao dia (caixa justa)', en: 'Operating day-to-day (tight cash)', score: 45 },
      { id: 'stable', es: 'Estable: cubre gastos y algo de sobra', pt: 'Estável: cobre gastos e sobra alguma coisa', en: 'Stable: covers costs with some surplus', score: 70 },
      { id: 'growing', es: 'Creciendo con demanda o capacidad limitada', pt: 'A crescer com procura ou capacidade limitada', en: 'Growing with demand or capacity limits', score: 78 },
      { id: 'scaling', es: 'Escalando con procesos más firmes', pt: 'A escalar com processos mais firmes', en: 'Scaling with firmer processes', score: 88 },
    ]),
    weight: 1.1,
  }),
  q({
    id: 'core_blockers',
    section: 'core',
    areaName: 'Bloqueos',
    prompt: t(
      'Hoy, ¿cuáles son los bloqueos para crecer o estabilizarse?',
      'Hoje, quais são os bloqueios para crescer ou estabilizar-se?',
      'Today, what blocks growth or stabilization?'
    ),
    help: t(
      'Puede marcar más de uno. Si no hay freno crítico, elija solo esa opción.',
      'Pode marcar mais de um. Se não há travão crítico, escolha só essa opção.',
      'You can select more than one. If none are critical, choose only that.'
    ),
    options: opts([
      { id: 'capital', es: 'Capital / caja / crédito', pt: 'Capital / caixa / crédito', en: 'Capital / cash / credit', score: 38 },
      { id: 'market', es: 'Clientes / demanda / precio', pt: 'Clientes / procura / preço', en: 'Customers / demand / price', score: 42 },
      { id: 'operations', es: 'Producción / logística / calidad', pt: 'Produção / logística / qualidade', en: 'Production / logistics / quality', score: 40 },
      { id: 'team', es: 'Gente / tiempo / dependencia del dueño', pt: 'Gente / tempo / dependência do dono', en: 'People / time / owner dependency', score: 36 },
      { id: 'formalization', es: 'Formalización / permisos / cumplimiento', pt: 'Formalização / licenças / conformidade', en: 'Formalization / permits / compliance', score: 44 },
      { id: 'knowledge', es: 'Falta de información técnica o de mercado', pt: 'Falta de informação técnica ou de mercado', en: 'Lack of technical or market know-how', score: 46 },
      { id: 'none', es: 'Ningún bloqueo crítico hoy', pt: 'Nenhum bloqueio crítico hoje', en: 'No critical blocker today', score: 88 },
    ]),
    weight: 1.2,
    multi: true,
    exclusiveOptionId: 'none',
  }),
];

/** 2 — Nível geral de gestão */
export const DX_LEVEL: LayerQuestion[] = [
  q({
    id: 'lvl_cash',
    section: 'level',
    pillarSlug: 'finance',
    areaName: 'Caja',
    prompt: t(
      '¿Conoce cuánto entra y sale de caja en un mes típico?',
      'Sabe quanto entra e sai de caixa num mês típico?',
      'Do you know typical monthly cash in and out?'
    ),
    help: t(
      'No hace falta contabilidad sofisticada: una libreta o hoja ya cuenta.',
      'Não precisa de contabilidade sofisticada: um caderno ou folha já conta.',
      'No fancy accounting needed — a notebook or sheet counts.'
    ),
    options: opts([
      { id: 'no', es: 'No lo sé con claridad', pt: 'Não sei com clareza', en: 'I don’t know clearly', score: 22 },
      { id: 'rough', es: 'Tengo una idea aproximada', pt: 'Tenho uma ideia aproximada', en: 'I have a rough idea', score: 48 },
      { id: 'tracked', es: 'Lo anoto / reviso al menos mensualmente', pt: 'Anoto / revejo pelo menos mensalmente', en: 'I track/review at least monthly', score: 72 },
      { id: 'planned', es: 'Lo sigo y anticipo las próximas semanas', pt: 'Sigo e antecipo as próximas semanas', en: 'I track and forecast the coming weeks', score: 90 },
    ]),
    weight: 1.2,
  }),
  q({
    id: 'lvl_accounting',
    section: 'level',
    pillarSlug: 'finance',
    areaName: 'Contabilidad',
    prompt: t(
      'Además de la caja, ¿lleva cuentas (ingresos/gastos, impuestos, estados simples)?',
      'Além da caixa, leva contas (receitas/despesas, impostos, estados simples)?',
      'Besides cash, do you keep accounts (income/expense, tax, simple statements)?'
    ),
    help: t(
      'Caja ≠ contabilidad. Las dos hacen falta para un plan anual.',
      'Caixa ≠ contabilidade. As duas fazem falta para um plano anual.',
      'Cash ≠ accounting. Both are needed for an annual plan.',
    ),
    options: opts([
      { id: 'none', es: 'No; solo sé si hay plata hoy', pt: 'Não; só sei se há dinheiro hoje', en: 'No; I only know if there is cash today', score: 22 },
      { id: 'tax', es: 'Lo mínimo para impuestos / un contador externo', pt: 'O mínimo para impostos / um contabilista externo', en: 'Minimum for tax / an external bookkeeper', score: 50 },
      { id: 'monthly', es: 'Reviso ingresos y gastos al mes', pt: 'Revejo receitas e despesas ao mês', en: 'I review income and expenses monthly', score: 72 },
      { id: 'used', es: 'Uso las cifras para decidir (precio, compra, sueldo)', pt: 'Uso os números para decidir (preço, compra, salário)', en: 'I use the numbers to decide (price, purchase, wage)', score: 90 },
    ]),
    weight: 1.15,
  }),
  q({
    id: 'lvl_margin',
    section: 'level',
    pillarSlug: 'finance',
    areaName: 'Margen',
    prompt: t(
      '¿Sabe si lo que vende deja margen después de costos directos?',
      'Sabe se o que vende deixa margem depois dos custos diretos?',
      'Do you know if sales leave margin after direct costs?'
    ),
    options: opts([
      { id: 'no', es: 'No lo calculo', pt: 'Não calculo', en: 'I don’t calculate it', score: 20 },
      { id: 'feel', es: 'Solo por sensación («me alcanza»)', pt: 'Só por sensação («dá»)', en: 'Only by feel (“it covers”)', score: 42 },
      { id: 'main', es: 'Sé el margen de lo principal que vendo', pt: 'Sei a margem do principal que vendo', en: 'I know margin on main products', score: 72 },
      { id: 'lines', es: 'Sé margen por línea o producto clave', pt: 'Sei margem por linha ou produto-chave', en: 'I know margin by key line/product', score: 90 },
    ]),
    weight: 1.15,
  }),
  q({
    id: 'lvl_people',
    section: 'level',
    pillarSlug: 'people',
    areaName: 'Personas',
    prompt: t(
      '¿Quién hace qué (usted, familia, empleados) y cómo se acuerda el trabajo?',
      'Quem faz o quê (você, família, empregados) e como se acorda o trabalho?',
      'Who does what (you, family, staff) and how is the work agreed?'
    ),
    options: opts([
      { id: 'solo', es: 'Casi todo lo hago yo; no hay acuerdos', pt: 'Quase tudo faço eu; não há acordos', en: 'I do almost everything; no agreements', score: 28 },
      { id: 'oral', es: 'Ayuda familiar / informal, de palabra', pt: 'Ajuda familiar / informal, de palavra', en: 'Family / informal help, verbal', score: 48 },
      { id: 'roles', es: 'Hay roles claros aunque simples', pt: 'Há papéis claros ainda que simples', en: 'Roles are clear, even if simple', score: 72 },
      { id: 'agreed', es: 'Roles + acuerdo de tiempo / pago / responsabilidad', pt: 'Papéis + acordo de tempo / pagamento / responsabilidade', en: 'Roles + agreement on time / pay / responsibility', score: 90 },
    ]),
    weight: 1.1,
  }),
  q({
    id: 'lvl_formal',
    section: 'level',
    pillarSlug: 'strategy',
    areaName: 'Formalización',
    prompt: t(
      '¿La empresa está formalizada para operar y vender (permisos, RUC/NIT, contratos)?',
      'A empresa está formalizada para operar e vender (licenças, NIF, contratos)?',
      'Is the firm formalized to operate and sell (permits, tax ID, contracts)?'
    ),
    options: opts([
      { id: 'none', es: 'Informal / sin papeles clave', pt: 'Informal / sem papéis-chave', en: 'Informal / missing key papers', score: 25 },
      { id: 'partial', es: 'Algunos papeles; otros pendientes o vencidos', pt: 'Alguns papéis; outros pendentes ou vencidos', en: 'Some papers; others pending or expired', score: 48 },
      { id: 'ok', es: 'Puedo vender y emitir lo básico en regla', pt: 'Posso vender e emitir o básico em regra', en: 'I can sell and issue the basics in order', score: 75 },
      { id: 'ready', es: 'Listo para clientes o fondos que piden evidencia', pt: 'Pronto para clientes ou fundos que pedem evidência', en: 'Ready for buyers or funds that ask for evidence', score: 90 },
    ]),
    weight: 1.05,
  }),
  q({
    id: 'lvl_delivery',
    section: 'level',
    pillarSlug: 'operations',
    areaName: 'Entrega',
    prompt: t(
      'En una semana normal, ¿cumple lo que promete a clientes (plazo y calidad)?',
      'Numa semana normal, cumpre o que promete aos clientes (prazo e qualidade)?',
      'In a normal week, do you deliver what you promise (time and quality)?'
    ),
    options: opts([
      { id: 'often_fail', es: 'Fallo seguido (atrasos o calidad)', pt: 'Falho bastante (atrasos ou qualidade)', en: 'Often fail (delays or quality)', score: 25 },
      { id: 'mixed', es: 'A veces sí, a veces no', pt: 'Às vezes sim, às vezes não', en: 'Sometimes yes, sometimes no', score: 48 },
      { id: 'mostly', es: 'Casi siempre cumplo', pt: 'Quase sempre cumpro', en: 'I almost always deliver', score: 75 },
      { id: 'reliable', es: 'Cumplo y puedo explicar por qué cuando falla', pt: 'Cumpro e sei explicar quando falha', en: 'Reliable, and I know why when it fails', score: 90 },
    ]),
    weight: 1.15,
  }),
  q({
    id: 'lvl_dependency',
    section: 'level',
    pillarSlug: 'people',
    areaName: 'Continuidad',
    prompt: t(
      'Si usted falta una semana, ¿el negocio sigue funcionando?',
      'Se faltar uma semana, o negócio continua a funcionar?',
      'If you are away a week, does the business keep running?'
    ),
    options: opts([
      { id: 'stops', es: 'Se detiene casi todo', pt: 'Para quase tudo', en: 'Almost everything stops', score: 22 },
      { id: 'basic', es: 'Alguien cubre lo básico (familia / ayuda)', pt: 'Alguém cobre o básico (família / ajuda)', en: 'Someone covers basics (family/help)', score: 48 },
      { id: 'critical', es: 'Las tareas críticas quedan cubiertas', pt: 'As tarefas críticas ficam cobertas', en: 'Critical tasks stay covered', score: 72 },
      { id: 'planned', es: 'Hay reemplazos claros para lo esencial', pt: 'Há substituições claras para o essencial', en: 'Clear backups for essentials', score: 90 },
    ]),
    weight: 1.05,
  }),
  q({
    id: 'lvl_plan',
    section: 'level',
    pillarSlug: 'strategy',
    areaName: 'Plan',
    prompt: t(
      '¿Tiene prioridades claras para los próximos 1–3 meses?',
      'Tem prioridades claras para os próximos 1–3 meses?',
      'Do you have clear priorities for the next 1–3 months?'
    ),
    options: opts([
      { id: 'react', es: 'Voy reaccionando a lo que aparece', pt: 'Vou reagindo ao que aparece', en: 'I react to whatever appears', score: 25 },
      { id: 'head', es: 'Prioridades solo en mi cabeza', pt: 'Prioridades só na minha cabeça', en: 'Priorities only in my head', score: 48 },
      { id: 'shared', es: 'Prioridades compartidas con quien me ayuda', pt: 'Prioridades partilhadas com quem me ajuda', en: 'Priorities shared with helpers', score: 72 },
      { id: 'written', es: 'Prioridades escritas y revisadas', pt: 'Prioridades escritas e revistas', en: 'Written and reviewed priorities', score: 90 },
    ]),
    weight: 1.05,
  }),
  q({
    id: 'lvl_records',
    section: 'level',
    pillarSlug: 'digital',
    areaName: 'Registros',
    prompt: t(
      '¿Dónde guarda datos clave (ventas, clientes, costos, producción)?',
      'Onde guarda dados-chave (vendas, clientes, custos, produção)?',
      'Where do you keep key data (sales, customers, costs, production)?'
    ),
    options: opts([
      { id: 'memory', es: 'Casi todo de memoria', pt: 'Quase tudo de memória', en: 'Almost all from memory', score: 22 },
      { id: 'paper', es: 'Papel / mensajes dispersos', pt: 'Papel / mensagens dispersas', en: 'Paper / scattered messages', score: 45 },
      { id: 'sheet', es: 'Una hoja o carpeta principal', pt: 'Uma folha ou pasta principal', en: 'One main sheet or folder', score: 70 },
      { id: 'system', es: 'Sistema o rutina clara (app, ERP, carpeta ordenada)', pt: 'Sistema ou rotina clara (app, ERP, pasta ordenada)', en: 'Clear system/routine (app, ERP, ordered folder)', score: 88 },
    ]),
    weight: 1,
  }),
];

/** 3 — Comercialização (qualquer negócio que vende) */
export const DX_COMMERCIAL: LayerQuestion[] = [
  q({
    id: 'com_channels',
    section: 'commercial',
    pillarSlug: 'commercial',
    areaName: 'Canales',
    prompt: t(
      '¿Por qué canales vende hoy?',
      'Por que canais vende hoje?',
      'Through which channels do you sell today?'
    ),
    help: t('Marque todos los que usa.', 'Marque todos os que usa.', 'Select all that apply.'),
    options: opts([
      { id: 'direct', es: 'Venta directa (puerta, finca, local, WhatsApp)', pt: 'Venda direta (porta, quinta, loja, WhatsApp)', en: 'Direct (door, farm, shop, WhatsApp)', score: 70 },
      { id: 'market', es: 'Feria / mercado / plaza', pt: 'Feira / mercado / praça', en: 'Fair / market / plaza', score: 68 },
      { id: 'intermediary', es: 'Intermediario / acopiador / mayorista', pt: 'Intermediário / angariador / grossista', en: 'Middleman / aggregator / wholesaler', score: 55 },
      { id: 'b2b', es: 'Contratos B2B (tiendas, hoteles, industria)', pt: 'Contratos B2B (lojas, hotéis, indústria)', en: 'B2B contracts (shops, hotels, industry)', score: 78 },
      { id: 'online', es: 'Online / delivery / redes', pt: 'Online / delivery / redes', en: 'Online / delivery / social', score: 72 },
      { id: 'weak', es: 'Vendo poco o sin canal estable', pt: 'Vendo pouco ou sem canal estável', en: 'Little sales / no stable channel', score: 28 },
    ]),
    weight: 1.15,
    multi: true,
    exclusiveOptionId: 'weak',
  }),
  q({
    id: 'com_price',
    section: 'commercial',
    pillarSlug: 'commercial',
    areaName: 'Precio',
    prompt: t(
      '¿Cómo fija el precio de lo que vende?',
      'Como define o preço do que vende?',
      'How do you set the price of what you sell?'
    ),
    options: opts([
      { id: 'guess', es: 'Por intuición o «lo que piden»', pt: 'Por intuição ou «o que pedem»', en: 'By intuition or “what they ask”', score: 28 },
      { id: 'copy', es: 'Copio el precio del mercado / vecino', pt: 'Copio o preço do mercado / vizinho', en: 'I copy market/neighbor price', score: 45 },
      { id: 'cost', es: 'Parto de mis costos + un margen', pt: 'Parto dos meus custos + uma margem', en: 'From my costs + a margin', score: 72 },
      { id: 'value', es: 'Costos + mercado + valor que percibe el cliente', pt: 'Custos + mercado + valor que o cliente percebe', en: 'Costs + market + customer perceived value', score: 90 },
    ]),
    weight: 1.15,
  }),
  q({
    id: 'com_demand',
    section: 'commercial',
    pillarSlug: 'commercial',
    areaName: 'Demanda',
    prompt: t(
      '¿Conoce quién compra más y con qué frecuencia?',
      'Sabe quem compra mais e com que frequência?',
      'Do you know who buys most and how often?'
    ),
    options: opts([
      { id: 'no', es: 'No lo tengo claro', pt: 'Não tenho claro', en: 'Not clear', score: 25 },
      { id: 'feel', es: 'Tengo una idea informal', pt: 'Tenho uma ideia informal', en: 'Informal idea', score: 48 },
      { id: 'known', es: 'Sé mis clientes o tipos principales', pt: 'Sei os meus clientes ou tipos principais', en: 'I know main customers/types', score: 72 },
      { id: 'tracked', es: 'Los registro y sé frecuencia / ticket aproximado', pt: 'Registo e sei frequência / ticket aproximado', en: 'I track frequency / approximate ticket', score: 90 },
    ]),
    weight: 1.1,
  }),
  q({
    id: 'com_pitch',
    section: 'commercial',
    pillarSlug: 'commercial',
    areaName: 'Oferta',
    prompt: t(
      'Cuando vende o atiende, ¿sigue una rutina mínima (preguntas, oferta, cierre)?',
      'Quando vende ou atende, segue uma rotina mínima (perguntas, oferta, fecho)?',
      'When selling or serving, do you follow a minimal routine (questions, offer, close)?'
    ),
    options: opts([
      { id: 'improv', es: 'Improviso en cada venta', pt: 'Improviso em cada venda', en: 'I improvise every sale', score: 25 },
      { id: 'habit', es: 'Tengo un jeito habitual, no escrito', pt: 'Tenho um jeito habitual, não escrito', en: 'Habitual approach, not written', score: 50 },
      { id: 'guide', es: 'Tengo un guía simple (notas / mensaje)', pt: 'Tenho um guia simples (notas / mensagem)', en: 'Simple guide (notes / message)', score: 75 },
      { id: 'shared', es: 'Guía clara y quien atiende también la sigue', pt: 'Guia claro e quem atende também segue', en: 'Clear guide that attendants also follow', score: 90 },
    ]),
    weight: 1,
  }),
  q({
    id: 'com_after',
    section: 'commercial',
    pillarSlug: 'commercial',
    areaName: 'Postventa',
    prompt: t(
      'Después de vender, ¿vuelve a contactar o dar seguimiento?',
      'Depois de vender, volta a contactar ou fazer seguimento?',
      'After selling, do you follow up with the customer?'
    ),
    options: opts([
      { id: 'never', es: 'Casi nunca', pt: 'Quase nunca', en: 'Almost never', score: 28 },
      { id: 'rare', es: 'Solo si hay problema o reclamo', pt: 'Só se há problema ou reclamação', en: 'Only if there’s a problem', score: 45 },
      { id: 'key', es: 'Sí, con clientes importantes', pt: 'Sim, com clientes importantes', en: 'Yes, with key customers', score: 72 },
      { id: 'routine', es: 'Sí, con una rutina (mensaje, visita, pedido)', pt: 'Sim, com uma rotina (mensagem, visita, pedido)', en: 'Yes, with a routine (message, visit, order)', score: 88 },
    ]),
    weight: 0.95,
  }),
];

/** 5 — Produção primária / secundária / terciária (agro + indústria + serviço) */
export const DX_PRODUCTION: LayerQuestion[] = [
  q({
    id: 'prod_layer',
    section: 'production',
    pillarSlug: 'operations',
    areaName: 'Eslabón',
    prompt: t(
      'Hoy, ¿qué eslabones de producción tiene? (puede marcar más de uno)',
      'Hoje, que elos de produção tem? (pode marcar mais de um)',
      'Today, which production links do you have? (select all that apply)'
    ),
    help: t(
      'Primaria = campo/cría. Secundaria = planta/transformación. Terciaria = servicio que usted presta.',
      'Primária = campo/criação. Secundária = planta/transformação. Terciária = serviço que presta.',
      'Primary = field/herd. Secondary = plant/processing. Tertiary = the service you deliver.',
    ),
    options: opts([
      { id: 'primary', es: 'Primaria (cultivo, cría, extracción, cosecha)', pt: 'Primária (cultura, criação, extração, colheita)', en: 'Primary (crop, herd, extract, harvest)', score: 70 },
      { id: 'secondary', es: 'Secundaria (transformo, envaso, planta)', pt: 'Secundária (transformo, embalo, planta)', en: 'Secondary (I process, pack, run a plant)', score: 72 },
      { id: 'tertiary', es: 'Terciaria (presto un servicio: atención, logística, asistencia)', pt: 'Terciária (presto um serviço: atendimento, logística, assistência)', en: 'Tertiary (I deliver a service: care, logistics, assistance)', score: 70 },
      { id: 'trade', es: 'Solo comercializo / no produzco', pt: 'Só comercializo / não produzo', en: 'I only trade / do not produce', score: 55 },
    ]),
    weight: 1.1,
    multi: true,
    exclusiveOptionId: 'trade',
  }),
  q({
    id: 'prod_capacity',
    section: 'production',
    pillarSlug: 'operations',
    areaName: 'Capacidad',
    prompt: t(
      '¿La capacidad de producir/transformar alcanza la demanda actual?',
      'A capacidade de produzir/transformar chega à procura atual?',
      'Does production/processing capacity meet current demand?'
    ),
    options: opts([
      { id: 'short', es: 'Me falta capacidad (pierdo pedidos)', pt: 'Falta capacidade (perco pedidos)', en: 'Short capacity (lost orders)', score: 35 },
      { id: 'tight', es: 'Al límite; cualquier pico me atrasa', pt: 'No limite; qualquer pico atrasa', en: 'At the limit; any peak delays me', score: 48 },
      { id: 'ok', es: 'Alcanza en la mayoría de semanas', pt: 'Chega na maioria das semanas', en: 'Enough most weeks', score: 72 },
      { id: 'flex', es: 'Alcanza y puedo planear picos', pt: 'Chega e consigo planear picos', en: 'Enough and I can plan peaks', score: 88 },
      { id: 'na', es: 'No aplica (solo comercializo / servicio)', pt: 'Não se aplica (só comercializo / serviço)', en: 'N/A (only trade / services)', score: 70 },
    ]),
    weight: 1.15,
  }),
  q({
    id: 'prod_loss',
    section: 'production',
    pillarSlug: 'operations',
    areaName: 'Mermas',
    prompt: t(
      '¿Conoce y controla mermas, desperdicio o producto no conforme?',
      'Conhece e controla perdas, desperdício ou produto não conforme?',
      'Do you know and control waste, spoilage or non-conforming product?'
    ),
    options: opts([
      { id: 'no', es: 'No lo mido', pt: 'Não meço', en: 'I don’t measure it', score: 22 },
      { id: 'feel', es: 'Sé que hay merma, sin número', pt: 'Sei que há perda, sem número', en: 'I know there’s waste, no number', score: 42 },
      { id: 'approx', es: 'Tengo un % o cantidad aproximada', pt: 'Tenho um % ou quantidade aproximada', en: 'I have an approximate % or amount', score: 70 },
      { id: 'managed', es: 'Lo registro y actúo para bajarlo', pt: 'Registo e ajo para baixar', en: 'I record it and act to reduce it', score: 90 },
      { id: 'na', es: 'No aplica a mi actividad', pt: 'Não se aplica à minha atividade', en: 'Does not apply', score: 70 },
    ]),
    weight: 1.1,
  }),
  q({
    id: 'prod_quality',
    section: 'production',
    pillarSlug: 'operations',
    areaName: 'Calidad',
    prompt: t(
      '¿Hay controles mínimos de calidad o inocuidad en lo que produce?',
      'Há controlos mínimos de qualidade ou inocuidade no que produz?',
      'Are there minimal quality/food-safety checks on what you produce?'
    ),
    options: opts([
      { id: 'none', es: 'Ninguno formal', pt: 'Nenhum formal', en: 'None formal', score: 25 },
      { id: 'eye', es: 'Solo inspección a ojo / costumbre', pt: 'Só inspeção a olho / costume', en: 'Eye check / habit only', score: 48 },
      { id: 'basic', es: 'Checklist o puntos de control básicos', pt: 'Checklist ou pontos de controlo básicos', en: 'Basic checklist / control points', score: 72 },
      { id: 'doc', es: 'Controles documentados (y registros)', pt: 'Controlos documentados (e registos)', en: 'Documented checks (and records)', score: 90 },
      { id: 'na', es: 'No produzco / no transformo', pt: 'Não produzo / não transformo', en: 'I don’t produce/process', score: 70 },
    ]),
    weight: 1.15,
  }),
  q({
    id: 'prod_inputs',
    section: 'production',
    pillarSlug: 'operations',
    areaName: 'Insumos',
    prompt: t(
      '¿Cómo asegura insumos críticos (materia prima, envases, repuestos)?',
      'Como assegura insumos críticos (matéria-prima, embalagens, peças)?',
      'How do you secure critical inputs (raw material, packaging, parts)?'
    ),
    options: opts([
      { id: 'spot', es: 'Compro cuando hace falta, sin plan', pt: 'Compro quando falta, sem plano', en: 'Buy when needed, no plan', score: 28 },
      { id: 'one', es: 'Dependo de un solo proveedor clave', pt: 'Dependo de um só fornecedor-chave', en: 'Depend on one key supplier', score: 40 },
      { id: 'alt', es: 'Tengo alternativas para lo crítico', pt: 'Tenho alternativas para o crítico', en: 'I have alternatives for critical items', score: 72 },
      { id: 'planned', es: 'Plan de compras + proveedores claros', pt: 'Plano de compras + fornecedores claros', en: 'Purchase plan + clear suppliers', score: 90 },
      { id: 'na', es: 'No aplica', pt: 'Não se aplica', en: 'N/A', score: 70 },
    ]),
    weight: 1.05,
  }),
];

function sectorPack(sectorId: string, questions: LayerQuestion[]): LayerQuestion[] {
  return questions.map((x) => ({ ...x, section: 'sector' as const, sectorId }));
}

const SECTOR_PACKS: Record<string, LayerQuestion[]> = {
  apiculture: sectorPack('apiculture', [
    q({
      id: 'sec_api_health',
      section: 'sector',
      areaName: 'Sanidad',
      prompt: t(
        '¿Cómo lleva la sanidad de las colmenas (varroa, nosema, manejo)?',
        'Como trata a sanidade das colmeias (varroa, nosema, manejo)?',
        'How do you manage hive health (varroa, nosema, husbandry)?'
      ),
      options: opts([
        { id: 'react', es: 'Actúo solo cuando veo problema grave', pt: 'Ajo só quando vejo problema grave', en: 'Only when I see a serious problem', score: 25 },
        { id: 'season', es: 'Trato en temporadas, sin registro', pt: 'Trato em épocas, sem registo', en: 'Seasonal treatment, no records', score: 48 },
        { id: 'calendar', es: 'Calendario de manejo y tratamientos', pt: 'Calendário de manejo e tratamentos', en: 'Husbandry and treatment calendar', score: 72 },
        { id: 'tracked', es: 'Calendario + registros por apiario/colmena', pt: 'Calendário + registos por apiário/colmeia', en: 'Calendar + records by yard/hive', score: 90 },
      ]),
      weight: 1.25,
    }),
    q({
      id: 'sec_api_book',
      section: 'sector',
      areaName: 'Cuaderno',
      prompt: t(
        '¿Lleva un cuaderno apícola (inspección, varroa, tratamientos) por colmena o apiario?',
        'Leva um caderno apícola (inspeção, varroa, tratamentos) por colmeia ou apiário?',
        'Do you keep a hive book (inspection, varroa, treatments) by hive or yard?'
      ),
      options: opts([
        { id: 'none', es: 'No registro nada', pt: 'Não registo nada', en: 'I record nothing', score: 22 },
        { id: 'memory', es: 'Solo memoria / notas sueltas', pt: 'Só memória / notas soltas', en: 'Memory / loose notes only', score: 42 },
        { id: 'paper', es: 'Cuaderno de papel irregular', pt: 'Caderno de papel irregular', en: 'Irregular paper book', score: 65 },
        { id: 'live', es: 'Registro por colmena con fechas', pt: 'Registo por colmeia com datas', en: 'Per-hive records with dates', score: 90 },
      ]),
      weight: 1.2,
    }),
    q({
      id: 'sec_api_forage',
      section: 'sector',
      areaName: 'Flora',
      prompt: t(
        '¿Planifica ubicación / trashumancia según flora y floración?',
        'Planeia localização / transumância conforme flora e floração?',
        'Do you plan siting / migration by forage and bloom?'
      ),
      options: opts([
        { id: 'fixed', es: 'Sitio fijo sin plan de flora', pt: 'Local fixo sem plano de flora', en: 'Fixed site, no forage plan', score: 35 },
        { id: 'observe', es: 'Observo flora, sin plan escrito', pt: 'Observo flora, sem plano escrito', en: 'I observe forage, no written plan', score: 55 },
        { id: 'season', es: 'Muevo o ubico según temporada', pt: 'Movo ou posiciono conforme a época', en: 'I move/site by season', score: 75 },
        { id: 'map', es: 'Plan de floración / rutas con fechas', pt: 'Plano de floração / rotas com datas', en: 'Bloom plan / routes with dates', score: 90 },
      ]),
      weight: 1.15,
    }),
    q({
      id: 'sec_api_harvest',
      section: 'sector',
      areaName: 'Cosecha',
      prompt: t(
        '¿Cómo controla cosecha, extracción y calidad de miel/derivados?',
        'Como controla colheita, extração e qualidade do mel/derivados?',
        'How do you control harvest, extraction and honey quality?'
      ),
      options: opts([
        { id: 'improv', es: 'Según oportunidad, sin estándares', pt: 'Conforme oportunidade, sem padrões', en: 'Opportunistic, no standards', score: 28 },
        { id: 'basic', es: 'Buenas prácticas básicas (higiene, humedad a ojo)', pt: 'Boas práticas básicas (higiene, humidade a olho)', en: 'Basic practices (hygiene, moisture by eye)', score: 55 },
        { id: 'measure', es: 'Mido humedad / calidad en lo principal', pt: 'Meço humidade / qualidade no principal', en: 'I measure moisture/quality on main lots', score: 75 },
        { id: 'std', es: 'Protocolo de extracción + registros de lote', pt: 'Protocolo de extração + registos de lote', en: 'Extraction protocol + lot records', score: 92 },
      ]),
      weight: 1.2,
    }),
    q({
      id: 'sec_api_sales',
      section: 'sector',
      areaName: 'Venta apícola',
      prompt: t(
        '¿Qué vende y con qué estabilidad de mercado?',
        'O que vende e com que estabilidade de mercado?',
        'What do you sell and how stable is the market?'
      ),
      options: opts([
        { id: 'spot', es: 'Miel a granel cuando sale / precio del momento', pt: 'Mel a granel quando sai / preço do momento', en: 'Bulk honey when ready / spot price', score: 35 },
        { id: 'local', es: 'Clientes locales recurrentes (envase propio)', pt: 'Clientes locais recorrentes (embalagem própria)', en: 'Recurring local buyers (own pack)', score: 65 },
        { id: 'mix', es: 'Mix: miel + otros (polen, cera, polinización)', pt: 'Mix: mel + outros (pólen, cera, polinização)', en: 'Mix: honey + other (pollen, wax, pollination)', score: 78 },
        { id: 'contracts', es: 'Contratos o canales estables con precio/calidad', pt: 'Contratos ou canais estáveis com preço/qualidade', en: 'Stable contracts/channels with price/quality', score: 90 },
      ]),
      weight: 1.15,
    }),
  ]),
  agriculture: sectorPack('agriculture', [
    q({
      id: 'sec_agr_plan',
      section: 'sector',
      areaName: 'Plan cultivo',
      prompt: t(
        '¿Tiene plan de siembra/cosecha y costo aproximado por hectárea o parcela?',
        'Tem plano de sementeira/colheita e custo aproximado por hectare ou parcela?',
        'Do you have a crop plan and approximate cost per hectare/plot?'
      ),
      options: opts([
        { id: 'no', es: 'Decido ciclo a ciclo sin plan', pt: 'Decido ciclo a ciclo sem plano', en: 'Cycle-by-cycle, no plan', score: 25 },
        { id: 'head', es: 'Plan en la cabeza / costumbre', pt: 'Plano na cabeça / costume', en: 'Plan in my head / habit', score: 48 },
        { id: 'basic', es: 'Plan simple + costos aproximados', pt: 'Plano simples + custos aproximados', en: 'Simple plan + approx costs', score: 72 },
        { id: 'tracked', es: 'Plan escrito con costos y fechas', pt: 'Plano escrito com custos e datas', en: 'Written plan with costs and dates', score: 90 },
      ]),
      weight: 1.2,
    }),
    q({
      id: 'sec_agr_book',
      section: 'sector',
      areaName: 'Cuaderno',
      prompt: t(
        '¿Registra siembra, riego e insumos en un cuaderno de campo por parcela?',
        'Regista sementeira, irrigação e insumos num caderno de campo por parcela?',
        'Do you log planting, irrigation and inputs in a field book by parcel?'
      ),
      options: opts([
        { id: 'none', es: 'No hay cuaderno', pt: 'Não há caderno', en: 'No field book', score: 20 },
        { id: 'memory', es: 'Solo memoria / papel suelto', pt: 'Só memória / papel solto', en: 'Memory / loose paper only', score: 40 },
        { id: 'irregular', es: 'Anoto a veces, no por parcela', pt: 'Anoto às vezes, não por parcela', en: 'Sometimes, not by parcel', score: 58 },
        { id: 'live', es: 'Líneas reales por parcela con fechas', pt: 'Linhas reais por parcela com datas', en: 'Real lines per parcel with dates', score: 90 },
      ]),
      weight: 1.25,
    }),
    q({
      id: 'sec_agr_inputs',
      section: 'sector',
      areaName: 'Insumos',
      prompt: t(
        '¿Cómo asegura semillas, fertilizantes y otros insumos a tiempo?',
        'Como assegura sementes, fertilizantes e outros insumos a tempo?',
        'How do you secure seed, fertilizer and other inputs on time?'
      ),
      options: opts([
        { id: 'late', es: 'Suelo comprar tarde o incompleto', pt: 'Costumo comprar tarde ou incompleto', en: 'Often late or incomplete', score: 28 },
        { id: 'spot', es: 'Compro cuando hay plata / oferta', pt: 'Compro quando há dinheiro / oferta', en: 'Buy when cash/offer appears', score: 45 },
        { id: 'season', es: 'Anticipo la temporada principal', pt: 'Antecipo a época principal', en: 'I anticipate the main season', score: 72 },
        { id: 'plan', es: 'Plan de compras + proveedores definidos', pt: 'Plano de compras + fornecedores definidos', en: 'Purchase plan + defined suppliers', score: 90 },
      ]),
      weight: 1.1,
    }),
    q({
      id: 'sec_agr_water',
      section: 'sector',
      areaName: 'Riego',
      prompt: t(
        '¿Cómo decide el riego — turno fijo, criterio o sensor de humedad?',
        'Como decide a irrigação — turno fixo, critério ou sensor de humidade?',
        'How do you decide irrigation — fixed turn, criterion or moisture sensor?'
      ),
      options: opts([
        { id: 'guess', es: 'A ojo / cuando puedo', pt: 'A olho / quando posso', en: 'By eye / when I can', score: 28 },
        { id: 'turn', es: 'Turno fijo, sin medir humedad', pt: 'Turno fixo, sem medir humidade', en: 'Fixed turn, no moisture measure', score: 48 },
        { id: 'criteria', es: 'Criterio (suelo, cultivo) anotado', pt: 'Critério (solo, cultura) anotado', en: 'Written criterion (soil, crop)', score: 72 },
        { id: 'sensor', es: 'Sensor o medición + umbral', pt: 'Sensor ou medição + limiar', en: 'Sensor or measurement + threshold', score: 90 },
      ]),
      weight: 1.15,
    }),
    q({
      id: 'sec_agr_market',
      section: 'sector',
      areaName: 'Precio agro',
      prompt: t(
        '¿Cómo decide cuándo y a quién vender la cosecha?',
        'Como decide quando e a quem vender a colheita?',
        'How do you decide when and to whom to sell the harvest?'
      ),
      options: opts([
        { id: 'urgent', es: 'Vendo por urgencia de caja', pt: 'Vendo por urgência de caixa', en: 'Sell under cash pressure', score: 28 },
        { id: 'buyer', es: 'Un comprador habitual fija el ritmo', pt: 'Um comprador habitual fixa o ritmo', en: 'One habitual buyer sets the pace', score: 48 },
        { id: 'compare', es: 'Comparo precios / canales antes de vender', pt: 'Comparo preços / canais antes de vender', en: 'I compare prices/channels before selling', score: 72 },
        { id: 'strategy', es: 'Estrategia de venta (momento, calidad, canal)', pt: 'Estratégia de venda (momento, qualidade, canal)', en: 'Sales strategy (timing, quality, channel)', score: 90 },
      ]),
      weight: 1.15,
    }),
  ]),
  horticulture: sectorPack('horticulture', [
    q({
      id: 'sec_hor_calendar',
      section: 'sector',
      areaName: 'Calendario',
      prompt: t(
        '¿Tiene calendario de siembra y rotación de canteros/camas?',
        'Tem calendário de plantio e rotação de canteiros?',
        'Do you have a planting calendar and bed rotation?'
      ),
      options: opts([
        { id: 'no', es: 'Siembro según oportunidad', pt: 'Planto conforme oportunidade', en: 'Plant when opportunity appears', score: 28 },
        { id: 'memory', es: 'Calendario mental / costumbre', pt: 'Calendário mental / costume', en: 'Mental calendar / habit', score: 50 },
        { id: 'written', es: 'Calendario escrito simple', pt: 'Calendário escrito simples', en: 'Simple written calendar', score: 75 },
        { id: 'rotation', es: 'Calendario + rotación y sucesión planificadas', pt: 'Calendário + rotação e sucessão planeadas', en: 'Calendar + planned rotation/succession', score: 90 },
      ]),
      weight: 1.2,
    }),
    q({
      id: 'sec_hor_book',
      section: 'sector',
      areaName: 'Cuaderno',
      prompt: t(
        '¿Lleva cuaderno de canteros (siembra, riego, insumos, merma)?',
        'Leva caderno de canteiros (plantio, irrigação, insumos, perda)?',
        'Do you keep a bed book (planting, irrigation, inputs, loss)?'
      ),
      options: opts([
        { id: 'none', es: 'No registro', pt: 'Não registo', en: 'I record nothing', score: 22 },
        { id: 'memory', es: 'Memoria / notas sueltas', pt: 'Memória / notas soltas', en: 'Memory / loose notes', score: 42 },
        { id: 'partial', es: 'Algunas camas, irregular', pt: 'Alguns canteiros, irregular', en: 'Some beds, irregular', score: 62 },
        { id: 'live', es: 'Por cantero con fechas', pt: 'Por canteiro com datas', en: 'By bed with dates', score: 90 },
      ]),
      weight: 1.2,
    }),
    q({
      id: 'sec_hor_post',
      section: 'sector',
      areaName: 'Poscosecha',
      prompt: t(
        '¿Controla riego, insumos y mermas de poscosecha?',
        'Controla irrigação, insumos e perdas pós-colheita?',
        'Do you control irrigation, inputs and postharvest loss?'
      ),
      options: opts([
        { id: 'weak', es: 'Poco control; merma alta o desconocida', pt: 'Pouco controlo; perda alta ou desconhecida', en: 'Little control; high/unknown loss', score: 25 },
        { id: 'basic', es: 'Riego/insumos a ojo; merma no medida', pt: 'Irrigação/insumos a olho; perda não medida', en: 'Irrigation/inputs by eye; loss not measured', score: 48 },
        { id: 'partial', es: 'Algunas prácticas + idea de merma', pt: 'Algumas práticas + ideia de perda', en: 'Some practices + idea of loss', score: 70 },
        { id: 'managed', es: 'Prácticas claras y merma estimada/registrada', pt: 'Práticas claras e perda estimada/registada', en: 'Clear practices and estimated/recorded loss', score: 90 },
      ]),
      weight: 1.15,
    }),
    q({
      id: 'sec_hor_sales',
      section: 'sector',
      areaName: 'Venta fresca',
      prompt: t(
        '¿Cómo comercializa producto fresco (feria, contrato, entrega)?',
        'Como comercializa produto fresco (feira, contrato, entrega)?',
        'How do you market fresh produce (fair, contract, delivery)?'
      ),
      options: opts([
        { id: 'spot', es: 'Venta ocasional sin canal fijo', pt: 'Venda ocasional sem canal fixo', en: 'Occasional sales, no fixed channel', score: 30 },
        { id: 'fair', es: 'Feria/mercado habitual', pt: 'Feira/mercado habitual', en: 'Habitual fair/market', score: 62 },
        { id: 'mix', es: 'Mix feria + clientes fijos', pt: 'Mix feira + clientes fixos', en: 'Mix fair + regular customers', score: 78 },
        { id: 'contract', es: 'Contratos o entregas recurrentes con volumen', pt: 'Contratos ou entregas recorrentes com volume', en: 'Contracts or recurring volume deliveries', score: 90 },
      ]),
      weight: 1.15,
    }),
  ]),
  poultry: sectorPack('poultry', [
    q({
      id: 'sec_pou_bio',
      section: 'sector',
      areaName: 'Bioseguridad',
      prompt: t(
        '¿Cómo maneja densidad, postura y bioseguridad del galpón/patio?',
        'Como gere densidade, postura e biossegurança do galpão/quintal?',
        'How do you manage density, laying and biosecurity?'
      ),
      options: opts([
        { id: 'loose', es: 'Manejo libre / sin normas claras', pt: 'Manejo livre / sem normas claras', en: 'Loose management / no clear rules', score: 28 },
        { id: 'basic', es: 'Algunas prácticas (limpieza, separación)', pt: 'Algumas práticas (limpeza, separação)', en: 'Some practices (cleaning, separation)', score: 52 },
        { id: 'routine', es: 'Rutina de manejo y sanidad', pt: 'Rotina de manejo e sanidade', en: 'Husbandry and health routine', score: 75 },
        { id: 'tracked', es: 'Rutina + registros (mortalidad, postura)', pt: 'Rotina + registos (mortalidade, postura)', en: 'Routine + records (mortality, lay)', score: 90 },
      ]),
      weight: 1.2,
    }),
    q({
      id: 'sec_pou_book',
      section: 'sector',
      areaName: 'Cuaderno',
      prompt: t(
        '¿Registra postura, mortalidad y ración por galpón / lote?',
        'Regista postura, mortalidade e ração por galpão / lote?',
        'Do you log laying, mortality and feed by house / flock?'
      ),
      options: opts([
        { id: 'none', es: 'No registro', pt: 'Não registo', en: 'I record nothing', score: 20 },
        { id: 'memory', es: 'Solo de memoria', pt: 'Só de memória', en: 'From memory only', score: 40 },
        { id: 'week', es: 'Anoto al final de la semana', pt: 'Anoto no fim da semana', en: 'I note at week end', score: 62 },
        { id: 'daily', es: 'Línea diaria por galpón', pt: 'Linha diária por galpão', en: 'Daily line per house', score: 90 },
      ]),
      weight: 1.25,
    }),
    q({
      id: 'sec_pou_cost',
      section: 'sector',
      areaName: 'Costo',
      prompt: t(
        '¿Conoce el costo aproximado por huevo o por ave?',
        'Conhece o custo aproximado por ovo ou por ave?',
        'Do you know approximate cost per egg or bird?'
      ),
      options: opts([
        { id: 'no', es: 'No lo calculo', pt: 'Não calculo', en: 'I don’t calculate it', score: 22 },
        { id: 'feed', es: 'Solo miro el gasto de alimento', pt: 'Só olho o gasto de ração', en: 'I only watch feed spend', score: 45 },
        { id: 'approx', es: 'Costo aproximado por unidad', pt: 'Custo aproximado por unidade', en: 'Approx unit cost', score: 72 },
        { id: 'full', es: 'Costo + conversión / revisión periódica', pt: 'Custo + conversão / revisão periódica', en: 'Cost + conversion / periodic review', score: 90 },
      ]),
      weight: 1.15,
    }),
    q({
      id: 'sec_pou_sales',
      section: 'sector',
      areaName: 'Venta aves',
      prompt: t(
        '¿Cómo vende huevos y/o aves?',
        'Como vende ovos e/ou aves?',
        'How do you sell eggs and/or birds?'
      ),
      options: opts([
        { id: 'irregular', es: 'Venta irregular / vecinos', pt: 'Venda irregular / vizinhos', en: 'Irregular / neighbors', score: 35 },
        { id: 'route', es: 'Ruta o clientes fijos informales', pt: 'Rota ou clientes fixos informais', en: 'Route or informal regular buyers', score: 60 },
        { id: 'stable', es: 'Canales estables (tienda, feria, pedido)', pt: 'Canais estáveis (loja, feira, pedido)', en: 'Stable channels (shop, fair, order)', score: 78 },
        { id: 'planned', es: 'Volumen y precio planificados', pt: 'Volume e preço planeados', en: 'Planned volume and price', score: 90 },
      ]),
      weight: 1.1,
    }),
  ]),
  livestock: sectorPack('livestock', [
    q({
      id: 'sec_liv_health',
      section: 'sector',
      areaName: 'Sanidad',
      prompt: t(
        '¿Cómo lleva sanidad, alimentación y productividad del rebaño?',
        'Como trata sanidade, alimentação e produtividade do rebanho?',
        'How do you manage herd health, feed and productivity?'
      ),
      options: opts([
        { id: 'react', es: 'Reactivo (cuando hay enfermo o baja)', pt: 'Reativo (quando há doente ou queda)', en: 'Reactive (sick animal / drop)', score: 28 },
        { id: 'basic', es: 'Prácticas básicas sin registros', pt: 'Práticas básicas sem registos', en: 'Basic practices, no records', score: 50 },
        { id: 'routine', es: 'Calendario sanitario / alimentación definida', pt: 'Calendário sanitário / alimentação definida', en: 'Health calendar / defined feeding', score: 75 },
        { id: 'tracked', es: 'Calendario + registros de producción', pt: 'Calendário + registos de produção', en: 'Calendar + production records', score: 90 },
      ]),
      weight: 1.2,
    }),
    q({
      id: 'sec_liv_book',
      section: 'sector',
      areaName: 'Cuaderno',
      prompt: t(
        '¿Lleva cuaderno zootécnico (sanidad, ración, ordeño) por lote?',
        'Leva caderno zootécnico (sanidade, ração, ordenha) por lote?',
        'Do you keep a herd book (health, feed, milking) by lot?'
      ),
      options: opts([
        { id: 'none', es: 'No hay cuaderno', pt: 'Não há caderno', en: 'No herd book', score: 20 },
        { id: 'memory', es: 'Memoria / recetas sueltas', pt: 'Memória / receitas soltas', en: 'Memory / loose recipes', score: 40 },
        { id: 'irregular', es: 'Anoto tratamientos, no la ración', pt: 'Anoto tratamentos, não a ração', en: 'I log treatments, not feed', score: 60 },
        { id: 'live', es: 'Líneas por lote con fechas', pt: 'Linhas por lote com datas', en: 'Lines per lot with dates', score: 90 },
      ]),
      weight: 1.25,
    }),
    q({
      id: 'sec_liv_cold',
      section: 'sector',
      areaName: 'Cadena',
      prompt: t(
        '¿Cómo asegura calidad hasta la venta (frío, higiene, transporte)?',
        'Como assegura qualidade até à venda (frio, higiene, transporte)?',
        'How do you keep quality to sale (cold, hygiene, transport)?'
      ),
      options: opts([
        { id: 'weak', es: 'Poco control después de producir', pt: 'Pouco controlo depois de produzir', en: 'Little control after production', score: 28 },
        { id: 'basic', es: 'Prácticas básicas de higiene/transporte', pt: 'Práticas básicas de higiene/transporte', en: 'Basic hygiene/transport practices', score: 52 },
        { id: 'partial', es: 'Cadena parcial (frío o tiempos definidos)', pt: 'Cadeia parcial (frio ou tempos definidos)', en: 'Partial chain (cold or defined times)', score: 72 },
        { id: 'solid', es: 'Cadena clara hasta el comprador', pt: 'Cadeia clara até ao comprador', en: 'Clear chain to the buyer', score: 90 },
      ]),
      weight: 1.15,
    }),
  ]),
  agroindustry: sectorPack('agroindustry', [
    q({
      id: 'sec_agi_process',
      section: 'sector',
      areaName: 'Proceso',
      prompt: t(
        '¿Los procesos de transformación están definidos (pasos, tiempos, responsables)?',
        'Os processos de transformação estão definidos (passos, tempos, responsáveis)?',
        'Are processing steps defined (steps, times, owners)?'
      ),
      options: opts([
        { id: 'ad_hoc', es: 'Cada lote se improvisa', pt: 'Cada lote se improvisa', en: 'Each batch is improvised', score: 25 },
        { id: 'oral', es: 'Se sabe oralmente / depende de una persona', pt: 'Sabe-se oralmente / depende de uma pessoa', en: 'Known orally / one-person dependent', score: 48 },
        { id: 'basic', es: 'Pasos claros, poco documentados', pt: 'Passos claros, pouco documentados', en: 'Clear steps, lightly documented', score: 72 },
        { id: 'doc', es: 'Proceso documentado con controles', pt: 'Processo documentado com controlos', en: 'Documented process with controls', score: 90 },
      ]),
      weight: 1.25,
    }),
    q({
      id: 'sec_agi_book',
      section: 'sector',
      areaName: 'Cuaderno',
      prompt: t(
        '¿El cuaderno de planta (higiene, lote, QC) se usa cada turno?',
        'O caderno de planta (higiene, lote, QC) usa-se em cada turno?',
        'Is the plant book (hygiene, lot, QC) used every shift?'
      ),
      options: opts([
        { id: 'none', es: 'No hay cuaderno / PDF en la pared', pt: 'Não há caderno / PDF na parede', en: 'No book / PDF on the wall', score: 22 },
        { id: 'irregular', es: 'Se llena cuando hay visita', pt: 'Preenche-se quando há visita', en: 'Filled when there is a visit', score: 42 },
        { id: 'partial', es: 'Higiene sí; lote a veces', pt: 'Higiene sim; lote às vezes', en: 'Hygiene yes; lot sometimes', score: 65 },
        { id: 'live', es: 'Una línea real por turno', pt: 'Uma linha real por turno', en: 'One real line per shift', score: 90 },
      ]),
      weight: 1.2,
    }),
    q({
      id: 'sec_agi_safety',
      section: 'sector',
      areaName: 'Inocuidad',
      prompt: t(
        '¿Cumple normas básicas de inocuidad y etiquetado?',
        'Cumpre normas básicas de inocuidade e rotulagem?',
        'Do you meet basic food-safety and labeling norms?'
      ),
      options: opts([
        { id: 'no', es: 'Aún no / desconocido', pt: 'Ainda não / desconhecido', en: 'Not yet / unknown', score: 22 },
        { id: 'partial', es: 'Algunas prácticas, sin evidencia completa', pt: 'Algumas práticas, sem evidência completa', en: 'Some practices, incomplete evidence', score: 48 },
        { id: 'basic', es: 'Buenas prácticas + etiqueta mínima', pt: 'Boas práticas + rótulo mínimo', en: 'Good practices + minimal label', score: 72 },
        { id: 'ready', es: 'Listo para auditorías / clientes exigentes', pt: 'Pronto para auditorias / clientes exigentes', en: 'Ready for audits / demanding buyers', score: 90 },
      ]),
      weight: 1.25,
    }),
    q({
      id: 'sec_agi_b2b',
      section: 'sector',
      areaName: 'B2B',
      prompt: t(
        '¿Cómo están contratos B2B y logística de distribución?',
        'Como estão contratos B2B e logística de distribuição?',
        'How are B2B contracts and distribution logistics?'
      ),
      options: opts([
        { id: 'spot', es: 'Pedidos sueltos sin contrato', pt: 'Pedidos soltos sem contrato', en: 'One-off orders, no contract', score: 35 },
        { id: 'verbal', es: 'Acuerdos verbales recurrentes', pt: 'Acordos verbais recorrentes', en: 'Recurring verbal agreements', score: 52 },
        { id: 'simple', es: 'Contratos simples + entregas planificadas', pt: 'Contratos simples + entregas planeadas', en: 'Simple contracts + planned deliveries', score: 75 },
        { id: 'solid', es: 'Contratos + logística y servicio medidos', pt: 'Contratos + logística e serviço medidos', en: 'Contracts + measured logistics/service', score: 90 },
      ]),
      weight: 1.15,
    }),
  ]),
  manufacturing: sectorPack('manufacturing', [
    q({
      id: 'sec_mfg_bottleneck',
      section: 'sector',
      areaName: 'Cuellos',
      prompt: t(
        '¿Conoce el principal cuello de botella de producción?',
        'Conhece o principal gargalo de produção?',
        'Do you know the main production bottleneck?'
      ),
      options: opts([
        { id: 'no', es: 'No está claro', pt: 'Não está claro', en: 'Not clear', score: 25 },
        { id: 'feel', es: 'Tengo una sospecha', pt: 'Tenho uma suspeita', en: 'I have a suspicion', score: 48 },
        { id: 'known', es: 'Lo identifiqué y lo explico', pt: 'Identifiquei e explico', en: 'Identified and I can explain it', score: 72 },
        { id: 'managed', es: 'Lo mido y tengo plan para aliviarlo', pt: 'Meço e tenho plano para aliviar', en: 'I measure it and have a relief plan', score: 90 },
      ]),
      weight: 1.2,
    }),
    q({
      id: 'sec_mfg_unit',
      section: 'sector',
      areaName: 'Costo unitario',
      prompt: t(
        '¿Conoce el costo unitario de lo que fabrica?',
        'Conhece o custo unitário do que fabrica?',
        'Do you know the unit cost of what you make?'
      ),
      options: opts([
        { id: 'no', es: 'No', pt: 'Não', en: 'No', score: 22 },
        { id: 'rough', es: 'Aproximado', pt: 'Aproximado', en: 'Approximate', score: 50 },
        { id: 'main', es: 'De la línea principal', pt: 'Da linha principal', en: 'Of the main line', score: 72 },
        { id: 'updated', es: 'Actualizado con revisión periódica', pt: 'Atualizado com revisão periódica', en: 'Updated with periodic review', score: 90 },
      ]),
      weight: 1.15,
    }),
  ]),
  food_hospitality: sectorPack('food_hospitality', [
    q({
      id: 'sec_food_cost',
      section: 'sector',
      areaName: 'Food cost',
      prompt: t(
        '¿Controla food cost / costo de carta o menú?',
        'Controla food cost / custo de carta ou menu?',
        'Do you control food cost / menu cost?'
      ),
      options: opts([
        { id: 'no', es: 'No lo calculo', pt: 'Não calculo', en: 'I don’t calculate it', score: 25 },
        { id: 'feel', es: 'Por sensación de compras', pt: 'Por sensação de compras', en: 'By feel from purchases', score: 45 },
        { id: 'approx', es: 'Porcentaje aproximado', pt: 'Percentagem aproximada', en: 'Approximate percentage', score: 72 },
        { id: 'tracked', es: 'Por plato/línea y revisión', pt: 'Por prato/linha e revisão', en: 'By dish/line with review', score: 90 },
      ]),
      weight: 1.2,
    }),
    q({
      id: 'sec_food_hygiene',
      section: 'sector',
      areaName: 'Higiene',
      prompt: t(
        '¿Cómo están higiene, licencias y experiencia del cliente?',
        'Como estão higiene, licenças e experiência do cliente?',
        'How are hygiene, licenses and customer experience?'
      ),
      options: opts([
        { id: 'risk', es: 'Hay riesgos o pendientes claros', pt: 'Há riscos ou pendências claras', en: 'Clear risks or pending items', score: 28 },
        { id: 'basic', es: 'Básico cubierto, sin sistema', pt: 'Básico coberto, sem sistema', en: 'Basics covered, no system', score: 55 },
        { id: 'ok', es: 'En regla y con rutinas', pt: 'Em regra e com rotinas', en: 'Compliant with routines', score: 78 },
        { id: 'strong', es: 'Rutinas + seguimiento de quejas/experiencia', pt: 'Rotinas + seguimento de queixas/experiência', en: 'Routines + complaint/experience follow-up', score: 90 },
      ]),
      weight: 1.15,
    }),
  ]),
};

function genericSectorPack(sectorId: string): LayerQuestion[] {
  const sector = getEconomicSector(sectorId);
  const areas = sector?.focusAreas || getEconomicSector('other')!.focusAreas;
  return areas.slice(0, 4).map((area, i) =>
    q({
      id: `sec_gen_${sectorId}_${i}`,
      section: 'sector',
      sectorId,
      areaName: area.es.slice(0, 40),
      prompt: t(
        `En su actividad — ${area.es.charAt(0).toLowerCase()}${area.es.slice(1)}: ¿cuál es la situación hoy?`,
        `Na sua atividade — ${area.pt.charAt(0).toLowerCase()}${area.pt.slice(1)}: qual é a situação hoje?`,
        `In your activity — ${area.en.charAt(0).toLowerCase()}${area.en.slice(1)}: what is the situation today?`
      ),
      help: t(
        'Elija el estado real, no el ideal.',
        'Escolha o estado real, não o ideal.',
        'Pick the real state, not the ideal.'
      ),
      options: opts([
        { id: 'weak', es: 'No existe o es muy débil', pt: 'Não existe ou é muito fraco', en: 'Missing or very weak', score: 25 },
        { id: 'partial', es: 'Existe de forma informal / irregular', pt: 'Existe de forma informal / irregular', en: 'Exists informally / irregularly', score: 50 },
        { id: 'ok', es: 'Funciona de forma aceptable', pt: 'Funciona de forma aceitável', en: 'Works adequately', score: 72 },
        { id: 'strong', es: 'Está sólido y lo puedo demostrar', pt: 'Está sólido e consigo demonstrar', en: 'Solid and I can demonstrate it', score: 90 },
      ]),
      weight: 1.05,
    })
  );
}

export function getSectorDiagnosticPack(sectorId: string): LayerQuestion[] {
  return SECTOR_PACKS[sectorId] || genericSectorPack(sectorId);
}

export function sectorNeedsProductionLayer(sectorId: string): boolean {
  const s = getEconomicSector(sectorId);
  if (!s) return false;
  return s.groupId === 'agro' || s.groupId === 'industry';
}

function cap(list: LayerQuestion[], n: number): LayerQuestion[] {
  if (n <= 0) return [];
  return list.slice(0, n);
}

export function layerCaps(depth: DiagnosticDepth): {
  core: number;
  level: number;
  commercial: number;
  sector: number;
  production: number;
} {
  switch (depth) {
    case 'screening':
      return { core: 4, level: 3, commercial: 2, sector: 2, production: 0 };
    case 'standard':
      return { core: 5, level: 6, commercial: 5, sector: 5, production: 3 };
    case 'deep':
      return { core: 5, level: 8, commercial: 5, sector: 5, production: 4 };
    case 'exhaustive':
      return { core: 99, level: 99, commercial: 99, sector: 99, production: 99 };
  }
}

export function buildLayeredDiagnosticQuestions(
  sectorId: string,
  depth: DiagnosticDepth
): LayerQuestion[] {
  const caps = layerCaps(depth);
  const sectorQs = getSectorDiagnosticPack(sectorId);
  const productionQs = sectorNeedsProductionLayer(sectorId) ? DX_PRODUCTION : [];

  const parts: LayerQuestion[] = [
    ...cap(DX_CORE, caps.core),
    ...cap(DX_LEVEL, caps.level),
    ...cap(DX_COMMERCIAL, caps.commercial),
    ...cap(sectorQs, caps.sector),
    ...cap(productionQs, caps.production),
  ];

  return parts.map((item) => ({
    ...item,
    sectorId:
      item.section === 'sector' || item.section === 'production'
        ? sectorId
        : 'universal',
  }));
}

export const DX_SECTION_ORDER: LayerSection[] = ['core', 'level', 'commercial', 'sector', 'production'];
