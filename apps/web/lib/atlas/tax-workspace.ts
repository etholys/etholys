/** International tax workspace: year books + country obligation packs. Not official e-filing. */

export type TaxYearTx = {
  type: string;
  amount: number;
  currency?: string | null;
  category?: string | null;
  title?: string | null;
  date?: Date | string | null;
  executionStatus?: string | null;
  scope?: string | null;
  origin?: string | null;
};

export type TaxYearInvoice = {
  type: string;
  status?: string | null;
  taxAmount?: number | null;
  total?: number | null;
  subtotal?: number | null;
  issueDate?: Date | string | null;
};

export type CategoryBucket = {
  category: string;
  income: number;
  expense: number;
  count: number;
};

export type TaxYearSummary = {
  currency: string;
  taxYear: number;
  fiscalStartMonth: number;
  cashIncome: number;
  cashExpense: number;
  cashResult: number;
  reimbursementIn: number;
  projectOnlyIn: number;
  projectOnlyOut: number;
  forecastIncome: number;
  forecastExpense: number;
  byCategory: CategoryBucket[];
  invoiceOutputTax: number;
  invoiceInputTax: number;
  invoiceReceivableTotal: number;
  invoicePayableTotal: number;
  executedCount: number;
};

export type TaxObligation = {
  id: string;
  title: string;
  titleEs: string;
  titlePt: string;
  cadence: 'annual' | 'monthly' | 'quarterly' | 'bimonthly' | 'once';
};

export type TaxCountryPack = {
  code: string;
  nameEn: string;
  nameEs: string;
  namePt: string;
  taxIdLabel: string;
  vatName: string;
  entityHints: string[];
  obligations: TaxObligation[];
};

const GENERIC_OBLIGATIONS: TaxObligation[] = [
  { id: 'income', title: 'Corporate / business income tax', titleEs: 'Impuesto a la renta / sociades', titlePt: 'Imposto sobre o rendimento das empresas', cadence: 'annual' },
  { id: 'vat', title: 'VAT / GST / sales tax returns', titleEs: 'IVA / impuesto a las ventas', titlePt: 'IVA / ICMS / ISS / GST', cadence: 'monthly' },
  { id: 'payroll', title: 'Payroll withholdings and social charges', titleEs: 'Retenciones laborales y cargas sociales', titlePt: 'Retenções e encargos trabalhistas', cadence: 'monthly' },
  { id: 'accounts', title: 'Annual accounts / books close', titleEs: 'Cierre de libros / estados anuales', titlePt: 'Encerramento de livros / demonstrações', cadence: 'annual' },
  { id: 'local', title: 'Municipal / local business tax', titleEs: 'Tributo municipal / patente', titlePt: 'Tributo municipal / alvará', cadence: 'annual' },
];

export const TAX_COUNTRY_PACKS: TaxCountryPack[] = [
  {
    code: 'UY', nameEn: 'Uruguay', nameEs: 'Uruguay', namePt: 'Uruguai',
    taxIdLabel: 'RUT', vatName: 'IVA',
    entityHints: ['SRL', 'SA', 'Unipersonal', 'SAS', 'Cooperativa'],
    obligations: [
      { id: 'irae', title: 'IRAE', titleEs: 'IRAE', titlePt: 'IRAE', cadence: 'annual' },
      { id: 'iva', title: 'IVA (DGI)', titleEs: 'IVA (DGI)', titlePt: 'IVA (DGI)', cadence: 'monthly' },
      { id: 'bps', title: 'BPS social contributions', titleEs: 'Aportes BPS', titlePt: 'Contribuições BPS', cadence: 'monthly' },
      { id: 'ip', title: 'IP / wealth if applicable', titleEs: 'IP si corresponde', titlePt: 'IP se aplicável', cadence: 'annual' },
    ],
  },
  {
    code: 'BR', nameEn: 'Brazil', nameEs: 'Brasil', namePt: 'Brasil',
    taxIdLabel: 'CNPJ', vatName: 'PIS/COFINS/ICMS/ISS',
    entityHints: ['LTDA', 'SA', 'MEI', 'EIRELI', 'SLU', 'Cooperativa'],
    obligations: [
      { id: 'irpj', title: 'IRPJ / CSLL', titleEs: 'IRPJ / CSLL', titlePt: 'IRPJ / CSLL', cadence: 'quarterly' },
      { id: 'pis', title: 'PIS / COFINS', titleEs: 'PIS / COFINS', titlePt: 'PIS / COFINS', cadence: 'monthly' },
      { id: 'iss', title: 'ISS / ICMS', titleEs: 'ISS / ICMS', titlePt: 'ISS / ICMS', cadence: 'monthly' },
      { id: 'ecf', title: 'ECD / ECF', titleEs: 'ECD / ECF', titlePt: 'ECD / ECF', cadence: 'annual' },
      { id: 'dctf', title: 'DCTF / eSocial', titleEs: 'DCTF / eSocial', titlePt: 'DCTF / eSocial', cadence: 'monthly' },
    ],
  },
  {
    code: 'US', nameEn: 'United States', nameEs: 'Estados Unidos', namePt: 'Estados Unidos',
    taxIdLabel: 'EIN', vatName: 'Sales tax',
    entityHints: ['LLC', 'C-Corp', 'S-Corp', 'Partnership', 'Sole proprietor'],
    obligations: [
      { id: '1120', title: 'Form 1120 (C-Corp / some LLCs)', titleEs: 'Formulario 1120', titlePt: 'Formulário 1120', cadence: 'annual' },
      { id: 'est', title: 'Estimated federal tax', titleEs: 'Impuesto estimado federal', titlePt: 'Imposto estimado federal', cadence: 'quarterly' },
      { id: '5472', title: 'Form 5472 if 25%+ foreign-owned', titleEs: 'Formulario 5472 si hay dueño extranjero ≥25%', titlePt: 'Formulário 5472 se sócio estrangeiro ≥25%', cadence: 'annual' },
      { id: 'state', title: 'State income / franchise / sales tax', titleEs: 'Impuesto estatal / franchise / sales tax', titlePt: 'Imposto estadual / franchise / sales tax', cadence: 'annual' },
    ],
  },
  {
    code: 'AR', nameEn: 'Argentina', nameEs: 'Argentina', namePt: 'Argentina',
    taxIdLabel: 'CUIT', vatName: 'IVA',
    entityHints: ['SRL', 'SA', 'SAS', 'Monotributo'],
    obligations: [
      { id: 'gan', title: 'Ganancias', titleEs: 'Ganancias', titlePt: 'Ganancias', cadence: 'annual' },
      { id: 'iva', title: 'IVA', titleEs: 'IVA', titlePt: 'IVA', cadence: 'monthly' },
      { id: 'iibb', title: 'Ingresos Brutos', titleEs: 'Ingresos Brutos', titlePt: 'Ingresos Brutos', cadence: 'monthly' },
    ],
  },
  {
    code: 'CL', nameEn: 'Chile', nameEs: 'Chile', namePt: 'Chile',
    taxIdLabel: 'RUT', vatName: 'IVA',
    entityHints: ['SpA', 'Ltda', 'SA', 'EIRL'],
    obligations: [
      { id: 'renta', title: 'Renta 1ª categoría / F22', titleEs: 'Renta 1ª categoría / F22', titlePt: 'Renda 1ª categoria / F22', cadence: 'annual' },
      { id: 'f29', title: 'F29 IVA / retenciones', titleEs: 'F29 IVA / retenciones', titlePt: 'F29 IVA / retenções', cadence: 'monthly' },
    ],
  },
  {
    code: 'CO', nameEn: 'Colombia', nameEs: 'Colombia', namePt: 'Colômbia',
    taxIdLabel: 'NIT', vatName: 'IVA',
    entityHints: ['SAS', 'Ltda', 'SA', 'EU'],
    obligations: [
      { id: 'renta', title: 'Renta', titleEs: 'Renta', titlePt: 'Renda', cadence: 'annual' },
      { id: 'iva', title: 'IVA', titleEs: 'IVA', titlePt: 'IVA', cadence: 'bimonthly' },
      { id: 'ica', title: 'ICA', titleEs: 'ICA', titlePt: 'ICA', cadence: 'annual' },
    ],
  },
  {
    code: 'MX', nameEn: 'Mexico', nameEs: 'México', namePt: 'México',
    taxIdLabel: 'RFC', vatName: 'IVA',
    entityHints: ['S.A. de C.V.', 'S. de R.L.', 'S.A.P.I.', 'Persona física'],
    obligations: [
      { id: 'isr', title: 'ISR', titleEs: 'ISR', titlePt: 'ISR', cadence: 'annual' },
      { id: 'iva', title: 'IVA', titleEs: 'IVA', titlePt: 'IVA', cadence: 'monthly' },
      { id: 'diot', title: 'DIOT', titleEs: 'DIOT', titlePt: 'DIOT', cadence: 'monthly' },
    ],
  },
  {
    code: 'PE', nameEn: 'Peru', nameEs: 'Perú', namePt: 'Peru',
    taxIdLabel: 'RUC', vatName: 'IGV',
    entityHints: ['SAC', 'SRL', 'EIRL', 'SA'],
    obligations: [
      { id: 'renta', title: 'Renta 3ª categoría', titleEs: 'Renta 3ª categoría', titlePt: 'Renda 3ª categoria', cadence: 'annual' },
      { id: 'igv', title: 'IGV', titleEs: 'IGV', titlePt: 'IGV', cadence: 'monthly' },
    ],
  },
  {
    code: 'PY', nameEn: 'Paraguay', nameEs: 'Paraguay', namePt: 'Paraguai',
    taxIdLabel: 'RUC', vatName: 'IVA',
    entityHints: ['SRL', 'SA', 'Unipersonal'],
    obligations: [
      { id: 'iracis', title: 'IRACIS / IRE', titleEs: 'IRACIS / IRE', titlePt: 'IRACIS / IRE', cadence: 'annual' },
      { id: 'iva', title: 'IVA', titleEs: 'IVA', titlePt: 'IVA', cadence: 'monthly' },
    ],
  },
  {
    code: 'BO', nameEn: 'Bolivia', nameEs: 'Bolivia', namePt: 'Bolívia',
    taxIdLabel: 'NIT', vatName: 'IVA',
    entityHints: ['SRL', 'SA', 'Unipersonal'],
    obligations: [
      { id: 'iue', title: 'IUE', titleEs: 'IUE', titlePt: 'IUE', cadence: 'annual' },
      { id: 'iva', title: 'IVA', titleEs: 'IVA', titlePt: 'IVA', cadence: 'monthly' },
    ],
  },
  {
    code: 'CR', nameEn: 'Costa Rica', nameEs: 'Costa Rica', namePt: 'Costa Rica',
    taxIdLabel: 'Cédula jurídica', vatName: 'IVA',
    entityHints: ['SRL', 'SA', 'Unipersonal'],
    obligations: [
      { id: 'renta', title: 'Impuesto sobre la renta', titleEs: 'Impuesto sobre la renta', titlePt: 'Imposto sobre a renda', cadence: 'annual' },
      { id: 'iva', title: 'IVA', titleEs: 'IVA', titlePt: 'IVA', cadence: 'monthly' },
    ],
  },
  {
    code: 'PA', nameEn: 'Panama', nameEs: 'Panamá', namePt: 'Panamá',
    taxIdLabel: 'RUC', vatName: 'ITBMS',
    entityHints: ['SRL', 'SA', 'LLC'],
    obligations: [
      { id: 'isr', title: 'ISR', titleEs: 'ISR', titlePt: 'ISR', cadence: 'annual' },
      { id: 'itbms', title: 'ITBMS', titleEs: 'ITBMS', titlePt: 'ITBMS', cadence: 'monthly' },
    ],
  },
  {
    code: 'GT', nameEn: 'Guatemala', nameEs: 'Guatemala', namePt: 'Guatemala',
    taxIdLabel: 'NIT', vatName: 'IVA',
    entityHints: ['SRL', 'SA', 'Unipersonal'],
    obligations: [
      { id: 'isr', title: 'ISR', titleEs: 'ISR', titlePt: 'ISR', cadence: 'annual' },
      { id: 'iva', title: 'IVA', titleEs: 'IVA', titlePt: 'IVA', cadence: 'monthly' },
    ],
  },
  {
    code: 'EC', nameEn: 'Ecuador', nameEs: 'Ecuador', namePt: 'Equador',
    taxIdLabel: 'RUC', vatName: 'IVA',
    entityHints: ['CIA. LTDA.', 'SA', 'SAS'],
    obligations: [
      { id: 'renta', title: 'Impuesto a la renta', titleEs: 'Impuesto a la renta', titlePt: 'Imposto de renda', cadence: 'annual' },
      { id: 'iva', title: 'IVA', titleEs: 'IVA', titlePt: 'IVA', cadence: 'monthly' },
    ],
  },
  {
    code: 'ES', nameEn: 'Spain', nameEs: 'España', namePt: 'Espanha',
    taxIdLabel: 'NIF/CIF', vatName: 'IVA',
    entityHints: ['SL', 'SA', 'Autónomo', 'Cooperativa'],
    obligations: [
      { id: 'is', title: 'Impuesto sobre Sociedades (mod. 200)', titleEs: 'Impuesto sobre Sociedades (mod. 200)', titlePt: 'Imposto sobre Sociedades (mod. 200)', cadence: 'annual' },
      { id: 'iva', title: 'IVA (mod. 303)', titleEs: 'IVA (mod. 303)', titlePt: 'IVA (mod. 303)', cadence: 'quarterly' },
    ],
  },
  {
    code: 'PT', nameEn: 'Portugal', nameEs: 'Portugal', namePt: 'Portugal',
    taxIdLabel: 'NIF', vatName: 'IVA',
    entityHints: ['Lda', 'SA', 'ENI', 'Cooperativa'],
    obligations: [
      { id: 'irc', title: 'IRC', titleEs: 'IRC', titlePt: 'IRC', cadence: 'annual' },
      { id: 'iva', title: 'IVA', titleEs: 'IVA', titlePt: 'IVA', cadence: 'monthly' },
      { id: 'ies', title: 'IES / accounts', titleEs: 'IES / cuentas', titlePt: 'IES / contas', cadence: 'annual' },
    ],
  },
  {
    code: 'DE', nameEn: 'Germany', nameEs: 'Alemania', namePt: 'Alemanha',
    taxIdLabel: 'Steuernummer / USt-IdNr.', vatName: 'USt',
    entityHints: ['GmbH', 'UG', 'AG', 'GbR'],
    obligations: [
      { id: 'kst', title: 'Körperschaftsteuer', titleEs: 'Körperschaftsteuer', titlePt: 'Körperschaftsteuer', cadence: 'annual' },
      { id: 'ust', title: 'Umsatzsteuer', titleEs: 'Umsatzsteuer', titlePt: 'Umsatzsteuer', cadence: 'monthly' },
    ],
  },
  {
    code: 'FR', nameEn: 'France', nameEs: 'Francia', namePt: 'França',
    taxIdLabel: 'SIRET / TVA', vatName: 'TVA',
    entityHints: ['SARL', 'SAS', 'SA', 'EI'],
    obligations: [
      { id: 'is', title: 'Impôt sur les sociétés', titleEs: 'Impôt sur les sociétés', titlePt: 'Impôt sur les sociétés', cadence: 'annual' },
      { id: 'tva', title: 'TVA', titleEs: 'TVA', titlePt: 'TVA', cadence: 'monthly' },
    ],
  },
  {
    code: 'GB', nameEn: 'United Kingdom', nameEs: 'Reino Unido', namePt: 'Reino Unido',
    taxIdLabel: 'UTR / VAT', vatName: 'VAT',
    entityHints: ['Ltd', 'LLP', 'PLC', 'Sole trader'],
    obligations: [
      { id: 'ct', title: 'Corporation Tax', titleEs: 'Corporation Tax', titlePt: 'Corporation Tax', cadence: 'annual' },
      { id: 'vat', title: 'VAT return', titleEs: 'Declaración VAT', titlePt: 'Declaração VAT', cadence: 'quarterly' },
      { id: 'accounts', title: 'Companies House accounts', titleEs: 'Cuentas Companies House', titlePt: 'Contas Companies House', cadence: 'annual' },
    ],
  },
];

const GENERIC_PACK: TaxCountryPack = {
  code: 'XX',
  nameEn: 'Other country',
  nameEs: 'Otro país',
  namePt: 'Outro país',
  taxIdLabel: 'Tax ID',
  vatName: 'VAT / GST',
  entityHints: ['Ltd', 'LLC', 'SRL', 'SA', 'Sole proprietor', 'Cooperative', 'NGO'],
  obligations: GENERIC_OBLIGATIONS,
};

export function normalizeCountryCode(raw?: string | null): string {
  const t = String(raw || '').trim().toUpperCase();
  if (!t) return '';
  if (t.length === 2) return t;
  const byName = TAX_COUNTRY_PACKS.find(
    (p) => p.nameEn.toUpperCase() === t || p.nameEs.toUpperCase() === t || p.namePt.toUpperCase() === t,
  );
  return byName?.code || t.slice(0, 2);
}

export function countryPack(code?: string | null): TaxCountryPack {
  const c = normalizeCountryCode(code);
  return TAX_COUNTRY_PACKS.find((p) => p.code === c) || GENERIC_PACK;
}

export function filingLabel(formType: string, locale: 'en' | 'es' | 'pt' = 'en'): string {
  if (formType === 'YEAR') {
    return locale === 'es' ? 'Expediente fiscal' : locale === 'pt' ? 'Dossiê fiscal' : 'Fiscal year pack';
  }
  if (formType === '1120') return 'US Form 1120';
  if (formType === '5472') return 'US Form 5472';
  return formType;
}

export function isUsOfficialForm(formType?: string | null): boolean {
  return formType === '1120' || formType === '5472';
}

export function fiscalRange(taxYear: number, startMonth = 1): { start: Date; end: Date } {
  const m = Math.min(12, Math.max(1, startMonth || 1));
  return {
    start: new Date(Date.UTC(taxYear, m - 1, 1)),
    end: new Date(Date.UTC(taxYear + 1, m - 1, 1)),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function txScope(scope?: string | null): string {
  return scope && scope.trim() ? scope : 'SHARED';
}

function isExecuted(status?: string | null): boolean {
  return status !== 'FORECAST';
}

function isIncome(type: string): boolean {
  return type === 'INCOME' || type === 'TRANSFER_IN';
}

function isExpense(type: string): boolean {
  return type === 'EXPENSE' || type === 'TRANSFER_OUT';
}

function hitsCash(scope: string): boolean {
  return scope !== 'PROJECT_ONLY';
}

function invoiceCounts(status?: string | null): boolean {
  const s = String(status || '').toUpperCase();
  return s !== 'DRAFT' && s !== 'CANCELLED';
}

export function summarizeTaxYear(
  txs: TaxYearTx[],
  invoices: TaxYearInvoice[] = [],
  opts: { taxYear: number; currency?: string; fiscalStartMonth?: number } = { taxYear: new Date().getUTCFullYear() },
): TaxYearSummary {
  const currency = opts.currency || 'USD';
  const fiscalStartMonth = opts.fiscalStartMonth || 1;
  const cats = new Map<string, CategoryBucket>();

  let cashIncome = 0;
  let cashExpense = 0;
  let reimbursementIn = 0;
  let projectOnlyIn = 0;
  let projectOnlyOut = 0;
  let forecastIncome = 0;
  let forecastExpense = 0;
  let executedCount = 0;

  for (const t of txs) {
    const amt = Number(t.amount) || 0;
    const scope = txScope(t.scope);
    const catName = (t.category || '').trim() || '(uncategorized)';
    if (!cats.has(catName)) cats.set(catName, { category: catName, income: 0, expense: 0, count: 0 });
    const bucket = cats.get(catName)!;

    if (!isExecuted(t.executionStatus)) {
      if (isIncome(t.type)) forecastIncome += amt;
      if (isExpense(t.type)) forecastExpense += amt;
      continue;
    }

    executedCount += 1;
    if (isIncome(t.type)) {
      bucket.income += amt;
      bucket.count += 1;
      if (hitsCash(scope)) cashIncome += amt;
      else projectOnlyIn += amt;
      if (String(t.origin || '').toUpperCase() === 'REIMBURSEMENT') reimbursementIn += amt;
    }
    if (isExpense(t.type)) {
      bucket.expense += amt;
      bucket.count += 1;
      if (hitsCash(scope)) cashExpense += amt;
      else projectOnlyOut += amt;
    }
  }

  let invoiceOutputTax = 0;
  let invoiceInputTax = 0;
  let invoiceReceivableTotal = 0;
  let invoicePayableTotal = 0;
  for (const inv of invoices) {
    if (!invoiceCounts(inv.status)) continue;
    const tax = Number(inv.taxAmount) || 0;
    const total = Number(inv.total) || 0;
    if (inv.type === 'RECEIVABLE') {
      invoiceOutputTax += tax;
      invoiceReceivableTotal += total;
    } else if (inv.type === 'PAYABLE') {
      invoiceInputTax += tax;
      invoicePayableTotal += total;
    }
  }

  const byCategory = [...cats.values()]
    .filter((c) => c.count > 0)
    .sort((a, b) => b.income + b.expense - (a.income + a.expense));

  return {
    currency,
    taxYear: opts.taxYear,
    fiscalStartMonth,
    cashIncome: round2(cashIncome),
    cashExpense: round2(cashExpense),
    cashResult: round2(cashIncome - cashExpense),
    reimbursementIn: round2(reimbursementIn),
    projectOnlyIn: round2(projectOnlyIn),
    projectOnlyOut: round2(projectOnlyOut),
    forecastIncome: round2(forecastIncome),
    forecastExpense: round2(forecastExpense),
    byCategory,
    invoiceOutputTax: round2(invoiceOutputTax),
    invoiceInputTax: round2(invoiceInputTax),
    invoiceReceivableTotal: round2(invoiceReceivableTotal),
    invoicePayableTotal: round2(invoicePayableTotal),
    executedCount,
  };
}

export function seedObligationState(pack: TaxCountryPack): Record<string, string> {
  const out: Record<string, string> = {};
  for (const o of pack.obligations) out[o.id] = 'pending';
  return out;
}

export function money(n: number, currency = 'USD', locale = 'en'): string {
  try {
    return new Intl.NumberFormat(locale === 'pt' ? 'pt-BR' : locale === 'es' ? 'es-UY' : 'en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(n || 0);
  } catch {
    return `${currency} ${(n || 0).toFixed(2)}`;
  }
}
