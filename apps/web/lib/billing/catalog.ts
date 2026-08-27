/**
 * Catálogo comercial Etholys (fonte de verdade dos SKUs).
 * Preços de lista em cêntimos USD — cotações B2B podem ser ajustadas na fatura.
 */

import { WORKSPACE_SYSTEM_KEYS, type WorkspaceSystemKey } from '@/lib/integrated-workspace-shared';

export type BillingInterval = 'MONTH' | 'YEAR' | 'ONCE' | 'EVENT';
export type BillingSkuKind = 'plan' | 'system' | 'addon' | 'license' | 'commission';

export type I18nText = { pt: string; es: string; en: string };

export type BillingSku = {
  code: string;
  kind: BillingSkuKind;
  name: I18nText;
  blurb: I18nText;
  systems: WorkspaceSystemKey[];
  requiresSystems: WorkspaceSystemKey[];
  interval: BillingInterval;
  priceCents: number | null;
  currency: 'USD';
  maxSeats: number | null;
  commissionBps: number | null;
  commissionMinBps?: number;
  commissionMaxBps?: number;
  selfServe: boolean;
};

const L = (pt: string, es: string, en: string): I18nText => ({ pt, es, en });

const SYSTEM_SKUS: BillingSku[] = [
  {
    code: 'sys.ATLAS',
    kind: 'system',
    name: L('ATLAS — ERP 360°', 'ATLAS — ERP 360°', 'ATLAS — ERP 360°'),
    blurb: L(
      'Finanças, facturação, RH, stock e operações.',
      'Finanzas, facturación, RRHH, stock y operaciones.',
      'Finance, invoicing, HR, inventory, and operations.',
    ),
    systems: ['ATLAS'],
    requiresSystems: [],
    interval: 'MONTH',
    priceCents: 14900,
    currency: 'USD',
    maxSeats: 25,
    commissionBps: null,
    selfServe: true,
  },
  {
    code: 'sys.SIEP',
    kind: 'system',
    name: L('SIEP — Projectos', 'SIEP — Proyectos', 'SIEP — Projects'),
    blurb: L(
      'Portfólio, execução e monitorização de projectos.',
      'Portafolio, ejecución y monitoreo de proyectos.',
      'Portfolio, delivery, and project monitoring.',
    ),
    systems: ['SIEP'],
    requiresSystems: [],
    interval: 'MONTH',
    priceCents: 14900,
    currency: 'USD',
    maxSeats: 25,
    commissionBps: null,
    selfServe: true,
  },
  {
    code: 'sys.FUNDHUB',
    kind: 'system',
    name: L('FUNDHUB — Captação', 'FUNDHUB — Captación', 'FUNDHUB — Fundraising'),
    blurb: L(
      'Convocatórias, matching e propostas.',
      'Convocatorias, matching y propuestas.',
      'Calls, matching, and proposals.',
    ),
    systems: ['FUNDHUB'],
    requiresSystems: [],
    interval: 'MONTH',
    priceCents: 12900,
    currency: 'USD',
    maxSeats: 15,
    commissionBps: null,
    selfServe: true,
  },
  {
    code: 'sys.NEXUS',
    kind: 'system',
    name: L('NEXUS — MIPYMEs', 'NEXUS — MIPYMEs', 'NEXUS — MSMEs'),
    blurb: L(
      'Diagnóstico, rota e assistência técnica a MIPYMEs.',
      'Diagnóstico, ruta y asistencia técnica a MIPYMEs.',
      'Diagnosis, roadmap, and MSME technical assistance.',
    ),
    systems: ['NEXUS'],
    requiresSystems: [],
    interval: 'MONTH',
    priceCents: 7900,
    currency: 'USD',
    maxSeats: 20,
    commissionBps: null,
    selfServe: true,
  },
  {
    code: 'sys.FORGE',
    kind: 'system',
    name: L('FORGE — EAD', 'FORGE — EAD', 'FORGE — LMS'),
    blurb: L(
      'Cursos, jogos e formação.',
      'Cursos, juegos y formación.',
      'Courses, games, and training.',
    ),
    systems: ['FORGE'],
    requiresSystems: [],
    interval: 'MONTH',
    priceCents: 9900,
    currency: 'USD',
    maxSeats: 50,
    commissionBps: null,
    selfServe: true,
  },
  {
    code: 'sys.PRISM',
    kind: 'system',
    name: L('PRISM — BI 360°', 'PRISM — BI 360°', 'PRISM — BI 360°'),
    blurb: L(
      'Painel executivo e indicadores cruzados.',
      'Panel ejecutivo e indicadores cruzados.',
      'Executive dashboard and cross-system KPIs.',
    ),
    systems: ['PRISM'],
    requiresSystems: [],
    interval: 'MONTH',
    priceCents: 19900,
    currency: 'USD',
    maxSeats: 15,
    commissionBps: null,
    selfServe: true,
  },
];

const PLAN_SKUS: BillingSku[] = [
  {
    code: 'plan.mipyme',
    kind: 'plan',
    name: L('Pacote MIPYME', 'Paquete MIPYME', 'MSME pack'),
    blurb: L(
      'NEXUS + FORGE para cooperativas e empreendimentos.',
      'NEXUS + FORGE para cooperativas y emprendimientos.',
      'NEXUS + FORGE for co-ops and small ventures.',
    ),
    systems: ['NEXUS', 'FORGE'],
    requiresSystems: [],
    interval: 'MONTH',
    priceCents: 14900,
    currency: 'USD',
    maxSeats: 15,
    commissionBps: null,
    selfServe: true,
  },
  {
    code: 'plan.institucional',
    kind: 'plan',
    name: L('Pacote Institucional', 'Paquete Institucional', 'Institutional pack'),
    blurb: L(
      'ATLAS + FUNDHUB + FORGE para ONGs e universidades.',
      'ATLAS + FUNDHUB + FORGE para ONGs y universidades.',
      'ATLAS + FUNDHUB + FORGE for NGOs and universities.',
    ),
    systems: ['ATLAS', 'FUNDHUB', 'FORGE'],
    requiresSystems: [],
    interval: 'MONTH',
    priceCents: 29900,
    currency: 'USD',
    maxSeats: 30,
    commissionBps: null,
    selfServe: true,
  },
  {
    code: 'plan.tecnico',
    kind: 'plan',
    name: L('Pacote Técnico', 'Paquete Técnico', 'Technical pack'),
    blurb: L(
      'SIEP para centros de I+D e incubadoras.',
      'SIEP para centros de I+D e incubadoras.',
      'SIEP for R&D centres and incubators.',
    ),
    systems: ['SIEP'],
    requiresSystems: [],
    interval: 'MONTH',
    priceCents: 14900,
    currency: 'USD',
    maxSeats: 20,
    commissionBps: null,
    selfServe: true,
  },
  {
    code: 'plan.gubernamental',
    kind: 'plan',
    name: L('Pacote Governamental', 'Paquete Gubernamental', 'Government pack'),
    blurb: L(
      'Todos os sistemas + PRISM para agências e multilaterais.',
      'Todos los sistemas + PRISM para agencias y multilaterales.',
      'All systems + PRISM for agencies and multilaterals.',
    ),
    systems: [...WORKSPACE_SYSTEM_KEYS],
    requiresSystems: [],
    interval: 'MONTH',
    priceCents: 59900,
    currency: 'USD',
    maxSeats: 100,
    commissionBps: null,
    selfServe: true,
  },
];

const ADDON_SKUS: BillingSku[] = [
  {
    code: 'addon.siep.smart_import',
    kind: 'addon',
    name: L('SIEP Smart Import', 'SIEP Smart Import', 'SIEP Smart Import'),
    blurb: L(
      'Documento do doador → projecto pré-preenchido.',
      'Documento del donante → proyecto prellenado.',
      'Donor document → pre-filled project.',
    ),
    systems: [],
    requiresSystems: ['SIEP'],
    interval: 'MONTH',
    priceCents: 4900,
    currency: 'USD',
    maxSeats: null,
    commissionBps: null,
    selfServe: true,
  },
  {
    code: 'addon.siep.marketplace',
    kind: 'addon',
    name: L('SIEP Marketplace de fornecedores', 'SIEP Marketplace de proveedores', 'SIEP supplier marketplace'),
    blurb: L(
      'Ligação a fabricantes e consultores técnicos.',
      'Conexión con fabricantes y consultores técnicos.',
      'Connect with manufacturers and technical consultants.',
    ),
    systems: [],
    requiresSystems: ['SIEP'],
    interval: 'MONTH',
    priceCents: 3900,
    currency: 'USD',
    maxSeats: null,
    commissionBps: null,
    selfServe: true,
  },
  {
    code: 'addon.atlas.governance',
    kind: 'addon',
    name: L('ATLAS Governação', 'ATLAS Gobernanza', 'ATLAS Governance'),
    blurb: L('Auditoria, aprovações e ESG.', 'Auditoría, aprobaciones y ESG.', 'Audit, approvals, and ESG.'),
    systems: [],
    requiresSystems: ['ATLAS'],
    interval: 'MONTH',
    priceCents: 3900,
    currency: 'USD',
    maxSeats: null,
    commissionBps: null,
    selfServe: true,
  },
  {
    code: 'addon.atlas.legal',
    kind: 'addon',
    name: L('ATLAS Jurídico', 'ATLAS Jurídico', 'ATLAS Legal'),
    blurb: L('Contratos, licenças e PI.', 'Contratos, licencias y PI.', 'Contracts, licenses, and IP.'),
    systems: [],
    requiresSystems: ['ATLAS'],
    interval: 'MONTH',
    priceCents: 3900,
    currency: 'USD',
    maxSeats: null,
    commissionBps: null,
    selfServe: true,
  },
  {
    code: 'addon.fundhub.post_award',
    kind: 'addon',
    name: L('FUNDHUB pós-aprovação', 'FUNDHUB post-aprobación', 'FUNDHUB post-award'),
    blurb: L(
      'Gestão do fundo ganho e reportes ao doador.',
      'Gestión del fondo ganado y reportes al donante.',
      'Awarded-fund management and donor reports.',
    ),
    systems: [],
    requiresSystems: ['FUNDHUB'],
    interval: 'MONTH',
    priceCents: 4900,
    currency: 'USD',
    maxSeats: null,
    commissionBps: null,
    selfServe: true,
  },
  {
    code: 'addon.nexus.marketplace',
    kind: 'addon',
    name: L('NEXUS Canastas / marketplace', 'NEXUS Canastas / marketplace', 'NEXUS baskets / marketplace'),
    blurb: L(
      'Vendas e transacções dentro da plataforma.',
      'Ventas y transacciones dentro de la plataforma.',
      'In-platform sales and transactions.',
    ),
    systems: [],
    requiresSystems: ['NEXUS'],
    interval: 'MONTH',
    priceCents: 3900,
    currency: 'USD',
    maxSeats: null,
    commissionBps: null,
    selfServe: true,
  },
  {
    code: 'addon.nexus.wallet',
    kind: 'addon',
    name: L('NEXUS Carteira digital', 'NEXUS Billetera digital', 'NEXUS digital wallet'),
    blurb: L(
      'Receber pagamentos de vendas e captação.',
      'Recibir pagos de ventas y captación.',
      'Receive payments from sales and fundraising.',
    ),
    systems: [],
    requiresSystems: ['NEXUS'],
    interval: 'MONTH',
    priceCents: 7900,
    currency: 'USD',
    maxSeats: null,
    commissionBps: null,
    selfServe: true,
  },
  {
    code: 'addon.forge.marketplace',
    kind: 'addon',
    name: L('FORGE Marketplace educacional', 'FORGE Marketplace educacional', 'FORGE education marketplace'),
    blurb: L(
      'Cursos e mentorias de terceiros.',
      'Cursos y mentorías de terceros.',
      'Third-party courses and mentorships.',
    ),
    systems: [],
    requiresSystems: ['FORGE'],
    interval: 'MONTH',
    priceCents: 3900,
    currency: 'USD',
    maxSeats: null,
    commissionBps: null,
    selfServe: true,
  },
  {
    code: 'addon.prism.esg',
    kind: 'addon',
    name: L('PRISM ESG e impacto', 'PRISM ESG e impacto', 'PRISM ESG & impact'),
    blurb: L(
      'Indicadores ODS/GRI e relatórios de impacto.',
      'Indicadores ODS/GRI e informes de impacto.',
      'SDG/GRI indicators and impact reports.',
    ),
    systems: [],
    requiresSystems: ['PRISM'],
    interval: 'MONTH',
    priceCents: 4900,
    currency: 'USD',
    maxSeats: null,
    commissionBps: null,
    selfServe: true,
  },
  {
    code: 'addon.tool.studio',
    kind: 'addon',
    name: L('Studio (documentos com IA)', 'Studio (documentos con IA)', 'Studio (AI documents)'),
    blurb: L(
      'Ferramenta transversal — gate comercial quando deixar de ser isenta.',
      'Herramienta transversal — gate comercial cuando deje de ser exenta.',
      'Transversal tool — commercial gate when it is no longer exempt.',
    ),
    systems: [],
    requiresSystems: [],
    interval: 'MONTH',
    priceCents: 1900,
    currency: 'USD',
    maxSeats: null,
    commissionBps: null,
    selfServe: true,
  },
];

const LICENSE_SKUS: BillingSku[] = [
  {
    code: 'license.annual',
    kind: 'license',
    name: L('Licença anual B2B', 'Licencia anual B2B', 'Annual B2B license'),
    blurb: L(
      'Contrato anual sobre os sistemas já escolhidos (ou pacote). Factura única do período.',
      'Contrato anual sobre los sistemas ya elegidos (o paquete). Factura única del período.',
      'Annual contract on selected systems (or a pack). Single invoice for the term.',
    ),
    systems: [],
    requiresSystems: [],
    interval: 'YEAR',
    priceCents: 0,
    currency: 'USD',
    maxSeats: null,
    commissionBps: null,
    selfServe: true,
  },
  {
    code: 'license.whitelabel',
    kind: 'license',
    name: L('Licença White Label', 'Licencia White Label', 'White-label license'),
    blurb: L(
      'Instância com marca própria — governação, universidades, programas públicos.',
      'Instancia con marca propia — gobiernos, universidades, programas públicos.',
      'Own-brand instance — governments, universities, public programmes.',
    ),
    systems: [...WORKSPACE_SYSTEM_KEYS],
    requiresSystems: [],
    interval: 'YEAR',
    priceCents: 1200000,
    currency: 'USD',
    maxSeats: 500,
    commissionBps: null,
    selfServe: false,
  },
];

const COMMISSION_SKUS: BillingSku[] = [
  {
    code: 'commission.fundhub.success_fee',
    kind: 'commission',
    name: L('FUNDHUB success fee', 'FUNDHUB success fee', 'FUNDHUB success fee'),
    blurb: L(
      'Comissão 2–5% sobre fundos captados com assistência da plataforma.',
      'Comisión 2–5% sobre fondos captados con asistencia de la plataforma.',
      '2–5% commission on funds raised with platform assistance.',
    ),
    systems: [],
    requiresSystems: ['FUNDHUB'],
    interval: 'EVENT',
    priceCents: null,
    currency: 'USD',
    maxSeats: null,
    commissionBps: 250,
    commissionMinBps: 200,
    commissionMaxBps: 500,
    selfServe: true,
  },
  {
    code: 'commission.forge.marketplace',
    kind: 'commission',
    name: L('FORGE revenue share', 'FORGE revenue share', 'FORGE revenue share'),
    blurb: L(
      'Comissão sobre cursos/mentorias vendidos por terceiros no marketplace.',
      'Comisión sobre cursos/mentorías vendidos por terceros en el marketplace.',
      'Commission on third-party courses/mentorships sold in the marketplace.',
    ),
    systems: [],
    requiresSystems: ['FORGE'],
    interval: 'EVENT',
    priceCents: null,
    currency: 'USD',
    maxSeats: null,
    commissionBps: 1500,
    selfServe: true,
  },
  {
    code: 'commission.nexus.marketplace',
    kind: 'commission',
    name: L('NEXUS comissão marketplace', 'NEXUS comisión marketplace', 'NEXUS marketplace commission'),
    blurb: L(
      'Comissão sobre transacções em Canastas e carteira.',
      'Comisión sobre transacciones en Canastas y billetera.',
      'Commission on basket and wallet transactions.',
    ),
    systems: [],
    requiresSystems: ['NEXUS'],
    interval: 'EVENT',
    priceCents: null,
    currency: 'USD',
    maxSeats: null,
    commissionBps: 500,
    selfServe: true,
  },
];

export const BILLING_CATALOG: BillingSku[] = [
  ...PLAN_SKUS,
  ...SYSTEM_SKUS,
  ...ADDON_SKUS,
  ...LICENSE_SKUS,
  ...COMMISSION_SKUS,
];

const BY_CODE = new Map(BILLING_CATALOG.map((s) => [s.code, s]));

export function getSku(code: string): BillingSku | null {
  return BY_CODE.get(code.trim()) ?? null;
}

export function listSkusByKind(kind: BillingSkuKind): BillingSku[] {
  return BILLING_CATALOG.filter((s) => s.kind === kind);
}

export function skuForSystem(system: WorkspaceSystemKey): BillingSku | null {
  return getSku(`sys.${system}`);
}

/** Ano = 10× o preço mensal (2 meses de desconto). */
export function yearlyFromMonthly(monthlyCents: number): number {
  return monthlyCents * 10;
}

export type SkuQuote = {
  skuCode: string;
  interval: BillingInterval;
  priceCents: number;
  currency: 'USD';
  systems: WorkspaceSystemKey[];
};

export function quoteSku(
  sku: BillingSku,
  interval: BillingInterval,
  opts?: { licensedSystems?: WorkspaceSystemKey[] },
): SkuQuote | { error: string } {
  if (sku.kind === 'commission') {
    return { skuCode: sku.code, interval: 'EVENT', priceCents: 0, currency: 'USD', systems: sku.systems };
  }

  if (sku.kind === 'license' && sku.code === 'license.annual') {
    const systems = opts?.licensedSystems?.length ? opts.licensedSystems : [];
    if (systems.length === 0) {
      return { error: 'Escolha pelo menos um sistema (ou um pacote) antes da licença anual.' };
    }
    const monthly = systems.reduce((sum, key) => {
      const sys = skuForSystem(key);
      return sum + (sys?.priceCents ?? 0);
    }, 0);
    return {
      skuCode: sku.code,
      interval: 'YEAR',
      priceCents: yearlyFromMonthly(monthly),
      currency: 'USD',
      systems,
    };
  }

  const base = sku.priceCents ?? 0;
  if (interval === 'YEAR' && sku.interval === 'MONTH') {
    return {
      skuCode: sku.code,
      interval: 'YEAR',
      priceCents: yearlyFromMonthly(base),
      currency: 'USD',
      systems: sku.systems,
    };
  }

  return {
    skuCode: sku.code,
    interval: sku.interval,
    priceCents: base,
    currency: 'USD',
    systems: sku.systems,
  };
}

export function addDays(d: Date, days: number): Date {
  const n = new Date(d.getTime());
  n.setUTCDate(n.getUTCDate() + days);
  return n;
}

export function periodBounds(from: Date, interval: BillingInterval): { start: Date; end: Date } {
  const start = new Date(from.getTime());
  const end = new Date(from.getTime());
  if (interval === 'YEAR') {
    end.setUTCFullYear(end.getUTCFullYear() + 1);
  } else if (interval === 'ONCE' || interval === 'EVENT') {
    return { start, end: start };
  } else {
    end.setUTCMonth(end.getUTCMonth() + 1);
  }
  return { start, end };
}

export function commissionAmountCents(baseAmountCents: number, rateBps: number): number {
  if (baseAmountCents <= 0 || rateBps <= 0) return 0;
  return Math.round((baseAmountCents * rateBps) / 10_000);
}

export function formatCents(cents: number, currency = 'USD', locale = 'en'): string {
  return new Intl.NumberFormat(locale === 'pt' ? 'pt-PT' : locale === 'es' ? 'es-ES' : 'en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

export function pickI18n(text: I18nText, locale: string): string {
  if (locale === 'pt') return text.pt;
  if (locale === 'es') return text.es;
  return text.en;
}
