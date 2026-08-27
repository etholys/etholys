export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { isSystemAdmin } from '@/lib/platform-access';
import { renewDueSubscriptions } from '@/lib/billing/renew';

/**
 * Renovação automática de subscrições e add-ons vencidos.
 * Header: Authorization: Bearer {ETHOLYS_BILLING_CRON_SECRET}
 * ou sessão de system admin.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.ETHOLYS_BILLING_CRON_SECRET?.trim() || process.env.FORGE_CRON_SECRET?.trim();
  const auth = req.headers.get('authorization');
  const bearerOk = Boolean(secret && auth === `Bearer ${secret}`);

  if (!bearerOk) {
    const session = await getServerSession(authOptions);
    if (!isSystemAdmin(session?.user?.email)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
  }

  const result = await renewDueSubscriptions();
  return NextResponse.json({ ok: true, ...result });
}
