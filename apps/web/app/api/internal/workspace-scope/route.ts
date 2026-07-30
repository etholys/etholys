export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { resolveWorkspaceJwtScope } from '@/lib/workspace-access-scope';

/** Middleware: modo full | function_only | none + sistemas. */
export async function GET(req: Request) {
  const token = await getToken({ req: req as any, secret: process.env.NEXTAUTH_SECRET });
  const userId = (token?.id as string) || (token?.sub as string);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const scope = await resolveWorkspaceJwtScope(userId);
  return NextResponse.json(scope);
}
