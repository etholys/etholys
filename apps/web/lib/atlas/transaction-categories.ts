import { prisma } from '@/lib/prisma';

export function normalizeCategoryName(raw: unknown): string {
  return String(raw ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

export function uniqueCategoryPairs(
  items: Array<{ companyId?: string | null; category?: unknown }>,
): Array<{ companyId: string; name: string }> {
  const seen = new Set<string>();
  const out: Array<{ companyId: string; name: string }> = [];
  for (const item of items) {
    const companyId = String(item.companyId || '').trim();
    const name = normalizeCategoryName(item.category);
    if (!companyId || !name) continue;
    const key = `${companyId}\0${name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ companyId, name });
  }
  return out;
}

/** Cria ou reativa categorias no cadastro da empresa. Não funde com os defaults da Etholys. */
export async function ensureCompanyTransactionCategories(
  items: Array<{ companyId?: string | null; category?: unknown }>,
): Promise<number> {
  const pairs = uniqueCategoryPairs(items);
  for (const { companyId, name } of pairs) {
    await prisma.transactionCategory.upsert({
      where: { companyId_name: { companyId, name } },
      update: { isActive: true },
      create: { companyId, name },
    });
  }
  return pairs.length;
}
