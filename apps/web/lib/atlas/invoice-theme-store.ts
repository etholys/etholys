import { prisma } from '@/lib/prisma';
import {
  RURAL_COMMERCE_INVOICE_THEME,
  defaultInvoiceThemeForCompany,
  isRuralCommerceCompany,
  parseInvoiceTheme,
  type InvoiceTheme,
} from '@/lib/atlas/invoice-theme';

export async function loadInvoiceTheme(companyId: string): Promise<InvoiceTheme> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      name: true,
      shortName: true,
      color: true,
      logo: true,
      ein: true,
      taxAddress: true,
      invoiceThemeJson: true,
      companyUsers: { select: { user: { select: { email: true } } } },
    },
  });
  if (!company) return defaultInvoiceThemeForCompany(null);

  if (company.invoiceThemeJson) {
    return parseInvoiceTheme(company.invoiceThemeJson, company);
  }

  const emails = company.companyUsers.map((cu) => cu.user.email);
  if (isRuralCommerceCompany({ name: company.name, shortName: company.shortName, emails })) {
    await prisma.company.update({
      where: { id: companyId },
      data: { invoiceThemeJson: RURAL_COMMERCE_INVOICE_THEME },
    });
    return RURAL_COMMERCE_INVOICE_THEME;
  }

  return defaultInvoiceThemeForCompany(company);
}

export async function saveInvoiceTheme(companyId: string, raw: unknown): Promise<InvoiceTheme> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true, color: true, logo: true, ein: true, taxAddress: true },
  });
  const theme = parseInvoiceTheme(raw, company);
  await prisma.company.update({
    where: { id: companyId },
    data: { invoiceThemeJson: theme },
  });
  return theme;
}
