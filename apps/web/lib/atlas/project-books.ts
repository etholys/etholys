/** Three books for a project: donor report (SIEP), company cash (ATLAS), internal-only costs. */

export type ProjectBookTx = {
  id?: string;
  projectId?: string | null;
  project?: { id: string; name: string } | null;
  type: string;
  amount: number;
  currency?: string | null;
  scope?: string | null;
  origin?: string | null;
  executionStatus?: string | null;
};

export type ProjectBookRow = {
  projectId: string;
  projectName: string;
  currency: string;
  /** SIEP / informe: PROJECT_ONLY + SHARED (never COMPANY_ONLY). */
  reportedIn: number;
  reportedOut: number;
  /** Company cash: SHARED + COMPANY_ONLY (never PROJECT_ONLY). */
  companyIn: number;
  companyOut: number;
  /** Paid by the company and NOT on the donor report. */
  internalOut: number;
  /** Reimbursement into the company project pocket (not SIEP). */
  reimbursedIn: number;
  /** Hits both informe and company cash. */
  sharedOut: number;
  /** Informe only (e.g. billed 560 vs paid 480). */
  imputedOut: number;
  /** companyIn − companyOut. >0 leftover, 0 even, <0 still uncovered. */
  companyResult: number;
};

export type ProjectBookStatus = 'margin' | 'even' | 'loss';

export function txScope(tx: Pick<ProjectBookTx, 'scope'>): string {
  return tx.scope && tx.scope.trim() ? tx.scope : 'SHARED';
}

export function isReimbursementTx(tx: Pick<ProjectBookTx, 'origin'>): boolean {
  return String(tx.origin || '').toUpperCase() === 'REIMBURSEMENT';
}

export function isProjectIncome(type: string): boolean {
  return type === 'INCOME' || type === 'TRANSFER_IN';
}

export function isProjectExpense(type: string): boolean {
  return type === 'EXPENSE' || type === 'TRANSFER_OUT';
}

export function isExecutedTx(tx: Pick<ProjectBookTx, 'executionStatus'>): boolean {
  return tx.executionStatus !== 'FORECAST';
}

export function hitsReport(scope: string): boolean {
  return scope !== 'COMPANY_ONLY';
}

export function hitsCompanyCash(scope: string): boolean {
  return scope !== 'PROJECT_ONLY';
}

export function companyResultStatus(result: number, epsilon = 0.005): ProjectBookStatus {
  if (result > epsilon) return 'margin';
  if (result < -epsilon) return 'loss';
  return 'even';
}

function emptyRow(projectId: string, projectName: string, currency: string): ProjectBookRow {
  return {
    projectId,
    projectName,
    currency,
    reportedIn: 0,
    reportedOut: 0,
    companyIn: 0,
    companyOut: 0,
    internalOut: 0,
    reimbursedIn: 0,
    sharedOut: 0,
    imputedOut: 0,
    companyResult: 0,
  };
}

export function buildProjectBooks(
  transactions: ProjectBookTx[],
  projects: { id: string; name: string }[] = [],
): ProjectBookRow[] {
  const names = new Map(projects.map((p) => [p.id, p.name]));
  const map = new Map<string, ProjectBookRow>();

  const key = (projectId: string, currency: string) => `${projectId}::${currency}`;

  const ensure = (projectId: string, currency: string, fallbackName?: string) => {
    const k = key(projectId, currency);
    let row = map.get(k);
    if (!row) {
      row = emptyRow(projectId, names.get(projectId) || fallbackName || projectId, currency);
      map.set(k, row);
    }
    return row;
  };

  for (const tx of transactions) {
    const projectId = tx.projectId || tx.project?.id;
    if (!projectId) continue;
    if (!isExecutedTx(tx)) continue;
    const currency = tx.currency || 'USD';
    const name = tx.project?.name;
    const row = ensure(projectId, currency, name);
    if (name && row.projectName === projectId) row.projectName = name;
    const scope = txScope(tx);
    const amt = Number(tx.amount) || 0;

    if (isProjectIncome(tx.type)) {
      if (hitsReport(scope)) row.reportedIn += amt;
      if (hitsCompanyCash(scope)) {
        row.companyIn += amt;
        if (isReimbursementTx(tx)) row.reimbursedIn += amt;
      }
    } else if (isProjectExpense(tx.type)) {
      if (hitsReport(scope)) row.reportedOut += amt;
      if (hitsCompanyCash(scope)) row.companyOut += amt;
      if (scope === 'COMPANY_ONLY') row.internalOut += amt;
      if (scope === 'SHARED') row.sharedOut += amt;
      if (scope === 'PROJECT_ONLY') row.imputedOut += amt;
    }
  }

  const rows = [...map.values()].map((row) => ({
    ...row,
    companyResult: Math.round((row.companyIn - row.companyOut) * 100) / 100,
    reportedIn: Math.round(row.reportedIn * 100) / 100,
    reportedOut: Math.round(row.reportedOut * 100) / 100,
    companyIn: Math.round(row.companyIn * 100) / 100,
    companyOut: Math.round(row.companyOut * 100) / 100,
    internalOut: Math.round(row.internalOut * 100) / 100,
    reimbursedIn: Math.round(row.reimbursedIn * 100) / 100,
    sharedOut: Math.round(row.sharedOut * 100) / 100,
    imputedOut: Math.round(row.imputedOut * 100) / 100,
  }));

  return rows.sort((a, b) => {
    const byName = a.projectName.localeCompare(b.projectName, 'es');
    if (byName !== 0) return byName;
    return a.currency.localeCompare(b.currency);
  });
}
