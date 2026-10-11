import { prisma } from '@/lib/prisma';
import { isRuralCommerceCompany } from '@/lib/atlas/invoice-theme';
import { DEFAULT_INVOICE_NUMBERING, RURAL_COMMERCE_INVOICE_NUMBERING, parseInvoiceNumbering } from '@/lib/atlas/invoice-numbering';

const RC_BANK = {
  label: 'Mercury USD',
  bankName: 'Choice Financial Group (Mercury)',
  bankAddress: '4501 23rd Avenue S, Fargo, ND 58104',
  accountLabel: 'IBAN / Account Number',
  accountNumber: '2026990037610',
  routingLabel: 'ABA / Routing Number',
  routingNumber: '091311229',
  currency: 'USD',
  isDefault: true,
};

const RC_SIGN = {
  name: 'Tiago Rezende',
  title: 'Director Ejecutivo',
  companyLine: 'Rural Commerce',
  imageUrl: null as string | null,
  isDefault: true,
};

export async function ensureInvoiceCatalog(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      name: true,
      shortName: true,
      invoiceNumberingJson: true,
      companyUsers: { select: { user: { select: { email: true } } } },
    },
  });
  if (!company) return { numbering: DEFAULT_INVOICE_NUMBERING, seeded: false };
  const emails = company.companyUsers.map((cu) => cu.user.email);
  const rc = isRuralCommerceCompany({ name: company.name, shortName: company.shortName, emails });
  const fallback = rc ? RURAL_COMMERCE_INVOICE_NUMBERING : DEFAULT_INVOICE_NUMBERING;
  let numbering = parseInvoiceNumbering(company.invoiceNumberingJson, fallback);

  if (!company.invoiceNumberingJson && rc) {
    await prisma.company.update({
      where: { id: companyId },
      data: { invoiceNumberingJson: numbering },
    });
  }

  const [banks, signs] = await Promise.all([
    prisma.companyBankAccount.count({ where: { companyId, isActive: true } }),
    prisma.companyInvoiceSignature.count({ where: { companyId, isActive: true } }),
  ]);
  if (rc && banks === 0) {
    await prisma.companyBankAccount.create({ data: { companyId, ...RC_BANK } });
  }
  if (rc && signs === 0) {
    await prisma.companyInvoiceSignature.create({ data: { companyId, ...RC_SIGN } });
  }
  return { numbering, seeded: rc };
}
