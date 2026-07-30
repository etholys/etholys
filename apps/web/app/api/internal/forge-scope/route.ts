export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { resolveForgeJwtScope } from '@/lib/forge/access-context';

/** Uso interno do middleware: âmbito FORGE do utilizador autenticado. */
export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const scope = await resolveForgeJwtScope(userId);
  return NextResponse.json(scope);
}
