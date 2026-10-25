export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { resolveWorkJwtScope } from '@/lib/work/folder-share';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const scope = await resolveWorkJwtScope(session.user.id);
  return NextResponse.json(scope);
}
