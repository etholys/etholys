import type { EcoLedgerState, LedgerEntry, LedgerEntryType } from '@/lib/forge/expedicion-v2/types';
import { GREEN_LOAN_AMOUNT, GREEN_LOAN_DEBT, INITIAL_ECO_BALANCE } from '@/lib/forge/expedicion-v2/types';

function uid() {
  return `le-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createInitialLedger(): EcoLedgerState {
  const entry: LedgerEntry = {
    id: uid(),
    seq: 1,
    description: 'Capital Inicial',
    type: 'E',
    amount: INITIAL_ECO_BALANCE,
    balance: INITIAL_ECO_BALANCE,
    at: new Date().toISOString(),
    meta: { kind: 'initial' },
  };
  return {
    entries: [entry],
    balance: INITIAL_ECO_BALANCE,
    greenLoanTaken: false,
    greenLoanDebt: 0,
  };
}

export function appendLedgerEntry(
  ledger: EcoLedgerState,
  description: string,
  type: LedgerEntryType,
  amount: number,
  meta?: Record<string, unknown>
): EcoLedgerState {
  const signed = type === 'S' ? -Math.abs(amount) : Math.abs(amount);
  const balance = ledger.balance + signed;
  const entry: LedgerEntry = {
    id: uid(),
    seq: ledger.entries.length + 1,
    description,
    type,
    amount: Math.abs(amount),
    balance,
    at: new Date().toISOString(),
    meta,
  };
  return {
    ...ledger,
    entries: [...ledger.entries, entry],
    balance,
  };
}

export function takeGreenLoan(ledger: EcoLedgerState): EcoLedgerState {
  if (ledger.greenLoanTaken) return ledger;
  let next = appendLedgerEntry(ledger, 'Préstamo Crédito Verde', 'E', GREEN_LOAN_AMOUNT, {
    kind: 'green_loan',
  });
  return {
    ...next,
    greenLoanTaken: true,
    greenLoanDebt: GREEN_LOAN_DEBT,
  };
}

export function settleGreenLoan(ledger: EcoLedgerState): EcoLedgerState {
  if (!ledger.greenLoanTaken || ledger.greenLoanDebt <= 0) return ledger;
  const debt = ledger.greenLoanDebt;
  let next = appendLedgerEntry(ledger, 'Liquidación préstamo (+10% interés)', 'S', debt, {
    kind: 'green_loan_settle',
  });
  return { ...next, greenLoanDebt: 0 };
}

export function parseLedger(raw: unknown): EcoLedgerState {
  if (!raw || typeof raw !== 'object') return createInitialLedger();
  const o = raw as Partial<EcoLedgerState>;
  if (!Array.isArray(o.entries) || o.entries.length === 0) return createInitialLedger();
  return {
    entries: o.entries as LedgerEntry[],
    balance: typeof o.balance === 'number' ? o.balance : INITIAL_ECO_BALANCE,
    greenLoanTaken: Boolean(o.greenLoanTaken),
    greenLoanDebt: typeof o.greenLoanDebt === 'number' ? o.greenLoanDebt : 0,
  };
}
