import { prisma } from '@/lib/prisma';
import { ensureInvoiceCatalog } from '@/lib/atlas/invoice-catalog';
import { allocateInvoiceNumbers, extractSeqFromNumber, nextSeqFromExisting } from '@/lib/atlas/invoice-numbering';
import { parseDateOnlyToUtc } from '@/lib/atlas/date-only';

export async function takeInvoiceNumbers(opts: {
  companyId: string;
  count: number;
  when?: Date | string | null;
  manualNumber?: string | null;
}): Promise<string[]> {
  const when = parseDateOnlyToUtc(opts.when) || new Date();
  const { numbering } = await ensureInvoiceCatalog(opts.companyId);
  if (opts.manualNumber && opts.count === 1) {
    const n = opts.manualNumber.trim();
    if (n) {
      const seq = extractSeqFromNumber(n, numbering, when);
      if (seq && seq >= numbering.nextSeq) {
        await prisma.company.update({
          where: { id: opts.companyId },
          data: { invoiceNumberingJson: { ...numbering, nextSeq: seq + 1 } },
        });
      }
      return [n];
    }
  }
  const existing = await prisma.invoice.findMany({
    where: { companyId: opts.companyId },
    select: { number: true },
  });
  const { numbers, nextCfg } = allocateInvoiceNumbers({
    cfg: numbering,
    existingNumbers: existing.map((i) => i.number),
    count: opts.count,
    when,
  });
  await prisma.company.update({
    where: { id: opts.companyId },
    data: { invoiceNumberingJson: nextCfg },
  });
  return numbers;
}

export function bumpNumberingIfManual(manual: string, existingNext: number, seqFromManual: number | null) {
  if (!seqFromManual) return existingNext;
  return Math.max(existingNext, seqFromManual + 1);
}

export { nextSeqFromExisting };
