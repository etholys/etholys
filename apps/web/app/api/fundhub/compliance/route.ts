export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveOpportunityCompanyId } from '@/lib/opportunity/resolve-company';

/** Checklist de compliance da empresa. O ecrã usa isto quando o browser ainda não tem cópia. */
export async function GET(req: NextRequest) {
  const ctx = await resolveOpportunityCompanyId(req.nextUrl.searchParams.get('companyId'));
  if (!ctx) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const rows = await prisma.fundhubComplianceChecklist.findMany({
    where: { companyId: ctx.companyId, fundId: null },
  });

  const checklists = rows.map((row) => {
    let items: Record<string, boolean> = {};
    try {
      const parsed = JSON.parse(row.itemsJson) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
          items[key] = value === true;
        }
      }
    } catch {
      items = {};
    }
    return { id: row.checklistId, items, notes: row.notes };
  });

  const notes = rows.find((r) => r.notes?.trim())?.notes ?? '';
  return NextResponse.json({ checklists, notes });
}
