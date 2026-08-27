export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getUserCompanyIds } from '@/lib/tenant';
import { listSectorCatalog, listSectorGroups } from '@/lib/nexus-economic-sectors';

export async function GET() {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return NextResponse.json({
    groups: listSectorGroups(),
    sectors: listSectorCatalog(),
  });
}
