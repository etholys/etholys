/** International tax workspace: year books + country obligation packs. Not official e-filing. */

export type {
  TaxCountryPack,
  TaxObligation,
  TaxObligationCadence,
  TaxRegion,
} from './tax-country-packs';
export {
  COUNTRY_NAME_ALIASES,
  GENERIC_PACK,
  TAX_COUNTRY_PACKS,
  TAX_REGION_LABELS,
  taxCountriesByRegion,
} from './tax-country-packs';

import {
  COUNTRY_NAME_ALIASES,
  GENERIC_PACK,
  TAX_COUNTRY_PACKS,
  type TaxCountryPack,
} from './tax-country-packs';

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

function foldName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/['’]/g, '');
}

const FOLDED_ALIASES: Record<string, string> = Object.fromEntries(
  Object.entries(COUNTRY_NAME_ALIASES).map(([k, v]) => [foldName(k), v]),
);

export function normalizeCountryCode(raw?: string | null): string {
  const t = foldName(String(raw || '').trim());
  if (!t) return '';
  if (FOLDED_ALIASES[t]) return FOLDED_ALIASES[t];
  if (/^[A-Z]{2}$/.test(t)) return t;
  const byName = TAX_COUNTRY_PACKS.find(
    (p) => foldName(p.nameEn) === t || foldName(p.nameEs) === t || foldName(p.namePt) === t,
  );
  return byName?.code || (t.length >= 2 ? t.slice(0, 2) : '');
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
  for (const ob of pack.obligations) out[ob.id] = 'pending';
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
