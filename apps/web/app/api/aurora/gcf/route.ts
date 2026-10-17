export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getUserCompanyIds } from '@/lib/tenant';
import { gcfWorkbookForEngagement } from '@/lib/aurora-territory-db';

export async function GET(req: NextRequest) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const url = new URL(req.url);
  const book = await gcfWorkbookForEngagement({
    tenantCompanyIds: tenant.companyIds,
    attendedCompanyId: String(url.searchParams.get('companyId') || '').trim(),
    engagementId: String(url.searchParams.get('engagementId') || '').trim(),
  });
  if (!book) return NextResponse.json({ error: 'Projeto não ligado a este contrato.' }, { status: 404 });
  const filename = `gcf-${book.name.replace(/[^\w\-]+/g, '_').slice(0, 40) || 'projeto'}.xlsx`;
  return new NextResponse(new Uint8Array(book.buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
