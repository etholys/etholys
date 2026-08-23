export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getUserCompanyIds } from '@/lib/tenant';
import { resolveStudioCompanyId } from '@/lib/studio/access';
import {
  DOC_LINK_SYSTEMS,
  isDocLinkSystemKey,
  listDocLinkOptions,
} from '@/lib/document-links';

/** GET ?systemKey=NEXUS&companyId= */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const systemKeyRaw = (req.nextUrl.searchParams.get('systemKey') || '').toUpperCase();
  if (!isDocLinkSystemKey(systemKeyRaw)) {
    return NextResponse.json(
      { error: 'systemKey inválido', systems: DOC_LINK_SYSTEMS },
      { status: 400 },
    );
  }

  const tenant = await getUserCompanyIds();
  const companyIds = tenant?.companyIds || [];
  const requested = req.nextUrl.searchParams.get('companyId');
  const companyId =
    (await resolveStudioCompanyId(userId, requested)) ||
    (requested && companyIds.includes(requested) ? requested : companyIds[0]) ||
    '';

  if (!companyId) return NextResponse.json({ error: 'No company' }, { status: 400 });

  const entities = await listDocLinkOptions({
    systemKey: systemKeyRaw,
    companyId,
    companyIds: companyIds.length ? companyIds : [companyId],
  });

  return NextResponse.json({
    systemKey: systemKeyRaw,
    companyId,
    systems: DOC_LINK_SYSTEMS,
    entities,
  });
}
