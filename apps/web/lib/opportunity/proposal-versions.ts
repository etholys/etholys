/** Snapshot / restore helpers for ProposalVersion (R3). Pure — sem DB. */

export type ProposalVersionSnapshot = {
  versionNum: number;
  content: string;
  createdAt: string;
  createdBy?: string | null;
  label?: string;
};

export function nextVersionNum(existingNums: number[]): number {
  if (!existingNums.length) return 1;
  return Math.max(...existingNums) + 1;
}

/** Evita gravar versão idêntica à última. */
export function shouldSaveVersion(opts: {
  previousContent?: string | null;
  nextContent: string;
  minDeltaChars?: number;
}): boolean {
  const next = opts.nextContent.trim();
  if (next.length < 40) return false;
  const prev = (opts.previousContent ?? '').trim();
  if (!prev) return true;
  if (prev === next) return false;
  const minDelta = opts.minDeltaChars ?? 80;
  if (Math.abs(next.length - prev.length) >= minDelta) return true;
  // Conteúdo mudou mas tamanho similar — ainda assim versionar se != 
  return next !== prev;
}

export function versionLabel(num: number, locale: string = 'es'): string {
  if (locale === 'pt') return `Versão ${num}`;
  if (locale === 'en') return `Version ${num}`;
  return `Versión ${num}`;
}
